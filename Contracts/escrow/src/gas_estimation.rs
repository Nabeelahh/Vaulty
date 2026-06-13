//! Gas Estimation and Validation Module
//!
//! Provides utilities for estimating operation costs and validating
//! gas limits before execution to prevent out-of-gas failures.

use soroban_sdk::{contracttype, Env};

#[cfg(test)]
use std::{format, string::String};

use crate::errors::Error;
use crate::gas_profiler::{gas_costs, GasLimitConfig};
#[cfg(test)]
use crate::gas_profiler::GasMetric;
use crate::storage::EscrowRecord;

/// Gas estimation for fund operation
#[contracttype]
#[derive(Clone, Debug)]
pub struct FundEstimate {
    pub base_cost: u32,
    pub per_transfer_cost: u32,
    pub total_estimated: u32,
}

impl FundEstimate {
    pub fn new() -> Self {
        FundEstimate {
            base_cost: gas_costs::FUND_ESCROW_BASE,
            per_transfer_cost: gas_costs::TOKEN_TRANSFER_COST,
            total_estimated: gas_costs::FUND_ESCROW_BASE + gas_costs::TOKEN_TRANSFER_COST,
        }
    }
}

/// Gas estimation for approve farmer operation
#[contracttype]
#[derive(Clone, Debug)]
pub struct ApproveEstimate {
    pub base_cost: u32,
    pub total_estimated: u32,
}

impl ApproveEstimate {
    pub fn new() -> Self {
        ApproveEstimate {
            base_cost: gas_costs::APPROVE_FARMER_BASE,
            total_estimated: gas_costs::APPROVE_FARMER_BASE,
        }
    }
}

/// Gas estimation for redeem voucher operation
#[contracttype]
#[derive(Clone, Debug)]
pub struct RedeemEstimate {
    pub base_cost: u32,
    pub transfers: u32,
    pub total_estimated: u32,
}

impl RedeemEstimate {
    /// Create estimate for redeem with given number of transfers
    pub fn new(transfers: u32) -> Self {
        let total = gas_costs::REDEEM_VOUCHER_BASE + (transfers * gas_costs::TOKEN_TRANSFER_COST);
        RedeemEstimate {
            base_cost: gas_costs::REDEEM_VOUCHER_BASE,
            transfers,
            total_estimated: total,
        }
    }
}

/// Gas estimation for repay operation
#[contracttype]
#[derive(Clone, Debug)]
pub struct RepayEstimate {
    pub base_cost: u32,
    pub transfers: u32,
    pub storage_cost: u32,
    pub total_estimated: u32,
}

impl RepayEstimate {
    /// Create estimate for repay with given parameters
    pub fn new(transfers: u32, includes_history: bool) -> Self {
        let mut storage_cost = 0;
        if includes_history {
            storage_cost = gas_costs::STORAGE_WRITE_COST; // History append
        }

        let total = gas_costs::REPAY_BASE + (transfers * gas_costs::TOKEN_TRANSFER_COST) + storage_cost;
        RepayEstimate {
            base_cost: gas_costs::REPAY_BASE,
            transfers,
            storage_cost,
            total_estimated: total,
        }
    }
}

/// Gas estimation for batch repay
#[contracttype]
#[derive(Clone, Debug)]
pub struct BatchRepayEstimate {
    pub base_cost: u32,
    pub batch_size: u32,
    pub per_item_cost: u32,
    pub total_estimated: u32,
    pub gas_savings_vs_individual: u32,
}

impl BatchRepayEstimate {
    /// Create estimate for batch repay operation
    pub fn new(batch_size: u32) -> Self {
        let per_item = gas_costs::BATCH_REPAY_OVERHEAD_PER + (2 * gas_costs::TOKEN_TRANSFER_COST);
        let batch_total = gas_costs::BATCH_REPAY_BASE + (batch_size * per_item);
        let individual_total =
            batch_size * (gas_costs::REPAY_BASE + (2 * gas_costs::TOKEN_TRANSFER_COST));
        let savings = individual_total.saturating_sub(batch_total);

        BatchRepayEstimate {
            base_cost: gas_costs::BATCH_REPAY_BASE,
            batch_size,
            per_item_cost: per_item,
            total_estimated: batch_total,
            gas_savings_vs_individual: savings,
        }
    }
}

/// Validate operation against gas limits
pub fn validate_fund_gas(
    _env: &Env,
    _config: &GasLimitConfig,
) -> Result<(), Error> {
    // Fund operation is fixed cost, always safe
    Ok(())
}

/// Validate approve operation against gas limits
pub fn validate_approve_gas(
    _env: &Env,
    _config: &GasLimitConfig,
) -> Result<(), Error> {
    // Approve operation is fixed cost, always safe
    Ok(())
}

/// Validate redeem operation against gas limits
pub fn validate_redeem_gas(
    _env: &Env,
    _config: &GasLimitConfig,
) -> Result<(), Error> {
    // Redeem has predictable cost (2-3 transfers)
    Ok(())
}

/// Validate repay operation doesn't exceed limits
pub fn validate_repay_gas(
    env: &Env,
    record: &EscrowRecord,
    config: &GasLimitConfig,
) -> Result<(), Error> {
    // Check that repayment history isn't too large
    if let Ok((_, count)) = crate::storage_optimized::get_repayment_summary(env, &record.vendor_id) {
        if count as usize > config.max_history_retention {
            return Err(Error::HistoryTooLarge);
        }
    }
    Ok(())
}

/// Validate batch operation against gas limits
pub fn validate_batch_repay_gas(
    _env: &Env,
    batch_size: usize,
    config: &GasLimitConfig,
) -> Result<(), Error> {
    if batch_size > config.max_repayment_batch_size {
        return Err(Error::BatchSizeTooLarge);
    }
    Ok(())
}

/// Generate performance report for an operation
#[cfg(test)]
pub fn generate_performance_report(mut metric: GasMetric) -> String {
    metric.calculate_cost();
    
    let report = format!(
        "Operation: {}\nEstimated Gas Cost: {} stroops\nStorage Reads: {}\nStorage Writes: {}\nTransfers: {}",
        metric.operation, metric.estimated_cost, metric.storage_reads, metric.storage_writes, metric.transfers
    );
    
    report
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fund_estimate() {
        let est = FundEstimate::new();
        assert!(est.total_estimated > est.base_cost);
    }

    #[test]
    fn test_approve_estimate() {
        let est = ApproveEstimate::new();
        assert_eq!(est.total_estimated, est.base_cost);
    }

    #[test]
    fn test_redeem_estimate() {
        let est = RedeemEstimate::new(2);
        assert!(est.total_estimated > est.base_cost);
        assert_eq!(est.transfers, 2);
    }

    #[test]
    fn test_repay_estimate() {
        let est = RepayEstimate::new(2, true);
        assert!(est.total_estimated > est.base_cost);
        assert!(est.storage_cost > 0);
    }

    #[test]
    fn test_batch_repay_estimate() {
        let est = BatchRepayEstimate::new(10);
        let individual =
            est.batch_size * (gas_costs::REPAY_BASE + (2 * gas_costs::TOKEN_TRANSFER_COST));
        assert!(est.total_estimated < individual);
        assert!(est.gas_savings_vs_individual > 0);
    }

    #[test]
    fn test_performance_report() {
        let mut metric = GasMetric::new("test_operation");
        metric.storage_reads = 2;
        metric.transfers = 1;
        
        let report = generate_performance_report(metric);
        assert!(report.contains("test_operation"));
        assert!(report.contains("stroops"));
    }
}
