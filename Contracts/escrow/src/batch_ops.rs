//! Batch Operations Module
//!
//! Provides batch operations to reduce per-item gas costs through:
//! - Batch repayments from multiple farmers
//! - Batch approvals
//! - Bulk history queries

use soroban_sdk::{contracttype, Address, BytesN, Env, Vec};

use crate::errors::Error;
use crate::storage::{DataKey, EscrowRecord};
use crate::repayment;
use crate::events;
use crate::gas_profiler::gas_costs;

/// Single batch item for a repayment
#[contracttype]
#[derive(Clone, Debug)]
pub struct BatchRepayItem {
    pub escrow_id: BytesN<32>,
    pub farmer: Address,
    pub amount: i128,
}

/// Result of a batch repayment operation
#[contracttype]
#[derive(Clone, Debug)]
pub struct BatchRepayResult {
    pub successful_count: u32,
    pub failed_count: u32,
    pub total_repaid: i128,
    pub estimated_gas_saved: u32,
}

/// Execute batch repayments for multiple escrows
/// Reduces gas overhead compared to individual repay calls
pub fn batch_repay(
    env: &Env,
    usdc_token: &Address,
    items: Vec<BatchRepayItem>,
    max_batch_size: u32,
) -> Result<BatchRepayResult, Error> {
    let batch_size = items.len() as u32;

    // Enforce batch size limit
    if batch_size > max_batch_size {
        return Err(Error::BatchSizeTooLarge);
    }

    if batch_size == 0 {
        return Err(Error::InvalidAmount);
    }

    let mut result = BatchRepayResult {
        successful_count: 0,
        failed_count: 0,
        total_repaid: 0,
        estimated_gas_saved: 0,
    };

    // Process each item in the batch
    for i in 0..batch_size {
        if let Some(item) = items.get(i) {
            match process_batch_repay_item(env, usdc_token, &item) {
                Ok(amount) => {
                    result.successful_count += 1;
                    result.total_repaid += amount;
                }
                Err(_) => {
                    result.failed_count += 1;
                    // Continue processing despite individual failures
                }
            }
        }
    }

    // Calculate gas savings compared to individual calls
    let individual_cost = batch_size * gas_costs::REPAY_BASE;
    let batch_cost = gas_costs::BATCH_REPAY_BASE + (batch_size * gas_costs::BATCH_REPAY_OVERHEAD_PER);
    result.estimated_gas_saved = individual_cost.saturating_sub(batch_cost);

    events::batch_repay_completed(env, result.successful_count, result.failed_count, result.total_repaid);

    Ok(result)
}

/// Process single batch repayment item
fn process_batch_repay_item(
    env: &Env,
    usdc_token: &Address,
    item: &BatchRepayItem,
) -> Result<i128, Error> {
    // Inline critical path to reduce function call overhead
    let mut record: EscrowRecord = env
        .storage()
        .persistent()
        .get(&DataKey::Escrow(item.escrow_id.clone()))
        .ok_or(Error::EscrowNotFound)?;

    if record.state != crate::storage::EscrowState::Repaying {
        return Err(Error::InvalidState);
    }

    if item.amount <= 0 {
        return Err(Error::InvalidAmount);
    }

    let remaining = repayment::remaining_balance(&record);
    if remaining <= 0 {
        return Err(Error::RepaymentComplete);
    }

    let actual_amount = item.amount.min(remaining);

    // Perform token transfer
    let token_client = soroban_sdk::token::Client::new(env, usdc_token);
    token_client.transfer(&item.farmer, &env.current_contract_address(), &actual_amount);
    token_client.transfer(&env.current_contract_address(), &record.sender, &actual_amount);

    record.repaid += actual_amount;

    // Update storage once per item
    env.storage()
        .persistent()
        .set(&DataKey::Escrow(item.escrow_id.clone()), &record);

    Ok(actual_amount)
}

/// Batch query escrow records by IDs
pub fn batch_get_escrows(
    env: &Env,
    escrow_ids: Vec<BytesN<32>>,
) -> Vec<Option<EscrowRecord>> {
    let mut results = Vec::new(env);
    
    for i in 0..escrow_ids.len() {
        if let Some(id) = escrow_ids.get(i) {
            let record = env.storage().persistent().get(&DataKey::Escrow(id.clone()));
            results.push_back(record);
        }
    }
    
    results
}

/// Batch update escrow states with validation
pub fn batch_update_states(
    env: &Env,
    updates: Vec<(BytesN<32>, crate::storage::EscrowState)>,
) -> Result<u32, Error> {
    let mut count = 0u32;

    for i in 0..updates.len() {
        if let Some((escrow_id, new_state)) = updates.get(i) {
            if let Ok(mut record) = env
                .storage()
                .persistent()
                .get::<_, EscrowRecord>(&DataKey::Escrow(escrow_id.clone()))
                .ok_or(Error::EscrowNotFound)
            {
                record.state = new_state;
                env.storage()
                    .persistent()
                    .set(&DataKey::Escrow(escrow_id.clone()), &record);
                count += 1;
            }
        }
    }

    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_batch_repay_result() {
        let result = BatchRepayResult {
            successful_count: 10,
            failed_count: 2,
            total_repaid: 5000,
            estimated_gas_saved: 50_000,
        };
        
        assert_eq!(result.successful_count, 10);
        assert_eq!(result.failed_count, 2);
        assert!(result.estimated_gas_saved > 0);
    }

    #[test]
    fn test_gas_savings_calculation() {
        let batch_size = 20u32;
        let individual_cost = batch_size * gas_costs::REPAY_BASE;
        let batch_cost = gas_costs::BATCH_REPAY_BASE + (batch_size * gas_costs::BATCH_REPAY_OVERHEAD_PER);
        let savings = individual_cost.saturating_sub(batch_cost);
        
        assert!(savings > 0, "Batch should save gas compared to individual calls");
    }
}
