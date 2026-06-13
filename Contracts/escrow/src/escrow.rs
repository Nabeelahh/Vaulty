use soroban_sdk::{Address, BytesN, Env, Symbol, token};

use crate::errors::Error;
use crate::events;
use crate::storage::{
    DataKey, EscrowRecord, EscrowState, APPROVAL_TIMEOUT_LEDGERS, DEFAULT_REPAYMENT_FEE_BPS,
    PROTOCOL_FEE_BPS, REPAYMENT_WINDOW_LEDGERS,
};
use crate::voucher;

const LONG_LIVED_STORAGE_TTL: u32 = REPAYMENT_WINDOW_LEDGERS + APPROVAL_TIMEOUT_LEDGERS + 10_000;
const MIN_ESCROW_AMOUNT: i128 = 10_000_000;
const MAX_ESCROW_AMOUNT: i128 = 1_000_000 * 10_000_000;

/// Derive a deterministic, collision-resistant escrow ID.
fn make_escrow_id(
    env: &Env,
    sender: &Address,
    vendor_id: &BytesN<32>,
    crop_season: &Symbol,
) -> BytesN<32> {
    let mut preimage = soroban_sdk::Bytes::new(env);

    // Ledger sequence — prevents replay across ledgers
    preimage.extend_from_array(&env.ledger().sequence().to_be_bytes());

    // Vendor ID
    preimage.append(&soroban_sdk::Bytes::from_slice(
        env,
        vendor_id.to_array().as_slice(),
    ));

    // Sender address — use raw ScVal payload (stable within Soroban version)
    let sender_raw: u64 = sender.to_val().get_payload();
    preimage.extend_from_array(&sender_raw.to_be_bytes());

    // Crop season — use Symbol's underlying 64-bit encoded value
    let season_raw: u64 = crop_season.to_val().get_payload();
    preimage.extend_from_array(&season_raw.to_be_bytes());

    env.crypto().sha256(&preimage).into()
}

/// Validate that a fee value in basis points is within sane bounds.
#[inline]
fn validate_fee_bps(bps: u32) -> Result<(), Error> {
    if bps > 10_000 {
        return Err(Error::InvalidAmount);
    }
    Ok(())
}

/// Compute `amount * bps / 10_000` with overflow protection.
#[inline]
fn safe_fee(amount: i128, bps: u32) -> Result<i128, Error> {
    amount
        .checked_mul(bps as i128)
        .and_then(|v| v.checked_div(10_000))
        .ok_or(Error::InvalidAmount)
}

/// Sender locks USDC into a new escrow.
///
/// # Errors
/// - [`Error::InvalidAmount`] if `amount` is below minimum, above maximum, or fee constants are invalid.
/// - [`Error::AlreadyFunded`] if an escrow with the derived ID already exists.
pub fn fund(
    env: &Env,
    usdc_token: &Address,
    sender: &Address,
    vendor_id: BytesN<32>,
    crop_season: Symbol,
    amount: i128,
) -> Result<BytesN<32>, Error> {
    if amount < MIN_ESCROW_AMOUNT {
        return Err(Error::InvalidAmount);
    }
    if amount > MAX_ESCROW_AMOUNT {
        return Err(Error::InvalidAmount);
    }

    // Validate stored fee constants early to surface misconfiguration
    validate_fee_bps(DEFAULT_REPAYMENT_FEE_BPS)?;
    validate_fee_bps(PROTOCOL_FEE_BPS)?;

    sender.require_auth();

    let escrow_id = make_escrow_id(env, sender, &vendor_id, &crop_season);

    if env
        .storage()
        .persistent()
        .has(&DataKey::Escrow(escrow_id.clone()))
    {
        return Err(Error::AlreadyFunded);
    }

    // Snapshot balance before transfer to detect fee-on-transfer tokens
    let token_client = token::Client::new(env, usdc_token);
    let balance_before = token_client.balance(&env.current_contract_address());

    token_client.transfer(sender, &env.current_contract_address(), &amount);

    // Confirm the contract actually received the expected amount
    let received = token_client.balance(&env.current_contract_address()) - balance_before;
    if received != amount {
        return Err(Error::InvalidAmount);
    }

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

    let key = DataKey::Escrow(escrow_id.clone());
    env.storage().persistent().set(&key, &record);
    env.storage()
        .persistent()
        .extend_ttl(&key, LONG_LIVED_STORAGE_TTL, LONG_LIVED_STORAGE_TTL);

    events::escrow_funded(env, &escrow_id, sender, amount);

    Ok(escrow_id)
}

/// Admin approves a farmer for an escrow, transitioning to [`EscrowState::VoucherMinted`].
///
/// # Errors
/// - [`Error::Unauthorized`] if admin and farmer are the same address.
/// - [`Error::EscrowNotFound`] if the escrow does not exist.
/// - [`Error::InvalidState`] if the escrow is not in [`EscrowState::Funded`] or farmer is already set.
/// - [`Error::NotExpired`] if the approval window has already elapsed.
pub fn approve_farmer(
    env: &Env,
    admin: &Address,
    escrow_id: BytesN<32>,
    farmer: Address,
) -> Result<(), Error> {
    // Reject self-approval
    if &farmer == admin {
        return Err(Error::Unauthorized);
    }

    let mut record: EscrowRecord = env
        .storage()
        .persistent()
        .get(&DataKey::Escrow(escrow_id.clone()))
        .ok_or(Error::EscrowNotFound)?;

    if record.state != EscrowState::Funded {
        return Err(Error::InvalidState);
    }

    // Reject if the cancellation window has already elapsed
    let elapsed = env
        .ledger()
        .sequence()
        .saturating_sub(record.created_ledger);
    if elapsed >= APPROVAL_TIMEOUT_LEDGERS {
        return Err(Error::NotExpired);
    }

    // Defensive: prevent reassigning a farmer
    if record.farmer.is_some() {
        return Err(Error::InvalidState);
    }

    record.farmer = Some(farmer.clone());
    record.state = EscrowState::VoucherMinted;

    // Mint voucher tokens — admin auth enforced inside mint_voucher
    voucher::mint_voucher(env, admin, &farmer, record.amount);

    env.storage()
        .persistent()
        .set(&DataKey::Escrow(escrow_id.clone()), &record);

    events::farmer_approved(env, &escrow_id, &farmer);
    events::voucher_minted(env, &escrow_id, &farmer, record.amount);

    Ok(())
}

/// Vendor burns the voucher and receives USDC minus the protocol fee.
///
/// # Errors
/// - [`Error::Unauthorized`] if `vendor` does not hold the vendor RBAC role.
/// - [`Error::EscrowNotFound`] if the escrow does not exist.
/// - [`Error::InvalidState`] if the escrow is not in [`EscrowState::VoucherMinted`].
/// - [`Error::InvalidAmount`] if fee arithmetic overflows or vendor amount is non-positive.
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

    // Burn voucher — enforces that only the vendor may trigger this
    voucher::burn_voucher(env, &escrow_id, &farmer, &vendor, record.amount)?;

    // Safe fee arithmetic
    let protocol_fee = safe_fee(record.amount, record.protocol_fee_bps)?;
    let vendor_amount = record
        .amount
        .checked_sub(protocol_fee)
        .ok_or(Error::InvalidAmount)?;

    if vendor_amount <= 0 {
        return Err(Error::InvalidAmount);
    }

    // CEI: update state before external transfers
    record.state = EscrowState::Redeemed;
    env.storage()
        .persistent()
        .set(&DataKey::Escrow(escrow_id.clone()), &record);

    let token_client = token::Client::new(env, usdc_token);
    token_client.transfer(&env.current_contract_address(), &vendor, &vendor_amount);

    if protocol_fee > 0 {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::Unauthorized)?;

        token_client.transfer(&env.current_contract_address(), &admin, &protocol_fee);
        events::fee_collected(env, &escrow_id, protocol_fee, 0);
    }

    events::voucher_redeemed(env, &escrow_id, &vendor, vendor_amount);

    Ok(())
}

/// Oracle triggers the repayment window after harvest.
///
/// # Errors
/// - [`Error::EscrowNotFound`] if the escrow does not exist.
/// - [`Error::NotRedeemed`] if the escrow has not yet been redeemed.
/// - [`Error::InvalidState`] if the repayment window was already triggered.
/// - [`Error::InvalidAmount`] if ledger sequence arithmetic overflows.
pub fn trigger_repay(env: &Env, escrow_id: BytesN<32>) -> Result<(), Error> {
    let mut record: EscrowRecord = env
        .storage()
        .persistent()
        .get(&DataKey::Escrow(escrow_id.clone()))
        .ok_or(Error::EscrowNotFound)?;

    if record.state != EscrowState::Redeemed {
        return Err(Error::NotRedeemed);
    }

    // Idempotency guard — prevent double-triggering
    if record.repay_deadline_ledger != 0 {
        return Err(Error::InvalidState);
    }

    let deadline = env
        .ledger()
        .sequence()
        .checked_add(REPAYMENT_WINDOW_LEDGERS)
        .ok_or(Error::InvalidAmount)?;

    record.state = EscrowState::Repaying;
    record.repay_deadline_ledger = deadline;

    let key = DataKey::Escrow(escrow_id.clone());
    env.storage().persistent().set(&key, &record);

    // Extend TTL to cover the full repayment window
    env.storage().persistent().extend_ttl(
        &key,
        REPAYMENT_WINDOW_LEDGERS + 1_000,
        REPAYMENT_WINDOW_LEDGERS + 1_000,
    );

    events::repay_triggered(env, &escrow_id, deadline);

    Ok(())
}

/// Cancel escrow and refund sender if no farmer was approved within the timeout.
///
/// Anyone may call this once the approval window has passed; the refund always
/// goes to the original `sender`.
///
/// # Errors
/// - [`Error::EscrowNotFound`] if the escrow does not exist.
/// - [`Error::InvalidState`] if the escrow is not in [`EscrowState::Funded`].
/// - [`Error::NotExpired`] if the approval timeout has not yet elapsed.
pub fn cancel(env: &Env, usdc_token: &Address, escrow_id: BytesN<32>) -> Result<(), Error> {
    let mut record: EscrowRecord = env
        .storage()
        .persistent()
        .get(&DataKey::Escrow(escrow_id.clone()))
        .ok_or(Error::EscrowNotFound)?;

    if record.state != EscrowState::Funded {
        return Err(Error::InvalidState);
    }

    let elapsed = env
        .ledger()
        .sequence()
        .saturating_sub(record.created_ledger);

    if elapsed < APPROVAL_TIMEOUT_LEDGERS {
        return Err(Error::NotExpired);
    }

    // CEI: update state before the external transfer
    let refund_to = record.sender.clone();
    let refund_amount = record.amount;

    record.state = EscrowState::Closed;
    env.storage()
        .persistent()
        .set(&DataKey::Escrow(escrow_id.clone()), &record);

    let token_client = token::Client::new(env, usdc_token);
    token_client.transfer(&env.current_contract_address(), &refund_to, &refund_amount);

    events::escrow_cancelled(env, &escrow_id, &refund_to, refund_amount);

    Ok(())
}

/// Fetch a single escrow record by ID.
///
/// # Errors
/// - [`Error::EscrowNotFound`] if no record exists for the given ID.
pub fn get_escrow(env: &Env, escrow_id: BytesN<32>) -> Result<EscrowRecord, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Escrow(escrow_id))
        .ok_or(Error::EscrowNotFound)
}