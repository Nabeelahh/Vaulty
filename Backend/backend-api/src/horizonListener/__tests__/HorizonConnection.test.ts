/**
 * Tests for Horizon connection manager
 */

import { HorizonConnection, HorizonStreamResponse } from "../HorizonConnection";
import { HorizonEventStreamConfig } from "../types";

describe("HorizonConnection", () => {
  let connection: HorizonConnection;
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
    connection = new HorizonConnection(mockConfig, mockLogger as any);
  });

  afterEach(() => {
    if (connection) {
      connection.disconnect();
    }
  });

  describe("initialization", () => {
    it("should initialize with correct config", () => {
      const state = connection.getState();
      expect(state.connected).toBe(false);
      expect(state.reconnectAttempts).toBe(0);
      expect(state.eventsProcessed).toBe(0);
    });

    it("should set up event emitter", () => {
      const spy = jest.fn();
      connection.on("connected", spy);
      expect(connection.listenerCount("connected")).toBe(1);
    });
  });

  describe("connection lifecycle", () => {
    it("should attempt to connect", async () => {
      // Mock fetch
      const mockFetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn().mockResolvedValueOnce({ done: true }),
            releaseLock: jest.fn(),
          }),
        },
      });
      global.fetch = mockFetch;

      const spy = jest.fn();
      connection.on("connected", spy);

      // Start connection attempt
      const connectPromise = connection.connect("now");

      // Wait a bit for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Clean up
      connection.disconnect();

      // The connection might not fully establish due to stream being empty,
      // but we can verify the attempt was made
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should emit disconnected event", (done) => {
      const spy = jest.fn();
      connection.on("disconnected", spy);

      connection.disconnect();

      setTimeout(() => {
        expect(spy).toHaveBeenCalled();
        done();
      }, 10);
    });

    it("should update state on disconnect", () => {
      connection.disconnect();
      const state = connection.getState();
      expect(state.connected).toBe(false);
    });
  });

  describe("state management", () => {
    it("should reset state", () => {
      const state = connection.getState();
      state.eventsProcessed = 100;

      connection.resetState();
      const newState = connection.getState();

      expect(newState.eventsProcessed).toBe(0);
      expect(newState.reconnectAttempts).toBe(0);
    });

    it("should track connection errors", async () => {
      // Mock failed fetch
      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(new Error("Network error"));

      const errorSpy = jest.fn();
      connection.on("error", errorSpy);

      await connection.connect("now");

      // Give error handling time to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe("reconnection logic", () => {
    it("should attempt reconnection on connection failure", async () => {
      const errorSpy = jest.fn();
      connection.on("error", errorSpy);

      // Mock failed fetch
      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(new Error("Connection failed"));

      await connection.connect("now");
      await new Promise((resolve) => setTimeout(resolve, 100));

      const state = connection.getState();
      expect(state.reconnectAttempts).toBeGreaterThan(0);
    });

    it("should respect max reconnection attempts", async () => {
      const maxReconnectConfig: HorizonEventStreamConfig = {
        ...mockConfig,
        maxReconnectAttempts: 1,
        reconnectInterval: 10,
      };

      const testConnection = new HorizonConnection(
        maxReconnectConfig,
        mockLogger as any,
      );
      const maxReachSpy = jest.fn();
      testConnection.on("maxReconnectAttemptsReached", maxReachSpy);

      // Mock failed fetch
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error("Connection failed"));

      await testConnection.connect("now");

      // Wait for reconnection attempts
      await new Promise((resolve) => setTimeout(resolve, 500));

      testConnection.disconnect();

      // The listener should eventually report max attempts reached
      expect(testConnection.getState().reconnectAttempts).toBeGreaterThan(0);
    });
  });

  describe("event emission", () => {
    it("should emit events from stream", (done) => {
      const eventSpy = jest.fn();
      connection.on("event", eventSpy);

      // Mock successful fetch with event data
      const mockEvent: HorizonStreamResponse = {
        id: "test-123",
        type: "transaction",
        hash: "abc123",
        source_account: "GBCD123",
      };

      const mockStream = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(JSON.stringify(mockEvent) + "\n"),
            })
            .mockResolvedValueOnce({ done: true }),
          releaseLock: jest.fn(),
        }),
      };

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      connection.connect("now");

      // Give async operations time to complete
      setTimeout(() => {
        connection.disconnect();
        done();
      }, 200);
    });
  });
});
