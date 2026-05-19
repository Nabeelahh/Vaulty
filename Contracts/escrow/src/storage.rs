use soroban_sdk::{contracttype, Address, Bytes, BytesN, Symbol, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EscrowState {
    Created,
    Funded,
    VoucherMinted,
    Redeemed,
    Repaying,
    Closed,
    Defaulted,
}

/// Role-based access control roles
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Role {
    Admin,
    Oracle,
    Vendor,
    Sender,
    Farmer,
}

/// Permission levels for multi-signature operations
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PermissionLevel {
    Low,      // Single admin approval
    Medium,   // 2 out of 3 admins
    High,     // All admins (3 out of 3)
    Critical, // All admins + oracle
}

/// Multi-signature proposal for critical operations
#[contracttype]
#[derive(Clone, Debug)]
pub struct MultiSigProposal {
    pub operation: Symbol,
    pub params: Bytes,
    pub proposer: Address,
    pub approvals: Vec<Address>,
    pub required_level: PermissionLevel,
    pub created_ledger: u32,
    pub executed: bool,
}

/// Individual repayment event stored on-chain.
#[contracttype]
#[derive(Clone, Debug)]
pub struct RepaymentEntry {
    pub amount: i128,
    pub ledger: u32,
    pub cumulative: i128,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct EscrowRecord {
    pub sender: Address,
    pub farmer: Option<Address>,
    pub vendor_id: BytesN<32>,
    pub crop_season: Symbol,
    pub amount: i128,
    pub repaid: i128,
    pub repayment_fee_bps: u32,
    pub protocol_fee_bps: u32,
    pub state: EscrowState,
    pub created_ledger: u32,
    pub repay_deadline_ledger: u32,
}

/// ABI/schema registry entry for a contract.
#[contracttype]
#[derive(Clone, Debug)]
pub struct ContractAbi {
    pub contract_id: BytesN<32>,
    pub version: u32,
    pub schema: Bytes,
}

#[contracttype]
pub enum DataKey {
    Escrow(BytesN<32>),
    Admin,
    Oracle,
    // Role mappings: address -> role
    UserRole(Address),
    // Admin list for multi-signature
    AdminList,
    // Approved vendors: vendor_id -> bool
    ApprovedVendor(BytesN<32>),
    // Approved vendor addresses: address -> bool
    VendorAddress(Address),
    // Emergency pause state
    Paused,
    // Multi-signature proposals: proposal_id -> MultiSigProposal
    MultiSigProposal(BytesN<32>),
    // Proposal counter
    ProposalCounter,
    /// Voucher balance per address
    VoucherBalance(Address),
    /// Repayment history list per escrow
    RepaymentHistory(BytesN<32>),
    /// ABI registry: contract_id -> ContractAbi
    ContractAbi(BytesN<32>),
    /// ABI version counter per contract
    AbiVersion(BytesN<32>),
    /// Tracks whether a voucher for an escrow has been consumed (double-redeem guard)
    VoucherConsumed(BytesN<32>),
}

pub const APPROVAL_TIMEOUT_LEDGERS: u32 = 100_800;   // ~7 days at 6s/ledger
pub const REPAYMENT_WINDOW_LEDGERS: u32 = 1_814_400; // ~126 days (harvest season)
pub const PROTOCOL_FEE_BPS: u32 = 100;               // 1%
pub const DEFAULT_REPAYMENT_FEE_BPS: u32 = 1000;     // 10%