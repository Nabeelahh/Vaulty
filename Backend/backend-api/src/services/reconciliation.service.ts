import { Knex } from 'knex';
import { Logger } from '../utils/logger';
import { ReconciliationMatchingService } from './reconciliation.matching.service';
import {
  CreateReconciliationDto,
  PaymentReconciliation,
  ReconciliationFilterDto,
  ReconciliationReport,
  ReconciliationRun,
  ReconciliationRunStatus,
  ReconciliationStatus,
  ResolveDiscrepancyDto,
} from '../models/reconciliation.model';

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS_MINUTES = [5, 30, 120]; 
const BATCH_CHUNK_SIZE = 100;

export class ReconciliationService {
  private readonly matchingService: ReconciliationMatchingService;

  constructor(
    private readonly db: Knex,
    private readonly logger: Logger
  ) {
    this.matchingService = new ReconciliationMatchingService(db, logger);
  }

  // ─── Create ───────────────────────────────────────────────────────────────

  async createReconciliation(dto: CreateReconciliationDto): Promise<PaymentReconciliation> {
    return this.db.transaction(async (trx) => {
      const existing = await trx('payment_reconciliation')
        .where('payment_reference', dto.payment_reference)
        .select('id', 'status')
        .first();

      if (existing) {
        this.logger.warn('Duplicate reconciliation attempt ignored', { 
          payment_reference: dto.payment_reference,
          existing_id: existing.id 
        });
        return existing;
      }

      const [record] = await trx('payment_reconciliation')
        .insert({
          mobile_money_payment_id: dto.mobile_money_payment_id,
          payment_amount: dto.payment_amount,
          payment_currency: dto.payment_currency,
          payment_reference: dto.payment_reference,
          mobile_money_provider: dto.mobile_money_provider,
          mobile_money_number: dto.mobile_money_number,
          transaction_id: dto.transaction_id,
          status: ReconciliationStatus.PENDING,
          retry_count: 0,
        })
        .returning('*');

      this.logger.info('Reconciliation record created successfully', { id: record.id });
      return record;
    });
  }

  // ─── Process Single ───────────────────────────────────────────────────────

  async processReconciliation(reconciliationId: string, externalTrx?: Knex.Transaction): Promise<PaymentReconciliation> {
    const trx = externalTrx || await this.db.transaction();

    try {
      const reconciliation = await trx('payment_reconciliation')
        .where('id', reconciliationId)
        .forUpdate() // Row-level locks prevent dual processing systems from colliding
        .first();

      if (!reconciliation) {
        throw new Error(`Reconciliation not found: ${reconciliationId}`);
      }

      if (reconciliation.status === ReconciliationStatus.MATCHED) {
        if (!externalTrx) await trx.commit();
        return reconciliation;
      }

      const result = await this.matchingService.matchPaymentToEscrow(reconciliation, trx);
      
      if (!externalTrx) await trx.commit();
      return result;
    } catch (error) {
      if (!externalTrx) await trx.rollback();
      
      this.logger.error('Reconciliation processing failed', { reconciliationId, error });
      
      // Persist failure trace in an independent database block
      await this.db('payment_reconciliation')
        .where('id', reconciliationId)
        .update({
          status: ReconciliationStatus.FAILED,
          matching_metadata: JSON.stringify({ 
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
          }),
          updated_at: this.db.fn.now(),
        });

      throw error;
    }
  }

  // ─── Batch Processing ─────────────────────────────────────────────────────

  async runBatchReconciliation(): Promise<ReconciliationRun> {
    const run = await this.startRun();
    this.logger.info('Starting memory-safe batch reconciliation run', { run_id: run.id });

    const stats = {
      matched: 0,
      unmatched: 0,
      discrepancy: 0,
      failed: 0,
      total_amount: 0,
      matched_amount: 0,
    };

    try {
      const baseQuery = this.db('payment_reconciliation')
        .whereIn('status', [ReconciliationStatus.PENDING, ReconciliationStatus.UNMATCHED])
        .where((qb) =>
          qb.whereNull('next_retry_at').orWhere('next_retry_at', '<=', this.db.fn.now())
        )
        .orderBy('created_at', 'asc');

      // Process in steady streaming chunks rather than loading all records into Node.js heap space memory
      await baseQuery.chunk(BATCH_CHUNK_SIZE, async (records) => {
        for (const record of records) {
          stats.total_amount += Number(record.payment_amount);

          try {
            // Processing happens in scoped transactional environments per entity
            const result = await this.processReconciliation(record.id);

            if (result.status === ReconciliationStatus.MATCHED) {
              stats.matched++;
              stats.matched_amount += Number(result.payment_amount);
            } else if (result.status === ReconciliationStatus.DISCREPANCY) {
              stats.discrepancy++;
            } else {
              stats.unmatched++;
            }
          } catch (err) {
            stats.failed++;
            this.logger.error('Failed processing specific item during batch context', {
              id: record.id,
              error: err instanceof Error ? err.message : err,
            });
          }
        }
      });

      return await this.completeRun(run.id, ReconciliationRunStatus.COMPLETED, {
        total_payments: stats.matched + stats.unmatched + stats.discrepancy + stats.failed,
        ...stats,
      });
    } catch (error) {
      this.logger.error('Critical breakdown under batch processing block', { run_id: run.id, error });
      return await this.completeRun(run.id, ReconciliationRunStatus.FAILED, stats, error instanceof Error ? error : new Error(String(error)));
    }
  }

  // ─── Retry Logic ──────────────────────────────────────────────────────────

  async retryFailedReconciliations(): Promise<void> {
    const eligibleForRetry = await this.db('payment_reconciliation')
      .whereIn('status', [ReconciliationStatus.FAILED, ReconciliationStatus.UNMATCHED])
      .where('retry_count', '<', MAX_RETRY_ATTEMPTS)
      .where((qb) =>
        qb.whereNull('next_retry_at').orWhere('next_retry_at', '<=', this.db.fn.now())
      )
      .select('id', 'retry_count');

    this.logger.info(`Retrying ${eligibleForRetry.length} failing payment records`);

    // Concurrent execution safe boundary allocation limit
    const poolLimit = 5;
    const chunks = [];
    for (let i = 0; i < eligibleForRetry.length; i += poolLimit) {
      chunks.push(eligibleForRetry.slice(i, i + poolLimit));
    }

    for (const chunk of chunks) {
      await Promise.all(chunk.map(record => this.scheduleRetry(record)));
    }
  }

  private async scheduleRetry(record: Pick<PaymentReconciliation, 'id' | 'retry_count'>): Promise<void> {
    const nextRetryDelay = RETRY_DELAYS_MINUTES[record.retry_count] ?? 120;
    const nextRetryAt = new Date(Date.now() + nextRetryDelay * 60 * 1000);

    await this.db('payment_reconciliation')
      .where('id', record.id)
      .update({
        retry_count: record.retry_count + 1,
        last_retry_at: this.db.fn.now(),
        next_retry_at: nextRetryAt,
        status: ReconciliationStatus.PENDING,
        updated_at: this.db.fn.now(),
      });

    try {
      await this.processReconciliation(record.id);
    } catch (err) {
      this.logger.error('Asynchronous retried processing logic rejected execution path', { 
        id: record.id, 
        error: err instanceof Error ? err.message : err 
      });
    }
  }

  // ─── Discrepancy Detection ────────────────────────────────────────────────

  async detectDiscrepancies(): Promise<PaymentReconciliation[]> {
    return this.db('payment_reconciliation')
      .where('status', ReconciliationStatus.DISCREPANCY)
      .orderBy('created_at', 'desc');
  }

  async getDiscrepancySummary(): Promise<{
    total: number;
    total_amount: number;
    by_type: Record<string, number>;
  }> {
    const records = await this.db('payment_reconciliation')
      .where('status', ReconciliationStatus.DISCREPANCY)
      .select('discrepancy_details', 'discrepancy_amount');

    const byType: Record<string, number> = {};
    let totalAmount = 0;

    for (const r of records) {
      totalAmount += Math.abs(Number(r.discrepancy_amount) || 0);
      
      // Safe parsing normalization if the engine stores JSON types natively as string objects
      const details = typeof r.discrepancy_details === 'string' 
        ? JSON.parse(r.discrepancy_details) 
        : r.discrepancy_details;

      if (details?.type) {
        byType[details.type] = (byType[details.type] || 0) + 1;
      }
    }

    return { total: records.length, total_amount: totalAmount, by_type: byType };
  }

  // ─── Reporting ────────────────────────────────────────────────────────────

  async generateReport(from: Date, to: Date): Promise<ReconciliationReport> {
    const records = await this.db('payment_reconciliation')
      .whereBetween('created_at', [from, to]);

    const total_payments = records.length;
    let total_amount = 0;
    let matched = 0;
    
    const unmatched_records: PaymentReconciliation[] = [];
    const discrepancy_records: PaymentReconciliation[] = [];

    for (const r of records) {
      total_amount += Number(r.payment_amount) || 0;
      if (r.status === ReconciliationStatus.MATCHED) {
        matched++;
      } else if (r.status === ReconciliationStatus.UNMATCHED) {
        unmatched_records.push(r);
      } else if (r.status === ReconciliationStatus.DISCREPANCY) {
        discrepancy_records.push(r);
      }
    }

    const discrepancies = discrepancy_records.map((r) => {
      const details = typeof r.discrepancy_details === 'string' 
        ? JSON.parse(r.discrepancy_details) 
        : r.discrepancy_details;

      return {
        reconciliation_id: r.id,
        payment_reference: r.payment_reference,
        payment_amount: Number(r.payment_amount),
        expected_amount: Number(r.expected_amount) || 0,
        difference: Number(r.discrepancy_amount) || 0,
        discrepancy_type: details?.type || 'UNKNOWN',
        provider: r.mobile_money_provider,
        created_at: r.created_at,
      };
    });

    const lastRun = await this.db('reconciliation_runs')
      .whereBetween('started_at', [from, to])
      .orderBy