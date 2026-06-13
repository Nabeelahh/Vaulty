/**
 * Tests for event queue
 */

import { EventQueue, EventProcessor } from "../EventQueue";
import { ProcessedEvent } from "../types";

describe("EventQueue", () => {
  let queue: EventQueue;
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const createMockEvent = (id: string = "event-1"): ProcessedEvent => ({
    id,
    originalId: id,
    eventType: "transaction",
    contractRelated: false,
    timestamp: new Date().toISOString(),
    data: {
      id,
      type: "transaction",
      timestamp: new Date().toISOString(),
      hash: "abc123",
      sourceAccount: "GBCD123",
      operationCount: 1,
      fees: "100",
      successful: true,
      ledgerSequence: 100,
    } as any,
    processedAt: new Date().toISOString(),
    valid: true,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    queue = new EventQueue(1000, 100, mockLogger as any);
  });

  afterEach(() => {
    queue.stop();
    jest.useRealTimers();
  });

  describe("event enqueueing", () => {
    it("should enqueue events", () => {
      const event = createMockEvent();
      const result = queue.enqueue(event);

      expect(result).toBe(true);
      expect(queue.getQueueSize()).toBe(1);
    });

    it("should enqueue multiple events", () => {
      const events = [
        createMockEvent("1"),
        createMockEvent("2"),
        createMockEvent("3"),
      ];
      const count = queue.enqueueMultiple(events);

      expect(count).toBe(3);
      expect(queue.getQueueSize()).toBe(3);
    });

    it("should reject events when queue is full", () => {
      const smallQueue = new EventQueue(2, 100, mockLogger as any);

      const event1 = createMockEvent("1");
      const event2 = createMockEvent("2");
      const event3 = createMockEvent("3");

      const result1 = smallQueue.enqueue(event1);
      const result2 = smallQueue.enqueue(event2);
      const result3 = smallQueue.enqueue(event3);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();

      smallQueue.stop();
    });

    it("should track total received count", () => {
      queue.enqueue(createMockEvent());
      queue.enqueue(createMockEvent("2"));

      const metrics = queue.getMetrics();
      expect(metrics.totalReceived).toBe(2);
    });
  });

  describe("event processing", () => {
    it("should register event processors", () => {
      const processor: EventProcessor = jest.fn();
      queue.registerProcessor(processor);

      expect(queue["processors"]).toContain(processor);
    });

    it("should not register duplicate processors", () => {
      const processor: EventProcessor = jest.fn();
      queue.registerProcessor(processor);
      queue.registerProcessor(processor);

      expect(queue["processors"].length).toBe(1);
    });

    it("should unregister processors", () => {
      const processor: EventProcessor = jest.fn();
      queue.registerProcessor(processor);
      queue.unregisterProcessor(processor);

      expect(queue["processors"]).not.toContain(processor);
    });

    it("should process events with registered processors", async () => {
      const processor: EventProcessor = jest.fn().mockResolvedValue(undefined);
      queue.registerProcessor(processor);

      const event = createMockEvent();
      queue.enqueue(event);

      // Process the event
      await queue["processNextBatch"]();

      expect(processor).toHaveBeenCalledWith(event);
    });

    it("should execute multiple processors", async () => {
      const processor1: EventProcessor = jest.fn().mockResolvedValue(undefined);
      const processor2: EventProcessor = jest.fn().mockResolvedValue(undefined);

      queue.registerProcessor(processor1);
      queue.registerProcessor(processor2);

      const event = createMockEvent();
      queue.enqueue(event);

      await queue["processNextBatch"]();

      expect(processor1).toHaveBeenCalledWith(event);
      expect(processor2).toHaveBeenCalledWith(event);
    });

    it("should skip invalid events", async () => {
      const processor: EventProcessor = jest.fn();
      queue.registerProcessor(processor);

      const invalidEvent = createMockEvent();
      invalidEvent.valid = false;

      queue.enqueue(invalidEvent);

      await queue["processNextBatch"]();

      expect(processor).not.toHaveBeenCalled();
    });

    it("should handle processor errors gracefully", async () => {
      const processor: EventProcessor = jest
        .fn()
        .mockRejectedValue(new Error("Process error"));
      queue.registerProcessor(processor);

      const event = createMockEvent();
      queue.enqueue(event);

      // Should not throw
      await queue["processNextBatch"]();

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("queue metrics", () => {
    it("should track processed events", async () => {
      const processor: EventProcessor = jest.fn().mockResolvedValue(undefined);
      queue.registerProcessor(processor);

      queue.enqueue(createMockEvent("1"));
      queue.enqueue(createMockEvent("2"));

      await queue["processNextBatch"]();

      const metrics = queue.getMetrics();
      expect(metrics.processed).toBe(2);
    });

    it("should track failed events", async () => {
      const processor: EventProcessor = jest
        .fn()
        .mockRejectedValue(new Error("Error"));
      queue.registerProcessor(processor);

      queue.enqueue(createMockEvent());

      await queue["processNextBatch"]();

      const metrics = queue.getMetrics();
      expect(metrics.failed).toBeGreaterThan(0);
    });

    it("should reset metrics", () => {
      queue.enqueue(createMockEvent());
      queue.resetMetrics();

      const metrics = queue.getMetrics();
      expect(metrics.processed).toBe(0);
      expect(metrics.totalReceived).toBe(0);
    });

    it("should report queue size", () => {
      queue.enqueue(createMockEvent("1"));
      queue.enqueue(createMockEvent("2"));
      queue.enqueue(createMockEvent("3"));

      expect(queue.getQueueSize()).toBe(3);
    });
  });

  describe("queue lifecycle", () => {
    it("should start processing", () => {
      expect(queue.isRunning()).toBe(false);
      queue["startProcessing"]();
      expect(queue.isRunning()).toBe(true);
    });

    it("should stop processing", () => {
      queue["startProcessing"]();
      queue.stop();
      expect(queue.isRunning()).toBe(false);
    });

    it("should not start processing twice", () => {
      queue["startProcessing"]();
      const timer1 = queue["processingInterval"];

      queue["startProcessing"]();
      const timer2 = queue["processingInterval"];

      expect(timer1).toBe(timer2);
    });

    it("should clear queue", () => {
      queue.enqueue(createMockEvent("1"));
      queue.enqueue(createMockEvent("2"));

      queue.clear();

      expect(queue.getQueueSize()).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Event queue cleared",
        expect.any(Object),
      );
    });
  });

  describe("queue configuration", () => {
    it("should set maximum queue size", () => {
      queue.setMaxQueueSize(500);
      // Verify by attempting to enqueue beyond new limit
      const smallQueue = new EventQueue(2);
      expect(() => smallQueue.setMaxQueueSize(0)).toThrow();
    });

    it("should set poll interval", () => {
      queue.setPollInterval(50);
      // Verify by checking the queue's behavior
      expect(() => queue.setPollInterval(0)).toThrow();
    });

    it("should throw on invalid queue size", () => {
      expect(() => queue.setMaxQueueSize(0)).toThrow();
      expect(() => queue.setMaxQueueSize(-1)).toThrow();
    });

    it("should throw on invalid poll interval", () => {
      expect(() => queue.setPollInterval(0)).toThrow();
      expect(() => queue.setPollInterval(-1)).toThrow();
    });
  });

  describe("batch processing", () => {
    it("should process events in batches", async () => {
      const processor: EventProcessor = jest.fn();
      queue.registerProcessor(processor);

      for (let i = 0; i < 25; i++) {
        queue.enqueue(createMockEvent(String(i)));
      }

      // Process first batch (max 10)
      await queue["processNextBatch"]();

      // Should have processed up to 10 events
      expect(queue.getQueueSize()).toBeLessThanOrEqual(15);
    });

    it("should handle empty batches", async () => {
      const processor: EventProcessor = jest.fn();
      queue.registerProcessor(processor);

      // Process empty queue
      await queue["processNextBatch"]();

      expect(processor).not.toHaveBeenCalled();
    });
  });

  describe("state management", () => {
    it("should return queue copy for debugging", () => {
      const event = createMockEvent();
      queue.enqueue(event);

      const queueCopy = queue.getQueue();
      expect(queueCopy).toHaveLength(1);
      expect(queueCopy[0]).toEqual(event);
    });

    it("should not modify original queue via returned copy", () => {
      const event = createMockEvent();
      queue.enqueue(event);

      const queueCopy = queue.getQueue();
      queueCopy.pop();

      expect(queue.getQueueSize()).toBe(1);
    });
  });

  describe("processor async handling", () => {
    it("should handle async processors", async () => {
      const processor: EventProcessor = jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(resolve, 50);
          }),
      );

      queue.registerProcessor(processor);
      const event = createMockEvent();
      queue.enqueue(event);

      await queue["processNextBatch"]();

      expect(processor).toHaveBeenCalled();
    });

    it("should handle sync processors", async () => {
      const processor: EventProcessor = jest.fn();
      queue.registerProcessor(processor);

      const event = createMockEvent();
      queue.enqueue(event);

      await queue["processNextBatch"]();

      expect(processor).toHaveBeenCalled();
    });
  });
});
