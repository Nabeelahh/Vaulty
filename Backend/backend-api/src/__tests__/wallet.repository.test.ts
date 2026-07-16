import { WalletRepository } from '../repositories/wallet.repository';
import { Wallet, CreateWalletDto, UpdateWalletBalanceDto } from '../models/Wallet';
import Knex from 'knex';

// Mock Knex instance
const mockKnex = {
  insert: jest.fn().mockReturnThis(),
  returning: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  first: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
} as unknown as Knex;

describe('WalletRepository', () => {
  let repository: WalletRepository;

  beforeEach(() => {
    repository = new WalletRepository(mockKnex);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new wallet', async () => {
      const dto: CreateWalletDto = {
        user_id: 'user-123',
        public_key: 'GABC123...',
      };

      const mockWallet: Wallet = {
        id: 'wallet-123',
        user_id: dto.user_id,
        public_key: dto.public_key,
        encrypted_secret_key: null,
        cached_balance: 0,
        balance_currency: 'XLM',
        balance_synced_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      (mockKnex.insert as jest.Mock).mockReturnValue(mockKnex);
      (mockKnex.returning as jest.Mock).mockResolvedValue([mockWallet]);

      const result = await repository.create(dto);

      expect(mockKnex.insert).toHaveBeenCalledWith({
        user_id: dto.user_id,
        public_key: dto.public_key,
        encrypted_secret_key: null,
        cached_balance: 0,
        balance_currency: 'XLM',
      });
      expect(result).toEqual(mockWallet);
    });
  });

  describe('findById', () => {
    it('should find wallet by ID', async () => {
      const mockWallet: Wallet = {
        id: 'wallet-123',
        user_id: 'user-123',
        public_key: 'GABC123...',
        encrypted_secret_key: null,
        cached_balance: 0,
        balance_currency: 'XLM',
        balance_synced_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      (mockKnex.where as jest.Mock).mockReturnValue(mockKnex);
      (mockKnex.first as jest.Mock).mockResolvedValue(mockWallet);

      const result = await repository.findById('wallet-123');

      expect(mockKnex.where).toHaveBeenCalledWith({ id: 'wallet-123' });
      expect(result).toEqual(mockWallet);
    });

    it('should return null if wallet not found', async () => {
      (mockKnex.where as jest.Mock).mockReturnValue(mockKnex);
      (mockKnex.first as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should find wallet by user ID', async () => {
      const mockWallet: Wallet = {
        id: 'wallet-123',
        user_id: 'user-123',
        public_key: 'GABC123...',
        encrypted_secret_key: null,
        cached_balance: 0,
        balance_currency: 'XLM',
        balance_synced_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      (mockKnex.where as jest.Mock).mockReturnValue(mockKnex);
      (mockKnex.first as jest.Mock).mockResolvedValue(mockWallet);

      const result = await repository.findByUserId('user-123');

      expect(mockKnex.where).toHaveBeenCalledWith({ user_id: 'user-123' });
      expect(result).toEqual(mockWallet);
    });

    it('should return null if wallet not found for user', async () => {
      (mockKnex.where as jest.Mock).mockReturnValue(mockKnex);
      (mockKnex.first as jest.Mock).mockResolvedValue(null);

      const result = await repository.findByUserId('nonexistent-user');

      expect(result).toBeNull();
    });
  });

  describe('existsByUserId', () => {
    it('should return true if wallet exists for user', async () => {
      const mockWallet: Wallet = {
        id: 'wallet-123',
        user_id: 'user-123',
        public_key: 'GABC123...',
        encrypted_secret_key: null,
        cached_balance: 0,
        balance_currency: 'XLM',
        balance_synced_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      (mockKnex.where as jest.Mock).mockReturnValue(mockKnex);
      (mockKnex.first as jest.Mock).mockResolvedValue(mockWallet);

      const result = await repository.existsByUserId('user-123');

      expect(result).toBe(true);
    });

    it('should return false if wallet does not exist for user', async () => {
      (mockKnex.where as jest.Mock).mockReturnValue(mockKnex);
      (mockKnex.first as jest.Mock).mockResolvedValue(null);

      const result = await repository.existsByUserId('nonexistent-user');

      expect(result).toBe(false);
    });
  });

  describe('updateBalance', () => {
    it('should update wallet balance', async () => {
      const mockWallet: Wallet = {
        id: 'wallet-123',
        user_id: 'user-123',
        public_key: 'GABC123...',
        encrypted_secret_key: null,
        cached_balance: 10000000, // 1 XLM in stroops
        balance_currency: 'XLM',
        balance_synced_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const dto: UpdateWalletBalanceDto = {
        cached_balance: 20000000, // 2 XLM in stroops
        balance_currency: 'XLM',
        balance_synced_at: new Date().toISOString(),
      };

      (mockKnex.where as jest.Mock).mockReturnValue(mockKnex);
      (mockKnex.update as jest.Mock).mockReturnValue(mockKnex);
      (mockKnex.returning as jest.Mock).mockResolvedValue([mockWallet]);

      const result = await repository.updateBalance('wallet-123', dto);

      expect(mockKnex.where).toHaveBeenCalledWith({ id: 'wallet-123' });
      expect(mockKnex.update).toHaveBeenCalled();
      expect(result).toEqual(mockWallet);
    });
  });

  describe('delete', () => {
    it('should delete wallet and return true', async () => {
      (mockKnex.where as jest.Mock).mockReturnValue(mockKnex);
      (mockKnex.delete as jest.Mock).mockResolvedValue(1);

      const result = await repository.delete('wallet-123');

      expect(mockKnex.where).toHaveBeenCalledWith({ id: 'wallet-123' });
      expect(result).toBe(true);
    });

    it('should return false if wallet not found', async () => {
      (mockKnex.where as jest.Mock).mockReturnValue(mockKnex);
      (mockKnex.delete as jest.Mock).mockResolvedValue(0);

      const result = await repository.delete('nonexistent');

      expect(result).toBe(false);
    });
  });
});
