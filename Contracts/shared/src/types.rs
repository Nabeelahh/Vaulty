use soroban_sdk::{contracttype, Address};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[contracttype]
pub struct VaultId(pub u64);

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Amount(pub i128);

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[contracttype]
pub enum LockPeriod {
    ThirtyDays,
    NinetyDays,
    OneYear,
    Custom(u64),
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Vault {
    pub owner: Address,
    pub balance: Amount,
    pub lock_period: LockPeriod,
    pub created_at: u64,
    pub unlocks_at: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct UserProfile {
    pub address: Address,
    pub total_vaults: u64,
    pub total_deposited: Amount,
    pub total_withdrawn: Amount,
    pub current_streak: u32,
    pub longest_streak: u32,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[contracttype]
pub struct DisciplineScore {
    pub score: u32,
    pub last_updated: u64,
}
