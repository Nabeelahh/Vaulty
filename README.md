# 🔐 Vaulty

> **Save consistently. Grow your wealth. Unlock financial opportunities.**

Vaulty is a decentralized savings platform on the Stellar network that turns saving into an engaging, rewarding habit. It combines gamification, automated savings, DeFi, and seamless bank integration to help users — especially in emerging markets — build lasting financial discipline while growing their wealth through yield, lending, borrowing, and investing.

---

## Problem

Millions of people want to save but struggle with consistency. Traditional savings apps offer little motivation, no visual feedback, limited investment access, and clunky, complicated onboarding into DeFi — with no seamless bridge between local banking and blockchain. For many users in Africa and other emerging markets, the challenge isn't opening a savings account; it's *maintaining the discipline* to save.

## Solution

Vaulty pairs behavioral psychology with DeFi. Users fund vaults directly from a Nigerian bank account (auto-converted to USDT on Stellar), lock savings into purpose-built vaults, and build streaks — while earning yield, lending idle assets, borrowing against savings, or investing in curated portfolios. Every deposit gets animated visual feedback, and withdrawals convert back to NGN straight to a bank account.

---

## Core Features

- **Savings Vaults** — Purpose-built vaults (Emergency Fund, School Fees, Rent, Vacation, Business Capital, Car, Wedding, Investments, etc.), each tracking target amount, progress, lock period, balance, deposit history, and maturity date.
- **Saving Streaks** — Deposits build a streak (7/30/100/365-day milestones); missing a scheduled deposit resets it unless protected by an earned streak freeze.
- **Vault Pulse Animation** — Deposits trigger pulse/growth animations, progress updates, and milestone celebrations for instant positive reinforcement.
- **Progress Tracking** — Dashboard for total savings, goal completion %, streaks, deposit history, vault performance, and yield/interest earned.
- **Nigerian Bank Integration** — User initiates a bank transfer → payment partner receives NGN → converts to USDT → deposits into the user's Stellar wallet → moves into the chosen vault. No manual crypto purchase required.
- **Automatic Savings** — Recurring deposits (daily, weekly, monthly, payday-aligned, or custom) that also maintain streaks.

## Financial Features

- **Yield Vaults** — Flexible, Fixed, Stable, and Growth vault types, each showing estimated APY, historical performance, lock period, risk, and earnings.
- **Lending Marketplace** — Supply idle assets to a collateralized lending pool for passive, transparent, on-chain income with automated repayments. Dashboard shows active loans, expected returns, maturity, and interest earned.
- **Borrow Against Savings** — Use a vault as collateral instead of breaking a streak, preserving growth and rewards while accessing liquidity.
- **Investment Portfolios** — Conservative, Balanced, and Growth portfolios for gradual wealth-building without advanced trading knowledge; risk and expected return disclosed for each.
- **Compound Earnings** — Auto-reinvest, withdraw, compound, or redirect earnings into other vaults.

## Gamification

- **Achievements** — First Deposit, First Week/Month, 100 Deposits, $100/$1,000 Saved, One Year Streak, etc.
- **Discipline Score** — Based on saving consistency, streak length, goal completion, loan repayment history, and investment activity; higher scores unlock platform benefits.
- **Milestone Celebrations** — Confetti, animated vaults, and celebration screens.
- **Savings Calendar** — GitHub-style contribution calendar showing daily deposits, missed days, and consistency trends.
- **Smart Notifications** — e.g. *"Keep your 28-day streak alive by saving today"* or *"You're only $15 away from your emergency fund goal."*

---

## User Flow

1. **Register** — Create account → Stellar wallet → KYC identity verification (required for bank funding and withdrawals, per local regulation).
2. **Fund** — Nigerian bank transfer, existing Stellar wallet, USDT transfer, or supported crypto wallet.
3. **Save** — Create a vault, set a goal and lock period, deposit, and build a streak.
4. **Grow** — Earn yield, lend, borrow against savings, invest, or compound.
5. **Withdraw** — At maturity, convert USDT to NGN and send to a bank account.

---

## Technology Stack

- **Blockchain:** Stellar Network, Soroban Smart Contracts
- **Backend:** Node.js, TypeScript, PostgreSQL, Redis
- **Frontend:** Next.js, React, Tailwind CSS
- **Mobile (future):** Flutter
- **Infrastructure:** Docker, GitHub Actions, Vercel, cloud hosting

**Smart contracts** manage savings vaults, time locks, lending/borrowing, yield distribution, reward calculations, and streak verification.

## Security & Compliance

Audited smart contracts, multi-signature treasury management, encrypted user data, secure authentication, rate limiting, fraud detection, continuous monitoring, and KYC/AML verification through a licensed identity provider for bank-linked accounts.

---

## Roadmap

| Phase | Focus |
|---|---|
| **1** | Savings vaults, USDT deposits, streaks, goal tracking, vault animations, Stellar wallet integration |
| **2** | Nigerian bank deposits, automatic savings, yield vaults, achievements, savings calendar, notifications |
| **3** | Lending marketplace, borrowing, investment portfolios, compound earnings, Discipline Score enhancements |
| **4** | Multi-country bank support, tokenized real-world assets, AI financial coach, community savings circles, merchant integrations, global remittances |

---

## Why Stellar?

Stellar's speed, low transaction costs, and asset tokenization make it well-suited to an accessible financial platform for emerging markets — letting users move between traditional banking and blockchain via seamless fiat on/off ramps, without needing deep crypto knowledge.

## Mission

To help millions build sustainable financial habits by making saving engaging, accessible, and rewarding — while opening a gateway to decentralized financial services. Every deposit strengthens discipline; every streak builds confidence; every saved dollar becomes an opportunity to grow wealth.

---
