import { Knex } from 'knex';

/**
 * Migration: create wallets table.
 *
 * wallets — stores user Stellar wallet information with cached balance
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('wallets', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().unique().references('id').inTable('users').onDelete('CASCADE');
    t.string('public_key', 64).notNullable().unique();
    t.text('encrypted_secret_key').nullable(); // Encrypted secret key for future use
    t.bigInteger('cached_balance').notNullable().defaultTo(0); // Cached balance in stroops (1 XLM = 10,000,000 stroops)
    t.string('balance_currency', 16).notNullable().defaultTo('XLM');
    t.timestamp('balance_synced_at').nullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    t.index('user_id');
    t.index('public_key');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('wallets');
}
