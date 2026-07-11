#![no_std]

use soroban_sdk::{contract, contractimpl, Env, Address};
use shared::{
    VaultyError, VaultId, Vault, LockPeriod, Amount, vault_key, vault_counter_key, has,
    is_unlocked, checked_add, checked_sub, VaultCreated, DepositMade, WithdrawalCompleted,
};

#[contract]
pub struct VaultContract;

#[contractimpl]
impl VaultContract {
    pub fn create_vault(env: Env, owner: Address, lock_period: LockPeriod) -> Result<VaultId, VaultyError> {
        owner.require_auth();

        let lock_seconds = match lock_period {
            LockPeriod::ThirtyDays => 30 * 24 * 60 * 60,
            LockPeriod::NinetyDays => 90 * 24 * 60 * 60,
            LockPeriod::OneYear => 365 * 24 * 60 * 60,
            LockPeriod::Custom(seconds) => {
                if seconds == 0 {
                    Err(VaultyError::InvalidAmount)?;
                }
                seconds
            }
        };

        let counter_key = vault_counter_key(&env);
        let vault_id_num = if has(&env, &counter_key) {
            let current_id: u64 = env.storage().persistent().get(&counter_key).unwrap();
            let new_id = current_id.checked_add(1).unwrap();
            env.storage().persistent().set(&counter_key, &new_id);
            new_id
        } else {
            env.storage().persistent().set(&counter_key, &1u64);
            1
        };

        let vault_id = VaultId(vault_id_num);

        let current_timestamp = env.ledger().timestamp();
        let unlocks_at = current_timestamp + lock_seconds;

        let vault = Vault {
            owner: owner.clone(),
            balance: Amount(0),
            lock_period,
            created_at: current_timestamp,
            unlocks_at,
        };

        let key = vault_key(&env, &vault_id);
        env.storage().persistent().set(&key, &vault);

        VaultCreated::publish(&env, vault_id, owner, lock_seconds);

        Ok(vault_id)
    }

    pub fn deposit(env: Env, owner: Address, vault_id: VaultId, amount: i128) -> Result<(), VaultyError> {
        owner.require_auth();

        if amount <= 0 {
            Err(VaultyError::InvalidAmount)?;
        }

        let key = vault_key(&env, &vault_id);
        if !has(&env, &key) {
            Err(VaultyError::VaultNotFound)?;
        }

        let mut vault: Vault = env.storage().persistent().get(&key).unwrap();

        if vault.owner != owner {
            Err(VaultyError::Unauthorized)?;
        }

        let new_balance = checked_add(vault.balance.0, amount)?;
        vault.balance = Amount(new_balance);

        env.storage().persistent().set(&key, &vault);

        DepositMade::publish(&env, vault_id, Amount(amount), owner);

        Ok(())
    }

    pub fn withdraw(env: Env, owner: Address, vault_id: VaultId, amount: i128) -> Result<(), VaultyError> {
        owner.require_auth();

        if amount <= 0 {
            Err(VaultyError::InvalidAmount)?;
        }

        let key = vault_key(&env, &vault_id);
        if !has(&env, &key) {
            Err(VaultyError::VaultNotFound)?;
        }

        let mut vault: Vault = env.storage().persistent().get(&key).unwrap();

        if vault.owner != owner {
            Err(VaultyError::Unauthorized)?;
        }

        if !is_unlocked(&env, vault.unlocks_at) {
            Err(VaultyError::VaultLocked)?;
        }

        let new_balance = checked_sub(vault.balance.0, amount)?;
        vault.balance = Amount(new_balance);

        env.storage().persistent().set(&key, &vault);

        WithdrawalCompleted::publish(&env, vault_id, Amount(amount), owner);

        Ok(())
    }

    pub fn get_vault(env: Env, vault_id: VaultId) -> Result<Vault, VaultyError> {
        let key = vault_key(&env, &vault_id);
        if !has(&env, &key) {
            Err(VaultyError::VaultNotFound)?;
        }
        Ok(env.storage().persistent().get(&key).unwrap())
    }
}
