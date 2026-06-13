/**
 * Tests for event parser
 */

import { EventParser } from "../EventParser";
import { HorizonStreamResponse } from "../HorizonConnection";
import { TransactionEvent, OperationEvent } from "../types";

describe("EventParser", () => {
  let parser: EventParser;
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    parser = new EventParser(mockLogger as any);
  });

  describe("transaction parsing", () => {
    it("should parse transaction events", () => {
      const event: HorizonStreamResponse = {
        id: "tx-123",
        type: "transaction",
        created_at: "2023-01-01T00:00:00Z",
        hash: "abc123hash",
        source_account: "GBCD123",
        operation_count: 5,
        fees_paid: "1000",
        successful: true,
        ledger_sequence: 12345,
      };

      const result = parser.parseEvent(event);

      expect(result).not.toBeNull();
      expect(result?.eventType).toBe("transaction");
      expect(result?.data).toMatchObject({
        hash: "abc123hash",
        sourceAccount: "GBCD123",
        operationCount: 5,
      });
    });

    it("should validate parsed transactions", () => {
      const event: HorizonStreamResponse = {
        id: "tx-123",
        type: "transaction",
        hash: "abc123",
        source_account: "GBCD123",
        ledger_sequence: 100,
      };

      const result = parser.parseEvent(event);

      expect(result?.valid).toBe(true);
      expect(result?.errors).toBeUndefined();
    });

    it("should detect invalid transactions", () => {
      const event: HorizonStreamResponse = {
        id: "tx-123",
        type: "transaction",
        // Missing required fields
      };

      const result = parser.parseEvent(event);

      expect(result?.valid).toBe(false);
      expect(result?.errors).toBeDefined();
      expect(result?.errors).toContain("Missing source account");
    });
  });

  describe("operation parsing", () => {
    it("should parse operation events", () => {
      const event: HorizonStreamResponse = {
        id: "op-456",
        type: "payment",
        created_at: "2023-01-01T00:00:00Z",
        transaction_hash: "tx-hash-123",
        source_account: "GBCD123",
        amount: "100",
        asset_type: "native",
      };

      const result = parser.parseEvent(event);

      expect(result?.eventType).toBe("operation");
      expect(result?.data).toMatchObject({
        operationType: "payment",
        transactionHash: "tx-hash-123",
      });
    });
  });

  describe("contract event parsing", () => {
    it("should parse contract events", () => {
      const event: HorizonStreamResponse = {
        id: "contract-789",
        type: "contract",
        created_at: "2023-01-01T00:00:00Z",
        contract_id: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
        transaction_hash: "tx-hash-456",
        topics: ["topic1", "topic2"],
        data: "0x1234",
        ledger_sequence: 54321,
        ledger_closed_at: "2023-01-01T00:00:00Z",
      } as any;

      const result = parser.parseEvent(event);

      expect(result?.eventType).toBe("contract");
      expect(result?.contractRelated).toBe(true);
      expect(result?.data).toMatchObject({
        contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
        topics: ["topic1", "topic2"],
      });
    });
  });

  describe("contract detection", () => {
    it("should detect contract-related transactions", () => {
      const event: HorizonStreamResponse = {
        id: "tx-123",
        type: "transaction",
        hash: "abc123",
        source_account: "GBCD123",
        envelope: {
          tx: {
            operations: [
              {
                type: "invoke_host_function",
                contract_id: "CXXXX",
              },
            ],
          },
        },
      } as any;

      const result = parser.parseEvent(event);

      expect(result?.contractRelated).toBe(true);
    });

    it("should not mark non-contract transactions as contract-related", () => {
      const event: HorizonStreamResponse = {
        id: "tx-123",
        type: "transaction",
        hash: "abc123",
        source_account: "GBCD123",
        envelope: {
          tx: {
            operations: [
              {
                type: "payment",
                amount: "100",
              },
            ],
          },
        },
      } as any;

      const result = parser.parseEvent(event);

      expect(result?.contractRelated).toBe(false);
    });
  });

  describe("event validation", () => {
    it("should validate event structure", () => {
      const events = [
        {
          id: "tx-1",
          type: "transaction",
          timestamp: "2023-01-01T00:00:00Z",
          hash: "abc",
          sourceAccount: "GBX",
          operationCount: 1,
          fees: "100",
          successful: true,
          ledgerSequence: 100,
        } as any,
        {
          id: "tx-2",
          type: "transaction",
          timestamp: "2023-01-01T00:00:00Z",
          hash: "def",
          sourceAccount: "GBY",
          operationCount: 1,
          fees: "200",
          successful: true,
          ledgerSequence: 101,
        } as any,
      ];

      const results = parser.validateEvents(events);

      expect(results).toHaveLength(2);
      expect(results[0].valid).toBe(true);
    });

    it("should filter out invalid events", () => {
      const events = [
        {
          id: "tx-1",
          type: "transaction",
          timestamp: "2023-01-01T00:00:00Z",
          hash: "abc",
          sourceAccount: "GBX",
          operationCount: 1,
          fees: "100",
          successful: true,
          ledgerSequence: 100,
        } as any,
        {
          id: "",
          type: "transaction",
          timestamp: "",
          hash: "",
          sourceAccount: "",
          operationCount: 0,
          fees: "0",
          successful: false,
          ledgerSequence: -1,
        } as any,
      ];

      const results = parser.validateEvents(events);

      // Should only return valid events
      expect(results.filter((r) => r.valid)).toHaveLength(1);
    });
  });

  describe("event ID generation", () => {
    it("should generate unique IDs for parsed events", () => {
      const event: HorizonStreamResponse = {
        id: "tx-123",
        type: "transaction",
        hash: "abc123",
        source_account: "GBCD123",
      };

      const result1 = parser.parseEvent(event);
      const result2 = parser.parseEvent(event);

      expect(result1?.id).not.toBe(result2?.id);
    });

    it("should preserve original event ID", () => {
      const event: HorizonStreamResponse = {
        id: "original-123",
        type: "transaction",
        hash: "abc123",
        source_account: "GBCD123",
      };

      const result = parser.parseEvent(event);

      expect(result?.originalId).toBe("original-123");
    });
  });

  describe("edge cases", () => {
    it("should handle events with missing timestamps", () => {
      const event: HorizonStreamResponse = {
        id: "tx-123",
        type: "transaction",
        hash: "abc123",
        source_account: "GBCD123",
      };

      const result = parser.parseEvent(event);

      expect(result).not.toBeNull();
      expect(result?.data).toHaveProperty("timestamp");
    });

    it("should handle events with extra fields", () => {
      const event: HorizonStreamResponse = {
        id: "tx-123",
        type: "transaction",
        hash: "abc123",
        source_account: "GBCD123",
        extra_field_1: "value1",
        extra_field_2: "value2",
      } as any;

      const result = parser.parseEvent(event);

      expect(result).not.toBeNull();
      expect(result?.data).toBeDefined();
    });

    it("should handle invalid event types gracefully", () => {
      const event: HorizonStreamResponse = {
        id: "unknown-1",
        type: "unknown_type",
      };

      const result = parser.parseEvent(event);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe("data extraction", () => {
    it("should extract specific fields from events", () => {
      const event = {
        id: "tx-1",
        type: "transaction",
        hash: "abc123",
        sourceAccount: "GBCD",
        operationCount: 5,
        fees: "100",
      } as any;

      const extracted = parser.extractData(event, [
        "hash",
        "sourceAccount",
        "fees",
      ]);

      expect(extracted).toEqual({
        hash: "abc123",
        sourceAccount: "GBCD",
        fees: "100",
      });
    });

    it("should handle missing fields in extraction", () => {
      const event = {
        id: "tx-1",
        hash: "abc123",
      } as any;

      const extracted = parser.extractData(event, [
        "hash",
        "sourceAccount",
        "nonexistent",
      ]);

      expect(extracted).toEqual({
        hash: "abc123",
      });
    });
  });
});
