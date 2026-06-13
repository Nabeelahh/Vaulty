/**
 * Horizon connection manager
 * Handles connection to Stellar Horizon API and event stream setup
 */

import { EventEmitter } from "events";
import {
  HorizonEventStreamConfig,
  HorizonListenerState,
  ReconnectionConfig,
} from "./types";

export interface HorizonStreamResponse {
  id?: string;
  type?: string;
  paging_token?: string;
  hash?: string;
  source_account?: string;
  operation_count?: number;
  transaction?: Record<string, unknown>;
  envelope?: Record<string, unknown>;
  [key: string]: unknown;
}

export class HorizonConnection extends EventEmitter {
  private config: HorizonEventStreamConfig;
  private reconnectionConfig: ReconnectionConfig;
  private state: HorizonListenerState;
  private abortController: AbortController | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private lastPagingToken: string | null = null;
  private logger: Console;

  constructor(config: HorizonEventStreamConfig, logger: Console = console) {
    super();
    this.config = config;
    this.logger = logger;
    this.state = {
      connected: false,
      reconnectAttempts: 0,
      lastEventId: null,
      eventsProcessed: 0,
      errorsEncountered: 0,
    };
    this.reconnectionConfig = {
      maxAttempts: config.maxReconnectAttempts,
      initialDelayMs: config.reconnectInterval,
      maxDelayMs: config.reconnectInterval * 10,
      backoffMultiplier: 2,
    };
  }

  /**
   * Connect to Horizon event stream
   */
  async connect(cursor: string = "now"): Promise<void> {
    try {
      this.logger.info("Connecting to Horizon event stream", {
        horizonUrl: this.config.horizonUrl,
        cursor,
      });

      if (this.abortController) {
        this.abortController.abort();
      }

      this.abortController = new AbortController();
      this.state.reconnectAttempts = 0;

      // Start listening to transactions
      await this.streamTransactions(cursor);
    } catch (error) {
      this.handleConnectionError(error);
    }
  }

  /**
   * Stream transactions from Horizon
   */
  private async streamTransactions(cursor: string): Promise<void> {
    const url = new URL(`${this.config.horizonUrl}/transactions`);
    url.searchParams.append("cursor", cursor);
    url.searchParams.append("limit", "200");
    url.searchParams.append("order", "asc");

    try {
      const response = await fetch(url.toString(), {
        signal: this.abortController?.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Horizon API returned status ${response.status}: ${response.statusText}`,
        );
      }

      if (!response.body) {
        throw new Error("No response body from Horizon API");
      }

      this.state.connected = true;
      this.state.reconnectAttempts = 0;
      this.emit("connected");
      this.logger.info("Successfully connected to Horizon event stream");

      await this.processStream(response.body);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        this.logger.info("Horizon stream connection aborted");
        this.state.connected = false;
      } else {
        this.handleConnectionError(error);
      }
    }
  }

  /**
   * Process incoming stream data
   */
  private async processStream(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          this.logger.warn("Horizon stream ended unexpectedly");
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");

        // Process complete lines
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (line) {
            try {
              const event = JSON.parse(line) as HorizonStreamResponse;
              this.handleStreamEvent(event);
            } catch (parseError) {
              this.logger.error("Failed to parse stream event", { line });
            }
          }
        }

        // Keep incomplete line in buffer
        buffer = lines[lines.length - 1];
      }
    } catch (error) {
      this.logger.error("Stream processing error", error);
      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Handle individual stream event
   */
  private handleStreamEvent(event: HorizonStreamResponse): void {
    if (event.paging_token) {
      this.lastPagingToken = event.paging_token;
    }

    // Emit raw event for processing
    this.emit("event", event);
    this.state.eventsProcessed++;
    this.state.lastEventId = event.id as string;
  }

  /**
   * Handle connection errors with reconnection logic
   */
  private handleConnectionError(error: unknown): void {
    this.state.connected = false;
    this.state.errorsEncountered++;

    const errorMessage = error instanceof Error ? error.message : String(error);
    this.state.lastError = errorMessage;
    this.state.lastErrorTime = new Date().toISOString();

    this.logger.error("Horizon connection error", {
      error: errorMessage,
      reconnectAttempt: this.state.reconnectAttempts,
    });

    this.emit("error", error);

    // Attempt reconnection
    if (this.state.reconnectAttempts < this.reconnectionConfig.maxAttempts) {
      this.scheduleReconnect();
    } else {
      this.logger.error(
        "Max reconnection attempts reached. Giving up.",
        this.state,
      );
      this.emit("maxReconnectAttemptsReached");
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = Math.min(
      this.reconnectionConfig.initialDelayMs *
        Math.pow(
          this.reconnectionConfig.backoffMultiplier,
          this.state.reconnectAttempts,
        ),
      this.reconnectionConfig.maxDelayMs,
    );

    this.state.reconnectAttempts++;
    this.logger.info("Scheduling reconnection", {
      delay,
      attempt: this.state.reconnectAttempts,
    });

    this.reconnectTimer = setTimeout(() => {
      this.logger.info("Attempting to reconnect to Horizon");
      this.connect(this.lastPagingToken || "now");
    }, delay);
  }

  /**
   * Disconnect from stream
   */
  disconnect(): void {
    this.logger.info("Disconnecting from Horizon stream");

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.abortController) {
      this.abortController.abort();
    }

    this.state.connected = false;
    this.emit("disconnected");
  }

  /**
   * Get current connection state
   */
  getState(): HorizonListenerState {
    return { ...this.state };
  }

  /**
   * Reset connection state
   */
  resetState(): void {
    this.state = {
      connected: false,
      reconnectAttempts: 0,
      lastEventId: null,
      eventsProcessed: 0,
      errorsEncountered: 0,
    };
  }
}
