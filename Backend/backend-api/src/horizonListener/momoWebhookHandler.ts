import { Request, Response } from 'express';
import { MomoWebhookPayload, MomoTransactionRecord } from '../models/MomoTransaction';

// In production, replace with your DB service (e.g., Prisma, TypeORM)
const transactionStore = new Map<string, MomoTransactionRecord>();

function validatePaymentAmount(amount: string, expectedAmount: number): boolean {
  const receivedAmount = parseFloat(amount);
  if (isNaN(receivedAmount) || receivedAmount <= 0) return false;
  // Allow ±1% tolerance for currency rounding
  return Math.abs(receivedAmount - expectedAmount) / expectedAmount < 0.01;
}

function validatePayerIdentity(
  payload: MomoWebhookPayload,
  expectedPhone?: string
): boolean {
  if (!expectedPhone) return true; // No identity check required
  // Normalize phone numbers: strip leading + or country code
  const normalize = (p: string) => p.replace(/^\+?234/, '0').replace(/\D/g, '');
  return normalize(payload.payer.partyId) === normalize(expectedPhone);
}

export async function handleMomoPaymentNotification(
  req: Request,
  res: Response
): Promise<void> {
  const payload = req.body as MomoWebhookPayload;

  console.info(`[MoMo] Received webhook for transaction: ${payload.financialTransactionId}`);

  // ── Structural validation ──────────────────────────────────────────────────
  const required: (keyof MomoWebhookPayload)[] = [
    'financialTransactionId', 'externalId', 'amount', 'currency', 'payer', 'status',
  ];
  const missing = required.filter(field => !payload[field]);
  if (missing.length) {
    console.warn(`[MoMo] Missing required fields: ${missing.join(', ')}`);
    res.status(400).json({ error: 'Invalid payload', missing });
    return;
  }

  // ── Idempotency: ignore duplicates ────────────────────────────────────────
  if (transactionStore.has(payload.financialTransactionId)) {
    console.info(`[MoMo] Duplicate webhook ignored: ${payload.financialTransactionId}`);
    res.status(200).json({ message: 'Already processed' });
    return;
  }

  // ── Amount validation (fetch expected amount from your DB by externalId) ──
  // TODO: Replace with real DB lookup
  const expectedAmount = await getExpectedAmount(payload.externalId);
  if (expectedAmount !== null && !validatePaymentAmount(payload.amount, expectedAmount)) {
    console.error(`[MoMo] Amount mismatch for ${payload.externalId}: got ${payload.amount}, expected ${expectedAmount}`);
    res.status(422).json({ error: 'Payment amount mismatch' });
    return;
  }

  // ── Identity verification ─────────────────────────────────────────────────
  const expectedPhone = await getExpectedPayerPhone(payload.externalId);
  if (!validatePayerIdentity(payload, expectedPhone)) {
    console.error(`[MoMo] Payer identity mismatch for ${payload.externalId}`);
    res.status(422).json({ error: 'Payer identity mismatch' });
    return;
  }

  // ── Persist transaction record ────────────────────────────────────────────
  const record: MomoTransactionRecord = {
    transactionId: payload.financialTransactionId,
    externalId: payload.externalId,
    amount: parseFloat(payload.amount),
    currency: payload.currency,
    payerPhone: payload.payer.partyId,
    status: payload.status,
    rawPayload: payload,
    receivedAt: new Date(),
    validated: true,
  };
  transactionStore.set(payload.financialTransactionId, record);

  // ── Handle payment outcome ─────────────────────────────────────────────────
  switch (payload.status) {
    case 'SUCCESSFUL':
      console.info(`[MoMo] ✅ Payment confirmed: ${payload.financialTransactionId}`);
      await onPaymentSuccess(record);
      break;
    case 'FAILED':
    case 'TIMEOUT':
      console.warn(`[MoMo] ❌ Payment ${payload.status}: ${payload.financialTransactionId} — ${payload.reason}`);
      await onPaymentFailure(record);
      break;
    case 'PENDING':
      console.info(`[MoMo] ⏳ Payment still pending: ${payload.financialTransactionId}`);
      break;
  }

  res.status(200).json({ message: 'Webhook received', status: payload.status });
}

// ── Stub functions — replace with real DB/service calls ───────────────────
async function getExpectedAmount(_externalId: string): Promise<number | null> {
  // TODO: query your orders/payments table
  return null;
}

async function getExpectedPayerPhone(_externalId: string): Promise<string | undefined> {
  // TODO: query your users/orders table
  return undefined;
}

async function onPaymentSuccess(record: MomoTransactionRecord): Promise<void> {
  // TODO: update order status, trigger fulfillment, send confirmation email, etc.
  console.info(`[MoMo] Processing successful payment for order: ${record.externalId}`);
}

async function onPaymentFailure(record: MomoTransactionRecord): Promise<void> {
  // TODO: update order status, notify user, trigger retry logic, etc.
  console.info(`[MoMo] Processing failed payment for order: ${record.externalId}`);
}