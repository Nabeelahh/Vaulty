/**
 * Event filter for Horizon events
 * Filters events based on configured criteria
 */

import {
  EventFilterOptions,
  BlockchainEvent,
  TransactionEvent,
  OperationEvent,
  ContractEvent,
} from "./types";
import { HorizonStreamResponse } from "./HorizonConnection";

export class EventFilter {
  private options: EventFilterOptions;
  private logger: Console;

  constructor(options: EventFilterOptions = {}, logger: Console = console) {
    this.options = {
      includeTransactions: options.includeTransactions ?? true,
      includeOperations: options.includeOperations ?? false,
      includeContractEvents: options.includeContractEvents ?? true,
      contractAddresses: options.contractAddresses || [],
      sourceAccounts: options.sourceAccounts || [],
      operationTypes: options.operationTypes || [],
    };
    this.logger = logger;
  }

  /**
   * Determine if an event should be processed
   */
  shouldProcess(event: HorizonStreamResponse): boolean {
    const eventType = this.determineEventType(event);

    if (!eventType) {
      return false;
    }

    switch (eventType) {
      case "transaction":
        return (
          this.options.includeTransactions! && this.isTransactionRelevant(event)
        );
      case "operation":
        return (
          this.options.includeOperations! && this.isOperationRelevant(event)
        );
      case "contract":
        return (
          this.options.includeContractEvents! &&
          this.isContractEventRelevant(event)
        );
      default:
        return false;
    }
  }

  /**
   * Determine event type from Horizon response
   */
  private determineEventType(event: HorizonStreamResponse): string | null {
    if (event.type === "transaction") {
      return "transaction";
    }
    if (event.type === "operation") {
      return "operation";
    }
    // Check for contract events (soroban)
    if (this.isContractEvent(event)) {
      return "contract";
    }
    return null;
  }

  /**
   * Check if transaction should be processed
   */
  private isTransactionRelevant(event: HorizonStreamResponse): boolean {
    // Filter by source account if specified
    if (this.options.sourceAccounts && this.options.sourceAccounts.length > 0) {
      if (
        !this.options.sourceAccounts.includes(event.source_account as string)
      ) {
        return false;
      }
    }

    // Check if transaction contains contract operations
    if (
      this.options.contractAddresses &&
      this.options.contractAddresses.length > 0
    ) {
      const hasContractOp = this.hasContractOperation(event);
      if (!hasContractOp) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if operation should be processed
   */
  private isOperationRelevant(event: HorizonStreamResponse): boolean {
    // Filter by operation type if specified
    if (this.options.operationTypes && this.options.operationTypes.length > 0) {
      const operationType = event.type as string;
      if (!this.options.operationTypes.includes(operationType)) {
        return false;
      }
    }

    // Filter by source account if specified
    if (this.options.sourceAccounts && this.options.sourceAccounts.length > 0) {
      if (
        !this.options.sourceAccounts.includes(event.source_account as string)
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if contract event should be processed
   */
  private isContractEventRelevant(event: HorizonStreamResponse): boolean {
    // Filter by contract address if specified
    if (
      this.options.contractAddresses &&
      this.options.contractAddresses.length > 0
    ) {
      const contractId = this.extractContractId(event);
      if (!contractId || !this.options.contractAddresses.includes(contractId)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if event is a contract event (Soroban)
   */
  private isContractEvent(event: HorizonStreamResponse): boolean {
    // Soroban contract events are identified by specific fields
    // They typically appear in the contract events endpoint or have specific markers
    const hasContractFields =
      (event as Record<string, unknown>).contract_id !== undefined ||
      (event as Record<string, unknown>).soroban_op_count !== undefined ||
      this.hasContractOperation(event);

    return hasContractFields;
  }

  /**
   * Check if transaction contains contract operations
   */
  private hasContractOperation(event: HorizonStreamResponse): boolean {
    const operations =
      (event.envelope?.tx?.operations as Array<Record<string, unknown>>) || [];
    return operations.some(
      (op) =>
        op.type === "invoke_host_function" ||
        op.type === "bump_sequence" ||
        (op.type as string)?.includes("contract"),
    );
  }

  /**
   * Extract contract ID from event
   */
  private extractContractId(event: HorizonStreamResponse): string | null {
    return ((event as Record<string, unknown>).contract_id as string) || null;
  }

  /**
   * Update filter options
   */
  updateOptions(options: Partial<EventFilterOptions>): void {
    this.options = { ...this.options, ...options };
    this.logger.info("Event filter options updated", this.options);
  }

  /**
   * Get current filter options
   */
  getOptions(): EventFilterOptions {
    return { ...this.options };
  }

  /**
   * Add contract address to filter list
   */
  addContractAddress(address: string): void {
    if (!this.options.contractAddresses!.includes(address)) {
      this.options.contractAddresses!.push(address);
      this.logger.info("Contract address added to filter", { address });
    }
  }

  /**
   * Remove contract address from filter list
   */
  removeContractAddress(address: string): void {
    const index = this.options.contractAddresses!.indexOf(address);
    if (index > -1) {
      this.options.contractAddresses!.splice(index, 1);
      this.logger.info("Contract address removed from filter", { address });
    }
  }

  /**
   * Add source account to filter list
   */
  addSourceAccount(account: string): void {
    if (!this.options.sourceAccounts!.includes(account)) {
      this.options.sourceAccounts!.push(account);
      this.logger.info("Source account added to filter", { account });
    }
  }

  /**
   * Remove source account from filter list
   */
  removeSourceAccount(account: string): void {
    const index = this.options.sourceAccounts!.indexOf(account);
    if (index > -1) {
      this.options.sourceAccounts!.splice(index, 1);
      this.logger.info("Source account removed from filter", { account });
    }
  }
}
