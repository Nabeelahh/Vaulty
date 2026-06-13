/**
 * Integration guide: Using Horizon Event Listener with Express.js backend
 */

import express, { Express, Request, Response } from "express";
import HorizonEventStreamListener from "./horizonListener";
import {
  ProcessedEvent,
  HorizonEventStreamConfig,
} from "./horizonListener/types";

/**
 * Example Express.js application with integrated Horizon listener
 */
export class RemitRootBackend {
  private app: Express;
  private horizonListener: HorizonEventStreamListener | null = null;
  private eventCache: Map<string, ProcessedEvent> = new Map();

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes() {
    // Health check
    this.app.get("/health", (req: Request, res: Response) => {
      const state = this.horizonListener?.getState();
      const metrics = this.horizonListener?.getQueueMetrics();

      res.json({
        status: "ok",
        listener: {
          running: this.horizonListener?.running(),
          connected: state?.connected,
          metrics: metrics,
        },
      });
    });

    // Horizon listener management endpoints
    this.app.post(
      "/api/listener/start",
      async (req: Request, res: Response) => {
        try {
          if (!this.horizonListener) {
            res.status(400).json({ error: "Listener not initialized" });
            return;
          }

          const cursor = req.body.cursor || "now";
          await this.horizonListener.start(cursor);

          res.json({
            success: true,
            message: "Listener started",
            cursor,
          });
        } catch (error) {
          res.status(500).json({
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      },
    );

    this.app.post("/api/listener/stop", (req: Request, res: Response) => {
      if (!this.horizonListener) {
        res.status(400).json({ error: "Listener not initialized" });
        return;
      }

      this.horizonListener.stop();
      res.json({ success: true, message: "Listener stopped" });
    });

    // Get listener state
    this.app.get("/api/listener/state", (req: Request, res: Response) => {
      if (!this.horizonListener) {
        res.status(400).json({ error: "Listener not initialized" });
        return;
      }

      const state = this.horizonListener.getState();
      const metrics = this.horizonListener.getQueueMetrics();

      res.json({
        state,
        metrics,
        running: this.horizonListener.running(),
      });
    });

    // Configure filters
    this.app.post("/api/listener/filters", (req: Request, res: Response) => {
      if (!this.horizonListener) {
        res.status(400).json({ error: "Listener not initialized" });
        return;
      }

      const {
        includeTransactions,
        includeOperations,
        includeContractEvents,
        contractAddresses,
        sourceAccounts,
      } = req.body;

      this.horizonListener.setFilterOptions({
        includeTransactions,
        includeOperations,
        includeContractEvents,
        contractAddresses,
        sourceAccounts,
      });

      res.json({
        success: true,
        message: "Filters updated",
        filters: this.horizonListener.getFilterOptions(),
      });
    });

    // Add contract address to filter
    this.app.post(
      "/api/listener/contracts/:contractId",
      (req: Request, res: Response) => {
        if (!this.horizonListener) {
          res.status(400).json({ error: "Listener not initialized" });
          return;
        }

        const contractId = req.params.contractId;
        this.horizonListener.addContractAddress(contractId);

        res.json({
          success: true,
          message: "Contract added to filter",
          contractId,
        });
      },
    );

    // Remove contract address from filter
    this.app.delete(
      "/api/listener/contracts/:contractId",
      (req: Request, res: Response) => {
        if (!this.horizonListener) {
          res.status(400).json({ error: "Listener not initialized" });
          return;
        }

        const contractId = req.params.contractId;
        this.horizonListener.removeContractAddress(contractId);

        res.json({
          success: true,
          message: "Contract removed from filter",
          contractId,
        });
      },
    );

    // Get recent events (for demo/debugging)
    this.app.get("/api/events/recent", (req: Request, res: Response) => {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
      const events = Array.from(this.eventCache.values()).slice(-limit);

      res.json({
        count: events.length,
        events,
      });
    });

    // Get event by ID
    this.app.get("/api/events/:eventId", (req: Request, res: Response) => {
      const event = this.eventCache.get(req.params.eventId);

      if (!event) {
        res.status(404).json({ error: "Event not found" });
        return;
      }

      res.json(event);
    });
  }

  /**
   * Initialize the Horizon listener
   */
  async initializeHorizonListener(config?: Partial<HorizonEventStreamConfig>) {
    const defaultConfig: HorizonEventStreamConfig = {
      horizonUrl:
        process.env.HORIZON_URL || "https://horizon-testnet.stellar.org",
      network:
        (process.env.STELLAR_NETWORK as "public" | "testnet") || "testnet",
      reconnectInterval: parseInt(process.env.RECONNECT_INTERVAL || "1000"),
      maxReconnectAttempts: parseInt(process.env.MAX_RECONNECT_ATTEMPTS || "5"),
      eventQueueMaxSize: parseInt(process.env.EVENT_QUEUE_MAX_SIZE || "1000"),
      pollInterval: parseInt(process.env.QUEUE_POLL_INTERVAL || "100"),
    };

    const finalConfig = { ...defaultConfig, ...config };

    this.horizonListener = new HorizonEventStreamListener(finalConfig);

    // Register default processors
    this.horizonListener.registerProcessor(this.cacheEventProcessor.bind(this));
    this.horizonListener.registerProcessor(
      this.persistEventProcessor.bind(this),
    );
    this.horizonListener.registerProcessor(
      this.notifyWebSocketsProcessor.bind(this),
    );

    // Setup event handlers
    this.horizonListener.on("connected", () => {
      console.log("[Listener] Connected to Horizon");
      this.notifyBackendStatus("connected");
    });

    this.horizonListener.on("disconnected", () => {
      console.log("[Listener] Disconnected from Horizon");
      this.notifyBackendStatus("disconnected");
    });

    this.horizonListener.on("error", (error) => {
      console.error("[Listener] Error:", error);
      this.notifyBackendStatus("error", error);
    });

    this.horizonListener.on("maxReconnectAttemptsReached", () => {
      console.error("[Listener] Max reconnect attempts reached");
      this.notifyBackendStatus("maxReconnectAttemptsReached");
    });

    this.horizonListener.on("eventReceived", (event) => {
      console.log(
        `[Listener] Event received: ${event.eventType} (${event.id}) - Contract: ${event.contractRelated}`,
      );
    });

    // Optional: Start listening automatically
    const autoStart = process.env.AUTO_START_LISTENER === "true";
    if (autoStart) {
      await this.horizonListener.start("now");
    }

    return this.horizonListener;
  }

  /**
   * Event processor: Cache events in memory
   */
  private async cacheEventProcessor(event: ProcessedEvent) {
    // Keep last 1000 events in cache
    if (this.eventCache.size > 1000) {
      const firstKey = this.eventCache.keys().next().value;
      this.eventCache.delete(firstKey);
    }

    this.eventCache.set(event.id, event);
  }

  /**
   * Event processor: Persist events to database
   */
  private async persistEventProcessor(event: ProcessedEvent) {
    try {
      // TODO: Implement database persistence
      // await database.events.create({
      //   id: event.id,
      //   originalId: event.originalId,
      //   eventType: event.eventType,
      //   contractRelated: event.contractRelated,
      //   data: event.data,
      //   timestamp: event.timestamp,
      // });

      console.log("[Database] Event persisted:", event.id);
    } catch (error) {
      console.error("[Database] Failed to persist event:", error);
      // Implement retry logic or error handling
    }
  }

  /**
   * Event processor: Notify connected WebSocket clients
   */
  private async notifyWebSocketsProcessor(event: ProcessedEvent) {
    // TODO: Implement WebSocket notifications if you have connected clients
    // const message = {
    //   type: 'blockchainEvent',
    //   event,
    //   timestamp: new Date().toISOString(),
    // };
    // this.broadcastToWebSocketClients(message);
  }

  /**
   * Notify backend of listener status changes
   */
  private notifyBackendStatus(
    status:
      | "connected"
      | "disconnected"
      | "error"
      | "maxReconnectAttemptsReached",
    error?: Error,
  ) {
    // TODO: Implement status notifications
    // - Send to monitoring system
    // - Update database status
    // - Send alerts if needed

    console.log(`[Backend] Listener status changed: ${status}`, error?.message);
  }

  /**
   * Start the Express server
   */
  startServer(port: number = 3000) {
    this.app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      console.log(`Health check: http://localhost:${port}/health`);
      console.log(
        `Listener state: http://localhost:${port}/api/listener/state`,
      );
    });
  }

  /**
   * Get the Express app
   */
  getApp(): Express {
    return this.app;
  }

  /**
   * Get the listener instance
   */
  getListener(): HorizonEventStreamListener | null {
    return this.horizonListener;
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log("Shutting down backend...");

    if (this.horizonListener) {
      this.horizonListener.stop();
      const metrics = this.horizonListener.getQueueMetrics();
      console.log("Final metrics:", metrics);
    }

    process.exit(0);
  }
}

/**
 * Startup script
 */
async function startBackend() {
  const backend = new RemitRootBackend();

  // Initialize Horizon listener
  try {
    await backend.initializeHorizonListener({
      contractAddresses: process.env.MONITORED_CONTRACTS?.split(","),
    });
    console.log("✓ Horizon listener initialized");
  } catch (error) {
    console.error("✗ Failed to initialize Horizon listener:", error);
    process.exit(1);
  }

  // Start Express server
  const port = parseInt(process.env.PORT || "3000");
  backend.startServer(port);

  // Handle graceful shutdown
  process.on("SIGTERM", () => backend.shutdown());
  process.on("SIGINT", () => backend.shutdown());
}

// Export for use in main application
export { RemitRootBackend };

// Uncomment to run standalone
// startBackend().catch(console.error);
