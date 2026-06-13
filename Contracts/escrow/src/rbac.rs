use soroban_sdk::{Address, Bytes, BytesN, Env, Symbol, Vec};
use crate::errors::Error;
use crate::events;
use crate::storage::{DataKey, MultiSigProposal, PermissionLevel, Role};

/// Role-Based Access Control module
pub struct RBAC;

/// Constants for multi-signature requirements
const MAX_ADMINS: u32 = 5;
const PROPOSAL_TIMEOUT_LEDGERS: u32 = 51840; // ~3 days at 6s/ledger

impl RBAC {
    /// Check if an address has a specific role
    pub fn has_role(env: &Env, address: &Address, role: &Role) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::UserRole(address.clone()))
            .map(|stored_role: Role| stored_role == *role)
            .unwrap_or(false)
    }

    /// Check if an address has admin role
    pub fn is_admin(env: &Env, address: &Address) -> bool {
        Self::has_role(env, address, &Role::Admin)
    }

    /// Check if an address has oracle role
    pub fn is_oracle(env: &Env, address: &Address) -> bool {
        Self::has_role(env, address, &Role::Oracle)
    }

    /// Check if an address has vendor role
    pub fn is_vendor(env: &Env, address: &Address) -> bool {
        Self::has_role(env, address, &Role::Vendor)
    }

    /// Check if an address has sender role
    pub fn is_sender(env: &Env, address: &Address) -> bool {
        Self::has_role(env, address, &Role::Sender)
    }

    /// Check if an address has farmer role
    pub fn is_farmer(env: &Env, address: &Address) -> bool {
        Self::has_role(env, address, &Role::Farmer)
    }

    /// Require that an address has a specific role
    pub fn require_role(env: &Env, address: &Address, role: &Role) -> Result<(), Error> {
        if !Self::has_role(env, address, role) {
            return Err(Error::InsufficientPermissions);
        }
        Ok(())
    }

    /// Require admin role
    pub fn require_admin(env: &Env, address: &Address) -> Result<(), Error> {
        Self::require_role(env, address, &Role::Admin)
    }

    /// Require oracle role
    pub fn require_oracle(env: &Env, address: &Address) -> Result<(), Error> {
        Self::require_role(env, address, &Role::Oracle)
    }

    /// Require vendor role
    pub fn require_vendor(env: &Env, address: &Address) -> Result<(), Error> {
        Self::require_role(env, address, &Role::Vendor)
    }

    /// Require sender role
    pub fn require_sender(env: &Env, address: &Address) -> Result<(), Error> {
        Self::require_role(env, address, &Role::Sender)
    }

    /// Require farmer role
    pub fn require_farmer(env: &Env, address: &Address) -> Result<(), Error> {
        Self::require_role(env, address, &Role::Farmer)
    }

    /// Assign a role to an address (admin only)
    pub fn assign_role(env: &Env, caller: &Address, address: &Address, role: Role) -> Result<(), Error> {
        Self::require_admin(env, caller)?;

        // Check if role is already assigned
        if Self::has_role(env, address, &role) {
            return Err(Error::RoleAlreadyAssigned);
        }

        // Special validation for admin role
        if role == Role::Admin {
            let admin_count = Self::get_admin_count(env);
            if admin_count >= MAX_ADMINS {
                return Err(Error::AdminLimitExceeded);
            }
        }

        env.storage()
            .persistent()
            .set(&DataKey::UserRole(address.clone()), &role);

        events::role_assigned(env, address, &role);
        Ok(())
    }

    /// Revoke a role from an address (admin only)
    pub fn revoke_role(env: &Env, caller: &Address, address: &Address, role: Role) -> Result<(), Error> {
        Self::require_admin(env, caller)?;

        // Cannot revoke admin role from the last admin
        if role == Role::Admin {
            let admin_count = Self::get_admin_count(env);
            if admin_count <= 1 {
                return Err(Error::InvalidRoleTransition);
            }
        }

        // Check if role exists
        if !Self::has_role(env, address, &role) {
            return Err(Error::RoleNotFound);
        }

        env.storage()
            .persistent()
            .remove(&DataKey::UserRole(address.clone()));

        events::role_revoked(env, address, &role);
        Ok(())
    }

    /// Transfer admin role with safeguards
    pub fn transfer_admin(env: &Env, current_admin: &Address, new_admin: &Address) -> Result<(), Error> {
        Self::require_admin(env, current_admin)?;

        // Cannot transfer to self
        if current_admin == new_admin {
            return Err(Error::InvalidRoleTransition);
        }

        // Check if new admin already has a role
        if env.storage().persistent().has(&DataKey::UserRole(new_admin.clone())) {
            return Err(Error::RoleAlreadyAssigned);
        }

        // Assign new admin role
        env.storage()
            .persistent()
            .set(&DataKey::UserRole(new_admin.clone()), &Role::Admin);

        // Revoke old admin role
        env.storage()
            .persistent()
            .remove(&DataKey::UserRole(current_admin.clone()));

        events::admin_transferred(env, current_admin, new_admin);
        Ok(())
    }

    /// Set oracle address (admin only)
    pub fn set_oracle(env: &Env, caller: &Address, oracle: &Address) -> Result<(), Error> {
        Self::require_admin(env, caller)?;

        let old_oracle = env
            .storage()
            .instance()
            .get(&DataKey::Oracle)
            .unwrap_or_else(|| oracle.clone());

        env.storage().instance().set(&DataKey::Oracle, oracle);
        env.storage()
            .persistent()
            .set(&DataKey::UserRole(oracle.clone()), &Role::Oracle);

        events::oracle_changed(env, &old_oracle, oracle);
        Ok(())
    }

    /// Approve a vendor by ID (admin only)
    pub fn approve_vendor(env: &Env, caller: &Address, vendor_id: BytesN<32>) -> Result<(), Error> {
        Self::require_admin(env, caller)?;

        env.storage()
            .persistent()
            .set(&DataKey::ApprovedVendor(vendor_id.clone()), &true);

        events::vendor_approved(env, &vendor_id, caller);
        Ok(())
    }

    /// Remove vendor approval (admin only)
    pub fn remove_vendor(env: &Env, caller: &Address, vendor_id: BytesN<32>) -> Result<(), Error> {
        Self::require_admin(env, caller)?;

        env.storage()
            .persistent()
            .set(&DataKey::ApprovedVendor(vendor_id.clone()), &false);

        events::vendor_removed(env, &vendor_id, caller);
        Ok(())
    }

    /// Check if vendor is approved
    pub fn is_vendor_approved(env: &Env, vendor_id: &BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::ApprovedVendor(vendor_id.clone()))
            .unwrap_or(false)
    }

    /// Check if contract is paused
    pub fn is_paused(env: &Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    /// Pause contract (admin only)
    pub fn pause_contract(env: &Env, caller: &Address) -> Result<(), Error> {
        Self::require_admin(env, caller)?;

        if Self::is_paused(env) {
            return Err(Error::InvalidState);
        }

        env.storage().instance().set(&DataKey::Paused, &true);
        events::contract_paused(env, caller);
        Ok(())
    }

    /// Resume contract (admin only)
    pub fn resume_contract(env: &Env, caller: &Address) -> Result<(), Error> {
        Self::require_admin(env, caller)?;

        if !Self::is_paused(env) {
            return Err(Error::InvalidState);
        }

        env.storage().instance().set(&DataKey::Paused, &false);
        events::contract_resumed(env, caller);
        Ok(())
    }

    /// Require contract not paused
    pub fn require_not_paused(env: &Env) -> Result<(), Error> {
        if Self::is_paused(env) {
            return Err(Error::ContractPaused);
        }
        Ok(())
    }

    /// Get the count of admin addresses
    fn get_admin_count(_env: &Env) -> u32 {
        // This is a simplified implementation - in practice you'd need to iterate through all users
        // For now, we'll assume we track this separately or use a more efficient storage pattern
        1 // Placeholder - would need proper implementation
    }

    /// Create a multi-signature proposal for critical operations
    pub fn create_proposal(
        env: &Env,
        caller: &Address,
        operation: Symbol,
        params: Bytes,
        level: PermissionLevel,
    ) -> Result<BytesN<32>, Error> {
        Self::require_admin(env, caller)?;

        let counter: u64 = env
            .storage()
            .instance()
            .get(&DataKey::ProposalCounter)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::ProposalCounter, &(counter + 1));

        let mut proposal_preimage = Bytes::new(env);
        proposal_preimage.extend_from_array(&env.ledger().sequence().to_be_bytes());
        proposal_preimage.extend_from_array(&counter.to_be_bytes());
        let proposal_id: BytesN<32> = env.crypto().sha256(&proposal_preimage).into();
        let proposal = MultiSigProposal {
            operation: operation.clone(),
            params,
            proposer: caller.clone(),
            approvals: Vec::new(env),
            required_level: level,
            created_ledger: env.ledger().sequence(),
            executed: false,
        };

        env.storage()
            .temporary()
            .set(&DataKey::MultiSigProposal(proposal_id.clone()), &proposal);

        events::proposal_created(env, &proposal_id, &operation, caller);
        Ok(proposal_id)
    }

    /// Approve a multi-signature proposal
    pub fn approve_proposal(env: &Env, caller: &Address, proposal_id: BytesN<32>) -> Result<(), Error> {
        Self::require_admin(env, caller)?;

        let mut proposal: MultiSigProposal = env
            .storage()
            .temporary()
            .get(&DataKey::MultiSigProposal(proposal_id.clone()))
            .ok_or(Error::ProposalNotFound)?;

        if proposal.executed {
            return Err(Error::ProposalAlreadyExecuted);
        }

        // Check if already approved by this admin
        for approval in proposal.approvals.iter() {
            if approval == *caller {
                return Err(Error::InvalidState);
            }
        }

        proposal.approvals.push_back(caller.clone());
        env.storage()
            .temporary()
            .set(&DataKey::MultiSigProposal(proposal_id.clone()), &proposal);

        events::proposal_approved(env, &proposal_id, caller);
        Ok(())
    }

    /// Execute a multi-signature proposal if it has enough approvals
    pub fn execute_proposal(env: &Env, caller: &Address, proposal_id: BytesN<32>) -> Result<(), Error> {
        Self::require_admin(env, caller)?;

        let mut proposal: MultiSigProposal = env
            .storage()
            .temporary()
            .get(&DataKey::MultiSigProposal(proposal_id.clone()))
            .ok_or(Error::ProposalNotFound)?;

        if proposal.executed {
            return Err(Error::ProposalAlreadyExecuted);
        }

        // Check timeout
        if env.ledger().sequence() > proposal.created_ledger + PROPOSAL_TIMEOUT_LEDGERS {
            return Err(Error::ProposalExpired);
        }

        // Check if proposal has enough approvals
        let admin_count = Self::get_admin_count(env);
        let approval_count = proposal.approvals.len();

        let has_enough_approvals = match proposal.required_level {
            PermissionLevel::Low => approval_count >= 1,
            PermissionLevel::Medium => approval_count >= 2 && admin_count >= 3,
            PermissionLevel::High => approval_count >= admin_count,
            PermissionLevel::Critical => {
                approval_count >= admin_count && Self::is_oracle(env, &caller)
            }
        };

        if !has_enough_approvals {
            return Err(Error::InsufficientApprovals);
        }

        // Mark as executed
        proposal.executed = true;
        env.storage()
            .temporary()
            .set(&DataKey::MultiSigProposal(proposal_id.clone()), &proposal);

        events::proposal_executed(env, &proposal_id, caller);

        // Here you would execute the actual operation based on proposal.operation
        // For now, we'll just return success
        Ok(())
    }

    /// Get user role
    pub fn get_user_role(env: &Env, address: &Address) -> Option<Role> {
        env.storage()
            .persistent()
            .get(&DataKey::UserRole(address.clone()))
    }
}
