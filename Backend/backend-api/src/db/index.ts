import Knex, { Knex as KnexType } from 'knex';

/**
 * Shared Knex instance.
 * Uses DATABASE_URL when set (production/staging), otherwise falls back to
 * individual DB_* env vars for local development.
 *
 * Lazily initialised so that test suites that mock the DB don't require `pg`.
 */
let _db: KnexType | null = null;

export function getDb(): KnexType {
  if (!_db) {
    _db = Knex({
      client: 'pg',
      connection: process.env.DATABASE_URL ?? {
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        database: process.env.DB_NAME ?? 'remitroot_db',
        user: process.env.DB_USER ?? 'admin',
        password: process.env.DB_PASSWORD ?? '',
      },
      pool: { min: 2, max: 10 },
    });
  }
  return _db;
}

export default getDb;
