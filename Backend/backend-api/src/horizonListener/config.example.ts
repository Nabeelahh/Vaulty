/**
 * Configuration examples for Horizon Event Listener
 * Copy these to your .env file or pass as environment variables
 */

/**
 * ENVIRONMENT VARIABLES
 */

// Horizon API endpoint
// For public network: https://horizon.stellar.org
// For testnet: https://horizon-testnet.stellar.org
export const HORIZON_URL =
  process.env.HORIZON_URL || "https://horizon-testnet.stellar.org";

// Stellar network to monitor
// Options: 'public' or 'testnet'
export const STELLAR_NETWORK =
  (process.env.STELLAR_NETWORK as "public" | "testnet") || "testnet";

// Initial reconnection delay in milliseconds
// The delay will exponentially increase up to maxDelayMs
export const RECONNECT_INTERVAL = parseInt(
  process.env.RECONNECT_INTERVAL || "1000",
);

// Maximum number of reconnection attempts
// After this, the listener will emit 'maxReconnectAttemptsReached'
export const MAX_RECONNECT_ATTEMPTS = parseInt(
  process.env.MAX_RECONNECT_ATTEMPTS || "5",
);

// Maximum number of events to hold in the queue
// Older events will be dropped if queue exceeds this
export const EVENT_QUEUE_MAX_SIZE = parseInt(
  process.env.EVENT_QUEUE_MAX_SIZE || "1000",
);

// Queue polling interval in milliseconds
// How frequently the queue processor checks for new events
export const QUEUE_POLL_INTERVAL = parseInt(
  process.env.QUEUE_POLL_INTERVAL || "100",
);

// Comma-separated list of contract addresses to monitor
export const MONITORED_CONTRACTS =
  process.env.MONITORED_CONTRACTS?.split(",") || [];

// Comma-separated list of source accounts to monitor
export const MONITORED_ACCOUNTS =
  process.env.MONITORED_ACCOUNTS?.split(",") || [];

// Automatically start the listener when the application starts
export const AUTO_START_LISTENER = process.env.AUTO_START_LISTENER === "true";

// Enable debug logging
export const DEBUG_MODE = process.env.DEBUG_MODE === "true";

/**
 * EXAMPLE .env FILE
 */

const exampleEnvFile = `
# Horizon Configuration
HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_NETWORK=testnet

# Connection Settings
RECONNECT_INTERVAL=1000
MAX_RECONNECT_ATTEMPTS=5

# Queue Settings
EVENT_QUEUE_MAX_SIZE=1000
QUEUE_POLL_INTERVAL=100

# Contract Monitoring
# Comma-separated contract addresses
MONITORED_CONTRACTS=CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4,CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBSC4

# Account Monitoring
# Comma-separated account addresses
MONITORED_ACCOUNTS=GBCD123,GBDEF456

# Application Settings
AUTO_START_LISTENER=true
DEBUG_MODE=false

# Server Port
PORT=3000

# Database (if using)
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=remitroot
# DB_USER=admin
# DB_PASSWORD=password
`;

/**
 * CONFIGURATION PROFILES
 */

/**
 * Development Profile - Testnet with aggressive reconnection
 */
export const developmentConfig = {
  horizonUrl: "https://horizon-testnet.stellar.org",
  network: "testnet" as const,
  reconnectInterval: 1000,
  maxReconnectAttempts: 10,
  eventQueueMaxSize: 500,
  pollInterval: 100,
};

/**
 * Production Profile - Public network with conservative settings
 */
export const productionConfig = {
  horizonUrl: "https://horizon.stellar.org",
  network: "public" as const,
  reconnectInterval: 5000,
  maxReconnectAttempts: 15,
  eventQueueMaxSize: 5000,
  pollInterval: 50,
};

/**
 * Testing Profile - Minimal configuration for unit tests
 */
export const testingConfig = {
  horizonUrl: "https://horizon-testnet.stellar.org",
  network: "testnet" as const,
  reconnectInterval: 100,
  maxReconnectAttempts: 2,
  eventQueueMaxSize: 100,
  pollInterval: 10,
};

/**
 * High-Volume Profile - For systems processing many events
 */
export const highVolumeConfig = {
  horizonUrl: "https://horizon.stellar.org",
  network: "public" as const,
  reconnectInterval: 2000,
  maxReconnectAttempts: 20,
  eventQueueMaxSize: 10000,
  pollInterval: 25,
};

/**
 * Low-Latency Profile - For real-time trading or critical operations
 */
export const lowLatencyConfig = {
  horizonUrl: "https://horizon.stellar.org",
  network: "public" as const,
  reconnectInterval: 500,
  maxReconnectAttempts: 10,
  eventQueueMaxSize: 2000,
  pollInterval: 10,
};

/**
 * Get configuration based on environment
 */
export function getConfig(env?: string): any {
  const environment = env || process.env.NODE_ENV || "development";

  const configs: Record<string, any> = {
    development: developmentConfig,
    production: productionConfig,
    test: testingConfig,
    "high-volume": highVolumeConfig,
    "low-latency": lowLatencyConfig,
  };

  return configs[environment] || developmentConfig;
}

/**
 * CONFIGURATION RECOMMENDATIONS
 */

const recommendations = `
Configuration Recommendations:

1. DEVELOPMENT
   - Use testnet to avoid production impact
   - Enable debug logging for troubleshooting
   - Use smaller queue sizes to catch issues early
   - Increase reconnect attempts for stability

2. PRODUCTION
   - Use public network endpoint
   - Increase queue size for handling traffic spikes
   - Set appropriate reconnection intervals
   - Monitor queue metrics closely
   - Set up alerts for max reconnect attempts

3. HIGH-VOLUME ENVIRONMENTS
   - Increase eventQueueMaxSize to 5000-10000
   - Reduce pollInterval to 25-50ms
   - Use multiple listener instances if needed
   - Monitor memory usage

4. LOW-LATENCY REQUIREMENTS
   - Minimize pollInterval (10-50ms)
   - Keep queue size moderate (1000-5000)
   - Use dedicated hardware
   - Monitor CPU usage

TUNING GUIDE:

- If queue frequently fills up: increase eventQueueMaxSize
- If seeing high latency: decrease pollInterval
- If CPU usage is high: increase pollInterval
- If memory is high: decrease eventQueueMaxSize
- If losing reconnection on failures: increase maxReconnectAttempts

MONITORING:

Use these endpoints to monitor the listener:
- GET /health - Basic health check
- GET /api/listener/state - Current state and metrics
- GET /api/events/recent - Recently processed events

Monitor these metrics:
- queue size: Number of pending events
- processed: Total events successfully processed
- failed: Events that failed to process
- connected: Listener connection status
- reconnect attempts: Number of reconnection tries
`;

export { exampleEnvFile, recommendations };
