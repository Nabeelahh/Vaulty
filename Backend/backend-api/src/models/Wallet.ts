/**
 * Wallet model representing a user's Stellar wallet
 */

export interface Wallet {
  id: string;
  user_id: string;
  public_key: string;
  encrypted_secret_key: string | null;
  cached_balance: number; // in stroops (1 XLM = 10,000,000 stroops)
  balance_currency: string;
  balance_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWalletDto {
  user_id: string;
  public_key: string;
  encrypted_secret_key?: string;
}

export interface UpdateWalletBalanceDto {
  cached_balance: number;
  balance_currency?: string;
  balance_synced_at: string;
}

export interface WalletResponse {
  id: string;
  user_id: string;
  public_key: string;
  balance: number; // in XLM (converted from stroops)
  balance_currency: string;
  balance_synced_at: string | null;
  created_at: string;
}

export interface WalletBalanceResponse {
  wallet_id: string;
  public_key: string;
  live_balance: number; // in XLM
  currency: string;
  last_updated: string;
}
