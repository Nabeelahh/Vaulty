/**
 * Event queue processor
 * Manages event queue and processes events asynchronously
 */

import { ProcessedEvent, EventQueueMetrics } from "./types";

export type EventProcessor = (event: ProcessedEvent) => Promise<void> | void;

export class EventQueue {
  private queue: ProcessedEvent[] = [];
  private isProcessing: boolean = false;
  private maxQueueSize: number;
  private processors: EventProcessor[] = [];
  private logger: Console;
  private metrics: {
    processed: number;
    failed: number;
    totalReceived: number;
  } = {
    processed: 0,
    failed: 0,
    totalReceived: 0,
  };
  private processingInterval: NodeJS.Timeout | null = null;
  private pollInterval: number;

  constructor(
    maxQueueSize: number = 1000,
    pollInterval: number = 100,
    logger: Console = console,
  ) {
    this.maxQueueSize = maxQueueSize;
    this.pollInterval = pollInterval;
    this.logger = logger;
  }

  /**
   * Enqueue an event for processing
   */
  enqueue(event: ProcessedEvent): boolean {
    if (this.queue.length >= this.maxQueueSize) {
      this.logger.warn("Event queue is full. Dropping event.", { event });
      return false;
    }

    this.queue.push(event);
    this.metrics.totalReceived++;

    if (!this.isProcessing) {
      this.startProcessing();
    }

    return true;
  }

  /**
   * Enqueue multiple events
   */
  enqueueMultiple(events: ProcessedEvent[]): number {
    let enqueued = 0;
    for (const event of events) {
      if (this.enqueue(event)) {
        enqueued++;
      }
    }
    return enqueued;
  }

  /**
   * Register an event processor
   */
  registerProcessor(processor: EventProcessor): void {
    if (this.processors.includes(processor)) {
      this.logger.warn("Processor already registered");
      return;
    }
    this.processors.push(processor);
    this.logger.info("Event processor registered", {
      count: this.processors.length,
    });
  }

  /**
   * Unregister an event processor
   */
  unregisterProcessor(processor: EventProcessor): void {
    const index = this.processors.indexOf(processor);
    if (index > -1) {
      this.processors.splice(index, 1);
      this.logger.info("Event processor unregistered", {
        count: this.processors.length,
      });
    }
  }

  /**
   * Start processing queue
   */
  private startProcessing(): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.logger.info("Starting event queue processor");

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    this.processingInterval = setInterval(() => {
      this.processNextBatch().catch((error) => {
        this.logger.error("Unexpected error during batch processing", error);
      });
    }, this.pollInterval);
  }

  /**
   * Stop processing queue
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.isProcessing = false;
    this.logger.info("Event queue processor stopped", this.metrics);
  }

  /**
   * Process next batch of events
   */
  private async processNextBatch(): Promise<void> {
    if (this.queue.length === 0) {
      if (this.isProcessing && !this.processingInterval) {
        this.stop();
      }
      return;
    }

    // Process up to 10 events at a time
    const batchSize = 10;
    const batch = this.queue.splice(0, Math.min(batchSize, this.queue.length));

    for (const event of batch) {
      try {
        await this.processEvent(event);
        this.metrics.processed++;
      } catch (error) {
        this.metrics.failed++;
        this.logger.error("Failed to process event", {
          eventId: event.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // If queue is empty and no more events expected, stop processing
    if (this.queue.length === 0 && this.isProcessing) {
      this.scheduleStopIfIdle();
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(event: ProcessedEvent): Promise<void> {
    if (!event.valid) {
      this.logger.warn("Skipping invalid event", {
        eventId: event.id,
        errors: event.errors,
      });
      return;
    }

    // Execute all registered processors
    for (const processor of this.processors) {
      try {
        await Promise.resolve(processor(event));
      } catch (error) {
        this.logger.error("Processor failed to handle event", {
          eventId: event.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Schedule automatic stop if queue remains idle
   */
  private scheduleStopIfIdle(): void {
    // Don't stop immediately, wait for more events to potentially arrive
    // This will be called periodically, so we just skip stopping here
    // and let the next interval check decide
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Get metrics
   */
  getMetrics(): EventQueueMetrics {
    return {
      queueSize: this.queue.length,
      ...this.metrics,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      processed: 0,
      failed: 0,
      totalReceived: 0,
    };
    this.logger.info("Event queue metrics reset");
  }

  /**
   * Check if queue is processing
   */
  isRunning(): boolean {
    return this.isProcessing;
  }

  /**
   * Clear the queue
   */
  clear(): void {
    const clearedCount = this.queue.length;
    this.queue = [];
    this.logger.warn("Event queue cleared", { clearedCount });
  }

  /**
   * Get current queue (for debugging)
   */
  getQueue(): ProcessedEvent[] {
    return [...this.queue];
  }

  /**
   * Set maximum queue size
   */
  setMaxQueueSize(size: number): void {
    if (size < 1) {
      throw new Error("Queue size must be at least 1");
    }
    this.maxQueueSize = size;
    this.logger.info("Max queue size updated", {
      maxQueueSize: this.maxQueueSize,
    });
  }

  /**
   * Set poll interval
   */
  setPollInterval(interval: number): void {
    if (interval < 1) {
      throw new Error("Poll interval must be at least 1ms");
    }
    this.pollInterval = interval;

    // Restart processing with new interval
    if (this.isProcessing) {
      this.stop();
      this.startProcessing();
    }

    this.logger.info("Poll interval updated", {
      pollInterval: this.pollInterval,
    });
  }
}
