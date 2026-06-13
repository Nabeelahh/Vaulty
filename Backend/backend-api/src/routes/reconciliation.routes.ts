import { Router, Request, Response, NextFunction } from 'express';
import { ReconciliationService } from '../services/reconciliation.service';
import { ReconciliationFilterDto, ReconciliationStatus } from '../models/reconciliation.model';
import { Knex } from 'knex';
import { createLogger } from '../utils/logger';
import { validateRequest } from '../middleware/validaterequest';

export function createReconciliationRouter(db: Knex): Router {
  const router = Router();
  const logger = createLogger('ReconciliationRouter');
  const service = new ReconciliationService(db, logger);

  /**
   * POST /reconciliation
   * Create a new reconciliation record for a mobile money payment.
   */
  router.post(
    '/',
    reconciliationValidators.create,
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const record = await service.createReconciliation(req.body);
        // Kick off async matching
        service.processReconciliation(record.id).catch((err) =>
          logger.error('Async processing failed', { id: record.id, err })
        );
        res.status(201).json({ success: true, data: record });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * GET /reconciliation
   * List reconciliation records with optional filters.
   * Query params: status, from_date, to_date, provider, page, limit
   */
  router.get(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const filter: ReconciliationFilterDto = {
          status: req.query.status as ReconciliationStatus | undefined,
          from_date: req.query.from_date ? new Date(req.query.from_date as string) : undefined,
          to_date: req.query.to_date ? new Date(req.query.to_date as string) : undefined,
          provider: req.query.provider as string | undefined,
          page: req.query.page ? Number(req.query.page) : 1,
          limit: req.query.limit ? Math.min(Number(req.query.limit), 100) : 20,
        };

        const result = await service.getReconciliations(filter);
        res.json({ success: true, ...result });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * GET /reconciliation/report
   * Generate a reconciliation report for a date range.
   * Query params: from (ISO date), to (ISO date)
   */
  router.get(
    '/report',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const from = req.query.from ? new Date(req.query.from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = req.query.to ? new Date(req.query.to as string) : new Date();

        if (isNaN(from.getTime()) || isNaN(to.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid date range' });
        }

        const report = await service.generateReport(from, to);
        res.json({ success: true, data: report });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * GET /reconciliation/discrepancies
   * List all unresolved discrepancies.
   */
  router.get(
    '/discrepancies',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const [discrepancies, summary] = await Promise.all([
          service.detectDiscrepancies(),
          service.getDiscrepancySummary(),
        ]);
        res.json({ success: true, data: discrepancies, summary });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * GET /reconciliation/:id
   * Get a single reconciliation record.
   */
  router.get(
    '/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const record = await service.getReconciliationById(req.params.id);
        if (!record) {
          return res.status(404).json({ success: false, message: 'Reconciliation not found' });
        }
        res.json({ success: true, data: record });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * POST /reconciliation/:id/process
   * Manually trigger processing for a specific reconciliation.
   */
  router.post(
    '/:id/process',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.processReconciliation(req.params.id);
        res.json({ success: true, data: result });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * POST /reconciliation/:id/resolve
   * Manually resolve a discrepancy.
   * Body: { resolution_notes, resolved_by }
   */
  router.post(
    '/:id/resolve',
    reconciliationValidators.resolve,
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.resolveDiscrepancy({
          reconciliation_id: req.params.id,
          resolution_notes: req.body.resolution_notes,
          resolved_by: req.body.resolved_by,
        });
        res.json({ success: true, data: result });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * POST /reconciliation/batch/run
   * Trigger a full batch reconciliation run.
   */
  router.post(
    '/batch/run',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const run = await service.runBatchReconciliation();
        res.json({ success: true, data: run });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * POST /reconciliation/batch/retry
   * Retry all failed/unmatched reconciliations.
   */
  router.post(
    '/batch/retry',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await service.retryFailedReconciliations();
        res.json({ success: true, message: 'Retry batch initiated' });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}