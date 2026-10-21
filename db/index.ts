import { config as loadEnv } from 'dotenv';
// Next.js loads .env.local automatically, but standalone tsx/drizzle commands do not.
// Load local settings first while preserving variables already provided by the shell.
loadEnv({ path: ['.env.local', '.env'] });

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const globalForDb = globalThis as unknown as { pgPool?: Pool };
function getPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Create .env.local from .env.example in the project root and set DATABASE_URL to a reachable PostgreSQL database, then rerun the command.');
  return globalForDb.pgPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 10, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined });
}
export const db = drizzle(getPool(), { schema });
