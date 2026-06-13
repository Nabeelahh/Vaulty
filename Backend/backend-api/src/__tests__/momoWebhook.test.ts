import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import momoWebhookRoutes from '../routes/momoWebhook.routes';

const MOCK_SECRET = 'test-secret-key';
process.env.MOMO_WEBHOOK_SECRET = MOCK_SECRET;

const app = express();
app.use(express.json());
app.use('/webhooks/momo', momoWebhookRoutes);

function signPayload(body: object): string {
  return crypto
    .createHmac('sha256', MOCK_SECRET)
    .update(JSON.stringify(body))
    .digest('hex');
}

const validPayload = {
  financialTransactionId: 'txn-001',
  externalId: 'order-123',
  amount: '5000',
  currency: 'NGN',
  payer: { partyIdType: 'MSISDN', partyId: '2348012345678' },
  status: 'SUCCESSFUL',
};

describe('MTN MoMo Webhook', () => {
  describe('POST /webhooks/momo/payment', () => {
    it('returns 401 when signature header is missing', async () => {
      const res = await request(app).post('/webhooks/momo/payment').send(validPayload);
      expect(res.status).toBe(401);
    });

    it('returns 403 when signature is invalid', async () => {
      const res = await request(app)
        .post('/webhooks/momo/payment')
        .set('x-callback-signature', 'badsignature')
        .send(validPayload);
      expect(res.status).toBe(403);
    });

    it('returns 200 for a valid successful payment', async () => {
      const sig = signPayload(validPayload);
      const res = await request(app)
        .post('/webhooks/momo/payment')
        .set('x-callback-signature', sig)
        .send(validPayload);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SUCCESSFUL');
    });

    it('returns 200 and ignores duplicate transaction', async () => {
      const sig = signPayload(validPayload);
      await request(app)
        .post('/webhooks/momo/payment')
        .set('x-callback-signature', sig)
        .send(validPayload);
      // Send same transaction again
      const res = await request(app)
        .post('/webhooks/momo/payment')
        .set('x-callback-signature', sig)
        .send(validPayload);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Already processed');
    });

    it('returns 400 for payload missing required fields', async () => {
      const incomplete = { externalId: 'order-123', status: 'SUCCESSFUL' };
      const sig = signPayload(incomplete);
      const res = await request(app)
        .post('/webhooks/momo/payment')
        .set('x-callback-signature', sig)
        .send(incomplete);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /webhooks/momo/health', () => {
    it('returns 200 health check', async () => {
      const res = await request(app).get('/webhooks/momo/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});