import { Router, Request, Response, NextFunction } from 'express';
import { WalletService } from '../services/wallet.service';
import { WalletRepository } from '../repositories/wallet.repository';
import { StellarClient } from '../services/stellar.client';
import { HttpError } from '../middleware/errorHandler';
import getDb from '../db';

const router = Router();

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

// ─── Middleware ───────────────────────────────────────────────────────────────

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/**
 * Mock authentication middleware
 * In production, this would verify JWT tokens
 * For now, we'll use a header or query param for user ID
 */
const authenticateUser = (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
  const userId = req.headers['x-user-id'] as string || req.query.user_id as string;
  
  if (!userId) {
    throw HttpError.unauthorized('User authentication required');
  }

  req.user = { id: userId, email: '' };
  next();
};

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/wallets
 * Create a wallet for the authenticated user
 */
router.post(
  '/',
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw HttpError.unauthorized('User authentication required');
    }

    const db = getDb();
    const walletRepository = new WalletRepository(db);
    const stellarClient = new StellarClient();
    const walletService = new WalletService(walletRepository, stellarClient);

    const wallet = await walletService.createWallet(req.user.id);

    const response: ApiResponse<typeof wallet> = {
      success: true,
      data: wallet,
      message: 'Wallet created successfully',
    };

    res.status(201).json(response);
  })
);

/**
 * GET /api/wallets/me
 * Return the authenticated user's wallet address and cached balance
 */
router.get(
  '/me',
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw HttpError.unauthorized('User authentication required');
    }

    const db = getDb();
    const walletRepository = new WalletRepository(db);
    const stellarClient = new StellarClient();
    const walletService = new WalletService(walletRepository, stellarClient);

    const wallet = await walletService.getWalletByUserId(req.user.id);

    const response: ApiResponse<typeof wallet> = {
      success: true,
      data: wallet,
    };

    res.json(response);
  })
);

/**
 * GET /api/wallets/:id/balance
 * Fetch live balance via the Stellar SDK
 */
router.get(
  '/:id/balance',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const db = getDb();
    const walletRepository = new WalletRepository(db);
    const stellarClient = new StellarClient();
    const walletService = new WalletService(walletRepository, stellarClient);

    const balance = await walletService.getLiveBalance(id);

    const response: ApiResponse<typeof balance> = {
      success: true,
      data: balance,
    };

    res.json(response);
  })
);

/**
 * GET /api/wallets/:id
 * Get wallet by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const db = getDb();
    const walletRepository = new WalletRepository(db);
    const stellarClient = new StellarClient();
    const walletService = new WalletService(walletRepository, stellarClient);

    const wallet = await walletService.getWalletById(id);

    const response: ApiResponse<typeof wallet> = {
      success: true,
      data: wallet,
    };

    res.json(response);
  })
);

// ─── Global error handler for this router ────────────────────────────────────

router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(`[WalletRouter Error] ${err.message}`, err.stack);
  res.status(500).json(<ApiResponse<null>>{
    success: false,
    error: 'An unexpected error occurred',
  });
});

export default router;
