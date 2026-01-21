import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sqlClient = neon(process.env.DATABASE_URL!);
export const db = drizzle(sqlClient, { schema });

// Export the raw neon client for direct SQL queries
export const neonSql = sqlClient;

export * from './schema';
