export enum ReconciliationStatus {
    PENDING = 'pending',
    MATCHED = 'matched',
    UNMATCHED = 'unmatched',
    DISCREPANCY = 'discrepancy',
    MANUALLY_RESOLVED = 'manually_resolved',
    FAILED = 'failed',
  }
  
  export enum ReconciliationRunStatus {
    RUNNING = 'running',
    COMPLETED = 'completed',
    FAILED = 'failed',
    PARTIAL = 'partial',
  }
  
  export interface PaymentReconciliation {
    id: string;
    mobile_money_payment_id: string;
    escrow_repayment_id?: string;
    transaction_id?: string;
    status: ReconciliationStatus;
    payment_amount: number;
    expected_amount?: number;
    discrepancy_amount?: number;
    payment_currency: string;
    expected_currency?: string;
    payment_reference: string;
    escrow_reference?: string;
    mobile_money_provider: string;
    mobile_money_number: string;
    matching_metadata?: Record<string, unknown>;
    discrepancy_details?: DiscrepancyDetails;
    resolution_notes?: string;
    resolved_by?: string;
    retry_count: number;
    last_retry_at?: Date;
    next_retry_at?: Date;
    matched_at?: Date;
    resolved_at?: Date;
    created_at: Date;
    updated_at: Date;
  }
  
  export interface DiscrepancyDetails {
    type: DiscrepancyType;
    payment_amount: number;
    expected_amount: number;
    difference: number;
    currency_mismatch?: boolean;
    payment_currency?: string;
    expected_currency?: string;
    additional_info?: Record<string, unknown>;
  }
  
  export enum DiscrepancyType {
    AMOUNT_MISMATCH = 'amount_mismatch',
    CURRENCY_MISMATCH = 'currency_mismatch',
    DUPLICATE_PAYMENT = 'duplicate_payment',
    OVERPAYMENT = 'overpayment',
    UNDERPAYMENT = 'underpayment',
  }
  
  export interface MobileMoneyPayment {
    id: string;
    amount: number;
    currency: string;
    reference: string;
    provider: string;
    phone_number: string;
    status: string;
    transaction_id?: string;
    metadata?: Record<string, unknown>;
    created_at: Date;
  }
  
  export interface EscrowRepayment {
    id: string;
    amount: number;
    currency: string;
    reference: string;
    status: string;
    payment_id?: string;
    due_date: Date;
    metadata?: Record<string, unknown>;
    created_at: Date;
  }
  
  export interface ReconciliationRun {
    id: string;
    status: ReconciliationRunStatus;
    total_payments: number;
    matched_count: number;
    unmatched_count: number;
    discrepancy_count: number;
    failed_count: number;
    total_amount_processed?: number;
    total_amount_matched?: number;
    started_at: Date;
    completed_at?: Date;
    error_details?: Record<string, unknown>;
    created_at: Date;
    updated_at: Date;
  }
  
  export interface ReconciliationReport {
    run_id: string;
    period: { from: Date; to: Date };
    summary: {
      total_payments: number;
      total_amount: number;
      matched: number;
      unmatched: number;
      discrepancies: number;
      match_rate: number;
    };
    discrepancies: DiscrepancyReportItem[];
    unmatched_payments: PaymentReconciliation[];
    generated_at: Date;
  }
  
  export interface DiscrepancyReportItem {
    reconciliation_id: string;
    payment_reference: string;
    payment_amount: number;
    expected_amount: number;
    difference: number;
    discrepancy_type: DiscrepancyType;
    provider: string;
    created_at: Date;
  }
  
  export interface CreateReconciliationDto {
    mobile_money_payment_id: string;
    payment_amount: number;
    payment_currency: string;
    payment_reference: string;
    mobile_money_provider: string;
    mobile_money_number: string;
    transaction_id?: string;
  }
  
  export interface ResolveDiscrepancyDto {
    reconciliation_id: string;
    resolution_notes: string;
    resolved_by: string;
    adjust_amount?: number;
  }
  
  export interface ReconciliationFilterDto {
    status?: ReconciliationStatus;
    from_date?: Date;
    to_date?: Date;
    provider?: string;
    page?: number;
    limit?: number;
  }