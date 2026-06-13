/**
 * Type definitions for Horizon event stream listener
 */

export interface HorizonEventStreamConfig {
  horizonUrl: string;
  network: "public" | "testnet";
  reconnectInterval: number; // milliseconds
  maxReconnectAttempts: number;
  eventQueueMaxSize: number;
  pollInterval: number; // milliseconds for processing queue
}

export interface TransactionEvent {
  id: string;
  type: "transaction";
  timestamp: string;
  hash: string;
  sourceAccount: string;
  operationCount: number;
  fees: string;
  successful: boolean;
  ledgerSequence: number;
  envelope?: {
    tx?: {
      operations?: Array<{
        type: string;
        [key: string]: unknown;
      }>;
    };
  };
}

export interface OperationEvent {
  id: string;
  type: "operation";
  timestamp: string;
  transactionHash: string;
  operationType: string;
  sourceAccount: string;
  details: Record<string, unknown>;
}

export interface ContractEvent {
  id: string;
  type: "contract";
  timestamp: string;
  contractId: string;
  transactionHash: string;
  eventType: string;
  topics: string[];
  data: string;
  ledgerSequence: number;
  ledgerClosedAt: string;
}

export type BlockchainEvent = TransactionEvent | OperationEvent | ContractEvent;

export interface ProcessedEvent {
  id: string;
  originalId: string;
  eventType: "transaction" | "operation" | "contract";
  contractRelated: boolean;
  timestamp: string;
  data: BlockchainEvent;
  processedAt: string;
  valid: boolean;
  errors?: string[];
}

export interface EventFilterOptions {
  includeTransactions?: boolean;
  includeOperations?: boolean;
  includeContractEvents?: boolean;
  contractAddresses?: string[];
  sourceAccounts?: string[];
  operationTypes?: string[];
}

export interface HorizonListenerState {
  connected: boolean;
  reconnectAttempts: number;
  lastEventId: string | null;
  eventsProcessed: number;
  errorsEncountered: number;
  lastError?: string;
  lastErrorTime?: string;
}

export interface EventQueueMetrics {
  queueSize: number;
  processed: number;
  failed: number;
  totalReceived: number;
}

export interface ReconnectionConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}
