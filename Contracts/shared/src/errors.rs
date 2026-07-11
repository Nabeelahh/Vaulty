use soroban_sdk::contracterror;

#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[contracterror]
pub enum VaultyError {
    Unauthorized = 1,
    InsufficientBalance = 2,
    VaultLocked = 3,
    VaultNotFound = 4,
    InvalidAmount = 5,
    AlreadyExists = 6,
}
