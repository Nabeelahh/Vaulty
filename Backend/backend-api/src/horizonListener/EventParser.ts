/**
 * Event parser and validator
 * Parses Horizon events and validates their structure and content
 */

import { v4 as uuidv4 } from "uuid";
import {
  BlockchainEvent,
  TransactionEvent,
  OperationEvent,
  ContractEvent,
  ProcessedEvent,
} from "./types";
import { HorizonStreamResponse } from "./HorizonConnection";

export class EventParser {
  private logger: Console;

  constructor(logger: Console = console) {
    this.logger = logger;
  }

  /**
   * Parse and validate a Horizon event
   */
  parseEvent(event: HorizonStreamResponse): ProcessedEvent | null {
    try {
      const eventType = this.getEventType(event);
      let parsedEvent: BlockchainEvent | null = null;
      let contractRelated = false;

      switch (eventType) {
        case "transaction":
          parsedEvent = this.parseTransaction(event);
          contractRelated = this.isContractRelated(event);
          break;
        case "operation":
          parsedEvent = this.parseOperation(event);
          contractRelated = this.isContractRelated(event);
          break;
        case "contract":
          parsedEvent = this.parseContractEvent(event);
          contractRelated = true;
          break;
        default:
          this.logger.warn("Unknown event type", { event });
          return null;
      }

      if (!parsedEvent) {
        return null;
      }

      const validation = this.validateEvent(parsedEvent);

      return {
        id: uuidv4(),
        originalId: (event.id as string) || uuidv4(),
        eventType: eventType as "transaction" | "operation" | "contract",
        contractRelated,
        timestamp: new Date().toISOString(),
        data: parsedEvent,
        processedAt: new Date().toISOString(),
        valid: validation.valid,
        errors: validation.valid ? undefined : validation.errors,
      };
    } catch (error) {
      this.logger.error("Failed to parse event", {
        error: error instanceof Error ? error.message : String(error),
        event,
      });
      return null;
    }
  }

  /**
   * Determine event type
   */
  private getEventType(event: HorizonStreamResponse): string {
    if (event.type === "transaction") return "transaction";
    if (event.type === "operation") return "operation";
    if ((event as Record<string, unknown>).contract_id) return "contract";
    return "unknown";
  }

  /**
   * Parse transaction event
   */
  private parseTransaction(event: HorizonStreamResponse): TransactionEvent {
    return {
      id: (event.id as string) || uuidv4(),
      type: "transaction",
      timestamp: (event.created_at as string) || new Date().toISOString(),
      hash: (event.hash as string) || "",
      sourceAccount: (event.source_account as string) || "",
      operationCount: (event.operation_count as number) || 0,
      fees: (event.fees_paid as string) || "0",
      successful: (event.successful as boolean) ?? true,
      ledgerSequence: (event.ledger_sequence as number) || 0,
      envelope: event.envelope as Record<string, unknown>,
    };
  }

  /**
   * Parse operation event
   */
  private parseOperation(event: HorizonStreamResponse): OperationEvent {
    return {
      id: (event.id as string) || uuidv4(),
      type: "operation",
      timestamp: (event.created_at as string) || new Date().toISOString(),
      transactionHash: (event.transaction_hash as string) || "",
      operationType: (event.type as string) || "unknown",
      sourceAccount: (event.source_account as string) || "",
      details: this.extractOperationDetails(event),
    };
  }

  /**
   * Parse contract event
   */
  private parseContractEvent(event: HorizonStreamResponse): ContractEvent {
    const contractId =
      ((event as Record<string, unknown>).contract_id as string) || "";
    const topics =
      ((event as Record<string, unknown>).topics as string[]) || [];
    const data = ((event as Record<string, unknown>).data as string) || "";

    return {
      id: (event.id as string) || uuidv4(),
      type: "contract",
      timestamp: (event.created_at as string) || new Date().toISOString(),
      contractId,
      transactionHash: (event.transaction_hash as string) || "",
      eventType: (event.type as string) || "unknown",
      topics,
      data,
      ledgerSequence:
        ((event as Record<string, unknown>).ledger_sequence as number) || 0,
      ledgerClosedAt:
        ((event as Record<string, unknown>).ledger_closed_at as string) || "",
    };
  }

  /**
   * Extract operation details from event
   */
  private extractOperationDetails(
    event: HorizonStreamResponse,
  ): Record<string, unknown> {
    const details: Record<string, unknown> = {};
    const excludeKeys = [
      "id",
      "type",
      "created_at",
      "transaction_hash",
      "source_account",
      "paging_token",
    ];

    for (const [key, value] of Object.entries(event)) {
      if (!excludeKeys.includes(key)) {
        details[key] = value;
      }
    }

    return details;
  }

  /**
   * Check if event is contract-related
   */
  private isContractRelated(event: HorizonStreamResponse): boolean {
    const eventAsRecord = event as Record<string, unknown>;

    // Check for contract fields
    if (eventAsRecord.contract_id || eventAsRecord.soroban_op_count) {
      return true;
    }

    // Check operations for contract-related types
    const operations =
      (eventAsRecord.envelope?.tx?.operations as Array<
        Record<string, unknown>
      >) || [];
    return operations.some(
      (op) =>
        op.type === "invoke_host_function" ||
        (op.type as string)?.includes("contract"),
    );
  }

  /**
   * Validate event structure and content
   */
  private validateEvent(event: BlockchainEvent): {
    valid: boolean;
    errors?: string[];
  } {
    const errors: string[] = [];

    // Common validation
    if (!event.id) {
      errors.push("Missing event ID");
    }
    if (!event.timestamp) {
      errors.push("Missing timestamp");
    }

    // Type-specific validation
    if (event.type === "transaction") {
      const txEvent = event as TransactionEvent;
      if (!txEvent.hash) {
        errors.push("Missing transaction hash");
      }
      if (!txEvent.sourceAccount) {
        errors.push("Missing source account");
      }
      if (txEvent.ledgerSequence < 0) {
        errors.push("Invalid ledger sequence");
      }
    } else if (event.type === "operation") {
      const opEvent = event as OperationEvent;
      if (!opEvent.transactionHash) {
        errors.push("Missing transaction hash");
      }
      if (!opEvent.operationType) {
        errors.push("Missing operation type");
      }
    } else if (event.type === "contract") {
      const contractEvent = event as ContractEvent;
      if (!contractEvent.contractId) {
        errors.push("Missing contract ID");
      }
      if (!contractEvent.transactionHash) {
        errors.push("Missing transaction hash");
      }
      if (contractEvent.ledgerSequence < 0) {
        errors.push("Invalid ledger sequence");
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validate multiple events
   */
  validateEvents(events: BlockchainEvent[]): ProcessedEvent[] {
    return events
      .map((event) => {
        const validation = this.validateEvent(event);
        return {
          id: uuidv4(),
          originalId: event.id,
          eventType: event.type as "transaction" | "operation" | "contract",
          contractRelated: event.type === "contract",
          timestamp: event.timestamp,
          data: event,
          processedAt: new Date().toISOString(),
          valid: validation.valid,
          errors: validation.errors,
        };
      })
      .filter((result) => result.valid);
  }

  /**
   * Extract specific data from event
   */
  extractData<T>(event: BlockchainEvent, keys: string[]): Partial<T> {
    const result: Record<string, unknown> = {};
    const eventAsRecord = event as Record<string, unknown>;

    for (const key of keys) {
      if (key in eventAsRecord) {
        result[key] = eventAsRecord[key];
      }
    }

    return result as Partial<T>;
  }
}
