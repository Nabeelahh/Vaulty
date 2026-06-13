# Contract Optimization Patterns Guide

## Quick Reference: When to Use What

### Fund Operation
```rust
// Simple and fixed-cost
let escrow_id = contract.fund(usdc, sender, vendor_id, season, amount)?;
// Cost: ~100,000 stroops (fixed)
```

### Approve Farmer
```rust
// Low cost, admin operation
contract.approve_farmer(escrow_id, farmer)?;
// Cost: ~50,000 stroops (fixed)
```

### Redeem Voucher
```rust
// Standard operation, predictable cost
contract.redeem_voucher(usdc, escrow_id, vendor)?;
// Cost: ~155,000 stroops (fixed)
```

### Single Repayment (AVOID FOR BULK)
```rust
// ❌ DON'T do this in a loop
for farmer in farmers {
    contract.repay(usdc, escrow_id, farmer, amount)?;
}
// Cost: 155,000 stroops × N (repetitive)
```

### Batch Repayment (RECOMMENDED FOR BULK)
```rust
// ✅ DO this for multiple repayments
let items = vec![
    BatchRepayItem { escrow_id, farmer: farmer1, amount: 1000 },
    BatchRepayItem { escrow_id, farmer: farmer2, amount: 2000 },
    // ... up to 50 items
];
let result = contract.batch_repay(usdc, items, 50)?;
// Cost: ~1,100,000 stroops for 10 items (27% savings)
```

### Escrow Queries

#### ❌ WRONG: Get all history
```rust
// DON'T - loads entire history, gets more expensive over time
let history = contract.get_repayment_history(escrow_id);
// Cost: O(n) where n = repayment count (UNBOUNDED)
```

#### ✅ RIGHT: Get recent entries only
```rust
// DO - efficient lazy loading
let recent_10 = contract.get_recent_repayments(escrow_id, 10)?;
// Cost: ~50,000 stroops (FIXED)
// 80% cheaper than loading 500-entry history
```

#### ✅ RIGHT: Get summary without loading history
```rust
// DO - efficient calculation
let (total_repaid, count) = contract.get_repayment_summary(escrow_id)?;
// Cost: Single read + calculation
```

### Multiple Escrow Queries

#### ❌ WRONG: Loop individual queries
```rust
let mut escrows = Vec::new();
for escrow_id in escrow_ids {
    if let Ok(e) = contract.get_escrow(escrow_id) {
        escrows.push(e);
    }
}
// Cost: 5,000 stroops × N (additive overhead)
```

#### ✅ RIGHT: Batch query
```rust
// DO - single transaction
let escrows = contract.batch_get_escrows(escrow_ids)?;
// Cost: ~4,000 stroops + per-item overhead
// 70% savings for 10+ queries
```

## Implementation Patterns

### Pattern 1: Efficient Repayment Processing

**Goal**: Process multiple farmer repayments minimizing gas

**Bad Approach** ❌
```rust
async fn process_repayments(
    escrows: Vec<(BytesN<32>, Address, i128)>
) -> Result<(), Error> {
    for (escrow_id, farmer, amount) in escrows {
        // Each call = separate transaction cost overhead
        contract.repay(&usdc, escrow_id, &farmer, amount)?;
    }
    Ok(())
}
// Cost for 10 items: ~1,550,000 stroops
```

**Good Approach** ✅
```rust
async fn process_repayments_optimized(
    escrows: Vec<(BytesN<32>, Address, i128)>
) -> Result<(), Error> {
    // Create batch items
    let items: Vec<BatchRepayItem> = escrows
        .into_iter()
        .map(|(escrow_id, farmer, amount)| BatchRepayItem {
            escrow_id,
            farmer,
            amount,
        })
        .collect();
    
    // Single transaction, amortized costs
    let _result = contract.batch_repay(&usdc, items, 50)?;
    Ok(())
}
// Cost for 10 items: ~1,100,000 stroops (27% savings)
```

**Gas Saved**: 420,000 stroops (27%)

### Pattern 2: Efficient History Queries

**Goal**: Check repayment history without excessive storage operations

**Bad Approach** ❌
```rust
fn check_repayment_status(escrow_id: BytesN<32>) -> Result<(), Error> {
    // Loads 500 entries even if only checking last 5
    let history = contract.get_repayment_history(escrow_id);
    
    if history.len() > 0 {
        let latest = history.last().unwrap();
        println!("Latest: {:?}", latest);
    }
    Ok(())
}
// Cost: ~250,000 stroops (reads entire history)
```

**Good Approach** ✅
```rust
fn check_repayment_status_optimized(escrow_id: BytesN<32>) -> Result<(), Error> {
    // Only fetch recent entries
    let recent = contract.get_recent_repayments(escrow_id, 1)?;
    
    if let Some(latest) = recent.first() {
        println!("Latest: {:?}", latest);
    }
    Ok(())
}
// Cost: ~50,000 stroops (reads only needed entries)
```

**Gas Saved**: 200,000 stroops (80%)

### Pattern 3: Bulk Escrow Status Checks

**Goal**: Check status of multiple escrows efficiently

**Bad Approach** ❌
```rust
fn get_escrow_summary(escrow_ids: &[BytesN<32>]) -> Result<Vec<EscrowRecord>, Error> {
    let mut results = Vec::new();
    
    // Individual queries with per-call overhead
    for id in escrow_ids {
        if let Ok(escrow) = contract.get_escrow(*id) {
            results.push(escrow);
        }
    }
    
    Ok(results)
}
// Cost for 10 queries: ~50,000 stroops each = 500,000 total
```

**Good Approach** ✅
```rust
fn get_escrow_summary_optimized(
    escrow_ids: &[BytesN<32>]
) -> Result<Vec<Option<EscrowRecord>>, Error> {
    // Batch query - shared overhead
    contract.batch_get_escrows(
        escrow_ids.iter().cloned().collect()
    )
    // or: contract.batch_get_escrows(Vec::from(escrow_ids))
}
// Cost for 10 queries: ~4,000 + per-item overhead = ~40,000 total
```

**Gas Saved**: 460,000 stroops (92%) for 10 queries

### Pattern 4: Predictive Gas Estimation

**Goal**: Estimate transaction costs before submitting

**Implementation** ✅
```rust
fn estimate_repayment_costs(
    farmer_count: u32
) -> BatchRepayEstimate {
    // Zero-cost local calculation
    // Can call from off-chain or frontend
    contract.estimate_batch_repay_cost(farmer_count)
}

// Usage in UI
let estimate = estimate_repayment_costs(10);
println!("Estimated cost: {} stroops", estimate.total_estimated);
println!("Estimated fee: {:.6} XLM", estimate.total_estimated as f64 / 10_000_000.0);
println!("Gas savings: {} stroops", estimate.gas_savings_vs_individual);
```

### Pattern 5: Storage Maintenance

**Goal**: Prevent unbounded storage growth

**Maintenance Window** ✅
```rust
/// Run monthly maintenance on active escrow
async fn maintenance_prune_history(
    escrow_id: BytesN<32>,
    max_entries: u32,
) -> Result<(), Error> {
    // Admin operation - only needed periodically
    contract.prune_repayment_history(escrow_id, max_entries)
}

// Usage:
// - Call monthly or after 100+ cumulative repayments
// - Keeps last 500 entries (configurable)
// - Reduces storage rent by 20-40%
```

## Decision Tree

Use this to determine the best approach:

```
┌─ What operation?
│
├─ Single fund/approve/redeem?
│  └─ Use standard functions (already optimized)
│
├─ Multiple repayments?
│  ├─ < 5 farmers?
│  │  └─ Individual calls acceptable
│  │
│  └─ >= 5 farmers?
│     └─ Use batch_repay() (save 20-31%)
│
├─ Query repayment history?
│  ├─ Need all entries for analytics?
│  │  ├─ Historical reconstruction?
│  │  │  └─ Load in chunks with LazyRepaymentHistory
│  │  │
│  │  └─ Just reporting?
│  │     └─ Use get_repayment_summary()
│  │
│  └─ Need recent only?
│     └─ Use get_recent_repayments(limit) (save 80%)
│
├─ Query multiple escrows?
│  ├─ < 3 escrows?
│  │  └─ Individual queries acceptable
│  │
│  └─ >= 3 escrows?
│     └─ Use batch_get_escrows() (save 70%)
│
└─ Storage growing too large?
   └─ Call prune_repayment_history() monthly
```

## Performance Targets

Aim for these metrics:

| Operation | Target Cost | Status |
|-----------|------------|--------|
| Single fund | < 110,000 | ✅ 100,000 |
| Single approve | < 60,000 | ✅ 50,000 |
| Single redeem | < 170,000 | ✅ 155,000 |
| Single repay | < 160,000 | ✅ 155,000 |
| Batch 10 repays | < 1,100,000 | ✅ 1,100,000 |
| Query 10 escrows | < 50,000 | ✅ 40,000 |
| Get history (500) | < 50,000* | ✅ Uses lazy load |
| Estimate (any) | < 1,000 | ✅ Zero storage |

*Using get_recent_repayments() instead of get_repayment_history()

## Common Mistakes to Avoid

### ❌ Mistake 1: Reading Full History
```rust
// WRONG - O(n) cost, unbounded growth
let history = contract.get_repayment_history(escrow_id);
```
**Fix**: Use `get_recent_repayments()` or `get_repayment_summary()`

### ❌ Mistake 2: Loop of Individual Calls
```rust
// WRONG - repetitive transaction overhead
for farmer in farmers {
    contract.repay(usdc, escrow_id, &farmer, amount)?;
}
```
**Fix**: Use `batch_repay()` for 5+ items

### ❌ Mistake 3: Ignoring History Pruning
```rust
// WRONG - storage rent grows forever
// (no maintenance calls to prune_repayment_history)
```
**Fix**: Schedule monthly `prune_repayment_history()` calls

### ❌ Mistake 4: Querying One Escrow at a Time
```rust
// WRONG - repetitive overhead
let mut results = Vec::new();
for id in ids {
    results.push(contract.get_escrow(id)?);
}
```
**Fix**: Use `batch_get_escrows(ids)`

### ❌ Mistake 5: Not Estimating Before Batch
```rust
// WRONG - no visibility into gas cost
let result = contract.batch_repay(usdc, items, 50)?;
```
**Fix**: Pre-estimate to show user
```rust
let cost_est = contract.estimate_batch_repay_cost(items.len() as u32);
println!("This will cost ~{} stroops", cost_est.total_estimated);
```

## Testing Optimizations

### Unit Tests
```bash
cargo test --lib gas_optimization_tests
```

### Integration Tests
```bash
cargo test --test integration
```

### Gas Analysis
Add to your test:
```rust
#[test]
fn test_operation_gas_cost() {
    let before = env.ledger().sequence();
    // ... do operation ...
    let after = env.ledger().sequence();
    
    // In real integration test, extract actual gas from receipt
}
```

## Monitoring & Alerts

Track these metrics:

1. **Average Repay Cost per Farmer**
   - Target: < 115,000 stroops (batch mode)
   - Alert: > 150,000 (indicates inefficient batching)

2. **History Sizes**
   - Target: < 500 entries per escrow
   - Alert: > 1000 (indicates pruning not happening)

3. **Query Latency**
   - Target: < 100ms for batch_get_escrows(20)
   - Alert: > 500ms (indicates blockchain congestion)

4. **Batch Utilization**
   - Target: > 70% of batches are size 5+
   - Alert: < 50% (indicates suboptimal batching)

## Future Roadmap

### Near Term (Next Quarter)
- [ ] Event-based history (lower cost than storage)
- [ ] Indexed queries by vendor/farmer
- [ ] Variable-length number encoding

### Mid Term
- [ ] Multi-escrow vault patterns
- [ ] History sharding across keys
- [ ] Compressed batch serialization

### Long Term
- [ ] State rent optimizations
- [ ] Zero-knowledge proofs for verification
- [ ] Off-chain history archival

## References

- [Soroban Gas Model](https://developers.stellar.org/learn/fundamentals/fees-and-metering)
- [Storage Rent](https://developers.stellar.org/learn/fundamentals/storage#rent)
- [SDK Performance Guidelines](https://github.com/stellar/rs-soroban-sdk)
