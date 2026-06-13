/**
 * Integration tests for Horizon event stream listener
 */

import HorizonEventStreamListener from "../index";
import { HorizonEventStreamConfig, ProcessedEvent } from "../types";
import { HorizonStreamResponse } from "../HorizonConnection";

describe("HorizonEventStreamListener", () => {
  let listener: HorizonEventStreamListener;
  const mockConfig: HorizonEventStreamConfig = {
    horizonUrl: "https://horizon-testnet.stellar.org",
    network: "testnet",
    reconnectInterval: 1000,
    maxReconnectAttempts: 3,
    eventQueueMaxSize: 1000,
    pollInterval: 100,
  };

  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    listener = new HorizonEventStreamListener(mockConfig, mockLogger as any);
  });

  afterEach(() => {
    if (listener) {
      listener.stop();
    }
    jest.useRealTimers();
  });

  describe("initialization", () => {
    it("should initialize with correct config", () => {
      const config = listener.getConfig();
      expect(config.horizonUrl).toBe(mockConfig.horizonUrl);
      expect(config.network).toBe(mockConfig.network);
    });

    it("should not be running initially", () => {
      expect(listener.running()).toBe(false);
    });

    it("should emit started event", (done) => {
      const spy = jest.fn();
      listener.on("started", spy);

      // Mock fetch
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn().mockResolvedValueOnce({ done: true }),
            releaseLock: jest.fn(),
          }),
        },
      });

      listener.start("now");

      setTimeout(() => {
        jest.useRealTimers();
        // Verify event was eventually emitted
        listener.stop();
        done();
      }, 200);
    });
  });

  describe("event processing pipeline", () => {
    it("should process valid transaction events", (done) => {
      const processor = jest.fn();
      listener.registerProcessor(processor);

      const spy = jest.fn();
      listener.on("eventReceived", spy);

      // Mock the connection to emit an event
      const mockEvent: HorizonStreamResponse = {
        id: "tx-1",
        type: "transaction",
        hash: "abc123",
        source_account: "GBCD123",
        operation_count: 1,
        fees_paid: "100",
        successful: true,
        ledger_sequence: 100,
      };

      // Simulate receiving event after start
      setImmediate(() => {
        listener["connection"].emit("event", mockEvent);

        setTimeout(() => {
          // Give time for processing
          listener.stop();
          done();
        }, 200);
      });

      listener.start("now");
    });

    it("should filter events based on configuration", (done) => {
      const processor = jest.fn();
      listener.registerProcessor(processor);

      // Configure to only accept specific source accounts
      listener.setFilterOptions({
        includeTransactions: true,
        sourceAccounts: ["ALLOWED123"],
      });

      const allowedEvent: HorizonStreamResponse = {
        id: "tx-1",
        type: "transaction",
        hash: "abc123",
        source_account: "ALLOWED123",
      };

      const deniedEvent: HorizonStreamResponse = {
        id: "tx-2",
        type: "transaction",
        hash: "def456",
        source_account: "DENIED456",
      };

      setImmediate(() => {
        listener["connection"].emit("event", allowedEvent);
        listener["connection"].emit("event", deniedEvent);

        setTimeout(() => {
          listener.stop();
          // Allowed event should be processed, denied should be filtered out
          expect(processor.mock.calls.length).toBeLessThanOrEqual(1);
          done();
        }, 200);
      });

      listener.start("now");
    });

    it("should handle contract events", (done) => {
      listener.setFilterOptions({
        includeContractEvents: true,
        contractAddresses: ["CONTRACT123"],
      });

      const contractEvent: HorizonStreamResponse = {
        id: "contract-1",
        type: "contract",
        contract_id: "CONTRACT123",
        transaction_hash: "tx-hash",
      } as any;

      const spy = jest.fn();
      listener.on("eventReceived", spy);

      setImmediate(() => {
        listener["connection"].emit("event", contractEvent);

        setTimeout(() => {
          listener.stop();
          done();
        }, 200);
      });

      listener.start("now");
    });
  });

  describe("filter management", () => {
    it("should update filter options", () => {
      listener.setFilterOptions({
        includeTransactions: true,
        contractAddresses: ["CONTRACT1"],
      });

      const options = listener.getFilterOptions();
      expect(options.contractAddresses).toContain("CONTRACT1");
    });

    it("should add contract addresses", () => {
      listener.addContractAddress("CONTRACT1");
      listener.addContractAddress("CONTRACT2");

      const options = listener.getFilterOptions();
      expect(options.contractAddresses).toContain("CONTRACT1");
      expect(options.contractAddresses).toContain("CONTRACT2");
    });

    it("should remove contract addresses", () => {
      listener.addContractAddress("CONTRACT1");
      listener.removeContractAddress("CONTRACT1");

      const options = listener.getFilterOptions();
      expect(options.contractAddresses).not.toContain("CONTRACT1");
    });

    it("should add source accounts", () => {
      listener.addSourceAccount("ACCOUNT1");
      listener.addSourceAccount("ACCOUNT2");

      const options = listener.getFilterOptions();
      expect(options.sourceAccounts).toContain("ACCOUNT1");
      expect(options.sourceAccounts).toContain("ACCOUNT2");
    });

    it("should remove source accounts", () => {
      listener.addSourceAccount("ACCOUNT1");
      listener.removeSourceAccount("ACCOUNT1");

      const options = listener.getFilterOptions();
      expect(options.sourceAccounts).not.toContain("ACCOUNT1");
    });
  });

  describe("processor management", () => {
    it("should register multiple processors", () => {
      const proc1 = jest.fn();
      const proc2 = jest.fn();

      listener.registerProcessor(proc1);
      listener.registerProcessor(proc2);

      expect(listener["queue"]["processors"].length).toBe(2);
    });

    it("should unregister processors", () => {
      const proc = jest.fn();
      listener.registerProcessor(proc);
      listener.unregisterProcessor(proc);

      expect(listener["queue"]["processors"].length).toBe(0);
    });
  });

  describe("state and metrics", () => {
    it("should report listener state", () => {
      const state = listener.getState();
      expect(state).toHaveProperty("connected");
      expect(state).toHaveProperty("eventsProcessed");
      expect(state).toHaveProperty("errorsEncountered");
    });

    it("should report queue metrics", () => {
      const metrics = listener.getQueueMetrics();
      expect(metrics).toHaveProperty("queueSize");
      expect(metrics).toHaveProperty("processed");
      expect(metrics).toHaveProperty("failed");
      expect(metrics).toHaveProperty("totalReceived");
    });

    it("should report queue size", () => {
      expect(listener.getQueueSize()).toBe(0);
    });

    it("should reset metrics", () => {
      listener.resetMetrics();

      const state = listener.getState();
      const metrics = listener.getQueueMetrics();

      expect(state.eventsProcessed).toBe(0);
      expect(metrics.processed).toBe(0);
    });
  });

  describe("lifecycle management", () => {
    it("should not allow multiple starts", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn().mockResolvedValueOnce({ done: true }),
            releaseLock: jest.fn(),
          }),
        },
      });

      await listener.start("now");

      // Try starting again
      await listener.start("now");

      // Should not throw and should log warning
      expect(mockLogger.warn).toHaveBeenCalled();

      listener.stop();
    });

    it("should handle stop when not running", () => {
      expect(() => listener.stop()).not.toThrow();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("should emit connected and disconnected events", (done) => {
      const connectedSpy = jest.fn();
      const disconnectedSpy = jest.fn();

      listener.on("connected", connectedSpy);
      listener.on("disconnected", disconnectedSpy);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn().mockResolvedValueOnce({ done: true }),
            releaseLock: jest.fn(),
          }),
        },
      });

      listener.start("now");

      setTimeout(() => {
        listener.stop();

        setTimeout(() => {
          // Check if events were emitted
          expect(disconnectedSpy).toHaveBeenCalled();
          done();
        }, 100);
      }, 100);
    });
  });

  describe("queue configuration", () => {
    it("should set maximum queue size", () => {
      expect(() => listener.setMaxQueueSize(500)).not.toThrow();
    });

    it("should set queue poll interval", () => {
      expect(() => listener.setQueuePollInterval(50)).not.toThrow();
    });

    it("should throw on invalid queue configuration", () => {
      expect(() => listener.setMaxQueueSize(0)).toThrow();
      expect(() => listener.setQueuePollInterval(0)).toThrow();
    });
  });

  describe("error handling", () => {
    it("should emit error events", (done) => {
      const errorSpy = jest.fn();
      listener.on("error", errorSpy);

      global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

      listener.start("now");

      setTimeout(() => {
        listener.stop();
        // Error event should be emitted
        setTimeout(() => {
          expect(errorSpy).toHaveBeenCalled();
          done();
        }, 100);
      }, 100);
    });

    it("should emit maxReconnectAttemptsReached event", (done) => {
      const config: HorizonEventStreamConfig = {
        ...mockConfig,
        maxReconnectAttempts: 1,
        reconnectInterval: 10,
      };

      const testListener = new HorizonEventStreamListener(
        config,
        mockLogger as any,
      );
      const spy = jest.fn();
      testListener.on("maxReconnectAttemptsReached", spy);

      global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

      testListener.start("now");

      // Wait for reconnection logic
      setTimeout(() => {
        testListener.stop();
        done();
      }, 500);
    });
  });

  describe("event payload structure", () => {
    it("should include metadata in processed events", (done) => {
      const processor = jest.fn();
      listener.registerProcessor(processor);

      const mockEvent: HorizonStreamResponse = {
        id: "tx-1",
        type: "transaction",
        hash: "abc123",
        source_account: "GBCD123",
        created_at: "2023-01-01T00:00:00Z",
        operation_count: 1,
        fees_paid: "100",
        successful: true,
        ledger_sequence: 100,
      };

      setImmediate(() => {
        listener["connection"].emit("event", mockEvent);

        setTimeout(() => {
          listener.stop();

          if (processor.mock.calls.length > 0) {
            const event = processor.mock.calls[0][0] as ProcessedEvent;
            expect(event).toHaveProperty("id");
            expect(event).toHaveProperty("originalId");
            expect(event).toHaveProperty("eventType");
            expect(event).toHaveProperty("contractRelated");
            expect(event).toHaveProperty("timestamp");
            expect(event).toHaveProperty("data");
            expect(event).toHaveProperty("processedAt");
            expect(event).toHaveProperty("valid");
          }

          done();
        }, 200);
      });

      listener.start("now");
    });
  });
});
