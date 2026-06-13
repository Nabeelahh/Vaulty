/**
 * Example usage of Horizon Event Stream Listener
 * This demonstrates how to integrate the listener in your application
 */

import HorizonEventStreamListener from "./horizonListener";
import { ProcessedEvent } from "./horizonListener/types";

/**
 * Example 1: Basic setup with transaction monitoring
 */
export async function exampleBasicSetup() {
  const listener = new HorizonEventStreamListener({
    horizonUrl:
      process.env.HORIZON_URL || "https://horizon-testnet.stellar.org",
    network: (process.env.STELLAR_NETWORK as "public" | "testnet") || "testnet",
    reconnectInterval: 1000,
    maxReconnectAttempts: 5,
    eventQueueMaxSize: 1000,
    pollInterval: 100,
  });

  // Simple event processor
  listener.registerProcessor(async (event) => {
    console.log(`Processing ${event.eventType} event`, {
      id: event.id,
      timestamp: event.timestamp,
      valid: event.valid,
    });
  });

  // Start listening from the latest block
  await listener.start("now");

  return listener;
}

/**
 * Example 2: Contract event monitoring
 */
export async function exampleContractMonitoring(contractAddress: string) {
  const listener = new HorizonEventStreamListener({
    horizonUrl: "https://horizon.stellar.org",
    network: "public",
    reconnectInterval: 1000,
    maxReconnectAttempts: 5,
    eventQueueMaxSize: 2000,
    pollInterval: 100,
  });

  // Configure to only listen for contract events
  listener.setFilterOptions({
    includeTransactions: false,
    includeOperations: false,
    includeContractEvents: true,
    contractAddresses: [contractAddress],
  });

  // Process contract events
  listener.registerProcessor(async (event) => {
    if (event.eventType === "contract") {
      console.log("Contract event detected:", {
        contractId: (event.data as any).contractId,
        topics: (event.data as any).topics,
        ledgerSequence: (event.data as any).ledgerSequence,
      });

      // Update your database with contract event
      await saveContractEvent(event);
    }
  });

  // Handle connection events
  listener.on("connected", () => {
    console.log("✓ Connected to contract event stream");
  });

  listener.on("error", (error) => {
    console.error("✗ Stream error:", error.message);
  });

  listener.on("maxReconnectAttemptsReached", () => {
    console.error("✗ Failed to reconnect. Alerting administrators...");
    // Send alert to monitoring system
    alertAdministrators("Horizon listener max reconnect attempts reached");
  });

  await listener.start("now");

  return listener;
}

/**
 * Example 3: Multi-contract escrow monitoring with data persistence
 */
export async function exampleEscrowMonitoring(escrowContracts: string[]) {
  const listener = new HorizonEventStreamListener({
    horizonUrl: "https://horizon.stellar.org",
    network: "public",
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
    eventQueueMaxSize: 5000,
    pollInterval: 50,
  });

  // Monitor multiple escrow contracts
  listener.setFilterOptions({
    includeContractEvents: true,
    contractAddresses: escrowContracts,
  });

  // Processor 1: Validate and parse events
  listener.registerProcessor(async (event) => {
    if (!event.valid) {
      console.warn("Invalid event received:", event.errors);
      return;
    }

    console.log(
      `Valid ${event.eventType} event processed at ${event.processedAt}`,
    );
  });

  // Processor 2: Persist events to database
  listener.registerProcessor(async (event) => {
    try {
      await persistEventToDatabase(event);
    } catch (error) {
      console.error("Failed to persist event:", error);
      // Implement retry logic or alerting
    }
  });

  // Processor 3: Monitor for specific contract events
  listener.registerProcessor(async (event) => {
    if (event.eventType === "contract") {
      const contractData = event.data as any;

      // Check for escrow completion events
      if (contractData.topics?.includes("escrow_completed")) {
        await handleEscrowCompletion(event);
      }

      // Check for refund events
      if (contractData.topics?.includes("escrow_refund")) {
        await handleEscrowRefund(event);
      }
    }
  });

  // Monitor queue health
  setInterval(() => {
    const metrics = listener.getQueueMetrics();
    console.log("Queue metrics:", {
      size: metrics.queueSize,
      processed: metrics.processed,
      failed: metrics.failed,
    });

    if (metrics.queueSize > 4000) {
      console.warn("Queue is getting full, reducing other workloads");
    }
  }, 60000);

  // Handle graceful shutdown
  process.on("SIGTERM", async () => {
    console.log("Shutting down listener...");
    listener.stop();

    const finalMetrics = listener.getQueueMetrics();
    console.log("Final metrics:", finalMetrics);

    process.exit(0);
  });

  await listener.start("now");

  return listener;
}

/**
 * Example 4: Dynamic filter management
 */
export async function exampleDynamicFiltering() {
  const listener = new HorizonEventStreamListener({
    horizonUrl: "https://horizon-testnet.stellar.org",
    network: "testnet",
    reconnectInterval: 1000,
    maxReconnectAttempts: 5,
    eventQueueMaxSize: 1000,
    pollInterval: 100,
  });

  // Start with basic filtering
  listener.setFilterOptions({
    includeTransactions: true,
    includeContractEvents: false,
  });

  listener.registerProcessor(async (event) => {
    console.log(`Event: ${event.eventType}`);
  });

  await listener.start("now");

  // Dynamically add a contract to monitor after 30 seconds
  setTimeout(() => {
    const newContractAddress =
      "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
    console.log(`Adding contract to filter: ${newContractAddress}`);

    listener.addContractAddress(newContractAddress);

    // Update filter to include contract events
    listener.setFilterOptions({
      includeTransactions: true,
      includeContractEvents: true,
    });
  }, 30000);

  // Dynamically remove contract after 60 seconds
  setTimeout(() => {
    const contractToRemove =
      "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
    console.log(`Removing contract from filter: ${contractToRemove}`);

    listener.removeContractAddress(contractToRemove);
  }, 60000);

  return listener;
}

/**
 * Example 5: Event replay and recovery
 */
export async function exampleEventRecovery(lastProcessedLedger: number) {
  const listener = new HorizonEventStreamListener({
    horizonUrl: "https://horizon.stellar.org",
    network: "public",
    reconnectInterval: 1000,
    maxReconnectAttempts: 5,
    eventQueueMaxSize: 1000,
    pollInterval: 100,
  });

  // Track processed events
  let processedCount = 0;

  listener.registerProcessor(async (event) => {
    processedCount++;

    // Check if this is an event we've already processed
    const isReprocessed = await checkIfAlreadyProcessed(event);

    if (!isReprocessed) {
      await processEvent(event);
    }
  });

  listener.on("error", async (error) => {
    console.error("Listener error:", error);

    // On recovery, get the last processed cursor
    const lastCursor = await getLastProcessedCursor();
    console.log("Resuming from cursor:", lastCursor);

    // Restart the listener from the last known good position
    listener.stop();
    await listener.start(lastCursor);
  });

  console.log(`Starting from ledger ${lastProcessedLedger}`);
  await listener.start(`${lastProcessedLedger}-0`);

  return listener;
}

/**
 * Helper functions (implement according to your application)
 */

async function saveContractEvent(event: ProcessedEvent) {
  // Save to your database
  console.log("Saving contract event:", event.id);
}

async function persistEventToDatabase(event: ProcessedEvent) {
  // Implement database persistence
  console.log("Persisting event to database:", event.id);
}

async function handleEscrowCompletion(event: ProcessedEvent) {
  console.log("Escrow completion detected:", event.id);
  // Handle the completion
}

async function handleEscrowRefund(event: ProcessedEvent) {
  console.log("Escrow refund detected:", event.id);
  // Handle the refund
}

function alertAdministrators(message: string) {
  console.error("ALERT:", message);
  // Send to your monitoring system (Sentry, PagerDuty, etc.)
}

async function checkIfAlreadyProcessed(
  event: ProcessedEvent,
): Promise<boolean> {
  // Check your database
  return false;
}

async function processEvent(event: ProcessedEvent) {
  console.log("Processing new event:", event.id);
  // Your business logic here
}

async function getLastProcessedCursor(): Promise<string> {
  // Retrieve from your database
  return "now";
}

/**
 * Usage example
 */
async function main() {
  try {
    // Choose which example to run
    // const listener = await exampleBasicSetup();
    const listener = await exampleContractMonitoring(
      "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    );

    // Keep the process alive
    process.stdin.resume();

    process.on("SIGINT", () => {
      console.log("\nShutting down...");
      listener.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error("Failed to start listener:", error);
    process.exit(1);
  }
}

// Uncomment to run
// main();

export {
  exampleBasicSetup,
  exampleContractMonitoring,
  exampleEscrowMonitoring,
  exampleDynamicFiltering,
  exampleEventRecovery,
};
