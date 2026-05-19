#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Bytes, BytesN, Env, Symbol,
};

use remitroot_escrow::{EscrowContract, EscrowContractClient};
use remitroot_escrow::storage::{EscrowState, APPROVAL_TIMEOUT_LEDGERS, REPAYMENT_WINDOW_LEDGERS};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

fn create_env() -> Env {
    Env::default()
}

fn setup(env: &Env) -> (Address, EscrowContractClient, Address, Address) {
    let contract_id = env.register_contract(None, EscrowContract);
    let client = EscrowContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    let oracle = Address::generate(env);
    client.initialize(&admin, &oracle);

    let usdc_admin = Address::generate(env);
    let usdc_token = env.register_stellar_asset_contract_v2(usdc_admin.clone());
    (usdc_token.address(), client, admin, oracle)
}

/// Fund → approve farmer → approve vendor → redeem. Returns (escrow_id, farmer, sender).
fn fund_and_redeem(
    env: &Env,
    client: &EscrowContractClient,
    usdc_id: &Address,
    amount: i128,
) -> (BytesN<32>, Address, Address) {
    let sender = Address::generate(env);
    let farmer = Address::generate(env);
    let vendor = Address::generate(env);
    let vendor_id: BytesN<32> = BytesN::from_array(env, &[1u8; 32]);

    let usdc_client = soroban_sdk::token::StellarAssetClient::new(env, usdc_id);
    usdc_client.mint(&sender, &amount);

    client.approve_vendor_address(&vendor);

    let escrow_id = client.fund(usdc_id, &sender, &vendor_id, &Symbol::new(env, "2025A"), &amount);
    client.approve_farmer(&escrow_id, &farmer);
    client.redeem_voucher(usdc_id, &escrow_id, &vendor);

    (escrow_id, farmer, sender)
}

// ---------------------------------------------------------------------------
// Escrow lifecycle tests
// ---------------------------------------------------------------------------

#[test]
fn test_fund_creates_escrow() {
    let env = create_env();
    env.mock_all_auths();

    let (usdc_id, client, _admin, _oracle) = setup(&env);

    let sender = Address::generate(&env);
    let vendor_id: BytesN<32> = BytesN::from_array(&env, &[1u8; 32]);
    let crop_season = Symbol::new(&env, "2025A");
    let amount: i128 = 200_000_000;

    let usdc_client = soroban_sdk::token::StellarAssetClient::new(&env, &usdc_id);
    usdc_client.mint(&sender, &amount);

    let escrow_id = client.fund(&usdc_id, &sender, &vendor_id, &crop_season, &amount);

    let record = client.get_escrow(&escrow_id);
    assert_eq!(record.sender, sender);
    assert_eq!(record.amount, amount);
    assert_eq!(record.state, EscrowState::Funded);
}

#[test]
fn test_approve_farmer_transitions_state() {
    let env = create_env();
    env.mock_all_auths();

    let (usdc_id, client, _admin, _oracle) = setup(&env);

    let sender = Address::generate(&env);
    let farmer = Address::generate(&env);
    let vendor_id: BytesN<32> = BytesN::from_array(&env, &[2u8; 32]);
    let amount: i128 = 100_000_000;

    let usdc_client = soroban_sdk::token::StellarAssetClient::new(&env, &usdc_id);
    usdc_client.mint(&sender, &amount);

    let escrow_id = client.fund(&usdc_id, &sender, &vendor_id, &Symbol::new(&env, "2025B"), &amount);
    client.approve_farmer(&escrow_id, &farmer);

    let record = client.get_escrow(&escrow_id);
    assert_eq!(record.state, EscrowState::VoucherMinted);
    assert_eq!(record.farmer, Some(farmer));
}

#[test]
fn test_cancel_after_timeout() {
    let env = create_env();
    env.mock_all_auths();

    let (usdc_id, client, _admin, _oracle) = setup(&env);

    let sender = Address::generate(&env);
    let vendor_id: BytesN<32> = BytesN::from_array(&env, &[3u8; 32]);
    let amount: i128 = 50_000_000;

    let usdc_client = soroban_sdk::token::StellarAssetClient::new(&env, &usdc_id);
    usdc_client.mint(&sender, &amount);

    let escrow_id = client.fund(&usdc_id, &sender, &vendor_id, &Symbol::new(&env, "2025C"), &amount);

    env.ledger().with_mut(|l| {
        l.sequence_number += APPROVAL_TIMEOUT_LEDGERS + 1;
    });

    client.cancel(&usdc_id, &escrow_id);

    let record = client.get_escrow(&escrow_id);
    assert_eq!(record.state, EscrowState::Closed);
}

#[test]
#[should_panic]
fn test_cancel_before_timeout_fails() {
    let env = create_env();
    env.mock_all_auths();

    let (usdc_id, client, _admin, _oracle) = setup(&env);

    let sender = Address::generate(&env);
    let vendor_id: BytesN<32> = BytesN::from_array(&env, &[4u8; 32]);
    let amount: i128 = 50_000_000;

    let usdc_client = soroban_sdk::token::StellarAssetClient::new(&env, &usdc_id);
    usdc_client.mint(&sender, &amount);

    let escrow_id = client.fund(&usdc_id, &sender, &vendor_id, &Symbol::new(&env, "2025D"), &amount);

    client.cancel(&usdc_id, &escrow_id);
}

// ---------------------------------------------------------------------------
// Voucher token system tests
// ---------------------------------------------------------------------------

#[test]
fn test_mint_voucher_on_approve_farmer() {
    let env = create_env();
    env.mock_all_auths();

    let (usdc_id, client, _admin, _oracle) = setup(&env);

    let sender = Address::generate(&env);
    let farmer = Address::generate(&env);
    let vendor = Address::generate(&env);
    let vendor_id: BytesN<32> = BytesN::from_array(&env, &[1u8; 32]);

    let usdc_client = soroban_sdk::token::StellarAssetClient::new(&env, &usdc_id);
    usdc_client.mint(&sender, &200_000_000i128);

    client.approve_vendor_address(&vendor);

    let escrow_id = client.fund(&usdc_id, &sender, &vendor_id, &Symbol::new(&env, "2025A"), &200_000_000i128);

    assert_eq!(client.get_voucher_balance(&farmer), 0);

    client.approve_farmer(&escrow_id, &farmer);

    assert_eq!(client.get_voucher_balance(&farmer), 200_000_000i128);
}

#[test]
fn test_burn_voucher_on_redeem() {
    let env = create_env();
    env.mock_all_auths();

    let (usdc_id, client, _admin, _oracle) = setup(&env);

    let sender = Address::generate(&env);
    let farmer = Address::generate(&env);
    let vendor = Address::generate(&env);
    let vendor_id: BytesN<32> = BytesN::from_array(&env, &[2u8; 32]);
    let amount: i128 = 100_000_000;

    let usdc_client = soroban_sdk::token::StellarAssetClient::new(&env, &usdc_id);
    usdc_client.mint(&sender, &amount);

    client.approve_vendor_address(&vendor);

    let escrow_id = client.fund(&usdc_id, &sender, &vendor_id, &Symbol::new(&env, "2025B"), &amount);
    client.approve_farmer(&escrow_id, &farmer);

    assert_eq!(client.get_voucher_balance(&farmer), amount);

    client.redeem_voucher(&usdc_id, &escrow_id, &vendor);

    assert_eq!(client.get_voucher_balance(&farmer), 0);
}

#[test]
#[should_panic]
fn test_transfer_to_unapproved_vendor_fails() {
    let env = create_env();
    env.mock_all_auths();

    let (usdc_id, client, _admin, _oracle) = setup(&env);

    let sender = Address::generate(&env);
    let farmer = Address::generate(&env);
    let unapproved_vendor = Address::generate(&env);
    let vendor_id: BytesN<32> = BytesN::from_array(&env, &[3u8; 32]);
    let amount: i128 = 50_000_000;

    let usdc_client = soroban_sdk::token::StellarAssetClient::new(&env, &usdc_id);
    usdc_client.mint(&sender, &amount);

    let escrow_id = client.fund(&usdc_id, &sender, &vendor_id, &Symbol::new(&env, "2025C"), &amount);
    client.approve_farmer(&escrow_id, &farmer);

    client.redeem_voucher(&usdc_id, &escrow_id, &unapproved_vendor);
}

// ---------------------------------------------------------------------------
// ABI registry tests
// ---------------------------------------------------------------------------

#[test]
fn test_abi_registry_register_and_get() {
    let env = create_env();
    env.mock_all_auths();

    let (_, client, _admin, _oracle) = setup(&env);

    let contract_id: BytesN<32> = BytesN::from_array(&env, &[10u8; 32]);
    let schema = Bytes::from_slice(&env, b"{\"type\":\"escrow\",\"version\":1}");

    let version = client.register_abi(&contract_id, &schema);
    assert_eq!(version, 1u32);

    let abi = client.get_abi(&contract_id);
    assert_eq!(abi.version, 1u32);
    assert_eq!(abi.schema, schema);
}

#[test]
fn test_abi_registry_update_increments_version() {
    let env = create_env();
    env.mock_all_auths();

    let (_, client, _admin, _oracle) = setup(&env);

    let contract_id: BytesN<32> = BytesN::from_array(&env, &[11u8; 32]);
    let schema_v1 = Bytes::from_slice(&env, b"{\"version\":1}");
    let schema_v2 = Bytes::from_slice(&env, b"{\"version\":2}");

    client.register_abi(&contract_id, &schema_v1);
    let new_version = client.update_abi(&contract_id, &schema_v2);
    assert_eq!(new_version, 2u32);

    let abi = client.get_abi(&contract_id);
    assert_eq!(abi.version, 2u32);
    assert_eq!(abi.schema, schema_v2);
}

#[test]
fn test_abi_validate_matching_schema() {
    let env = create_env();
    env.mock_all_auths();

    let (_, client, _admin, _oracle) = setup(&env);

    let contract_id: BytesN<32> = BytesN::from_array(&env, &[12u8; 32]);
    let schema = Bytes::from_slice(&env, b"{\"type\":\"voucher\"}");

    client.register_abi(&contract_id, &schema);

    assert!(client.validate_abi(&contract_id, &schema));
    let wrong = Bytes::from_slice(&env, b"{\"type\":\"other\"}");
    assert!(!client.validate_abi(&contract_id, &wrong));
}

// ---------------------------------------------------------------------------
// Security tests (Issue #32 — Voucher Token Security)
// ---------------------------------------------------------------------------

/// Non-admin cannot trigger voucher minting (approve_farmer is admin-gated).
#[test]
#[should_panic]
fn test_unauthorized_mint_rejected() {
    let env = create_env();
    // Do NOT mock_all_auths — we want real auth enforcement
    let (usdc_id, client, _admin, _oracle) = setup(&env);

    let sender = Address::generate(&env);
    let farmer = Address::generate(&env);
    let vendor_id: BytesN<32> = BytesN::from_array(&env, &[20u8; 32]);
    let amount: i128 = 100_000_000;

    let usdc_client = soroban_sdk::token::StellarAssetClient::new(&env, &usdc_id);
    // Mint USDC to sender and mock only sender's auth for fund()
    env.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &sender,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &client.address,
            fn_name: "fund",
            args: soroban_sdk::vec![
                &env,
                usdc_id.clone().into(),
                sender.clone().into(),
                vendor_id.clone().into(),
                Symbol::new(&env, "2025X").into(),
                amount.into(),
            ],
            sub_invokes: &[],
        },
    }]);
    usdc_client.mint(&sender, &amount);
    let escrow_id = client.fund(&usdc_id, &sender, &vendor_id, &Symbol::new(&env, "2025X"), &amount);

    // Attempt approve_farmer without admin auth — should panic
    client.approve_farmer(&escrow_id, &farmer);
}

/// A non-vendor address cannot redeem a voucher.
#[test]
#[should_panic]
fn test_unauthorized_redeem_rejected() {
    let env = create_env();
    env.mock_all_auths();

    let (usdc_id, client, _admin, _oracle) = setup(&env);

    let sender = Address::generate(&env);
    let farmer = Address::generate(&env);
    let non_vendor = Address::generate(&env); // never registered as vendor
    let vendor_id: BytesN<32> = BytesN::from_array(&env, &[21u8; 32]);
    let amount: i128 = 100_000_000;

    let usdc_client = soroban_sdk::token::StellarAssetClient::new(&env, &usdc_id);
    usdc_client.mint(&sender, &amount);

    let escrow_id = client.fund(&usdc_id, &sender, &vendor_id, &Symbol::new(&env, "2025Y"), &amount);
    client.approve_farmer(&escrow_id, &farmer);

    // non_vendor has no Vendor role and is not in the approved-address list
    client.redeem_voucher(&usdc_id, &escrow_id, &non_vendor);
}

/// A voucher cannot be redeemed twice (double-redeem protection).
#[test]
#[should_panic]
fn test_double_redeem_rejected() {
    let env = create_env();
    env.mock_all_auths();

    let (usdc_id, client, _admin, _oracle) = setup(&env);

    let sender = Address::generate(&env);
    let farmer = Address::generate(&env);
    let vendor = Address::generate(&env);
    let vendor_id: BytesN<32> = BytesN::from_array(&env, &[22u8; 32]);
    let amount: i128 = 100_000_000;

    let usdc_client = soroban_sdk::token::StellarAssetClient::new(&env, &usdc_id);
    usdc_client.mint(&sender, &amount);

    client.approve_vendor_address(&vendor);

    let escrow_id = client.fund(&usdc_id, &sender, &vendor_id, &Symbol::new(&env, "2025Z"), &amount);
    client.approve_farmer(&escrow_id, &farmer);

    // First redemption — succeeds
    client.redeem_voucher(&usdc_id, &escrow_id, &vendor);

    // Second redemption — must panic (VoucherConsumed flag set)
    client.redeem_voucher(&usdc_id, &escrow_id, &vendor);
}

#[test]
fn test_trigger_repay_sets_deadline() {
    let env = create_env();
    env.mock_all_auths();

    let (usdc_id, client, _admin, _oracle) = setup(&env);
    let (escrow_id, _farmer, _sender) = fund_and_redeem(&env, &client, &usdc_id, 100_000_000);

    client.trigger_repay(&escrow_id);

    let record = client.get_escrow(&escrow_id);
    assert_eq!(record.state, EscrowState::Repaying);
    assert!(record.repay_deadline_ledger > 0);
}

#[test]
fn test_partial_repayment() {
    let env = create_env();
    env.mock_all_auths();

    let (usdc_id, client, _admin, _oracle) = setup(&env);
    let amount: i128 = 100_000_000;
    let (escrow_id, farmer, _sender) = fund_and_redeem(&env, &client, &usdc_id, amount);

    client.trigger_repay(&escrow_id);

    let usdc_client = soroban_sdk::token::StellarAssetClient::new(&env, &usdc_id);
    usdc_client.mint(&farmer, &200_000_000i128);

    client.repay(&usdc_id, &escrow_id, &farmer, &50_000_000i128);

    let record = client.get_escrow(&escrow_id);
    assert_eq!(record.repaid, 50_000_000i128);
    assert_eq!(record.state, EscrowState::Repaying);

    let remaining = client.get_remaining_balance(&escrow_id);
    // total_owed = 100M + 10% = 110M; remaining = 110M - 50M = 60M
    assert_eq!(remaining, 60_000_000i128);
}

#[test]
fn test_full_repayment_closes_escrow() {
    let env = create_env();
    env.mock_all_auths();

    let (usdc_id, client, _admin, _oracle) = setup(&env);
    let amount: i128 = 100_000_000;
    let (escrow_id, farmer, _sender) = fund_and_redeem(&env, &client, &usdc_id, amount);

    client.trigger_repay(&escrow_id);

    let usdc_client = soroban_sdk::token::StellarAssetClient::new(&env, &usdc_id);
    // total_owed = 110M (principal + 10% fee)
    usdc_client.mint(&farmer, &110_000_000i128);

    client.repay(&usdc_id, &escrow_id, &farmer, &110_000_000i128);

    let record = client.get_escrow(&escrow_id);
    assert_eq!(record.state, EscrowState::Closed);
    assert_eq!(record.repaid, 110_000_000i128);
}

#[test]
fn test_overpayment_capped_at_remaining() {
    let env = create_env();
    env.mock_all_auths();

    let (usdc_id, client, _admin, _oracle) = setup(&env);
    let amount: i128 = 100_000_000;
    let (escrow_id, farmer, _sender) = fund_and_redeem(&env, &client, &usdc_id, amount);

    client.trigger_repay(&escrow_id);

    let usdc_client = soroban_sdk::token::StellarAssetClient::new(&env, &usdc_id);
    usdc_client.mint(&farmer, &200_000_000i128);

    // Try to overpay — should be capped at 110M
    client.repay(&usdc_id, &escrow_id, &farmer, &200_000_000i128);

    let record = client.get_escrow(&escrow_id);
    assert_eq!(record.state, EscrowState::Closed);
    assert_eq!(record.repaid, 110_000_000i128);
}

#[test]
fn test_repayment_history_tracked() {
    let env = create_env();
    env.mock_all_auths();

    let (usdc_id, client, _admin, _oracle) = setup(&env);
    let amount: i128 = 100_000_000;
    let (escrow_id, farmer, _sender) = fund_and_redeem(&env, &client, &usdc_id, amount);

    client.trigger_repay(&escrow_id);

    let usdc_client = soroban_sdk::token::StellarAssetClient::new(&env, &usdc_id);
    usdc_client.mint(&farmer, &110_000_000i128);

    client.repay(&usdc_id, &escrow_id, &farmer, &30_000_000i128);
    client.repay(&usdc_id, &escrow_id, &farmer, &40_000_000i128);
    client.repay(&usdc_id, &escrow_id, &farmer, &40_000_000i128);

    let history = client.get_repayment_history(&escrow_id);
    assert_eq!(history.len(), 3u32);
    assert_eq!(history.get(0).unwrap().amount, 30_000_000i128);
    assert_eq!(history.get(1).unwrap().amount, 40_000_000i128);
    // Last payment capped at remaining (110M - 70M = 40M)
    assert_eq!(history.get(2).unwrap().cumulative, 110_000_000i128);
}

#[test]
fn test_default_after_deadline() {
    let env = create_env();
    env.mock_all_auths();

    let (usdc_id, client, _admin, _oracle) = setup(&env);
    let (escrow_id, _farmer, _sender) = fund_and_redeem(&env, &client, &usdc_id, 100_000_000);

    client.trigger_repay(&escrow_id);

    env.ledger().with_mut(|l| {
        l.sequence_number += REPAYMENT_WINDOW_LEDGERS + 1;
    });

    client.default_escrow(&escrow_id);

    let record = client.get_escrow(&escrow_id);
    assert_eq!(record.state, EscrowState::Defaulted);
}

#[test]
#[should_panic]
fn test_repay_after_complete_fails() {
    let env = create_env();
    env.mock_all_auths();

    let (usdc_id, client, _admin, _oracle) = setup(&env);
    let amount: i128 = 100_000_000;
    let (escrow_id, farmer, _sender) = fund_and_redeem(&env, &client, &usdc_id, amount);

    client.trigger_repay(&escrow_id);

    let usdc_client = soroban_sdk::token::StellarAssetClient::new(&env, &usdc_id);
    usdc_client.mint(&farmer, &200_000_000i128);

    client.repay(&usdc_id, &escrow_id, &farmer, &110_000_000i128);

    // Should panic — already closed
    client.repay(&usdc_id, &escrow_id, &farmer, &1i128);
}
