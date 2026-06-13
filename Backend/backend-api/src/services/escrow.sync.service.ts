/**
 * EscrowSyncService
 *
 * Indexes Horizon/Soroban contract events and keeps the `escrows` table in
 * sync with on-chain state.  Responsibilities:
 *   - Upsert escrow records from contract events
 *   - Validate state transitions (conflict resolution)
 *   - Append every transition to escrow_history
 *   - Expose query helpers used by the REST routes
 */

import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger';
import {
  Escrow,
  EscrowHistoryEntry,
  EscrowState,
  CreateEscrowDto,
  UpdateEscrowStateDto,
  isValidTransition,
} from '../models/Escrow';

export class EscrowSyncService {
  constructor(
    private readonly db: Knex,
    private readonly logger: Logger,
  ) {}

  // ─── Upsert (called by the Horizon event processor) ──────────────────────

  /**
   * Create a new escrow record from a `fund()` contract event.
   * Idempotent: returns the existing record if already present.
   */
  async createEscrow(dto: CreateEscrowDto): Promise<Escrow> {
    const existing = await this.db('escrows')
      .where('contract_escrow_id', dto.contract_escrow_id)
      .first();

    if (existing) {
      this.logger.warn('Escrow already exists, skipping create', {
        contract_escrow_id: dto.contract_escrow_id,
      });
      return existing as Escrow;
    }

    const now = new Date().toISOString();
    const id = uuidv4();

    const [record] = await this.db('escrows')
      .insert({
        id,
        contract_escrow_id: dto.contract_escrow_id,
        contract_id: dto.contract_id,
        state: dto.state,
        sender_address: dto.sender_address,
        farmer_address: dto.farmer_address ?? null,
        vendor_id: dto.vendor_id ?? null,
        amount: dto.amount,
        currency: dto.currency,
        crop_season: dto.crop_season ?? null,
        last_ledger_sequence: dto.last_ledger_sequence,
        last_tx_hash: dto.last_tx_hash ?? null,
        synced_at: now,
        created_at: now,
        updated_at: now,
      })
      .returning('*');

    await this.appendHistory({
      escrow_id: id,
      from_state: null,
      to_state: dto.state,
      tx_hash: dto.last_tx_hash ?? null,
      ledger_sequence: dto.last_ledger_sequence,
      event_type: 'escrow_created',
      metadata: null,
    });

    this.logger.info('Escrow created', { id, contract_escrow_id: dto.contract_escrow_id });
    return record as Escrow;
  }

  /**
   * Apply a state transition from a contract event.
   *
   * Conflict resolution rules:
   *   1. Duplicate event (same tx_hash + same state) → silently skip.
   *   2. Invalid transition (e.g. Redeemed → Funded) → log warning, skip.
   *   3. Stale event (ledger_sequence ≤ last known) → skip.
   *   4. Valid forward transition → update + append history.
   */
  async applyStateTransition(dto: UpdateEscrowStateDto): Promise<Escrow | null> {
    const escrow = await this.db('escrows')
      .where('contract_escrow_id', dto.contract_escrow_id)
      .first() as Escrow | undefined;

    if (!escrow) {
      this.logger.warn('Escrow not found for state transition', {
        contract_escrow_id: dto.contract_escrow_id,
      });
      return null;
    }

    // 1. Duplicate event guard
    if (escrow.last_tx_hash === dto.tx_hash && escrow.state === dto.new_state) {
      this.logger.info('Duplicate event skipped', { tx_hash: dto.tx_hash });
      return escrow;
    }

    // 2. Stale event guard
    if (dto.ledger_sequence <= escrow.last_ledger_sequence) {
      this.logger.warn('Stale event skipped', {
        contract_escrow_id: dto.contract_escrow_id,
        incoming_ledger: dto.ledger_sequence,
        current_ledger: escrow.last_ledger_sequence,
      });
      return escrow;
    }

    // 3. Validate transition
    if (!isValidTransition(escrow.state, dto.new_state)) {
      this.logger.warn('Invalid state transition rejected', {
        contract_escrow_id: dto.contract_escrow_id,
        from: escrow.state,
        to: dto.new_state,
      });
      return escrow;
    }

    const now = new Date().toISOString();

    const [updated] = await this.db('escrows')
      .where('id', escrow.id)
      .update({
        state: dto.new_state,
        last_tx_hash: dto.tx_hash,
        last_ledger_sequence: dto.ledger_sequence,
        synced_at: now,
        updated_at: now,
      })
      .returning('*');

    await this.appendHistory({
      escrow_id: escrow.id,
      from_state: escrow.state,
      to_state: dto.new_state,
      tx_hash: dto.tx_hash,
      ledger_sequence: dto.ledger_sequence,
      event_type: dto.event_type,
      metadata: dto.metadata ?? null,
    });

    this.logger.info('Escrow state updated', {
      id: escrow.id,
      from: escrow.state,
      to: dto.new_state,
    });

    return updated as Escrow;
  }

  // ─── History ──────────────────────────────────────────────────────────────

  private async appendHistory(entry: {
    escrow_id: string;
    from_state: EscrowState | null;
    to_state: EscrowState;
    tx_hash: string | null;
    ledger_sequence: number;
    event_type: string;
    metadata: Record<string, unknown> | null;
  }): Promise<void> {
    const now = new Date().toISOString();
    await this.db('escrow_history').insert({
      id: uuidv4(),
      escrow_id: entry.escrow_id,
      from_state: entry.from_state,
      to_state: entry.to_state,
      tx_hash: entry.tx_hash,
      ledger_sequence: entry.ledger_sequence,
      event_type: entry.event_type,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      occurred_at: now,
      created_at: now,
    });
  }

  async getHistory(escrowId: string): Promise<EscrowHistoryEntry[]> {
    return this.db('escrow_history')
      .where('escrow_id', escrowId)
      .orderBy('occurred_at', 'asc') as Promise<EscrowHistoryEntry[]>;
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  async getById(id: string): Promise<Escrow | null> {
    const row = await this.db('escrows').where('id', id).first();
    return (row as Escrow) ?? null;
  }

  async getByContractEscrowId(contractEscrowId: string): Promise<Escrow | null> {
    const row = await this.db('escrows')
      .where('contract_escrow_id', contractEscrowId)
      .first();
    return (row as Escrow) ?? null;
  }

  async list(filter: {
    state?: EscrowState;
    sender_address?: string;
    contract_id?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Escrow[]; total: number; page: number; limit: number }> {
    const page = filter.page ?? 1;
    const limit = Math.min(filter.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    let query = this.db('escrows');
    if (filter.state) query = query.where('state', filter.state);
    if (filter.sender_address) query = query.where('sender_address', filter.sender_address);
    if (filter.contract_id) query = query.where('contract_id', filter.contract_id);

    const [{ count }] = await query.clone().count('* as count');
    const data = await query.orderBy('created_at', 'desc').limit(limit).offset(offset);

    return { data: data as Escrow[], total: Number(count), page, limit };
  }

  // ─── Horizon event processor ──────────────────────────────────────────────

  /**
   * Process a raw contract event emitted by the Soroban escrow contract.
   * Maps event_type strings to the appropriate service method.
   */
  async processContractEvent(event: {
    contract_escrow_id: string;
    contract_id: string;
    event_type: string;
    tx_hash: string;
    ledger_sequence: number;
    sender_address?: string;
    farmer_address?: string;
    vendor_id?: string;
    amount?: number;
    currency?: string;
    crop_season?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const stateMap: Record<string, EscrowState> = {
      fund: EscrowState.Created,
      approve_farmer: EscrowState.Funded,
      mint_voucher: EscrowState.VoucherMinted,
      redeem_voucher: EscrowState.Redeemed,
      trigger_repay: EscrowState.Repaying,
      repay: EscrowState.Repaid,
      default: EscrowState.Defaulted,
      cancel: EscrowState.Cancelled,
    };

    const newState = stateMap[event.event_type];
    if (!newState) {
      this.logger.warn('Unknown contract event type', { event_type: event.event_type });
      return;
    }

    if (event.event_type === 'fund') {
      await this.createEscrow({
        contract_escrow_id: event.contract_escrow_id,
        contract_id: event.contract_id,
        state: EscrowState.Created,
        sender_address: event.sender_address ?? '',
        farmer_address: event.farmer_address,
        vendor_id: event.vendor_id,
        amount: event.amount ?? 0,
        currency: event.currency ?? 'USDC',
        crop_season: event.crop_season,
        last_ledger_sequence: event.ledger_sequence,
        last_tx_hash: event.tx_hash,
      });
    } else {
      await this.applyStateTransition({
        contract_escrow_id: event.contract_escrow_id,
        new_state: newState,
        tx_hash: event.tx_hash,
        ledger_sequence: event.ledger_sequence,
        event_type: event.event_type,
        metadata: event.metadata,
      });
    }
  }
}
