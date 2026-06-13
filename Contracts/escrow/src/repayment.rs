//! Repayment Streaming Logic
//!
//! Handles partial repayments, fee calculations, automated USDC streaming
//! back to senders, repayment history tracking, and oracle-triggered defaults.

use soroban_sdk::{Address, BytesN, Env, Vec, token};

use crate::errors::Error;
use crate::events;
use crate::storage::{DataKey, EscrowRecord, EscrowState, RepaymentEntry, REPAYMENT_WINDOW_LEDGERS};

// ---------------------------------------------------------------------------
// Fee calculation
// ---------------------------------------------------------------------------

/// Calculate total amount owed: principal + repayment fee.
pub fn total_owed(record: &EscrowRecord) -> i128 {
    let fee = record.amount * (record.repayment_fee_bps as i128) / 10_000;
    record.amount + fee
}

/// Calculate remaining balance to repay.
pub fn remaining_balance(record: &EscrowRecord) -> i128 {
    let owed = total_owed(record);
    (owed - record.repaid).max(0)
}

/// Calculate protocol fee on a given amount.
pub fn protocol_fee_on(amount: i128, fee_bps: u32) -> i128 {
    amount * (fee_bps as i128) / 10_000
}

// ---------------------------------------------------------------------------
// Trigger repayment window
// ---------------------------------------------------------------------------

/// Oracle triggers the repayment window after harvest.
/// Sets a deadline ledger for the farmer to repay.
pub fn trigger_repay(env: &Env, escrow_id: BytesN<32>) -> Result<(), Error> {
    let mut record: EscrowRecord = env
        .storage()
        .persistent()
        .get(&DataKey::Escrow(escrow_id.clone()))
        .ok_or(Error::EscrowNotFound)?;

    if record.state != EscrowState::Redeemed {
        return Err(Error::NotRedeemed);
    }

    let deadline = env.ledger().sequence() + REPAYMENT_WINDOW_LEDGERS;
    record.state = EscrowState::Repaying;
    record.repay_deadline_ledger = deadline;

    env.storage()
        .persistent()
        .set(&DataKey::Escrow(escrow_id.clone()), &record);
    events::repay_triggered(env, &escrow_id, deadline);

    Ok(())
}

// ---------------------------------------------------------------------------
// Partial repayment
// ---------------------------------------------------------------------------

/// Farmer makes a partial or full repayment.
///
/// - Validates state and amount
/// - Caps payment at remaining balance (prevents overpayment)
/// - Streams USDC directly to sender
/// - Records repayment in history
/// - Closes escrow when fully repaid
pub fn repay(
    env: &Env,
    usdc_token: &Address,
    escrow_id: BytesN<32>,
    farmer: &Address,
    amount: i128,
) -> Result<(), Error> {
    if amount <= 0 {
        return Err(Error::InvalidAmount);
    }

    farmer.require_auth();

    let mut record: EscrowRecord = env
        .storage()
        .persistent()
        .get(&DataKey::Escrow(escrow_id.clone()))
        .ok_or(Error::EscrowNotFound)?;

    if record.state != EscrowState::Repaying {
        return Err(Error::InvalidState);
    }

    let remaining = remaining_balance(&record);

    if remaining <= 0 {
        return Err(Error::RepaymentComplete);
    }

    // Cap at remaining to prevent overpayment
    let actual_amount = amount.min(remaining);

    let token_client = token::Client::new(env, usdc_token);

    // Pull payment from farmer
    token_client.transfer(farmer, &env.current_contract_address(), &actual_amount);

    // Stream immediately to sender
    token_client.transfer(&env.current_contract_address(), &record.sender, &actual_amount);

    record.repaid += actual_amount;

    // Record in history
    append_repayment_history(env, &escrow_id, actual_amount, record.repaid);

    let new_remaining = remaining_balance(&record);

    if new_remaining == 0 {
        record.state = EscrowState::Closed;
        events::repayment_complete(env, &escrow_id, record.repaid);
        events::escrow_closed(env, &escrow_id);
    }

    events::repayment_made(env, &escrow_id, farmer, actual_amount, record.repaid, new_remaining);
    env.storage()
        .persistent()
        .set(&DataKey::Escrow(escrow_id), &record);

    Ok(())
}

// ---------------------------------------------------------------------------
// Default
// ---------------------------------------------------------------------------

/// Oracle triggers a default when the repayment deadline has passed.
pub fn default_escrow(env: &Env, escrow_id: BytesN<32>) -> Result<(), Error> {
    let mut record: EscrowRecord = env
        .storage()
        .persistent()
        .get(&DataKey::Escrow(escrow_id.clone()))
        .ok_or(Error::EscrowNotFound)?;

    if record.state != EscrowState::Repaying {
        return Err(Error::InvalidState);
    }

    // Enforce deadline check — cannot default before window expires
    if record.repay_deadline_ledger > 0
        && env.ledger().sequence() < record.repay_deadline_ledger
    {
        return Err(Error::RepaymentTimeout);
    }

    let owed = total_owed(&record);
    record.state = EscrowState::Defaulted;

    env.storage()
        .persistent()
        .set(&DataKey::Escrow(escrow_id.clone()), &record);
    events::escrow_defaulted(env, &escrow_id, record.repaid, owed);

    Ok(())
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

fn append_repayment_history(env: &Env, escrow_id: &BytesN<32>, amount: i128, cumulative: i128) {
    let key = DataKey::RepaymentHistory(escrow_id.clone());
    let mut history: Vec<RepaymentEntry> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env));

    history.push_back(RepaymentEntry {
        amount,
        ledger: env.ledger().sequence(),
        cumulative,
    });

    env.storage().persistent().set(&key, &history);
}

/// Get full repayment history for an escrow.
pub fn get_repayment_history(env: &Env, escrow_id: BytesN<32>) -> Vec<RepaymentEntry> {
    env.storage()
        .persistent()
        .get(&DataKey::RepaymentHistory(escrow_id))
        .unwrap_or_else(|| Vec::new(env))
}

/// Get remaining balance for an escrow.
pub fn get_remaining_balance(env: &Env, escrow_id: BytesN<32>) -> Result<i128, Error> {
    let record: EscrowRecord = env
        .storage()
        .persistent()
        .get(&DataKey::Escrow(escrow_id))
        .ok_or(Error::EscrowNotFound)?;
    Ok(remaining_balance(&record))
}