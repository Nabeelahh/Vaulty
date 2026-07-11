use soroban_sdk::{Env, Symbol};

use crate::types::VaultId;

pub fn vault_key(env: &Env, vault_id: &VaultId) -> (Symbol, u64) {
    (Symbol::new(env, "vault"), vault_id.0)
}

pub fn user_profile_key(env: &Env, address: &soroban_sdk::Address) -> (Symbol, soroban_sdk::Address) {
    (Symbol::new(env, "user_profile"), address.clone())
}

pub fn discipline_score_key(env: &Env, address: &soroban_sdk::Address) -> (Symbol, soroban_sdk::Address) {
    (Symbol::new(env, "discipline_score"), address.clone())
}

pub fn vault_counter_key(env: &Env) -> Symbol {
    Symbol::new(env, "vault_counter")
}

pub fn user_vaults_key(env: &Env, address: &soroban_sdk::Address) -> (Symbol, soroban_sdk::Address) {
    (Symbol::new(env, "user_vaults"), address.clone())
}

pub fn has(env: &Env, key: &(impl soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone)) -> bool {
    env.storage().persistent().has(key)
}

pub fn remove(env: &Env, key: &(impl soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone)) {
    env.storage().persistent().remove(key);
}

pub fn extend_ttl(env: &Env, key: &(impl soroban_sdk::IntoVal<Env, soroban_sdk::Val> + Clone), threshold: u32, extend_to: u32) {
    env.storage()
        .persistent()
        .extend_ttl(key, threshold, extend_to);
}
