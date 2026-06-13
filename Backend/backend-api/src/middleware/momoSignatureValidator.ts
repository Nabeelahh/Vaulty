import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const MOMO_WEBHOOK_SECRET = process.env.MOMO_WEBHOOK_SECRET || '';

export function validateMomoSignature(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const signature = req.headers['x-callback-signature'] as string;

  if (!signature) {
    res.status(401).json({ error: 'Missing webhook signature' });
    return;
  }

  if (!MOMO_WEBHOOK_SECRET) {
    console.error('[MoMo] MOMO_WEBHOOK_SECRET is not configured');
    res.status(500).json({ error: 'Webhook secret not configured' });
    return;
  }

  // MTN MoMo signs the raw body with HMAC-SHA256
  const rawBody = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', MOMO_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );

  if (!isValid) {
    console.warn('[MoMo] Invalid webhook signature received');
    res.status(403).json({ error: 'Invalid signature' });
    return;
  }

  next();
}