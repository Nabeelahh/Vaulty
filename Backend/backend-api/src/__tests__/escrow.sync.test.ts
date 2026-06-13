/**
 * Tests for EscrowSyncService and /api/escrows routes.
 *
 * The database is mocked via jest.mock so no real Postgres connection is needed.
 */

import { EscrowSyncService } from '../services/escrow.sync.service';
import { EscrowState, isValidTransition } from '../models/Escrow';
import { Logger } from '../utils/logger';

const logger = new Logger('test');

// ─── Model: isValidTransition ─────────────────────────────────────────────────

describe('isValidTransition', () => {
  it('allows Created → Funded', () => {
    expect(isValidTransition(EscrowState.Created, EscrowState.Funded)).toBe(true);
  });

  it('allows Created → Cancelled', () => {
    expect(isValidTransition(EscrowState.Created, EscrowState.Cancelled)).toBe(true);
  });

  it('allows Funded → VoucherMinted', () => {
    expect(isValidTransition(EscrowState.Funded, EscrowState.VoucherMinted)).toBe(true);
  });

  it('allows VoucherMinted → Redeemed', () => {
    expect(isValidTransition(EscrowState.VoucherMinted, EscrowState.Redeemed)).toBe(true);
  });

  it('allows Redeemed → Repaying', () => {
    expect(isValidTransition(EscrowState.Redeemed, EscrowState.Repaying)).toBe(true);
  });

  it('allows Repaying → Repaid', () => {
    expect(isValidTransition(EscrowState.Repaying, EscrowState.Repaid)).toBe(true);
  });

  it('allows Repaying → Defaulted', () => {
    expect(isValidTransition(EscrowState.Repaying, EscrowState.Defaulted)).toBe(true);
  });

  it('rejects backward transition Redeemed → Funded', () => {
    expect(isValidTransition(EscrowState.Redeemed, EscrowState.Funded)).toBe(false);
  });

  it('rejects transition from terminal state Repaid', () => {
    expect(isValidTransition(EscrowState.Repaid, EscrowState.Repaying)).toBe(false);
  });

  it('rejects transition from terminal state Defaulted', () => {
    expect(isValidTransition(EscrowState.Defaulted, EscrowState.Repaid)).toBe(false);
  });

  it('rejects transition from terminal state Cancelled', () => {
    expect(isValidTransition(EscrowState.Cancelled, EscrowState.Funded)).toBe(false);
  });
});

// ─── EscrowSyncService ────────────────────────────────────────────────────────

describe('EscrowSyncService', () => {
  const baseEscrow = {
    id: 'uuid-1',
    contract_escrow_id: 'escrow-abc',
    contract_id: 'contract-xyz',
    state: EscrowState.Created,
    sender_address: 'GABC',
    farmer_address: null,
    vendor_id: null,
    amount: 200_000_000,
    currency: 'USDC',
    crop_season: '2026-A',
    last_ledger_sequence: 100,
    last_tx_hash: 'tx-hash-1',
    synced_at: '2026-01-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };

  describe('createEscrow', () => {
    it('inserts a new escrow and returns it', async () => {
      const inserted = { ...baseEscrow };
      const qb = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(undefined), // not found → create
        insert: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([inserted]),
      };
      const db = jest.fn().mockImplementation(() => qb) as any;
      db.fn = { now: jest.fn() };

      const svc = new EscrowSyncService(db, logger);
      const result = await svc.createEscrow({
        contract_escrow_id: 'escrow-abc',
        contract_id: 'contract-xyz',
        state: EscrowState.Created,
        sender_address: 'GABC',
        amount: 200_000_000,
        currency: 'USDC',
        last_ledger_sequence: 100,
        last_tx_hash: 'tx-hash-1',
      });

      expect(result.contract_escrow_id).toBe('escrow-abc');
      expect(qb.insert).toHaveBeenCalled();
    });

    it('returns existing escrow without inserting on duplicate', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(baseEscrow),
        insert: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([]),
      };
      const db = jest.fn().mockImplementation(() => qb) as any;
      db.fn = { now: jest.fn() };

      const svc = new EscrowSyncService(db, logger);
      const result = await svc.createEscrow({
        contract_escrow_id: 'escrow-abc',
        contract_id: 'contract-xyz',
        state: EscrowState.Created,
        sender_address: 'GABC',
        amount: 200_000_000,
        currency: 'USDC',
        last_ledger_sequence: 100,
      });

      expect(result).toEqual(baseEscrow);
      expect(qb.insert).not.toHaveBeenCalled();
    });
  });

  describe('applyStateTransition', () => {
    it('applies a valid state transition', async () => {
      const updated = { ...baseEscrow, state: EscrowState.Funded, last_ledger_sequence: 200 };
      let callCount = 0;
      const qb = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockImplementation(() => {
          // first call: find escrow; subsequent: history insert
          return callCount++ === 0 ? Promise.resolve(baseEscrow) : Promise.resolve(undefined);
        }),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([updated]),
        insert: jest.fn().mockReturnThis(),
      };
      const db = jest.fn().mockImplementation(() => qb) as any;
      db.fn = { now: jest.fn() };

      const svc = new EscrowSyncService(db, logger);
      const result = await svc.applyStateTransition({
        contract_escrow_id: 'escrow-abc',
        new_state: EscrowState.Funded,
        tx_hash: 'tx-hash-2',
        ledger_sequence: 200,
        event_type: 'approve_farmer',
      });

      expect(result?.state).toBe(EscrowState.Funded);
      expect(qb.update).toHaveBeenCalled();
    });

    it('skips duplicate event (same tx_hash + same state)', async () => {
      const escrowSameState = { ...baseEscrow, last_tx_hash: 'tx-dup', state: EscrowState.Funded };
      const qb = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(escrowSameState),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([]),
      };
      const db = jest.fn().mockImplementation(() => qb) as any;
      db.fn = { now: jest.fn() };

      const svc = new EscrowSyncService(db, logger);
      const result = await svc.applyStateTransition({
        contract_escrow_id: 'escrow-abc',
        new_state: EscrowState.Funded,
        tx_hash: 'tx-dup',
        ledger_sequence: 200,
        event_type: 'approve_farmer',
      });

      expect(result).toEqual(escrowSameState);
      expect(qb.update).not.toHaveBeenCalled();
    });

    it('skips stale event (ledger_sequence ≤ current)', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(baseEscrow), // last_ledger_sequence = 100
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([]),
      };
      const db = jest.fn().mockImplementation(() => qb) as any;
      db.fn = { now: jest.fn() };

      const svc = new EscrowSyncService(db, logger);
      const result = await svc.applyStateTransition({
        contract_escrow_id: 'escrow-abc',
        new_state: EscrowState.Funded,
        tx_hash: 'tx-old',
        ledger_sequence: 50, // older than 100
        event_type: 'approve_farmer',
      });

      expect(result).toEqual(baseEscrow);
      expect(qb.update).not.toHaveBeenCalled();
    });

    it('rejects invalid state transition', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(baseEscrow), // state = Created
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([]),
      };
      const db = jest.fn().mockImplementation(() => qb) as any;
      db.fn = { now: jest.fn() };

      const svc = new EscrowSyncService(db, logger);
      const result = await svc.applyStateTransition({
        contract_escrow_id: 'escrow-abc',
        new_state: EscrowState.Repaid, // invalid from Created
        tx_hash: 'tx-bad',
        ledger_sequence: 200,
        event_type: 'repay',
      });

      expect(result).toEqual(baseEscrow);
      expect(qb.update).not.toHaveBeenCalled();
    });

    it('returns null when escrow not found', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(undefined),
      };
      const db = jest.fn().mockImplementation(() => qb) as any;
      db.fn = { now: jest.fn() };

      const svc = new EscrowSyncService(db, logger);
      const result = await svc.applyStateTransition({
        contract_escrow_id: 'nonexistent',
        new_state: EscrowState.Funded,
        tx_hash: 'tx-x',
        ledger_sequence: 200,
        event_type: 'approve_farmer',
      });

      expect(result).toBeNull();
    });
  });

  describe('processContractEvent', () => {
    it('calls createEscrow for fund event', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(undefined),
        insert: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([baseEscrow]),
      };
      const db = jest.fn().mockImplementation(() => qb) as any;
      db.fn = { now: jest.fn() };

      const svc = new EscrowSyncService(db, logger);
      const createSpy = jest.spyOn(svc, 'createEscrow').mockResolvedValue(baseEscrow);

      await svc.processContractEvent({
        contract_escrow_id: 'escrow-abc',
        contract_id: 'contract-xyz',
        event_type: 'fund',
        tx_hash: 'tx-1',
        ledger_sequence: 100,
        sender_address: 'GABC',
        amount: 200_000_000,
        currency: 'USDC',
      });

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ contract_escrow_id: 'escrow-abc', state: EscrowState.Created }),
      );
    });

    it('calls applyStateTransition for non-fund events', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(baseEscrow),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ ...baseEscrow, state: EscrowState.Funded }]),
        insert: jest.fn().mockReturnThis(),
      };
      const db = jest.fn().mockImplementation(() => qb) as any;
      db.fn = { now: jest.fn() };

      const svc = new EscrowSyncService(db, logger);
      const transitionSpy = jest
        .spyOn(svc, 'applyStateTransition')
        .mockResolvedValue({ ...baseEscrow, state: EscrowState.Funded });

      await svc.processContractEvent({
        contract_escrow_id: 'escrow-abc',
        contract_id: 'contract-xyz',
        event_type: 'approve_farmer',
        tx_hash: 'tx-2',
        ledger_sequence: 200,
      });

      expect(transitionSpy).toHaveBeenCalledWith(
        expect.objectContaining({ new_state: EscrowState.Funded }),
      );
    });

    it('ignores unknown event types', async () => {
      const db = jest.fn() as any;
      db.fn = { now: jest.fn() };
      const svc = new EscrowSyncService(db, logger);
      const createSpy = jest.spyOn(svc, 'createEscrow');
      const transitionSpy = jest.spyOn(svc, 'applyStateTransition');

      await svc.processContractEvent({
        contract_escrow_id: 'escrow-abc',
        contract_id: 'contract-xyz',
        event_type: 'unknown_event',
        tx_hash: 'tx-x',
        ledger_sequence: 100,
      });

      expect(createSpy).not.toHaveBeenCalled();
      expect(transitionSpy).not.toHaveBeenCalled();
    });
  });

  describe('getHistory', () => {
    it('returns history entries ordered by occurred_at', async () => {
      const historyRows = [
        { id: 'h1', escrow_id: 'uuid-1', from_state: null, to_state: EscrowState.Created },
        { id: 'h2', escrow_id: 'uuid-1', from_state: EscrowState.Created, to_state: EscrowState.Funded },
      ];
      const qb = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue(historyRows),
      };
      const db = jest.fn().mockImplementation(() => qb) as any;
      db.fn = { now: jest.fn() };

      const svc = new EscrowSyncService(db, logger);
      const result = await svc.getHistory('uuid-1');

      expect(result).toHaveLength(2);
      expect(result[0].to_state).toBe(EscrowState.Created);
      expect(result[1].to_state).toBe(EscrowState.Funded);
    });
  });
});
