/**
 * Main Horizon event stream listener
 * Coordinates all components: connection, filtering, parsing, and queuing
 */

import { EventEmitter } from "events";
import {
  HorizonEventStreamConfig,
  EventFilterOptions,
  HorizonListenerState,
  ProcessedEvent,
  EventQueueMetrics,
} from "./types";
import { HorizonConnection, HorizonStreamResponse } from "./HorizonConnection";
import { EventFilter } from "./EventFilter";
import { EventParser } from "./EventParser";
import { EventQueue, EventProcessor } from "./EventQueue";

export class HorizonEventStreamListener extends EventEmitter {
  private config: HorizonEventStreamConfig;
  private connection: HorizonConnection;
  private filter: EventFilter;
  private parser: EventParser;
  private queue: EventQueue;
  private logger: Console;
  private isRunning: boolean = false;

  constructor(config: HorizonEventStreamConfig, logger: Console = console) {
    super();
    this.config = config;
    this.logger = logger;

    // Initialize components
    this.connection = new HorizonConnection(config, logger);
    this.filter = new EventFilter({}, logger);
    this.parser = new EventParser(logger);
    this.queue = new EventQueue(
      config.eventQueueMaxSize,
      config.pollInterval,
      logger,
    );

    // Setup event handlers
    this.setupEventHandlers();
  }

  /**
   * Setup internal event handlers
   */
  private setupEventHandlers(): void {
    // Connection events
    this.connection.on("connected", () => {
      this.logger.info("Horizon connection established");
      this.emit("connected");
    });

    this.connection.on("disconnected", () => {
      this.logger.info("Horizon connection disconnected");
      this.emit("disconnected");
    });

    this.connection.on("error", (error) => {
      this.logger.error("Horizon connection error", error);
      this.emit("error", error);
    });

    this.connection.on("maxReconnectAttemptsReached", () => {
      this.logger.error("Max reconnection attempts reached");
      this.emit("maxReconnectAttemptsReached");
    });

    // Incoming events from Horizon
    this.connection.on("event", (rawEvent: HorizonStreamResponse) => {
      this.processIncomingEvent(rawEvent);
    });
  }

  /**
   * Start listening to events
   */
  async start(cursor?: string): Promise<void> {
    if (this.isRunning) {
      this.logger.warn("Listener is already running");
      return;
    }

    try {
      this.logger.info("Starting Horizon event stream listener");
      this.isRunning = true;

      // Start queue processor
      this.queue.startProcessing();

      // Connect to Horizon
      await this.connection.connect(cursor);

      this.emit("started");
    } catch (error) {
      this.isRunning = false;
      this.logger.error("Failed to start listener", error);
      this.emit("error", error);
      throw error;
    }
  }

  /**
   * Stop listening to events
   */
  stop(): void {
    if (!this.isRunning) {
      this.logger.warn("Listener is not running");
      return;
    }

    this.logger.info("Stopping Horizon event stream listener");
    this.isRunning = false;

    // Stop queue processor
    this.queue.stop();

    // Disconnect from Horizon
    this.connection.disconnect();

    this.emit("stopped");
  }

  /**
   * Process incoming event from Horizon
   */
  private processIncomingEvent(rawEvent: HorizonStreamResponse): void {
    // Filter event
    if (!this.filter.shouldProcess(rawEvent)) {
      return;
    }

    // Parse and validate event
    const processedEvent = this.parser.parseEvent(rawEvent);
    if (!processedEvent) {
      return;
    }

    // Enqueue for processing
    const enqueued = this.queue.enqueue(processedEvent);
    if (enqueued) {
      this.emit("eventReceived", processedEvent);
    } else {
      this.logger.warn("Failed to enqueue event");
    }
  }

  /**
   * Register an event processor
   */
  registerProcessor(processor: EventProcessor): void {
    this.queue.registerProcessor(processor);
  }

  /**
   * Unregister an event processor
   */
  unregisterProcessor(processor: EventProcessor): void {
    this.queue.unregisterProcessor(processor);
  }

  /**
   * Update filter options
   */
  setFilterOptions(options: Partial<EventFilterOptions>): void {
    this.filter.updateOptions(options);
  }

  /**
   * Get filter options
   */
  getFilterOptions(): EventFilterOptions {
    return this.filter.getOptions();
  }

  /**
   * Add contract address to filter
   */
  addContractAddress(address: string): void {
    this.filter.addContractAddress(address);
  }

  /**
   * Remove contract address from filter
   */
  removeContractAddress(address: string): void {
    this.filter.removeContractAddress(address);
  }

  /**
   * Add source account to filter
   */
  addSourceAccount(account: string): void {
    this.filter.addSourceAccount(account);
  }

  /**
   * Remove source account from filter
   */
  removeSourceAccount(account: string): void {
    this.filter.removeSourceAccount(account);
  }

  /**
   * Get listener state
   */
  getState(): HorizonListenerState {
    return this.connection.getState();
  }

  /**
   * Get queue metrics
   */
  getQueueMetrics(): EventQueueMetrics {
    return this.queue.getMetrics();
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.getQueueSize();
  }

  /**
   * Check if listener is running
   */
  running(): boolean {
    return this.isRunning;
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.queue.resetMetrics();
    this.connection.resetState();
  }

  /**
   * Set maximum queue size
   */
  setMaxQueueSize(size: number): void {
    this.queue.setMaxQueueSize(size);
  }

  /**
   * Set queue poll interval
   */
  setQueuePollInterval(interval: number): void {
    this.queue.setPollInterval(interval);
  }

  /**
   * Get connection configuration
   */
  getConfig(): HorizonEventStreamConfig {
    return { ...this.config };
  }
}

export default HorizonEventStreamListener;
