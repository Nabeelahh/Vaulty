use soroban_sdk::{Env, Symbol, Vec};

use crate::types::{VaultId, Vault, UserProfile, DisciplineScore};

pub fn vault_key(vault_id: &VaultId) -> (Symbol, u64) {
    (Symbol::short("vault"), vault_id.0)
}

pub fn user_profile_key(address: &soroban_sdk::Address) -> (Symbol, soroban_sdk::Address) {
    (Symbol::short("user_profile"), address.clone())
}

pub fn discipline_score_key(address: &soroban_sdk::Address) -> (Symbol, soroban_sdk::Address) {
    (Symbol::short("discipline_score"), address.clone())
}

pub fn vault_counter_key() -> Symbol {
    Symbol::short("vault_counter")
}

pub fn user_vaults_key(address: &soroban_sdk::Address) -> (Symbol, soroban_sdk::Address) {
    (Symbol::short("user_vaults"), address.clone())
}

pub fn get<T: soroban_sdk::storage::StorageType>(env: &Env, key: &(impl soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone)) -> Option<T> {
    env.storage().persistent().get(key)
}

pub fn set<T: soroban_sdk::storage::StorageType>(
    env: &Env,
    key: &(impl soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone),
    value: &T,
) {
    env.storage().persistent().set(key, value);
}

pub fn has(env: &Env, key: &(impl soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone)) -> bool {
    env.storage().persistent().has(key)
}

pub fn remove(env: &Env, key: &(impl soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone)) {
    env.storage().persistent().remove(key);
}

pub fn extend_ttl(env: &Env, key: &(impl soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone), live_ledger_batches: u32) {
    env.storage()
        .persistent()
        .extend_ttl(key, live_ledger_batches);
}

pub fn extend_ttl_all(env: &Env, live_ledger_batches: u32) {
    env.storage().persistent().extend_ttl(
        &Symbol::short("all"),
        live_ledger_batches,
    );
}
