import { Knex } from 'knex';

/**
 * Migration: create escrows and escrow_history tables.
 *
 * escrows        — current state mirror of on-chain escrow contracts
 * escrow_history — append-only audit log of every state transition
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('escrows', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('contract_escrow_id', 128).notNullable().unique();
    t.string('contract_id', 128).notNullable();
    t.string('state', 32).notNullable();
    t.string('sender_address', 64).notNullable();
    t.string('farmer_address', 64).nullable();
    t.string('vendor_id', 128).nullable();
    t.bigInteger('amount').notNullable().defaultTo(0);
    t.string('currency', 16).notNullable().defaultTo('USDC');
    t.string('crop_season', 64).nullable();
    t.bigInteger('last_ledger_sequence').notNullable().defaultTo(0);
    t.string('last_tx_hash', 128).nullable();
    t.timestamp('synced_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    t.index('contract_id');
    t.index('sender_address');
    t.index('state');
  });

  await knex.schema.createTable('escrow_history', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('escrow_id').notNullable().references('id').inTable('escrows').onDelete('CASCADE');
    t.string('from_state', 32).nullable();
    t.string('to_state', 32).notNullable();
    t.string('tx_hash', 128).nullable();
    t.bigInteger('ledger_sequence').notNullable().defaultTo(0);
    t.string('event_type', 64).notNullable();
    t.jsonb('metadata').nullable();
    t.timestamp('occurred_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    t.index('escrow_id');
    t.index('to_state');
    t.index('occurred_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('escrow_history');
  await knex.schema.dropTableIfExists('escrows');
}
