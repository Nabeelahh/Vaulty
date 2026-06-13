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
const RETRY_DELAYS_MINUTES = [5, 30, 120]; // exponential backoff

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
    // Check for duplicate
    const existing = await this.db('payment_reconciliation')
      .where('payment_reference', dto.payment_reference)
      .first();

    if (existing) {
      this.logger.warn('Duplicate reconciliation attempt', { payment_reference: dto.payment_reference });
      return existing;
    }

    const [record] = await this.db('payment_reconciliation')
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

    this.logger.info('Reconciliation record created', { id: record.id });
    return record;
  }

  // ─── Process Single ───────────────────────────────────────────────────────

  async processReconciliation(reconciliationId: string): Promise<PaymentReconciliation> {
    const reconciliation = await this.db('payment_reconciliation')
      .where('id', reconciliationId)
      .first();

    if (!reconciliation) {
      throw new Error(`Reconciliation not found: ${reconciliationId}`);
    }

    if (reconciliation.status === ReconciliationStatus.MATCHED) {
      return reconciliation;
    }

    try {
      return await this.matchingService.matchPaymentToEscrow(reconciliation);
    } catch (error) {
      this.logger.error('Reconciliation processing failed', { reconciliationId, error });

      await this.db('payment_reconciliation').where('id', reconciliationId).update({
        status: ReconciliationStatus.FAILED,
        matching_metadata: JSON.stringify({ error: (error as Error).message }),
        updated_at: this.db.fn.now(),
      });

      throw error;
    }
  }

  // ─── Batch Processing ─────────────────────────────────────────────────────

  async runBatchReconciliation(): Promise<ReconciliationRun> {
    const run = await this.startRun();
    this.logger.info('Starting batch reconciliation run', { run_id: run.id });

    const stats = {
      matched: 0,
      unmatched: 0,
      discrepancy: 0,
      failed: 0,
      total_amount: 0,
      matched_amount: 0,
    };

    try {
      // Fetch all pending reconciliations
      const pendingRecords = await this.db('payment_reconciliation')
        .whereIn('status', [ReconciliationStatus.PENDING, ReconciliationStatus.UNMATCHED])
        .where((qb) =>
          qb.whereNull('next_retry_at').orWhere('next_retry_at', '<=', new Date())
        )
        .orderBy('created_at', 'asc');

      this.logger.info(`Processing ${pendingRecords.length} reconciliations`);

      for (const record of pendingRecords) {
        stats.total_amount += Number(record.payment_amount);

        try {
          const result = await this.matchingService.matchPaymentToEscrow(record);

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
          this.logger.error('Failed to process reconciliation in batch', {
            id: record.id,
            error: err,
          });
        }
      }

      return this.completeRun(run.id, ReconciliationRunStatus.COMPLETED, {
        total_payments: pendingRecords.length,
        ...stats,
      });
    } catch (error) {
      this.logger.error('Batch reconciliation run failed', { run_id: run.id, error });
      return this.completeRun(run.id, ReconciliationRunStatus.FAILED, stats, error as Error);
    }
  }

  // ─── Retry Logic ──────────────────────────────────────────────────────────

  async retryFailedReconciliations(): Promise<void> {
    const eligibleForRetry = await this.db('payment_reconciliation')
      .whereIn('status', [ReconciliationStatus.FAILED, ReconciliationStatus.UNMATCHED])
      .where('retry_count', '<', MAX_RETRY_ATTEMPTS)
      .where((qb) =>
        qb.whereNull('next_retry_at').orWhere('next_retry_at', '<=', new Date())
      );

    this.logger.info(`Retrying ${eligibleForRetry.length} reconciliations`);

    for (const record of eligibleForRetry) {
      await this.scheduleRetry(record);
    }
  }

  private async scheduleRetry(record: PaymentReconciliation): Promise<void> {
    const nextRetryDelay = RETRY_DELAYS_MINUTES[record.retry_count] ?? 120;
    const nextRetryAt = new Date(Date.now() + nextRetryDelay * 60 * 1000);

    await this.db('payment_reconciliation').where('id', record.id).update({
      retry_count: record.retry_count + 1,
      last_retry_at: new Date(),
      next_retry_at: nextRetryAt,
      status: ReconciliationStatus.PENDING,
      updated_at: this.db.fn.now(),
    });

    this.logger.info('Scheduled reconciliation retry', {
      id: record.id,
      retry_count: record.retry_count + 1,
      next_retry_at: nextRetryAt,
    });

    try {
      await this.processReconciliation(record.id);
    } catch (err) {
      this.logger.error('Retry attempt failed', { id: record.id, error: err });
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
      const details = r.discrepancy_details;
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
    const total_amount = records.reduce((s, r) => s + Number(r.payment_amount), 0);
    const matched = records.filter((r) => r.status === ReconciliationStatus.MATCHED).length;
    const unmatched_records = records.filter((r) => r.status === ReconciliationStatus.UNMATCHED);
    const discrepancy_records = records.filter((r) => r.status === ReconciliationStatus.DISCREPANCY);

    const discrepancies = discrepancy_records.map((r) => ({
      reconciliation_id: r.id,
      payment_reference: r.payment_reference,
      payment_amount: Number(r.payment_amount),
      expected_amount: Number(r.expected_amount) || 0,
      difference: Number(r.discrepancy_amount) || 0,
      discrepancy_type: r.discrepancy_details?.type,
      provider: r.mobile_money_provider,
      created_at: r.created_at,
    }));

    // Get last run ID for this period
    const lastRun = await this.db('reconciliation_runs')
      .whereBetween('started_at', [from, to])
      .orderBy('started_at', 'desc')
      .first();

    return {
      run_id: lastRun?.id ?? 'N/A',
      period: { from, to },
      summary: {
        total_payments,
        total_amount,
        matched,
        unmatched: unmatched_records.length,
        discrepancies: discrepancy_records.length,
        match_rate: total_payments > 0 ? (matched / total_payments) * 100 : 0,
      },
      discrepancies,
      unmatched_payments: unmatched_records,
      generated_at: new Date(),
    };
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  async getReconciliations(filter: ReconciliationFilterDto): Promise<{
    data: PaymentReconciliation[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const offset = (page - 1) * limit;

    let query = this.db('payment_reconciliation');

    if (filter.status) query = query.where('status', filter.status);
    if (filter.from_date) query = query.where('created_at', '>=', filter.from_date);
    if (filter.to_date) query = query.where('created_at', '<=', filter.to_date);
    if (filter.provider) query = query.where('mobile_money_provider', filter.provider);

    const [{ count }] = await query.clone().count('* as count');
    const data = await query.orderBy('created_at', 'desc').limit(limit).offset(offset);

    return { data, total: Number(count), page, limit };
  }

  async getReconciliationById(id: string): Promise<PaymentReconciliation | null> {
    return this.db('payment_reconciliation').where('id', id).first() ?? null;
  }

  async resolveDiscrepancy(dto: ResolveDiscrepancyDto): Promise<PaymentReconciliation> {
    return this.matchingService.resolveDiscrepancy(dto);
  }

  // ─── Run Tracking ─────────────────────────────────────────────────────────

  private async startRun(): Promise<ReconciliationRun> {
    const [run] = await this.db('reconciliation_runs')
      .insert({ status: ReconciliationRunStatus.RUNNING })
      .returning('*');
    return run;
  }

  private async completeRun(
    runId: string,
    status: ReconciliationRunStatus,
    stats: {
      total_payments?: number;
      matched?: number;
      unmatched?: number;
      discrepancy?: number;
      failed?: number;
      total_amount?: number;
      matched_amount?: number;
    },
    error?: Error
  ): Promise<ReconciliationRun> {
    const [run] = await this.db('reconciliation_runs')
      .where('id', runId)
      .update({
        status,
        total_payments: stats.total_payments ?? 0,
        matched_count: stats.matched ?? 0,
        unmatched_count: stats.unmatched ?? 0,
        discrepancy_count: stats.discrepancy ?? 0,
        failed_count: stats.failed ?? 0,
        total_amount_processed: stats.total_amount ?? 0,
        total_amount_matched: stats.matched_amount ?? 0,
        completed_at: this.db.fn.now(),
        error_details: error ? JSON.stringify({ message: error.message, stack: error.stack }) : null,
        updated_at: this.db.fn.now(),
      })
      .returning('*');
    return run;
  }
}