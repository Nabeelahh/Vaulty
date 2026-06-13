#!/usr/bin/env bash
# Build and test script for gas-optimized Soroban contract

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║        Soroban Escrow Contract Build & Test               ║"
echo "╚════════════════════════════════════════════════════════════╝"

# Check if cargo is installed
if ! command -v cargo &> /dev/null; then
    echo "❌ Cargo not found. Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
fi

# Check if Soroban CLI is installed
if ! command -v soroban &> /dev/null; then
    echo "❌ Soroban CLI not found. Installing..."
    cargo install soroban-cli --locked
fi

echo "✅ Tools verified"
echo ""

# Check
echo "🔍 Checking code..."
cargo check --all

echo ""
echo "🧪 Running tests..."
cargo test --lib

echo ""
echo "🏗️  Building release binary..."
cargo build --release --target wasm32-unknown-unknown

echo ""
echo "📊 Analyzing gas usage..."
echo "Run: cargo test --lib gas_optimization_tests -- --nocapture"

echo ""
echo "✅ Build successful!"
echo ""
echo "Next steps:"
echo "1. Deploy to Soroban testnet"
echo "2. Run gas benchmarks on-chain"
echo "3. Check OPTIMIZATION_PATTERNS.md for usage guide"
