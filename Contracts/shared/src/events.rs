use soroban_sdk::{Env, Symbol};

use crate::types::{Amount, VaultId};

pub struct VaultCreated {
    pub vault_id: VaultId,
    pub owner: soroban_sdk::Address,
    pub lock_period: u64,
}

impl VaultCreated {
    pub fn publish(env: &Env, vault_id: VaultId, owner: soroban_sdk::Address, lock_period: u64) {
        let event = VaultCreated {
            vault_id,
            owner,
            lock_period,
        };
        env.events()
            .publish((Symbol::new(&env, "vault_created"), event.vault_id.0), (event.owner, event.lock_period));
    }
}

pub struct DepositMade {
    pub vault_id: VaultId,
    pub amount: Amount,
    pub depositor: soroban_sdk::Address,
}

impl DepositMade {
    pub fn publish(env: &Env, vault_id: VaultId, amount: Amount, depositor: soroban_sdk::Address) {
        let event = DepositMade {
            vault_id,
            amount,
            depositor,
        };
        env.events()
            .publish((Symbol::new(&env, "deposit_made"), event.vault_id.0), (event.amount.0, event.depositor));
    }
}

pub struct WithdrawalCompleted {
    pub vault_id: VaultId,
    pub amount: Amount,
    pub withdrawer: soroban_sdk::Address,
}

impl WithdrawalCompleted {
    pub fn publish(env: &Env, vault_id: VaultId, amount: Amount, withdrawer: soroban_sdk::Address) {
        let event = WithdrawalCompleted {
            vault_id,
            amount,
            withdrawer,
        };
        env.events()
            .publish((Symbol::new(&env, "withdrawal_completed"), event.vault_id.0), (event.amount.0, event.withdrawer));
    }
}

pub struct VaultUnlocked {
    pub vault_id: VaultId,
    pub unlocked_at: u64,
}

impl VaultUnlocked {
    pub fn publish(env: &Env, vault_id: VaultId, unlocked_at: u64) {
        let event = VaultUnlocked { vault_id, unlocked_at };
        env.events()
            .publish((Symbol::new(&env, "vault_unlocked"), event.vault_id.0), event.unlocked_at);
    }
}

pub struct StreakUpdated {
    pub user: soroban_sdk::Address,
    pub current_streak: u32,
    pub longest_streak: u32,
}

impl StreakUpdated {
    pub fn publish(env: &Env, user: soroban_sdk::Address, current_streak: u32, longest_streak: u32) {
        let event = StreakUpdated {
            user,
            current_streak,
            longest_streak,
        };
        env.events()
            .publish((Symbol::new(&env, "streak_updated"),), (event.user, event.current_streak, event.longest_streak));
    }
}

pub struct LoanIssued {
    pub loan_id: u64,
    pub borrower: soroban_sdk::Address,
    pub amount: Amount,
    pub collateral_vault_id: VaultId,
}

impl LoanIssued {
    pub fn publish(env: &Env, loan_id: u64, borrower: soroban_sdk::Address, amount: Amount, collateral_vault_id: VaultId) {
        let event = LoanIssued {
            loan_id,
            borrower,
            amount,
            collateral_vault_id,
        };
        env.events()
            .publish((Symbol::new(&env, "loan_issued"), event.loan_id), (event.borrower, event.amount.0, event.collateral_vault_id.0));
    }
}

pub struct LoanRepaid {
    pub loan_id: u64,
    pub borrower: soroban_sdk::Address,
    pub amount_repaid: Amount,
}

impl LoanRepaid {
    pub fn publish(env: &Env, loan_id: u64, borrower: soroban_sdk::Address, amount_repaid: Amount) {
        let event = LoanRepaid {
            loan_id,
            borrower,
            amount_repaid,
        };
        env.events()
            .publish((Symbol::new(&env, "loan_repaid"), event.loan_id), (event.borrower, event.amount_repaid.0));
    }
}

pub struct RewardGranted {
    pub recipient: soroban_sdk::Address,
    pub amount: Amount,
    pub reason: Symbol,
}

impl RewardGranted {
    pub fn publish(env: &Env, recipient: soroban_sdk::Address, amount: Amount, reason: Symbol) {
        let event = RewardGranted {
            recipient,
            amount,
            reason,
        };
        env.events()
            .publish((Symbol::new(&env, "reward_granted"), event.reason), (event.recipient, event.amount.0));
    }
}
