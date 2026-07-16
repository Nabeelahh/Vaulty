import { WalletRepository } from '../repositories/wallet.repository';
import { StellarClient } from './stellar.client';
import { Wallet, WalletResponse, WalletBalanceResponse, CreateWalletDto } from '../models/Wallet';
import { HttpError } from '../middleware/errorHandler';

/**
 * Wallet service handling wallet creation, retrieval, and balance operations
 */
export class WalletService {
  constructor(
    private walletRepository: WalletRepository,
    private stellarClient: StellarClient
  ) {}

  /**
   * Create a new wallet for a user
   * Generates a Stellar keypair and stores the public key
   */
  async createWallet(userId: string): Promise<WalletResponse> {
    // Check if user already has a wallet
    const existingWallet = await this.walletRepository.findByUserId(userId);
    if (existingWallet) {
      throw HttpError.conflict('User already has a wallet');
    }

    // Generate new Stellar keypair
    const { publicKey } = this.stellarClient.generateKeypair();

    // Note: Secret key is not stored server-side for security.
    // In production, implement client-side encryption and store only the encrypted secret key.
    const createDto: CreateWalletDto = {
      user_id: userId,
      public_key: publicKey,
      // encrypted_secret_key will be added when encryption is implemented
    };

    const wallet = await this.walletRepository.create(createDto);

    // Optionally fund the account on testnet
    if (process.env.STELLAR_NETWORK_PASSPHRASE === 'Test SDF Network ; September 2015') {
      try {
        await this.stellarClient.fundTestnetAccount(publicKey);
      } catch (error) {
        // Log error but don't fail wallet creation
        console.warn(`Failed to fund testnet account for ${publicKey}:`, error);
      }
    }

    return this.toWalletResponse(wallet);
  }

  /**
   * Get wallet for authenticated user
   */
  async getWalletByUserId(userId: string): Promise<WalletResponse> {
    const wallet = await this.walletRepository.findByUserId(userId);
    if (!wallet) {
      throw HttpError.notFound('Wallet');
    }

    return this.toWalletResponse(wallet);
  }

  /**
   * Get wallet by ID
   */
  async getWalletById(walletId: string): Promise<WalletResponse> {
    const wallet = await this.walletRepository.findById(walletId);
    if (!wallet) {
      throw HttpError.notFound('Wallet');
    }

    return this.toWalletResponse(wallet);
  }

  /**
   * Fetch live balance from Stellar network
   */
  async getLiveBalance(walletId: string): Promise<WalletBalanceResponse> {
    const wallet = await this.walletRepository.findById(walletId);
    if (!wallet) {
      throw HttpError.notFound('Wallet');
    }

    try {
      const { balance, currency } = await this.stellarClient.getBalance(wallet.public_key);

      // Update cached balance in database
      await this.walletRepository.updateBalance(walletId, {
        cached_balance: balance,
        balance_currency: currency,
        balance_synced_at: new Date().toISOString(),
      });

      // Convert stroops to XLM for response
      const balanceInXlm = balance / 10_000_000;

      return {
        wallet_id: wallet.id,
        public_key: wallet.public_key,
        live_balance: balanceInXlm,
        currency,
        last_updated: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`Failed to fetch live balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sync wallet balance from Stellar network (for background job)
   */
  async syncWalletBalance(walletId: string): Promise<void> {
    const wallet = await this.walletRepository.findById(walletId);
    if (!wallet) {
      console.warn(`Wallet ${walletId} not found for balance sync`);
      return;
    }

    try {
      const { balance, currency } = await this.stellarClient.getBalance(wallet.public_key);

      await this.walletRepository.updateBalance(walletId, {
        cached_balance: balance,
        balance_currency: currency,
        balance_synced_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`Failed to sync balance for wallet ${walletId}:`, error);
      throw error;
    }
  }

  /**
   * Sync all wallet balances (for background job)
   */
  async syncAllWalletBalances(): Promise<void> {
    const wallets = await this.walletRepository.findAll(1000, 0);

    for (const wallet of wallets) {
      try {
        await this.syncWalletBalance(wallet.id);
      } catch (error) {
        console.error(`Failed to sync balance for wallet ${wallet.id}:`, error);
        // Continue with next wallet even if one fails
      }
    }
  }

  /**
   * Convert Wallet entity to WalletResponse
   */
  private toWalletResponse(wallet: Wallet): WalletResponse {
    return {
      id: wallet.id,
      user_id: wallet.user_id,
      public_key: wallet.public_key,
      balance: wallet.cached_balance / 10_000_000, // Convert stroops to XLM
      balance_currency: wallet.balance_currency,
      balance_synced_at: wallet.balance_synced_at,
      created_at: wallet.created_at,
    };
  }
}
