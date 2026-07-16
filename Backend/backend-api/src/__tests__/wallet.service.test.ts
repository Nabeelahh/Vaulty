import { WalletService } from '../services/wallet.service';
import { WalletRepository } from '../repositories/wallet.repository';
import { StellarClient } from '../services/stellar.client';
import { Wallet } from '../models/Wallet';
import { HttpError } from '../middleware/errorHandler';

// Mock dependencies
jest.mock('../repositories/wallet.repository');
jest.mock('../services/stellar.client');

describe('WalletService', () => {
  let walletService: WalletService;
  let mockWalletRepository: jest.Mocked<WalletRepository>;
  let mockStellarClient: jest.Mocked<StellarClient>;

  beforeEach(() => {
    mockWalletRepository = new WalletRepository({} as any) as jest.Mocked<WalletRepository>;
    mockStellarClient = new StellarClient() as jest.Mocked<StellarClient>;
    walletService = new WalletService(mockWalletRepository, mockStellarClient);
    jest.clearAllMocks();
  });

  describe('createWallet', () => {
    it('should create a new wallet successfully', async () => {
      const userId = 'user-123';
      const publicKey = 'GABC123...';
      
      mockWalletRepository.findByUserId.mockResolvedValue(null);
      mockStellarClient.generateKeypair.mockReturnValue({ publicKey, secretKey: 'SXYZ...' });
      mockWalletRepository.create.mockResolvedValue({
        id: 'wallet-123',
        user_id: userId,
        public_key: publicKey,
        encrypted_secret_key: null,
        cached_balance: 0,
        balance_currency: 'XLM',
        balance_synced_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Wallet);

      const result = await walletService.createWallet(userId);

      expect(mockWalletRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(mockStellarClient.generateKeypair).toHaveBeenCalled();
      expect(mockWalletRepository.create).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('public_key', publicKey);
      expect(result).toHaveProperty('balance', 0);
    });

    it('should throw conflict error if user already has a wallet', async () => {
      const userId = 'user-123';
      
      mockWalletRepository.findByUserId.mockResolvedValue({
        id: 'existing-wallet',
        user_id: userId,
        public_key: 'GEXISTING...',
        encrypted_secret_key: null,
        cached_balance: 0,
        balance_currency: 'XLM',
        balance_synced_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Wallet);

      await expect(walletService.createWallet(userId)).rejects.toThrow(HttpError);
      await expect(walletService.createWallet(userId)).rejects.toThrow('User already has a wallet');
    });
  });

  describe('getWalletByUserId', () => {
    it('should return wallet for user', async () => {
      const userId = 'user-123';
      const mockWallet: Wallet = {
        id: 'wallet-123',
        user_id: userId,
        public_key: 'GABC123...',
        encrypted_secret_key: null,
        cached_balance: 10000000, // 1 XLM in stroops
        balance_currency: 'XLM',
        balance_synced_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockWalletRepository.findByUserId.mockResolvedValue(mockWallet);

      const result = await walletService.getWalletByUserId(userId);

      expect(mockWalletRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(result).toHaveProperty('id', mockWallet.id);
      expect(result).toHaveProperty('balance', 1); // Converted from stroops
    });

    it('should throw not found error if wallet does not exist', async () => {
      const userId = 'nonexistent-user';
      mockWalletRepository.findByUserId.mockResolvedValue(null);

      await expect(walletService.getWalletByUserId(userId)).rejects.toThrow(HttpError);
      await expect(walletService.getWalletByUserId(userId)).rejects.toThrow('Wallet not found');
    });
  });

  describe('getLiveBalance', () => {
    it('should fetch and return live balance', async () => {
      const walletId = 'wallet-123';
      const mockWallet: Wallet = {
        id: walletId,
        user_id: 'user-123',
        public_key: 'GABC123...',
        encrypted_secret_key: null,
        cached_balance: 0,
        balance_currency: 'XLM',
        balance_synced_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockWalletRepository.findById.mockResolvedValue(mockWallet);
      mockStellarClient.getBalance.mockResolvedValue({ balance: 50000000, currency: 'XLM' }); // 5 XLM
      mockWalletRepository.updateBalance.mockResolvedValue(mockWallet);

      const result = await walletService.getLiveBalance(walletId);

      expect(mockWalletRepository.findById).toHaveBeenCalledWith(walletId);
      expect(mockStellarClient.getBalance).toHaveBeenCalledWith(mockWallet.public_key);
      expect(mockWalletRepository.updateBalance).toHaveBeenCalled();
      expect(result).toHaveProperty('live_balance', 5); // Converted from stroops
      expect(result).toHaveProperty('currency', 'XLM');
    });

    it('should throw not found error if wallet does not exist', async () => {
      const walletId = 'nonexistent-wallet';
      mockWalletRepository.findById.mockResolvedValue(null);

      await expect(walletService.getLiveBalance(walletId)).rejects.toThrow(HttpError);
      await expect(walletService.getLiveBalance(walletId)).rejects.toThrow('Wallet not found');
    });
  });

  describe('syncWalletBalance', () => {
    it('should sync wallet balance successfully', async () => {
      const walletId = 'wallet-123';
      const mockWallet: Wallet = {
        id: walletId,
        user_id: 'user-123',
        public_key: 'GABC123...',
        encrypted_secret_key: null,
        cached_balance: 0,
        balance_currency: 'XLM',
        balance_synced_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockWalletRepository.findById.mockResolvedValue(mockWallet);
      mockStellarClient.getBalance.mockResolvedValue({ balance: 30000000, currency: 'XLM' });
      mockWalletRepository.updateBalance.mockResolvedValue(mockWallet);

      await walletService.syncWalletBalance(walletId);

      expect(mockWalletRepository.findById).toHaveBeenCalledWith(walletId);
      expect(mockStellarClient.getBalance).toHaveBeenCalledWith(mockWallet.public_key);
      expect(mockWalletRepository.updateBalance).toHaveBeenCalledWith(
        walletId,
        expect.objectContaining({
          cached_balance: 30000000,
          balance_currency: 'XLM',
        })
      );
    });

    it('should log warning if wallet not found', async () => {
      const walletId = 'nonexistent-wallet';
      mockWalletRepository.findById.mockResolvedValue(null);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await walletService.syncWalletBalance(walletId);

      expect(consoleWarnSpy).toHaveBeenCalledWith(`Wallet ${walletId} not found for balance sync`);
      consoleWarnSpy.mockRestore();
    });
  });
});
