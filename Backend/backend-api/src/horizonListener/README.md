# Horizon Event Stream Listener

A robust TypeScript implementation for monitoring Stellar blockchain transactions and contract events using the Horizon API.

## Features

- **Event Stream Connection**: Reliable connection to Stellar Horizon API with automatic reconnection
- **Event Filtering**: Advanced filtering for transactions, operations, and contract events
- **Event Validation**: Comprehensive parsing and validation of blockchain events
- **Reconnection Logic**: Exponential backoff retry mechanism for stream failures
- **Event Queue Processing**: Asynchronous event queue with pluggable processors
- **Error Handling**: Graceful error handling with detailed logging
- **TypeScript Support**: Full type safety for all event structures

## Installation

```bash
npm install
```

## Quick Start

```typescript
import HorizonEventStreamListener from "./src/horizonListener";

// Create listener instance
const listener = new HorizonEventStreamListener({
  horizonUrl: "https://horizon-testnet.stellar.org",
  network: "testnet",
  reconnectInterval: 1000,
  maxReconnectAttempts: 5,
  eventQueueMaxSize: 1000,
  pollInterval: 100,
});

// Register event processor
listener.registerProcessor(async (event) => {
  console.log("Processing event:", event);
  // Handle the event
});

// Configure filters
listener.setFilterOptions({
  includeTransactions: true,
  includeContractEvents: true,
  contractAddresses: [
    "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
  ],
});

// Start listening
await listener.start("now");

// Listen for lifecycle events
listener.on("connected", () => console.log("Connected to Horizon"));
listener.on("disconnected", () => console.log("Disconnected from Horizon"));
listener.on("error", (error) => console.error("Error:", error));
listener.on("eventReceived", (event) =>
  console.log("Event received:", event.id),
);
```

## API Reference

### HorizonEventStreamListener

Main class for managing the event stream connection and processing.

#### Constructor

```typescript
new HorizonEventStreamListener(config: HorizonEventStreamConfig, logger?: Console)
```

#### Configuration

```typescript
interface HorizonEventStreamConfig {
  horizonUrl: string; // Horizon API endpoint
  network: "public" | "testnet"; // Stellar network
  reconnectInterval: number; // Initial reconnect delay (ms)
  maxReconnectAttempts: number; // Max reconnection attempts
  eventQueueMaxSize: number; // Maximum queue size
  pollInterval: number; // Queue processing interval (ms)
}
```

#### Methods

**start(cursor?: string): Promise<void>**

- Start listening to events
- `cursor`: Optional paging token to resume from (defaults to 'now')

**stop(): void**

- Stop listening and disconnect

**registerProcessor(processor: EventProcessor): void**

- Register a callback function to process events
- Processors are called asynchronously and can fail gracefully

**unregisterProcessor(processor: EventProcessor): void**

- Unregister an event processor

**setFilterOptions(options: Partial<EventFilterOptions>): void**

- Configure event filtering

**getFilterOptions(): EventFilterOptions**

- Get current filter configuration

**addContractAddress(address: string): void**

- Add a contract address to the filter

**removeContractAddress(address: string): void**

- Remove a contract address from the filter

**addSourceAccount(account: string): void**

- Add a source account to the filter

**removeSourceAccount(account: string): void**

- Remove a source account from the filter

**getState(): HorizonListenerState**

- Get current connection state and statistics

**getQueueMetrics(): EventQueueMetrics**

- Get event queue processing metrics

**getQueueSize(): number**

- Get current queue size

**resetMetrics(): void**

- Reset all metrics

**running(): boolean**

- Check if listener is currently running

**setMaxQueueSize(size: number): void**

- Update maximum queue size

**setQueuePollInterval(interval: number): void**

- Update queue processing poll interval

### Event Filters

```typescript
interface EventFilterOptions {
  includeTransactions?: boolean; // Process transaction events
  includeOperations?: boolean; // Process operation events
  includeContractEvents?: boolean; // Process contract events
  contractAddresses?: string[]; // Filter by contract IDs
  sourceAccounts?: string[]; // Filter by source accounts
  operationTypes?: string[]; // Filter by operation types
}
```

### Event Types

#### TransactionEvent

```typescript
interface TransactionEvent {
  id: string;
  type: "transaction";
  timestamp: string;
  hash: string;
  sourceAccount: string;
  operationCount: number;
  fees: string;
  successful: boolean;
  ledgerSequence: number;
  envelope?: object;
}
```

#### OperationEvent

```typescript
interface OperationEvent {
  id: string;
  type: "operation";
  timestamp: string;
  transactionHash: string;
  operationType: string;
  sourceAccount: string;
  details: Record<string, unknown>;
}
```

#### ContractEvent

```typescript
interface ContractEvent {
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
```

#### ProcessedEvent

```typescript
interface ProcessedEvent {
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
```

## Advanced Usage

### Filtering for Contract Events

```typescript
listener.setFilterOptions({
  includeTransactions: false,
  includeOperations: false,
  includeContractEvents: true,
  contractAddresses: [
    "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBSC4",
  ],
});
```

### Multiple Event Processors

```typescript
// Log all events
listener.registerProcessor(async (event) => {
  console.log(`Event: ${event.eventType}`, event.data);
});

// Process contract events
listener.registerProcessor(async (event) => {
  if (event.eventType === "contract") {
    await processContractEvent(event.data);
  }
});

// Update database
listener.registerProcessor(async (event) => {
  await database.saveEvent(event);
});
```

### Monitoring and Metrics

```typescript
// Get detailed state
const state = listener.getState();
console.log(`Events processed: ${state.eventsProcessed}`);
console.log(`Errors encountered: ${state.errorsEncountered}`);
console.log(`Connected: ${state.connected}`);

// Get queue metrics
const metrics = listener.getQueueMetrics();
console.log(`Queue size: ${metrics.queueSize}`);
console.log(`Processed: ${metrics.processed}`);
console.log(`Failed: ${metrics.failed}`);
console.log(`Total received: ${metrics.totalReceived}`);
```

### Event Lifecycle Monitoring

```typescript
listener.on("connected", () => {
  console.log("✓ Connected to Horizon");
});

listener.on("disconnected", () => {
  console.log("✗ Disconnected from Horizon");
});

listener.on("error", (error) => {
  console.error("Connection error:", error.message);
});

listener.on("eventReceived", (event) => {
  console.log(`Received ${event.eventType} event: ${event.id}`);
});

listener.on("maxReconnectAttemptsReached", () => {
  console.error("Failed to reconnect after max attempts");
  // Implement fallback logic
});

listener.on("started", () => {
  console.log("Listener started");
});

listener.on("stopped", () => {
  console.log("Listener stopped");
});
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test HorizonConnection.test.ts

# Generate coverage report
npm test -- --coverage
```

### Test Files

- `HorizonConnection.test.ts` - Tests for connection management and stream handling
- `EventFilter.test.ts` - Tests for event filtering logic
- `EventParser.test.ts` - Tests for event parsing and validation
- `EventQueue.test.ts` - Tests for queue management and processing
- `index.test.ts` - Integration tests for the full listener

## Architecture

### Components

1. **HorizonConnection**: Manages the actual connection to Horizon API
   - Stream establishment and error handling
   - Automatic reconnection with exponential backoff
   - Event emission from stream

2. **EventFilter**: Filters events based on configured criteria
   - Event type filtering (transactions, operations, contracts)
   - Contract address filtering
   - Source account filtering
   - Operation type filtering

3. **EventParser**: Parses and validates events
   - Converts raw Horizon responses to typed event objects
   - Validates event structure and content
   - Extracts relevant data
   - Detects contract-related events

4. **EventQueue**: Manages asynchronous event processing
   - Enqueues events for processing
   - Maintains configurable queue size
   - Processes events in batches
   - Tracks metrics (processed, failed, total)

5. **HorizonEventStreamListener**: Main coordinator
   - Orchestrates all components
   - Manages the full event pipeline
   - Provides public API for configuration and monitoring

## Error Handling

The listener implements comprehensive error handling:

- **Connection Errors**: Automatically attempts reconnection with exponential backoff
- **Parse Errors**: Invalid events are skipped with warnings
- **Processor Errors**: Individual processor failures don't affect other processors
- **Queue Full**: New events are dropped with warnings when queue is full

## Performance Considerations

- **Queue Size**: Default 1000 events. Increase for high-volume scenarios
- **Poll Interval**: Default 100ms. Decrease for lower latency, increase for lower CPU usage
- **Batch Processing**: Processes up to 10 events per poll interval
- **Concurrent Processors**: All registered processors execute for each event

## Best Practices

1. **Error Handling in Processors**

   ```typescript
   listener.registerProcessor(async (event) => {
     try {
       await processEvent(event);
     } catch (error) {
       logger.error("Failed to process event", { eventId: event.id, error });
       // Implement retry or fallback logic
     }
   });
   ```

2. **Memory Management**

   ```typescript
   // Increase queue size for high-volume scenarios
   listener.setMaxQueueSize(5000);

   // Adjust poll interval based on processing speed
   listener.setQueuePollInterval(50);
   ```

3. **Monitoring**

   ```typescript
   setInterval(() => {
     const metrics = listener.getQueueMetrics();
     if (metrics.queueSize > 900) {
       logger.warn("Queue nearly full", metrics);
     }
   }, 60000);
   ```

4. **Graceful Shutdown**
   ```typescript
   process.on("SIGTERM", () => {
     listener.stop();
     process.exit(0);
   });
   ```

## Environment Variables

Recommended environment variables:

```bash
HORIZON_URL=https://horizon.stellar.org
STELLAR_NETWORK=public
RECONNECT_INTERVAL=1000
MAX_RECONNECT_ATTEMPTS=5
EVENT_QUEUE_MAX_SIZE=1000
QUEUE_POLL_INTERVAL=100
```

## License

MIT
