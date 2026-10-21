import { config as loadEnv } from 'dotenv';
loadEnv({ path: ['.env.local', '.env'] });

import { db, getPool, isDbConfigured, schema } from '@/db';
import type { Pool } from 'pg';

/**
 * Validates if the DATABASE_URL environment variable is provided and non-empty.
 */
export { isDbConfigured, getPool, schema, db };

/**
 * Safely tests the database connection without throwing unhandled exceptions.
 * Useful for health-checks, status dashboards, and diagnostics.
 */
export async function checkDbConnection(): Promise<{ ok: boolean; message: string }> {
  if (!isDbConfigured()) {
    return {
      ok: false,
      message: 'DATABASE_URL is not configured. Set DATABASE_URL in environment or .env.local.',
    };
  }

  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      return { ok: true, message: 'Database connection verified.' };
    } finally {
      client.release();
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown connection error';
    return { ok: false, message: `Database connection failed: ${msg}` };
  }
}

/**
 * Returns the active Drizzle or PostgreSQL client. If not configured, throws an informative error
 * instead of crashing the process or worker during build time.
 */
export function getDbClient() {
  if (!isDbConfigured()) {
    throw new Error(
      'DATABASE_URL is required to perform this database operation. Please set DATABASE_URL in .env.local.'
    );
  }
  return db;
}

export default db;
