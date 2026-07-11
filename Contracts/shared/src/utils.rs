use soroban_sdk::Env;

use crate::errors::VaultyError;

pub fn checked_add(a: i128, b: i128) -> Result<i128, VaultyError> {
    a.checked_add(b).ok_or(VaultyError::InvalidAmount)
}

pub fn checked_sub(a: i128, b: i128) -> Result<i128, VaultyError> {
    a.checked_sub(b).ok_or(VaultyError::InsufficientBalance)
}

pub fn calculate_interest(principal: i128, rate_bps: u64, time_elapsed_seconds: u64) -> i128 {
    if rate_bps == 0 || time_elapsed_seconds == 0 {
        return 0;
    }
    
    const SECONDS_PER_YEAR: u64 = 31_536_000;
    let years = time_elapsed_seconds as i128 / SECONDS_PER_YEAR as i128;
    let interest = principal * rate_bps as i128 * years / 10_000;
    interest
}

pub fn time_elapsed_seconds(env: &Env, start_timestamp: u64) -> u64 {
    let current = env.ledger().timestamp();
    current.saturating_sub(start_timestamp)
}

pub fn is_unlocked(env: &Env, unlocks_at: u64) -> bool {
    let current = env.ledger().timestamp();
    current >= unlocks_at
}
