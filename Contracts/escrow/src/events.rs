use soroban_sdk::{Address, BytesN, Env, Symbol, symbol_short};

use crate::storage;

pub fn escrow_funded(env: &Env, escrow_id: &BytesN<32>, sender: &Address, amount: i128) {
    env.events().publish(
        (symbol_short!("funded"), escrow_id.clone()),
        (sender.clone(), amount),
    );
}

pub fn farmer_approved(env: &Env, escrow_id: &BytesN<32>, farmer: &Address) {
    env.events().publish(
        (symbol_short!("approved"), escrow_id.clone()),
        farmer.clone(),
    );
}

pub fn voucher_minted(env: &Env, escrow_id: &BytesN<32>, farmer: &Address, amount: i128) {
    env.events().publish(
        (symbol_short!("minted"), escrow_id.clone()),
        (farmer.clone(), amount),
    );
}

/// Emitted by voucher::burn_voucher — low-level burn inside the voucher module.
pub fn voucher_burned(env: &Env, escrow_id: &BytesN<32>, vendor: &Address, amount: i128) {
    env.events().publish(
        (symbol_short!("burned"), escrow_id.clone()),
        (vendor.clone(), amount),
    );
}

/// Emitted by escrow::redeem_voucher — high-level redemption with USDC transfer.
pub fn voucher_redeemed(env: &Env, escrow_id: &BytesN<32>, vendor: &Address, amount: i128) {
    env.events().publish(
        (symbol_short!("redeemed"), escrow_id.clone()),
        (vendor.clone(), amount),
    );
}

/// Emitted when oracle opens the repayment window. Includes deadline for off-chain monitoring.
pub fn repay_triggered(env: &Env, escrow_id: &BytesN<32>, deadline_ledger: u32) {
    env.events().publish(
        (Symbol::new(env, "repay_trig"), escrow_id.clone()),
        deadline_ledger,
    );
}

pub fn repayment_made(
    env: &Env,
    escrow_id: &BytesN<32>,
    farmer: &Address,
    amount: i128,
    total_repaid: i128,
    remaining: i128,
) {
    env.events().publish(
        (Symbol::new(env, "repayment"), escrow_id.clone()),
        (farmer.clone(), amount, total_repaid, remaining),
    );
}

pub fn repayment_complete(env: &Env, escrow_id: &BytesN<32>, total_repaid: i128) {
    env.events().publish(
        (Symbol::new(env, "repay_done"), escrow_id.clone()),
        total_repaid,
    );
}

pub fn escrow_closed(env: &Env, escrow_id: &BytesN<32>) {
    env.events().publish(
        (symbol_short!("closed"), escrow_id.clone()),
        (),
    );
}

pub fn escrow_cancelled(env: &Env, escrow_id: &BytesN<32>, sender: &Address, amount: i128) {
    env.events().publish(
        (symbol_short!("cancel"), escrow_id.clone()),
        (sender.clone(), amount),
    );
}

/// Emitted on default — includes repaid vs owed for off-chain loss accounting.
pub fn escrow_defaulted(env: &Env, escrow_id: &BytesN<32>, repaid: i128, owed: i128) {
    env.events().publish(
        (symbol_short!("default"), escrow_id.clone()),
        (repaid, owed),
    );
}

pub fn fee_collected(env: &Env, escrow_id: &BytesN<32>, protocol_fee: i128, repayment_fee: i128) {
    env.events().publish(
        (Symbol::new(env, "fee_coll"), escrow_id.clone()),
        (protocol_fee, repayment_fee),
    );
}

pub fn abi_registered(env: &Env, contract_id: &BytesN<32>, version: u32) {
    env.events().publish(
        (Symbol::new(env, "abi_reg"), contract_id.clone()),
        version,
    );
}

pub fn abi_updated(env: &Env, contract_id: &BytesN<32>, old_version: u32, new_version: u32) {
    env.events().publish(
        (Symbol::new(env, "abi_upd"), contract_id.clone()),
        (old_version, new_version),
    );
}

/// Emitted when batch repay operation completes
pub fn batch_repay_completed(env: &Env, successful: u32, failed: u32, total_repaid: i128) {
    env.events().publish(
        (Symbol::new(env, "batch_repay"), "completed"),
        (successful, failed, total_repaid),
    );
}

// -----------------------------------------------------------------------
// Role-Based Access Control Events
// -----------------------------------------------------------------------

/// Emitted when a role is assigned to an address
pub fn role_assigned(env: &Env, address: &Address, role: &storage::Role) {
    env.events().publish(
        (Symbol::new(env, "role_assign"), address.clone()),
        role.clone(),
    );
}

/// Emitted when a role is revoked from an address
pub fn role_revoked(env: &Env, address: &Address, role: &storage::Role) {
    env.events().publish(
        (Symbol::new(env, "role_revoke"), address.clone()),
        role.clone(),
    );
}

/// Emitted when admin role is transferred
pub fn admin_transferred(env: &Env, old_admin: &Address, new_admin: &Address) {
    env.events().publish(
        (Symbol::new(env, "admin_xfer"), old_admin.clone()),
        new_admin.clone(),
    );
}

/// Emitted when oracle is changed
pub fn oracle_changed(env: &Env, old_oracle: &Address, new_oracle: &Address) {
    env.events().publish(
        (Symbol::new(env, "oracle_chg"), old_oracle.clone()),
        new_oracle.clone(),
    );
}

/// Emitted when vendor is approved
pub fn vendor_approved(env: &Env, vendor_id: &BytesN<32>, approved_by: &Address) {
    env.events().publish(
        (Symbol::new(env, "vendor_appr"), vendor_id.clone()),
        approved_by.clone(),
    );
}

/// Emitted when vendor is removed
pub fn vendor_removed(env: &Env, vendor_id: &BytesN<32>, removed_by: &Address) {
    env.events().publish(
        (Symbol::new(env, "vendor_rem"), vendor_id.clone()),
        removed_by.clone(),
    );
}

/// Emitted when contract is paused
pub fn contract_paused(env: &Env, paused_by: &Address) {
    env.events().publish(
        (symbol_short!("paused"), "contract"),
        paused_by.clone(),
    );
}

/// Emitted when contract is resumed
pub fn contract_resumed(env: &Env, resumed_by: &Address) {
    env.events().publish(
        (symbol_short!("resumed"), "contract"),
        resumed_by.clone(),
    );
}

/// Emitted when multi-signature proposal is created
pub fn proposal_created(env: &Env, proposal_id: &BytesN<32>, operation: &Symbol, proposer: &Address) {
    env.events().publish(
        (Symbol::new(env, "prop_create"), proposal_id.clone()),
        (operation.clone(), proposer.clone()),
    );
}

/// Emitted when multi-signature proposal is approved
pub fn proposal_approved(env: &Env, proposal_id: &BytesN<32>, approver: &Address) {
    env.events().publish(
        (Symbol::new(env, "prop_appr"), proposal_id.clone()),
        approver.clone(),
    );
}

/// Emitted when multi-signature proposal is executed
pub fn proposal_executed(env: &Env, proposal_id: &BytesN<32>, executor: &Address) {
    env.events().publish(
        (Symbol::new(env, "prop_exec"), proposal_id.clone()),
        executor.clone(),
    );
}
