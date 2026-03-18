import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required. Set it to your Neon PostgreSQL connection string.');
}

const isLocalDb = process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1');

let db: ReturnType<typeof createDrizzle>;

function createDrizzle() {
  if (isLocalDb) {
    // Use standard node-postgres for local development/testing
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require('pg');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require('drizzle-orm/node-postgres');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    return drizzle(pool, { schema });
  } else {
    // Use Neon serverless for cloud (Vercel/Neon)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { neon } = require('@neondatabase/serverless');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require('drizzle-orm/neon-http');
    const sql = neon(process.env.DATABASE_URL);
    return drizzle(sql, { schema });
  }
}

db = createDrizzle();

export { db };
export * from './schema';
