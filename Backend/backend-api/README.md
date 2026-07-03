# Vaulty Backend

The Vaulty backend powers the platform's off-chain infrastructure, providing secure APIs, authentication, banking integrations, notifications, analytics, and communication with Stellar smart contracts.

Built with **Node.js**, **Express**, and **TypeScript**, the backend acts as the bridge between the frontend, the Stellar network, and third-party financial services, ensuring a secure, scalable, and reliable user experience.

---

# Overview

The backend is responsible for:

* User authentication and authorization
* Wallet management
* Savings vault management
* Transaction processing
* Nigerian bank integrations
* Fiat-to-USDT conversion workflows
* Lending and borrowing services
* Investment management
* Reward and streak calculations
* Notification delivery
* Analytics and reporting
* Communication with Soroban smart contracts

---

# Tech Stack

| Technology  | Purpose                |
| ----------- | ---------------------- |
| Node.js     | Runtime                |
| Express.js  | API Framework          |
| TypeScript  | Type Safety            |
| PostgreSQL  | Primary Database       |
| Redis       | Caching & Queues       |
| Prisma ORM  | Database Access        |
| JWT         | Authentication         |
| Stellar SDK | Blockchain Integration |
| BullMQ      | Background Jobs        |
| Docker      | Containerization       |

---

# Features

## Authentication

Provides secure user authentication and account management.

Features:

* User registration
* Login
* JWT authentication
* Refresh tokens
* Password reset
* Email verification
* Role-based access control

---

## Wallet Service

Manages user wallets and blockchain interactions.

Responsibilities:

* Wallet creation
* Wallet lookup
* Balance retrieval
* Transaction signing
* Stellar account synchronization

---

## Savings Service

Handles all savings-related operations.

Supports:

* Create vaults
* Deposit funds
* Withdraw funds
* Goal tracking
* Lock period validation
* Vault history

---

## Banking Service

Integrates with payment providers to support local bank transfers.

Responsibilities:

* Receive NGN deposits
* Verify payments
* Convert NGN to USDT
* Transfer assets to Stellar wallets
* Process withdrawals back to bank accounts

---

## Lending Service

Manages lending operations.

Features:

* Supply assets
* Track lending positions
* Interest calculations
* Loan monitoring

---

## Borrowing Service

Supports collateralized borrowing.

Responsibilities:

* Collateral verification
* Borrow limit calculation
* Loan issuance
* Repayment tracking

---

## Investment Service

Handles investment portfolios.

Features:

* Portfolio allocation
* Performance tracking
* Earnings calculation
* Investment history

---

## Rewards Service

Calculates user rewards.

Tracks:

* Saving streaks
* Achievements
* Financial Discipline Score
* Milestone completion

---

## Notification Service

Sends user notifications.

Examples:

* Deposit confirmation
* Streak reminders
* Goal milestones
* Loan due dates
* Reward unlocks

---

## Analytics Service

Provides reporting and platform insights.

Examples:

* User activity
* Savings growth
* Vault performance
* Transaction metrics
* Platform statistics

---

# Folder Structure

```text
backend/
│
├── src/
│   │
│   ├── config/
│   ├── controllers/
│   ├── services/
│   ├── routes/
│   ├── middleware/
│   ├── models/
│   ├── repositories/
│   ├── database/
│   │   ├── prisma/
│   │   └── migrations/
│   │
│   ├── blockchain/
│   │   ├── stellar/
│   │   ├── soroban/
│   │   └── contracts/
│   │
│   ├── integrations/
│   │   ├── banking/
│   │   ├── notifications/
│   │   └── payments/
│   │
│   ├── jobs/
│   ├── queues/
│   ├── utils/
│   ├── types/
│   ├── validators/
│   ├── constants/
│   ├── app.ts
│   └── server.ts
│
├── prisma/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── .env.example
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tsconfig.json
└── README.md
```

---

# API Modules

The backend is organized into independent modules.

* Authentication
* Users
* Wallets
* Savings Vaults
* Transactions
* Banking
* Lending
* Borrowing
* Investments
* Rewards
* Notifications
* Analytics

Each module follows a layered architecture with controllers, services, repositories, and validation.

---

# API Workflow

```text
Client
   │
   ▼
REST API
   │
   ▼
Controllers
   │
   ▼
Services
   │
   ├── PostgreSQL
   ├── Redis
   ├── Stellar SDK
   ├── Soroban Contracts
   └── Banking Providers
```

---

# Security

Security is built into every layer of the backend.

Measures include:

* JWT authentication
* Password hashing
* Input validation
* Rate limiting
* CORS protection
* Secure HTTP headers
* Role-based permissions
* Audit logging
* Environment-based secrets
* Request validation

---

# Database

PostgreSQL stores platform data including:

* Users
* Wallets
* Savings vaults
* Transactions
* Goals
* Rewards
* Loans
* Investments
* Notifications

Redis is used for:

* Session caching
* Background jobs
* Queue management
* Temporary data
* Rate limiting

---

# Running the Project

## Install dependencies

```bash
npm install
```

## Configure environment

```bash
cp .env.example .env
```

Update the environment variables with your database, Stellar, and third-party integration credentials.

## Run the development server

```bash
npm run dev
```

## Build the project

```bash
npm run build
```

## Start production

```bash
npm start
```

---

# Testing

Run all tests:

```bash
npm test
```

Run integration tests:

```bash
npm run test:integration
```

Run end-to-end tests:

```bash
npm run test:e2e
```

---

# Development Guidelines

* Use TypeScript throughout the project.
* Keep business logic inside services.
* Keep controllers lightweight.
* Validate all incoming requests.
* Write tests for new features.
* Follow RESTful API conventions.
* Document public endpoints.
* Handle errors consistently.
* Avoid hardcoded values; use configuration and environment variables.

---

# Roadmap

### Phase 1

* Authentication
* Wallet management
* Savings vault APIs
* Transaction history
* Stellar integration

### Phase 2

* Nigerian bank integration
* Automated savings
* Rewards engine
* Notification service

### Phase 3

* Lending
* Borrowing
* Investment portfolios
* Analytics dashboard

### Phase 4

* Multi-country banking support
* AI-powered financial insights
* Multi-asset support
* Advanced reporting
* Open developer APIs

---

# Vision

The Vaulty backend is the operational core of the platform, connecting users, banking systems, and the Stellar blockchain into a single, secure ecosystem. Designed with scalability, modularity, and reliability in mind, it enables millions of users to save, invest, lend, and grow their wealth through a seamless financial experience.