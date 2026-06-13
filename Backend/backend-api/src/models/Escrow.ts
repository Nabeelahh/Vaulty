/**
 * Escrow model — mirrors the on-chain Soroban escrow contract state.
 *
 * State machine (matches contract):
 *   Created → Funded → VoucherMinted → Redeemed → Repaying → Repaid | Defaulted
 *                                                                ↑
 *                                                           (Cancelled)
 */

export enum EscrowState {
  Created = 'Created',
  Funded = 'Funded',
  VoucherMinted = 'VoucherMinted',
  Redeemed = 'Redeemed',
  Repaying = 'Repaying',
  Repaid = 'Repaid',
  Defaulted = 'Defaulted',
  Cancelled = 'Cancelled',
}

/** Valid forward transitions for conflict resolution */
export const VALID_TRANSITIONS: Record<EscrowState, EscrowState[]> = {
  [EscrowState.Created]: [EscrowState.Funded, EscrowState.Cancelled],
  [EscrowState.Funded]: [EscrowState.VoucherMinted, EscrowState.Cancelled],
  [EscrowState.VoucherMinted]: [EscrowState.Redeemed],
  [EscrowState.Redeemed]: [EscrowState.Repaying],
  [EscrowState.Repaying]: [EscrowState.Repaid, EscrowState.Defaulted],
  [EscrowState.Repaid]: [],
  [EscrowState.Defaulted]: [],
  [EscrowState.Cancelled]: [],
};

export interface Escrow {
  id: string;                      // internal UUID
  contract_escrow_id: string;      // on-chain escrow ID (hex)
  contract_id: string;             // Soroban contract address
  state: EscrowState;
  sender_address: string;          // Stellar public key
  farmer_address: string | null;
  vendor_id: string | null;
  amount: number;                  // in stroops (1 XLM = 10^7 stroops)
  currency: string;                // e.g. "USDC"
  crop_season: string | null;
  last_ledger_sequence: number;
  last_tx_hash: string | null;
  synced_at: string;               // ISO timestamp of last sync
  created_at: string;
  updated_at: string;
}

export interface EscrowHistoryEntry {
  id: string;
  escrow_id: string;
  from_state: EscrowState | null;
  to_state: EscrowState;
  tx_hash: string | null;
  ledger_sequence: number;
  event_type: string;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
  created_at: string;
}

export interface CreateEscrowDto {
  contract_escrow_id: string;
  contract_id: string;
  state: EscrowState;
  sender_address: string;
  farmer_address?: string;
  vendor_id?: string;
  amount: number;
  currency: string;
  crop_season?: string;
  last_ledger_sequence: number;
  last_tx_hash?: string;
}

export interface UpdateEscrowStateDto {
  contract_escrow_id: string;
  new_state: EscrowState;
  tx_hash: string;
  ledger_sequence: number;
  event_type: string;
  metadata?: Record<string, unknown>;
}

export function isValidTransition(from: EscrowState, to: EscrowState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
