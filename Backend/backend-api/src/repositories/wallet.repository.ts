import { Knex } from 'knex';
import { Wallet, CreateWalletDto, UpdateWalletBalanceDto } from '../models/Wallet';

export class WalletRepository {
  constructor(private db: Knex) {}

  /**
   * Create a new wallet for a user
   */
  async create(dto: CreateWalletDto): Promise<Wallet> {
    const [wallet] = await this.db<Wallet>('wallets')
      .insert({
        user_id: dto.user_id,
        public_key: dto.public_key,
        encrypted_secret_key: dto.encrypted_secret_key || null,
        cached_balance: 0,
        balance_currency: 'XLM',
      })
      .returning('*');

    return wallet;
  }

  /**
   * Find wallet by ID
   */
  async findById(id: string): Promise<Wallet | null> {
    const wallet = await this.db<Wallet>('wallets')
      .where({ id })
      .first();

    return wallet || null;
  }

  /**
   * Find wallet by user ID (1:1 relationship)
   */
  async findByUserId(userId: string): Promise<Wallet | null> {
    const wallet = await this.db<Wallet>('wallets')
      .where({ user_id: userId })
      .first();

    return wallet || null;
  }

  /**
   * Find wallet by public key
   */
  async findByPublicKey(publicKey: string): Promise<Wallet | null> {
    const wallet = await this.db<Wallet>('wallets')
      .where({ public_key: publicKey })
      .first();

    return wallet || null;
  }

  /**
   * Check if user already has a wallet
   */
  async existsByUserId(userId: string): Promise<boolean> {
    const wallet = await this.db<Wallet>('wallets')
      .where({ user_id: userId })
      .first();

    return !!wallet;
  }

  /**
   * Check if public key is already taken
   */
  async existsByPublicKey(publicKey: string): Promise<boolean> {
    const wallet = await this.db<Wallet>('wallets')
      .where({ public_key: publicKey })
      .first();

    return !!wallet;
  }

  /**
   * Update wallet balance
   */
  async updateBalance(id: string, dto: UpdateWalletBalanceDto): Promise<Wallet | null> {
    const [wallet] = await this.db<Wallet>('wallets')
      .where({ id })
      .update({
        cached_balance: dto.cached_balance,
        balance_currency: dto.balance_currency || 'XLM',
        balance_synced_at: dto.balance_synced_at,
        updated_at: new Date(),
      })
      .returning('*');

    return wallet || null;
  }

  /**
   * Delete wallet by ID
   */
  async delete(id: string): Promise<boolean> {
    const count = await this.db<Wallet>('wallets')
      .where({ id })
      .delete();

    return count > 0;
  }

  /**
   * Get all wallets (for admin purposes)
   */
  async findAll(limit: number = 100, offset: number = 0): Promise<Wallet[]> {
    return this.db<Wallet>('wallets')
      .limit(limit)
      .offset(offset)
      .orderBy('created_at', 'desc');
  }
}
