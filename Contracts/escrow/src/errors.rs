use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyFunded = 1,
    NotFunded = 2,
    Unauthorized = 3,
    VoucherAlreadyMinted = 4,
    NotRedeemed = 5,
    RepaymentComplete = 6,
    NotExpired = 7,
    InvalidAmount = 8,
    VendorNotApproved = 9,
    EscrowNotFound = 10,
    InvalidState = 11,
    InsufficientBalance = 12,
    TransferRestricted = 13,
    RepaymentNotStarted = 14,
    RepaymentTimeout = 15,
    AbiNotFound = 16,
    AbiVersionMismatch = 17,
    // Gas optimization errors
    BatchSizeTooLarge = 18,
    HistoryTooLarge = 19,
    GasLimitExceeded = 20,
    // RBAC errors
    InsufficientPermissions = 21,
    RoleNotFound = 22,
    RoleAlreadyAssigned = 23,
    ContractPaused = 24,
    InvalidRoleTransition = 25,
    MultiSigRequired = 26,
    ProposalNotFound = 27,
    ProposalAlreadyExecuted = 28,
    ProposalExpired = 29,
    InsufficientApprovals = 30,
    AdminLimitExceeded = 31,
}