import { Knex } from 'knex';
import { Logger } from '../utils/logger';
import {

  DiscrepancyDetails,
  DiscrepancyType,
  EscrowRepayment,
  PaymentReconciliation,
  ReconciliationStatus,
  ResolveDiscrepancyDto,
} from '../models/reconciliation.model';

const AMOUNT_TOLERANCE = 0.01; // 1 cent tolerance for floating point

export class ReconciliationMatchingService {
  constructor(
    private readonly db: Knex,
    private readonly logger: Logger
  ) {}

  /**
   * Attempts to match a mobile money payment to an escrow repayment.
   * Returns the updated reconciliation record.
   */
  async matchPaymentToEscrow(
    reconciliation: PaymentReconciliation
  ): Promise<PaymentReconciliation> {
    this.logger.info('Attempting to match payment to escrow', {
      reconciliation_id: reconciliation.id,
      payment_reference: reconciliation.payment_reference,
    });

    // 1. Find candidate escrow repayments
    const candidates = await this.findCandidateEscrowRepayments(reconciliation);

    if (candidates.length === 0) {
      this.logger.warn('No candidate escrow repayments found', {
        reconciliation_id: reconciliation.id,
      });
      return this.updateStatus(reconciliation.id, ReconciliationStatus.UNMATCHED, {
        matching_metadata: { reason: 'no_candidates_found' },
      });
    }

    // 2. Score and rank candidates
    const ranked = this.rankCandidates(reconciliation, candidates);
    const best = ranked[0];

    // 3. Check for exact reference match (highest confidence)
    const referenceMatch = candidates.find(
      (c) => c.reference === reconciliation.payment_reference
    );
    if (referenceMatch) {
      return this.processMatch(reconciliation, referenceMatch, 'reference_match');
    }

    // 4. Use best-scored candidate if above threshold
    if (best.score >= 0.8) {
      return this.processMatch(reconciliation, best.repayment, 'fuzzy_match', best.score);
    }

    // 5. No confident match found
    return this.updateStatus(reconciliation.id, ReconciliationStatus.UNMATCHED, {
      matching_metadata: {
        reason: 'no_confident_match',
        best_score: best.score,
        candidates_evaluated: candidates.length,
      },
    });
  }

  private async findCandidateEscrowRepayments(
    reconciliation: PaymentReconciliation
  ): Promise<EscrowRepayment[]> {
    // Look for unmatched escrow repayments within a 5% amount tolerance and recent timeframe
    const amountMin = reconciliation.payment_amount * 0.95;
    const amountMax = reconciliation.payment_amount * 1.05;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.db('escrow_repayments')
      .where('status', 'pending')
      .whereNull('payment_id')
      .where('currency', reconciliation.payment_currency)
      .whereBetween('amount', [amountMin, amountMax])
      .where('created_at', '>=', thirtyDaysAgo)
      .orderBy('created_at', 'desc')
      .limit(10);
  }

  private rankCandidates(
    reconciliation: PaymentReconciliation,
    candidates: EscrowRepayment[]
  ): Array<{ repayment: EscrowRepayment; score: number }> {
    return candidates
      .map((candidate) => ({
        repayment: candidate,
        score: this.calculateMatchScore(reconciliation, candidate),
      }))
      .sort((a, b) => b.score - a.score);
  }

  private calculateMatchScore(
    reconciliation: PaymentReconciliation,
    candidate: EscrowRepayment
  ): number {
    let score = 0;

    // Amount match (weight: 0.5)
    const amountDiff = Math.abs(reconciliation.payment_amount - candidate.amount);
    if (amountDiff <= AMOUNT_TOLERANCE) {
      score += 0.5;
    } else if (amountDiff / candidate.amount <= 0.01) {
      score += 0.4; // within 1%
    } else if (amountDiff / candidate.amount <= 0.05) {
      score += 0.2; // within 5%
    }

    // Reference similarity (weight: 0.3)
    const refSimilarity = this.stringSimilarity(
      reconciliation.payment_reference,
      candidate.reference
    );
    score += refSimilarity * 0.3;

    // Recency (weight: 0.2) - prefer candidates created close in time
    const daysDiff = Math.abs(
      (reconciliation.created_at.getTime() - candidate.created_at.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (daysDiff <= 1) score += 0.2;
    else if (daysDiff <= 3) score += 0.1;
    else if (daysDiff <= 7) score += 0.05;

    return Math.min(score, 1);
  }

  private stringSimilarity(a: string, b: string): number {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1.0;
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = Array.from({ length: b.length + 1 }, (_, i) =>
      Array.from({ length: a.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        matrix[i][j] =
          b[i - 1] === a[j - 1]
            ? matrix[i - 1][j - 1]
            : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
    return matrix[b.length][a.length];
  }

  private async processMatch(
    reconciliation: PaymentReconciliation,
    escrowRepayment: EscrowRepayment,
    matchType: string,
    score?: number
  ): Promise<PaymentReconciliation> {
    const amountDiff = Math.abs(reconciliation.payment_amount - escrowRepayment.amount);
    const hasDiscrepancy = amountDiff > AMOUNT_TOLERANCE;

    return this.db.transaction(async (trx) => {
      // Check for currency mismatch
      const currencyMismatch =
        reconciliation.payment_currency !== escrowRepayment.currency;

      if (hasDiscrepancy || currencyMismatch) {
        // Matched but with discrepancy
        const discrepancyDetails: DiscrepancyDetails = {
          type: currencyMismatch
            ? DiscrepancyType.CURRENCY_MISMATCH
            : reconciliation.payment_amount > escrowRepayment.amount
            ? DiscrepancyType.OVERPAYMENT
            : DiscrepancyType.UNDERPAYMENT,
          payment_amount: reconciliation.payment_amount,
          expected_amount: escrowRepayment.amount,
          difference: reconciliation.payment_amount - escrowRepayment.amount,
          currency_mismatch: currencyMismatch,
          payment_currency: reconciliation.payment_currency,
          expected_currency: escrowRepayment.currency,
        };

        await trx('payment_reconciliation').where('id', reconciliation.id).update({
          status: ReconciliationStatus.DISCREPANCY,
          escrow_repayment_id: escrowRepayment.id,
          escrow_reference: escrowRepayment.reference,
          expected_amount: escrowRepayment.amount,
          expected_currency: escrowRepayment.currency,
          discrepancy_amount: discrepancyDetails.difference,
          discrepancy_details: JSON.stringify(discrepancyDetails),
          matching_metadata: JSON.stringify({ match_type: matchType, score }),
          updated_at: trx.fn.now(),
        });

        await this.logAudit(trx, reconciliation.id, 'discrepancy_detected', {
          previous_status: reconciliation.status,
          new_status: ReconciliationStatus.DISCREPANCY,
          details: discrepancyDetails,
        });
      } else {
        // Clean match
        await trx('payment_reconciliation').where('id', reconciliation.id).update({
          status: ReconciliationStatus.MATCHED,
          escrow_repayment_id: escrowRepayment.id,
          escrow_reference: escrowRepayment.reference,
          expected_amount: escrowRepayment.amount,
          expected_currency: escrowRepayment.currency,
          discrepancy_amount: 0,
          matching_metadata: JSON.stringify({ match_type: matchType, score }),
          matched_at: trx.fn.now(),
          updated_at: trx.fn.now(),
        });

        // Mark escrow repayment as paid
        await trx('escrow_repayments').where('id', escrowRepayment.id).update({
          status: 'paid',
          payment_id: reconciliation.mobile_money_payment_id,
          updated_at: trx.fn.now(),
        });

        await this.logAudit(trx, reconciliation.id, 'payment_matched', {
          previous_status: reconciliation.status,
          new_status: ReconciliationStatus.MATCHED,
          details: { escrow_id: escrowRepayment.id, match_type: matchType, score },
        });
      }

      return trx('payment_reconciliation').where('id', reconciliation.id).first();
    });
  }

  async resolveDiscrepancy(dto: ResolveDiscrepancyDto): Promise<PaymentReconciliation> {
    const reconciliation = await this.db('payment_reconciliation')
      .where('id', dto.reconciliation_id)
      .first();

    if (!reconciliation) {
      throw new Error(`Reconciliation not found: ${dto.reconciliation_id}`);
    }

    if (reconciliation.status !== ReconciliationStatus.DISCREPANCY) {
      throw new Error(`Reconciliation is not in discrepancy status: ${reconciliation.status}`);
    }

    return this.db.transaction(async (trx) => {
      await trx('payment_reconciliation').where('id', dto.reconciliation_id).update({
        status: ReconciliationStatus.MANUALLY_RESOLVED,
        resolution_notes: dto.resolution_notes,
        resolved_by: dto.resolved_by,
        resolved_at: trx.fn.now(),
        updated_at: trx.fn.now(),
      });

      await this.logAudit(trx, dto.reconciliation_id, 'discrepancy_resolved', {
        previous_status: ReconciliationStatus.DISCREPANCY,
        new_status: ReconciliationStatus.MANUALLY_RESOLVED,
        details: { resolved_by: dto.resolved_by, notes: dto.resolution_notes },
      });

      return trx('payment_reconciliation').where('id', dto.reconciliation_id).first();
    });
  }

  private async updateStatus(
    id: string,
    status: ReconciliationStatus,
    extra: Partial<PaymentReconciliation> = {}
  ): Promise<PaymentReconciliation> {
    await this.db('payment_reconciliation')
      .where('id', id)
      .update({ status, ...extra, updated_at: this.db.fn.now() });
    return this.db('payment_reconciliation').where('id', id).first();
  }

  private async logAudit(
    trx: Knex.Transaction,
    reconciliationId: string,
    action: string,
    details: {
      previous_status?: string;
      new_status?: string;
      details?: unknown;
      performed_by?: string;
    }
  ): Promise<void> {
    await trx('reconciliation_audit_log').insert({
      reconciliation_id: reconciliationId,
      action,
      previous_status: details.previous_status,
      new_status: details.new_status,
      details: JSON.stringify(details.details),
      performed_by: details.performed_by,
    });
  }
}