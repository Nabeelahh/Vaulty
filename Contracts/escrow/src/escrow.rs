use soroban_sdk::{Address, BytesN, Env, Symbol, token};

use crate::errors::Error;
use crate::events;
use crate::storage::{
    DataKey, EscrowRecord, EscrowState, APPROVAL_TIMEOUT_LEDGERS, DEFAULT_REPAYMENT_FEE_BPS,
    PROTOCOL_FEE_BPS, REPAYMENT_WINDOW_LEDGERS,
};
use crate::voucher;

const LONG_LIVED_STORAGE_TTL: u32 = REPAYMENT_WINDOW_LEDGERS + APPROVAL_TIMEOUT_LEDGERS + 10_000;

/// Derive a deterministic escrow ID from sender + vendor + season + ledger.
fn make_escrow_id(env: &Env, _sender: &Address, vendor_id: &BytesN<32>, _crop_season: &Symbol) -> BytesN<32> {
    let mut preimage = soroban_sdk::Bytes::new(env);
    preimage.extend_from_array(&env.ledger().sequence().to_be_bytes());
    preimage.append(&soroban_sdk::Bytes::from_slice(env, vendor_id.to_array().as_slice()));
    env.crypto().sha256(&preimage).into()
}

/// Sender locks USDC into a new escrow.
pub fn fund(
    env: &Env,
    usdc_token: &Address,
    sender: &Address,
    vendor_id: BytesN<32>,
    crop_season: Symbol,
    amount: i128,
) -> Result<BytesN<32>, Error> {
    if amount <= 0 {
        return Err(Error::InvalidAmount);
    }

    sender.require_auth();

    let escrow_id = make_escrow_id(env, sender, &vendor_id, &crop_season);

    if env.storage().persistent().has(&DataKey::Escrow(escrow_id.clone())) {
        return Err(Error::AlreadyFunded);
    }

    // Transfer USDC from sender to contract
    let token_client = token::Client::new(env, usdc_token);
    token_client.transfer(sender, &env.current_contract_address(), &amount);

    let record = EscrowRecord {
        sender: sender.clone(),
        farmer: None,
        vendor_id,
        crop_season,
        amount,
        repaid: 0,
        repayment_fee_bps: DEFAULT_REPAYMENT_FEE_BPS,
        protocol_fee_bps: PROTOCOL_FEE_BPS,
        state: EscrowState::Funded,
        created_ledger: env.ledger().sequence(),
        repay_deadline_ledger: 0,
    };

    env.storage().persistent().set(&DataKey::Escrow(escrow_id.clone()), &record);
    env.storage()
        .persistent()
        .extend_ttl(
            &DataKey::Escrow(escrow_id.clone()),
            LONG_LIVED_STORAGE_TTL,
            LONG_LIVED_STORAGE_TTL,
        );
    events::escrow_funded(env, &escrow_id, sender, amount);

    Ok(escrow_id)
}

/// Admin approves a farmer for an escrow, transitioning to VoucherMinted state.
pub fn approve_farmer(
    env: &Env,
    admin: &Address,
    escrow_id: BytesN<32>,
    farmer: Address,
) -> Result<(), Error> {
    let mut record: EscrowRecord = env
        .storage()
        .persistent()
        .get(&DataKey::Escrow(escrow_id.clone()))
        .ok_or(Error::EscrowNotFound)?;

    if record.state != EscrowState::Funded {
        return Err(Error::InvalidState);
    }

    record.farmer = Some(farmer.clone());
    record.state = EscrowState::VoucherMinted;

    // Mint voucher tokens to farmer — admin auth enforced inside mint_voucher
    voucher::mint_voucher(env, admin, &farmer, record.amount);

    env.storage().persistent().set(&DataKey::Escrow(escrow_id.clone()), &record);
    events::farmer_approved(env, &escrow_id, &farmer);
    events::voucher_minted(env, &escrow_id, &farmer, record.amount);

    Ok(())
}

/// Vendor burns the voucher and receives USDC.
pub fn redeem_voucher(
    env: &Env,
    usdc_token: &Address,
    escrow_id: BytesN<32>,
    vendor: Address,
) -> Result<(), Error> {
    vendor.require_auth();

    // Enforce vendor role via RBAC before any state change
    crate::rbac::RBAC::require_vendor(env, &vendor)?;

    let mut record: EscrowRecord = env
        .storage()
        .persistent()
        .get(&DataKey::Escrow(escrow_id.clone()))
        .ok_or(Error::EscrowNotFound)?;

    if record.state != EscrowState::VoucherMinted {
        return Err(Error::InvalidState);
    }

    let farmer = record.farmer.clone().ok_or(Error::InvalidState)?;

    // Burn voucher from farmer (enforces vendor-only transfer restriction)
    voucher::burn_voucher(env, &escrow_id, &farmer, &vendor, record.amount)?;

    // Protocol fee deduction — use per-escrow fee stored at fund time
    let protocol_fee = record.amount * (record.protocol_fee_bps as i128) / 10_000;
    let vendor_amount = record.amount - protocol_fee;

    let token_client = token::Client::new(env, usdc_token);
    token_client.transfer(&env.current_contract_address(), &vendor, &vendor_amount);

    // Send protocol fee to admin treasury
    if protocol_fee > 0 {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(Error::Unauthorized)?;
        token_client.transfer(&env.current_contract_address(), &admin, &protocol_fee);
        events::fee_collected(env, &escrow_id, protocol_fee, 0);
    }

    record.state = EscrowState::Redeemed;
    env.storage().persistent().set(&DataKey::Escrow(escrow_id.clone()), &record);
    events::voucher_redeemed(env, &escrow_id, &vendor, vendor_amount);

    Ok(())
}

/// Oracle triggers the repayment window after harvest.
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
    env.storage().persistent().set(&DataKey::Escrow(escrow_id.clone()), &record);
    events::repay_triggered(env, &escrow_id, deadline);

    Ok(())
}

/// Cancel escrow and refund sender if no farmer approved within timeout.
pub fn cancel(env: &Env, usdc_token: &Address, escrow_id: BytesN<32>) -> Result<(), Error> {
    let mut record: EscrowRecord = env
        .storage()
        .persistent()
        .get(&DataKey::Escrow(escrow_id.clone()))
        .ok_or(Error::EscrowNotFound)?;

    if record.state != EscrowState::Funded {
        return Err(Error::InvalidState);
    }

    let elapsed = env.ledger().sequence() - record.created_ledger;
    if elapsed < APPROVAL_TIMEOUT_LEDGERS {
        return Err(Error::NotExpired);
    }

    let token_client = token::Client::new(env, usdc_token);
    token_client.transfer(&env.current_contract_address(), &record.sender, &record.amount);

    record.state = EscrowState::Closed;
    env.storage().persistent().set(&DataKey::Escrow(escrow_id.clone()), &record);
    events::escrow_cancelled(env, &escrow_id, &record.sender, record.amount);

    Ok(())
}

/// Get escrow record.
pub fn get_escrow(env: &Env, escrow_id: BytesN<32>) -> Result<EscrowRecord, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Escrow(escrow_id))
        .ok_or(Error::EscrowNotFound)
}
