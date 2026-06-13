/**
 * Tests for event filter
 */

import { EventFilter } from "../EventFilter";
import { HorizonStreamResponse } from "../HorizonConnection";

describe("EventFilter", () => {
  let filter: EventFilter;
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    filter = new EventFilter({}, mockLogger as any);
  });

  describe("transaction filtering", () => {
    it("should accept transactions when enabled", () => {
      filter.updateOptions({ includeTransactions: true });

      const event: HorizonStreamResponse = {
        id: "tx-1",
        type: "transaction",
        hash: "abc123",
        source_account: "GBCD123",
      };

      expect(filter.shouldProcess(event)).toBe(true);
    });

    it("should reject transactions when disabled", () => {
      filter.updateOptions({ includeTransactions: false });

      const event: HorizonStreamResponse = {
        id: "tx-1",
        type: "transaction",
        hash: "abc123",
        source_account: "GBCD123",
      };

      expect(filter.shouldProcess(event)).toBe(false);
    });

    it("should filter by source account", () => {
      filter.updateOptions({
        includeTransactions: true,
        sourceAccounts: ["ALLOWED123"],
      });

      const allowedEvent: HorizonStreamResponse = {
        id: "tx-1",
        type: "transaction",
        source_account: "ALLOWED123",
      };

      const deniedEvent: HorizonStreamResponse = {
        id: "tx-2",
        type: "transaction",
        source_account: "DENIED456",
      };

      expect(filter.shouldProcess(allowedEvent)).toBe(true);
      expect(filter.shouldProcess(deniedEvent)).toBe(false);
    });
  });

  describe("contract event filtering", () => {
    it("should identify contract events", () => {
      filter.updateOptions({ includeContractEvents: true });

      const contractEvent: HorizonStreamResponse = {
        id: "contract-1",
        type: "contract",
        contract_id: "CONTRACT123",
      } as any;

      expect(filter.shouldProcess(contractEvent)).toBe(true);
    });

    it("should filter contract events by contract ID", () => {
      filter.updateOptions({
        includeContractEvents: true,
        contractAddresses: ["CONTRACT123"],
      });

      const allowedEvent: HorizonStreamResponse = {
        id: "c1",
        contract_id: "CONTRACT123",
      } as any;

      const deniedEvent: HorizonStreamResponse = {
        id: "c2",
        contract_id: "CONTRACT456",
      } as any;

      expect(filter.shouldProcess(allowedEvent)).toBe(true);
      expect(filter.shouldProcess(deniedEvent)).toBe(false);
    });
  });

  describe("operation filtering", () => {
    it("should filter operations by type", () => {
      filter.updateOptions({
        includeOperations: true,
        operationTypes: ["payment", "create_account"],
      });

      const paymentOp: HorizonStreamResponse = {
        id: "op-1",
        type: "payment",
        source_account: "GBCD123",
      };

      const otherOp: HorizonStreamResponse = {
        id: "op-2",
        type: "set_options",
        source_account: "GBCD123",
      };

      expect(filter.shouldProcess(paymentOp)).toBe(true);
      expect(filter.shouldProcess(otherOp)).toBe(false);
    });
  });

  describe("filter options management", () => {
    it("should update filter options", () => {
      filter.updateOptions({
        includeTransactions: true,
        contractAddresses: ["ADDRESS1", "ADDRESS2"],
      });

      const options = filter.getOptions();
      expect(options.includeTransactions).toBe(true);
      expect(options.contractAddresses).toContain("ADDRESS1");
    });

    it("should add contract addresses", () => {
      filter.addContractAddress("CONTRACT1");
      filter.addContractAddress("CONTRACT2");

      const options = filter.getOptions();
      expect(options.contractAddresses).toContain("CONTRACT1");
      expect(options.contractAddresses).toContain("CONTRACT2");
    });

    it("should remove contract addresses", () => {
      filter.addContractAddress("CONTRACT1");
      filter.removeContractAddress("CONTRACT1");

      const options = filter.getOptions();
      expect(options.contractAddresses).not.toContain("CONTRACT1");
    });

    it("should add source accounts", () => {
      filter.addSourceAccount("ACCOUNT1");
      filter.addSourceAccount("ACCOUNT2");

      const options = filter.getOptions();
      expect(options.sourceAccounts).toContain("ACCOUNT1");
      expect(options.sourceAccounts).toContain("ACCOUNT2");
    });

    it("should remove source accounts", () => {
      filter.addSourceAccount("ACCOUNT1");
      filter.removeSourceAccount("ACCOUNT1");

      const options = filter.getOptions();
      expect(options.sourceAccounts).not.toContain("ACCOUNT1");
    });

    it("should not add duplicate contract addresses", () => {
      filter.addContractAddress("CONTRACT1");
      filter.addContractAddress("CONTRACT1");

      const options = filter.getOptions();
      const count = (options.contractAddresses || []).filter(
        (addr) => addr === "CONTRACT1",
      ).length;
      expect(count).toBe(1);
    });
  });

  describe("contract operation detection", () => {
    it("should detect contract operations in transactions", () => {
      filter.updateOptions({
        includeTransactions: true,
        contractAddresses: ["ANY"],
      });

      const txWithContractOp: HorizonStreamResponse = {
        id: "tx-1",
        type: "transaction",
        envelope: {
          tx: {
            operations: [
              {
                type: "invoke_host_function",
                function: "contract_fn",
              },
            ],
          },
        },
      } as any;

      expect(filter.shouldProcess(txWithContractOp)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle unknown event types", () => {
      const unknownEvent: HorizonStreamResponse = {
        id: "unknown-1",
      };

      expect(filter.shouldProcess(unknownEvent)).toBe(false);
    });

    it("should handle empty filter options", () => {
      const defaultFilter = new EventFilter();
      const event: HorizonStreamResponse = {
        id: "tx-1",
        type: "transaction",
        source_account: "GBCD123",
      };

      expect(defaultFilter.shouldProcess(event)).toBe(true);
    });

    it("should handle null or undefined values in events", () => {
      const eventWithNulls: HorizonStreamResponse = {
        id: "tx-1",
        type: "transaction",
        source_account: undefined,
      };

      expect(filter.shouldProcess(eventWithNulls)).toBe(true);
    });
  });
});
