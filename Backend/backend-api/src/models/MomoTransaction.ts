export type MomoTransactionStatus = 
  | 'SUCCESSFUL' 
  | 'FAILED' 
  | 'PENDING' 
  | 'TIMEOUT';

export interface MomoWebhookPayload {
  financialTransactionId: string;
  externalId: string;
  amount: string;
  currency: string;
  payer: {
    partyIdType: 'MSISDN' | 'EMAIL' | 'PARTY_CODE';
    partyId: string;
  };
  payerMessage?: string;
  payeeNote?: string;
  status: MomoTransactionStatus;
  reason?: string;
}

export interface MomoTransactionRecord {
  transactionId: string;
  externalId: string;
  amount: number;
  currency: string;
  payerPhone: string;
  status: MomoTransactionStatus;
  rawPayload: MomoWebhookPayload;
  receivedAt: Date;
  validated: boolean;
}