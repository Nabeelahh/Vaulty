/**
 * Escrow routes
 *
 * GET  /api/escrows              — list escrows (filterable)
 * GET  /api/escrows/:id          — get escrow by internal UUID
 * GET  /api/escrows/contract/:contractEscrowId — get by on-chain ID
 * GET  /api/escrows/:id/history  — full state-transition history
 * POST /api/escrows/sync         — manually ingest a contract event
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Knex } from 'knex';
import { createLogger } from '../utils/logger';
import { EscrowSyncService } from '../services/escrow.sync.service';
import { EscrowState } from '../models/Escrow';

export function createEscrowRouter(db: Knex): Router {
  const router = Router();
  const logger = createLogger('EscrowRouter');
  const service = new EscrowSyncService(db, logger);

  /**
   * GET /api/escrows
   * Query params: state, sender_address, contract_id, page, limit
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await service.list({
        state: req.query.state as EscrowState | undefined,
        sender_address: req.query.sender_address as string | undefined,
        contract_id: req.query.contract_id as string | undefined,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/escrows/contract/:contractEscrowId
   * Look up by on-chain escrow ID (must come before /:id to avoid shadowing)
   */
  router.get(
    '/contract/:contractEscrowId',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const escrow = await service.getByContractEscrowId(req.params.contractEscrowId);
        if (!escrow) {
          res.status(404).json({ success: false, message: 'Escrow not found' });
          return;
        }
        res.json({ success: true, data: escrow });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /api/escrows/:id
   */
  router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const escrow = await service.getById(req.params.id);
      if (!escrow) {
        res.status(404).json({ success: false, message: 'Escrow not found' });
        return;
      }
      res.json({ success: true, data: escrow });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/escrows/:id/history
   */
  router.get('/:id/history', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const escrow = await service.getById(req.params.id);
      if (!escrow) {
        res.status(404).json({ success: false, message: 'Escrow not found' });
        return;
      }
      const history = await service.getHistory(req.params.id);
      res.json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/escrows/sync
   * Ingest a contract event (called by the Horizon indexer or manually).
   * Body: { contract_escrow_id, contract_id, event_type, tx_hash,
   *         ledger_sequence, sender_address?, farmer_address?,
   *         vendor_id?, amount?, currency?, crop_season?, metadata? }
   */
  router.post('/sync', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { contract_escrow_id, contract_id, event_type, tx_hash, ledger_sequence } = req.body;

      if (!contract_escrow_id || !contract_id || !event_type || !tx_hash || !ledger_sequence) {
        res.status(400).json({
          success: false,
          message:
            'contract_escrow_id, contract_id, event_type, tx_hash, and ledger_sequence are required',
        });
        return;
      }

      await service.processContractEvent(req.body);
      res.status(202).json({ success: true, message: 'Event accepted for processing' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
