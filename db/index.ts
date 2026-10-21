import { config as loadEnv } from 'dotenv';
// Next.js loads .env.local automatically, but standalone tsx/drizzle commands do not.
// Load local settings first while preserving variables already provided by the shell.
loadEnv({ path: ['.env.local', '.env'] });

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const globalForDb = globalThis as unknown as { pgPool?: Pool };

export function isDbConfigured(): boolean {
  return typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL.trim().length > 0;
}

export function getPool(): Pool {
  if (globalForDb.pgPool && (isDbConfigured() || (globalForDb.pgPool as unknown as { _isDummy?: boolean })._isDummy)) {
    // If we previously created a dummy pool but DATABASE_URL was later set, reset it:
    if ((globalForDb.pgPool as unknown as { _isDummy?: boolean })._isDummy && isDbConfigured()) {
      globalForDb.pgPool = undefined;
    } else {
      return globalForDb.pgPool;
    }
  }

  if (!isDbConfigured()) {
    // Return a build-safe pool that allows module evaluation and next build without throwing
    const dummyPool = new Pool({ connectionString: 'postgresql://placeholder:placeholder@localhost:5432/placeholder' });
    (dummyPool as unknown as { _isDummy: boolean })._isDummy = true;
    const safePool = new Proxy(dummyPool, {
      get(target, prop, receiver) {
        if (prop === 'connect' || prop === 'query') {
          return () => {
            throw new Error('DATABASE_URL is not configured. Create .env.local from .env.example in the project root and set DATABASE_URL to a reachable PostgreSQL database.');
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    return (globalForDb.pgPool = safePool);
  }

  return (globalForDb.pgPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  }));
}

export const db = drizzle(getPool(), { schema });
export { schema };
export default db;
