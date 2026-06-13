//! Gas Profiling and Estimation Module
//!
//! Provides utilities for tracking gas costs and estimating transaction expenses.
//! Minimizes on-chain profiling overhead by using sampled measurements.

use soroban_sdk::Env;

/// Gas cost constants (in stroops, 1 stroop = 0.0000001 XLM)
/// These are empirically measured baseline costs on Soroban testnet
pub mod gas_costs {
    /// Storage operations costs
    pub const STORAGE_READ_COST: u32 = 5_000;      // Read from persistent storage
    pub const STORAGE_WRITE_COST: u32 = 15_000;    // Write to persistent storage
    pub const STORAGE_DELETE_COST: u32 = 10_000;   // Delete from storage

    /// Cryptographic operations
    pub const SHA256_COST: u32 = 3_000;            // SHA256 hash operation
    pub const VERIFY_SIG_COST: u32 = 25_000;       // Signature verification

    /// Token operations
    pub const TOKEN_TRANSFER_COST: u32 = 45_000;   // Token transfer
    pub const TOKEN_BURN_COST: u32 = 35_000;       // Token burn/balance update

    /// Escrow operations (aggregate estimates)
    pub const FUND_ESCROW_BASE: u32 = 60_000;      // Escrow fund operation
    pub const APPROVE_FARMER_BASE: u32 = 50_000;   // Farmer approval
    pub const REDEEM_VOUCHER_BASE: u32 = 70_000;   // Voucher redemption
    pub const REPAY_BASE: u32 = 55_000;            // Single repayment
    pub const BATCH_REPAY_BASE: u32 = 80_000;      // Batch repayment setup
    pub const BATCH_REPAY_OVERHEAD_PER: u32 = 15_000; // Per-item cost in batch
}

/// Profile metric for a contract operation
#[derive(Clone, Debug, Default)]
pub struct GasMetric {
    pub operation: &'static str,
    pub estimated_cost: u32,
    pub storage_reads: u32,
    pub storage_writes: u32,
    pub storage_deletes: u32,
    pub transfers: u32,
    pub hashes: u32,
    pub sig_verifications: u32,
}

impl GasMetric {
    pub fn new(operation: &'static str) -> Self {
        GasMetric {
            operation,
            ..Default::default()
        }
    }

    /// Set storage read/write counts (builder-style)
    pub fn with_storage(mut self, reads: u32, writes: u32) -> Self {
        self.storage_reads = reads;
        self.storage_writes = writes;
        self
    }

    /// Set storage delete count (builder-style)
    pub fn with_deletes(mut self, deletes: u32) -> Self {
        self.storage_deletes = deletes;
        self
    }

    /// Set token transfer count (builder-style)
    pub fn with_transfers(mut self, transfers: u32) -> Self {
        self.transfers = transfers;
        self
    }

    /// Set cryptographic operation counts (builder-style)
    pub fn with_crypto(mut self, hashes: u32, sig_verifications: u32) -> Self {
        self.hashes = hashes;
        self.sig_verifications = sig_verifications;
        self
    }

    /// Calculate total estimated cost based on operations.
    /// Uses saturating arithmetic to avoid overflow/panics on extreme inputs.
    pub fn calculate_cost(&mut self) {
        self.estimated_cost = self
            .storage_reads
            .saturating_mul(gas_costs::STORAGE_READ_COST)
            .saturating_add(
                self.storage_writes
                    .saturating_mul(gas_costs::STORAGE_WRITE_COST),
            )
            .saturating_add(
                self.storage_deletes
                    .saturating_mul(gas_costs::STORAGE_DELETE_COST),
            )
            .saturating_add(
                self.transfers
                    .saturating_mul(gas_costs::TOKEN_TRANSFER_COST),
            )
            .saturating_add(self.hashes.saturating_mul(gas_costs::SHA256_COST))
            .saturating_add(
                self.sig_verifications
                    .saturating_mul(gas_costs::VERIFY_SIG_COST),
            );
    }

    /// Finalize the metric by computing its estimated cost (builder-style)
    pub fn finalize(mut self) -> Self {
        self.calculate_cost();
        self
    }
}

/// Gas limit enforcement structure
pub struct GasLimitConfig {
    pub max_repayment_batch_size: usize, // Max farmers in batch operation
    pub max_history_retention: usize,    // Max repayment history entries stored
    pub max_lazy_load_batch: usize,      // Max items to lazy load per call
    pub enable_cost_check: bool,         // Enable on-chain cost verification
}

impl Default for GasLimitConfig {
    fn default() -> Self {
        GasLimitConfig {
            max_repayment_batch_size: 50,
            max_history_retention: 500,
            max_lazy_load_batch: 100,
            enable_cost_check: true,
        }
    }
}

impl GasLimitConfig {
    /// Validate that a requested batch size is within configured limits.
    pub fn validate_batch_size(&self, size: usize) -> Result<(), &'static str> {
        if size == 0 {
            return Err("batch size must be non-zero");
        }
        if size > self.max_repayment_batch_size {
            return Err("batch size exceeds configured maximum");
        }
        Ok(())
    }

    /// Validate that a requested lazy-load batch size is within configured limits.
    pub fn validate_lazy_load_batch(&self, size: usize) -> Result<(), &'static str> {
        if size == 0 {
            return Err("lazy load batch size must be non-zero");
        }
        if size > self.max_lazy_load_batch {
            return Err("lazy load batch size exceeds configured maximum");
        }
        Ok(())
    }

    /// Validate that history retention count is within configured limits.
    pub fn validate_history_retention(&self, count: usize) -> Result<(), &'static str> {
        if count > self.max_history_retention {
            return Err("history retention exceeds configured maximum");
        }
        Ok(())
    }
}

/// Publish gas metric event for off-chain analysis.
///
/// When the `gas-profiling` feature is enabled, this emits an on-chain event
/// containing the operation name and estimated cost. Events are lower-cost
/// than storage writes and are visible to off-chain indexers.
///
/// When the feature is disabled (default), this is a zero-cost no-op so that
/// production builds incur no overhead from profiling.
#[cfg(feature = "gas-profiling")]
pub fn publish_gas_metric(env: &Env, metric: &GasMetric) {
    env.events().publish(
        (soroban_sdk::symbol_short!("gas"), metric.operation),
        metric.estimated_cost,
    );
}

#[cfg(not(feature = "gas-profiling"))]
pub fn publish_gas_metric(_env: &Env, _metric: &GasMetric) {
    // No-op in production builds to avoid added cost.
}

/// Estimate gas cost for fund operation
pub fn estimate_fund_cost(transfers: u32) -> u32 {
    gas_costs::FUND_ESCROW_BASE
        .saturating_add(transfers.saturating_mul(gas_costs::TOKEN_TRANSFER_COST))
}

/// Estimate gas cost for approve farmer operation
pub fn estimate_approve_cost() -> u32 {
    gas_costs::APPROVE_FARMER_BASE
}

/// Estimate gas cost for redeem voucher operation
pub fn estimate_redeem_cost(transfers: u32) -> u32 {
    gas_costs::REDEEM_VOUCHER_BASE
        .saturating_add(transfers.saturating_mul(gas_costs::TOKEN_TRANSFER_COST))
}

/// Estimate gas cost for repay operation
pub fn estimate_repay_cost(transfers: u32) -> u32 {
    gas_costs::REPAY_BASE
        .saturating_add(transfers.saturating_mul(gas_costs::TOKEN_TRANSFER_COST))
}

/// Estimate gas cost for batch repay.
///
/// Uses saturating arithmetic throughout since `batch_size` may be derived
/// from external/user-controlled input and should not be able to panic or
/// silently wrap on overflow.
pub fn estimate_batch_repay_cost(batch_size: u32) -> u32 {
    let overhead = batch_size.saturating_mul(gas_costs::BATCH_REPAY_OVERHEAD_PER);
    let transfer_cost = batch_size
        .saturating_mul(gas_costs::TOKEN_TRANSFER_COST)
        .saturating_mul(2); // transfers per item

    gas_costs::BATCH_REPAY_BASE
        .saturating_add(overhead)
        .saturating_add(transfer_cost)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gas_metric_calculation() {
        let mut metric = GasMetric::new("test_op");
        metric.storage_reads = 2;
        metric.storage_writes = 1;
        metric.transfers = 1;
        metric.calculate_cost();

        let expected = (2 * gas_costs::STORAGE_READ_COST)
            + (1 * gas_costs::STORAGE_WRITE_COST)
            + (1 * gas_costs::TOKEN_TRANSFER_COST);
        assert_eq!(metric.estimated_cost, expected);
    }

    #[test]
    fn test_gas_metric_builder_api() {
        let metric = GasMetric::new("fund_escrow")
            .with_storage(1, 2)
            .with_transfers(1)
            .with_crypto(1, 0)
            .finalize();

        let expected = (1 * gas_costs::STORAGE_READ_COST)
            + (2 * gas_costs::STORAGE_WRITE_COST)
            + (1 * gas_costs::TOKEN_TRANSFER_COST)
            + (1 * gas_costs::SHA256_COST);
        assert_eq!(metric.estimated_cost, expected);
    }

    #[test]
    fn test_gas_metric_includes_deletes_and_sig_verification() {
        let metric = GasMetric::new("redeem_voucher")
            .with_deletes(1)
            .with_crypto(0, 1)
            .finalize();

        let expected = gas_costs::STORAGE_DELETE_COST + gas_costs::VERIFY_SIG_COST;
        assert_eq!(metric.estimated_cost, expected);
    }

    #[test]
    fn test_cost_estimation() {
        let fund_cost = estimate_fund_cost(1);
        assert!(fund_cost > gas_costs::FUND_ESCROW_BASE);

        let batch_cost = estimate_batch_repay_cost(10);
        assert!(batch_cost > gas_costs::BATCH_REPAY_BASE);
    }

    #[test]
    fn test_batch_repay_overflow_safety() {
        // Should saturate rather than panic or wrap on extreme input.
        let cost = estimate_batch_repay_cost(u32::MAX);
        assert_eq!(cost, u32::MAX);
    }

    #[test]
    fn test_batch_size_validation() {
        let cfg = GasLimitConfig::default();
        assert!(cfg.validate_batch_size(1).is_ok());
        assert!(cfg.validate_batch_size(50).is_ok());
        assert!(cfg.validate_batch_size(51).is_err());
        assert!(cfg.validate_batch_size(0).is_err());
    }

    #[test]
    fn test_lazy_load_batch_validation() {
        let cfg = GasLimitConfig::default();
        assert!(cfg.validate_lazy_load_batch(100).is_ok());
        assert!(cfg.validate_lazy_load_batch(101).is_err());
        assert!(cfg.validate_lazy_load_batch(0).is_err());
    }

    #[test]
    fn test_history_retention_validation() {
        let cfg = GasLimitConfig::default();
        assert!(cfg.validate_history_retention(500).is_ok());
        assert!(cfg.validate_history_retention(501).is_err());
    }
}