# Vaulty Smart Contracts

The Vaulty smart contracts power the decentralized financial infrastructure of the platform. Built with **Soroban** on the **Stellar Network**, these contracts securely manage savings vaults, deposits, lending, borrowing, rewards, and user interactions in a transparent and trustless manner.

Each contract is designed to be modular, independently deployable, and easily auditable, allowing the protocol to evolve without affecting unrelated components.

---

# Overview

The smart contract layer is responsible for:

* Creating and managing savings vaults
* Locking and unlocking assets
* Processing deposits and withdrawals
* Tracking savings streaks
* Managing lending pools
* Processing collateralized loans
* Distributing rewards
* Recording on-chain financial activity
* Enforcing protocol rules

---

# Technology Stack

| Technology      | Purpose                    |
| --------------- | -------------------------- |
| Soroban SDK     | Smart Contract Development |
| Rust            | Contract Programming       |
| Stellar Network | Blockchain Infrastructure  |
| Stellar CLI     | Deployment & Testing       |
| Cargo           | Dependency Management      |

---

# Folder Structure

```text
contracts/
│
├── vault/
│   ├── src/
│   ├── tests/
│   └── Cargo.toml
│
├── streaks/
│   ├── src/
│   ├── tests/
│   └── Cargo.toml
│
├── lending/
│   ├── src/
│   ├── tests/
│   └── Cargo.toml
│
├── borrowing/
│   ├── src/
│   ├── tests/
│   └── Cargo.toml
│
├── rewards/
│   ├── src/
│   ├── tests/
│   └── Cargo.toml
│
├── shared/
│   ├── errors.rs
│   ├── events.rs
│   ├── storage.rs
│   ├── types.rs
│   └── utils.rs
│
├── scripts/
│   ├── build.sh
│   ├── deploy.sh
│   └── initialize.sh
│
├── Cargo.toml
├── Cargo.lock
└── README.md
```

---

# Contracts

## 🔒 Vault Contract

Manages user savings vaults.

### Responsibilities

* Create vaults
* Lock assets
* Deposit funds
* Withdraw funds
* Track balances
* Enforce lock periods
* Store vault metadata

---

## 🔥 Streak Contract

Tracks user saving consistency.

### Responsibilities

* Record deposits
* Calculate streaks
* Update milestones
* Reset expired streaks
* Trigger achievement events

---

## 🤝 Lending Contract

Manages decentralized lending pools.

### Responsibilities

* Supply liquidity
* Borrow assets
* Calculate interest
* Repay loans
* Manage collateral
* Update pool balances

---

## 💳 Borrowing Contract

Allows users to borrow against eligible savings vaults.

### Responsibilities

* Verify collateral
* Calculate borrowing limits
* Issue loans
* Process repayments
* Release collateral

---

## 🏆 Rewards Contract

Handles user incentives.

### Responsibilities

* Award achievements
* Calculate rewards
* Track milestones
* Record financial discipline scores
* Distribute eligible incentives

---

# Shared Modules

The `shared/` directory contains reusable logic across all contracts.

Includes:

* Custom errors
* Events
* Storage helpers
* Utility functions
* Shared data types

This avoids duplication and keeps contracts consistent.

---

# Contract Workflow

```text
User
 │
 ▼
Create Vault
 │
 ▼
Deposit USDT
 │
 ▼
Vault Contract
 │
 ├────────► Update Balance
 │
 ├────────► Lock Funds
 │
 ├────────► Record Deposit
 │
 ▼
Streak Contract
 │
 ├────────► Update Saving Streak
 ├────────► Check Milestones
 └────────► Emit Events
 │
 ▼
Rewards Contract
 │
 └────────► Award Achievements
```

---

# Security Principles

Vaulty contracts are designed with security as a priority.

Key principles include:

* Explicit authorization checks
* Input validation
* Safe arithmetic
* Deterministic state transitions
* Event emission for important actions
* Modular architecture
* Minimal external dependencies

---

# Events

Contracts emit events for major protocol actions.

Examples include:

* VaultCreated
* DepositMade
* WithdrawalCompleted
* VaultUnlocked
* StreakUpdated
* LoanIssued
* LoanRepaid
* RewardGranted

These events improve transparency and simplify frontend integrations.

---

# Testing

Each contract contains its own test suite.

Tests cover:

* Unit testing
* Integration testing
* Authorization checks
* Failure scenarios
* Edge cases
* State transitions

Run all tests:

```bash
cargo test
```

---

# Building Contracts

Compile all contracts:

```bash
cargo build --release
```

---

# Formatting

Format source code:

```bash
cargo fmt
```

---

# Linting

Run Clippy:

```bash
cargo clippy
```

---

# Deployment

Contracts are deployed using the Stellar CLI.

Typical deployment workflow:

1. Build contracts.
2. Deploy to Stellar Testnet.
3. Initialize contract storage.
4. Configure protocol parameters.
5. Verify deployment.
6. Connect frontend and backend services.

---

# Development Guidelines

When contributing:

* Keep contracts focused on a single responsibility.
* Reuse shared modules whenever possible.
* Write tests for all new functionality.
* Emit events for user-facing actions.
* Avoid breaking storage layouts without migration plans.
* Document all public functions.

---

# Roadmap

### Phase 1

* Savings vaults
* Deposits
* Withdrawals
* Time-locked vaults

### Phase 2

* Saving streaks
* Rewards
* Achievement tracking

### Phase 3

* Lending pools
* Borrowing against vaults
* Interest calculations

### Phase 4

* Yield strategies
* Governance support
* Multi-asset vaults
* Cross-protocol integrations

---

# Vision

The Vaulty smart contracts form the trustless foundation of the platform, enabling users to securely save, grow, lend, borrow, and manage digital assets on Stellar. By keeping the contracts modular, secure, and transparent, Vaulty creates a scalable protocol that can evolve into a comprehensive decentralized wealth platform for users worldwide.
