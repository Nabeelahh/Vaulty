import { Router } from 'express';
import { validateMomoSignature } from '../middleware/momoSignatureValidator';
import { handleMomoPaymentNotification } from '../horizonListener/momoWebhookHandler';

const router = Router();

/**
 * POST /webhooks/momo/payment
 * Receives MTN MoMo payment status callbacks
 */
router.post(
  '/payment',
  validateMomoSignature,
  handleMomoPaymentNotification
);

/**
 * GET /webhooks/momo/health
 * Health check for the webhook endpoint
 */
router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'momo-webhook' });
});

export default router;