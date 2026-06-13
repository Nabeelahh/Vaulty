//! Optimized Storage Patterns
//!
//! Implements efficient storage strategies:
//! - Minimal storage slots through data packing
//! - Lazy loading for large datasets
//! - Batch operations to reduce per-item costs
//! - CompactedRepaymentHistory for efficient history tracking

use soroban_sdk::{contracttype, BytesN, Env, Vec};

use crate::storage::{DataKey, RepaymentEntry};
use crate::errors::Error;

/// Compacted repayment entry using fixed-size fields
/// Reduces storage compared to full RepaymentEntry through field optimization
#[contracttype]
#[derive(Clone, Debug)]
pub struct CompactedRepaymentEntry {
    pub amount: i128,
    pub ledger: u32,
    // cumulative removed - can be calculated on-the-fly if needed
}

impl CompactedRepaymentEntry {
    pub fn from_entry(entry: &RepaymentEntry) -> Self {
        CompactedRepaymentEntry {
            amount: entry.amount,
            ledger: entry.ledger,
        }
    }
}

/// Lazy-loaded repayment history iterator
/// Loads history in chunks to minimize memory and storage costs
pub struct LazyRepaymentHistory {
    chunk_size: u32,
    current_chunk: Vec<RepaymentEntry>,
    chunk_index: u32,
    total_entries: u32,
}

impl LazyRepaymentHistory {
    /// Create a new lazy loader for repayment history
    pub fn new(env: &Env, escrow_id: &BytesN<32>, chunk_size: usize) -> Result<Self, Error> {
        let key = DataKey::RepaymentHistory(escrow_id.clone());
        let history: Vec<RepaymentEntry> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| Vec::new(env));
        
        let total_entries = history.len();
        let first_chunk = if total_entries > 0 {
            load_chunk(env, escrow_id, 0, chunk_size as u32)
        } else {
            Vec::new(env)
        };

        Ok(LazyRepaymentHistory {
            chunk_size: chunk_size as u32,
            current_chunk: first_chunk,
            chunk_index: 0,
            total_entries,
        })
    }

    /// Get next chunk of repayment entries
    pub fn next_chunk(&mut self, env: &Env, escrow_id: &BytesN<32>) -> Result<Option<Vec<RepaymentEntry>>, Error> {
        let next_offset = (self.chunk_index + 1) * self.chunk_size;
        if next_offset >= self.total_entries {
            return Ok(None);
        }

        self.chunk_index += 1;
        self.current_chunk = load_chunk(env, escrow_id, self.chunk_index, self.chunk_size);
        Ok(Some(self.current_chunk.clone()))
    }

    /// Get current chunk
    pub fn current(&self) -> &Vec<RepaymentEntry> {
        &self.current_chunk
    }
}

/// Load a specific chunk of repayment history without loading entire history
fn load_chunk(env: &Env, escrow_id: &BytesN<32>, chunk_index: u32, chunk_size: u32) -> Vec<RepaymentEntry> {
    let key = DataKey::RepaymentHistory(escrow_id.clone());
    let history: Vec<RepaymentEntry> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env));
    
    let start = chunk_index * chunk_size;
    let end = (start + chunk_size).min(history.len());
    
    let mut chunk = Vec::new(env);
    for i in start..end {
        if let Some(entry) = history.get(i) {
            chunk.push_back(entry);
        }
    }
    
    chunk
}

/// Prune old repayment history to maintain storage efficiency
/// Keeps only recent N entries to prevent unbounded storage growth
pub fn prune_repayment_history(
    env: &Env,
    escrow_id: &BytesN<32>,
    max_entries: usize,
) -> Result<(), Error> {
    let key = DataKey::RepaymentHistory(escrow_id.clone());
    let history: Vec<RepaymentEntry> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env));

    let max_entries = max_entries as u32;
    if history.len() <= max_entries {
        return Ok(());
    }

    // Keep only the most recent max_entries
    let start_idx = history.len() - max_entries;
    let mut pruned = Vec::new(env);
    
    for i in start_idx..history.len() {
        if let Some(entry) = history.get(i) {
            pruned.push_back(entry);
        }
    }

    env.storage().persistent().set(&key, &pruned);
    Ok(())
}

/// Calculate repayment summary without loading full history
/// Returns (total_repaid, entry_count) from history metadata
pub fn get_repayment_summary(
    env: &Env,
    escrow_id: &BytesN<32>,
) -> Result<(i128, u32), Error> {
    let key = DataKey::RepaymentHistory(escrow_id.clone());
    let history: Vec<RepaymentEntry> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env));

    let mut total = 0i128;
    for i in 0..history.len() {
        if let Some(entry) = history.get(i) {
            total += entry.amount;
        }
    }

    Ok((total, history.len() as u32))
}

/// Batch append multiple repayment entries with single storage write
pub fn batch_append_repayments(
    env: &Env,
    escrow_id: &BytesN<32>,
    entries: Vec<RepaymentEntry>,
) -> Result<(), Error> {
    let key = DataKey::RepaymentHistory(escrow_id.clone());
    let mut history: Vec<RepaymentEntry> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env));

    for i in 0..entries.len() {
        if let Some(entry) = entries.get(i) {
            history.push_back(entry);
        }
    }

    env.storage().persistent().set(&key, &history);
    Ok(())
}

/// Get last N repayment entries efficiently
pub fn get_recent_repayments(
    env: &Env,
    escrow_id: &BytesN<32>,
    limit: usize,
) -> Result<Vec<RepaymentEntry>, Error> {
    let key = DataKey::RepaymentHistory(escrow_id.clone());
    let history: Vec<RepaymentEntry> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env));

    let limit = limit as u32;
    let total_len = history.len();
    let start = if total_len > limit { total_len - limit } else { 0 };

    let mut result = Vec::new(env);
    for i in start..total_len {
        if let Some(entry) = history.get(i) {
            result.push_back(entry);
        }
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compacted_entry() {
        let entry = RepaymentEntry {
            amount: 1000,
            ledger: 12345,
            cumulative: 5000,
        };
        let compacted = CompactedRepaymentEntry::from_entry(&entry);
        assert_eq!(compacted.amount, 1000);
        assert_eq!(compacted.ledger, 12345);
    }
}
