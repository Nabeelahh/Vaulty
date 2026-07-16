import { Queue, Worker, Job } from 'bullmq';
import { WalletService } from '../services/wallet.service';
import { WalletRepository } from '../repositories/wallet.repository';
import { StellarClient } from '../services/stellar.client';
import getDb from '../db';
import IORedis from 'ioredis';

// ─── Configuration ─────────────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const SYNC_INTERVAL_MINUTES = parseInt(process.env.WALLET_SYNC_INTERVAL_MINUTES || '5', 10);

// ─── Queue Setup ───────────────────────────────────────────────────────────────

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const walletSyncQueue = new Queue('wallet-sync', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

// ─── Worker Setup ───────────────────────────────────────────────────────────────

const worker = new Worker(
  'wallet-sync',
  async (job: Job) => {
    const { walletId } = job.data;

    if (!walletId) {
      throw new Error('walletId is required');
    }

    const db = getDb();
    const walletRepository = new WalletRepository(db);
    const stellarClient = new StellarClient();
    const walletService = new WalletService(walletRepository, stellarClient);

    await walletService.syncWalletBalance(walletId);

    return { success: true, walletId };
  },
  {
    connection,
    concurrency: 5,
  }
);

// ─── Worker Events ─────────────────────────────────────────────────────────────

worker.on('completed', (job) => {
  console.log(`[WalletSync] Job ${job.id} completed for wallet ${job.data.walletId}`);
});

worker.on('failed', (job, err) => {
  console.error(`[WalletSync] Job ${job?.id} failed:`, err.message);
});

// ─── Scheduled Job ─────────────────────────────────────────────────────────────

/**
 * Schedule periodic wallet balance sync for all wallets
 */
export async function scheduleWalletSync(): Promise<void> {
  // Add a recurring job to sync all wallets
  await walletSyncQueue.add(
    'sync-all-wallets',
    {},
    {
      repeat: {
        every: SYNC_INTERVAL_MINUTES * 60 * 1000, // Convert to milliseconds
      },
    }
  );

  console.log(`[WalletSync] Scheduled recurring sync every ${SYNC_INTERVAL_MINUTES} minutes`);
}

/**
 * Add a single wallet to the sync queue
 */
export async function queueWalletSync(walletId: string): Promise<void> {
  await walletSyncQueue.add('sync-single-wallet', { walletId });
  console.log(`[WalletSync] Queued sync for wallet ${walletId}`);
}

// ─── Special Handler for Sync All ───────────────────────────────────────────────

// Create a separate worker for the "sync-all-wallets" job
const syncAllWorker = new Worker(
  'wallet-sync',
  async (job: Job) => {
    if (job.name === 'sync-all-wallets') {
      const db = getDb();
      const walletRepository = new WalletRepository(db);
      const stellarClient = new StellarClient();
      const walletService = new WalletService(walletRepository, stellarClient);

      await walletService.syncAllWalletBalances();

      return { success: true, message: 'All wallets synced' };
    }
    return { success: false, message: 'Unknown job type' };
  },
  {
    connection,
    concurrency: 1, // Only one sync-all job at a time
  }
);

syncAllWorker.on('completed', (job) => {
  console.log(`[WalletSync] Sync-all job ${job.id} completed`);
});

syncAllWorker.on('failed', (job, err) => {
  console.error(`[WalletSync] Sync-all job ${job?.id} failed:`, err.message);
});

// ─── Graceful Shutdown ─────────────────────────────────────────────────────────

process.on('SIGTERM', async () => {
  console.log('[WalletSync] SIGTERM received, closing workers...');
  await worker.close();
  await syncAllWorker.close();
  await walletSyncQueue.close();
  await connection.quit();
});

process.on('SIGINT', async () => {
  console.log('[WalletSync] SIGINT received, closing workers...');
  await worker.close();
  await syncAllWorker.close();
  await walletSyncQueue.close();
  await connection.quit();
});
