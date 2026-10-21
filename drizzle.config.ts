import { config as loadEnv } from 'dotenv';
loadEnv({ path: ['.env.local', '.env'] });
import { defineConfig } from 'drizzle-kit';
export default defineConfig({ schema: './db/schema.ts', out: './db/migrations', dialect: 'postgresql', dbCredentials: { url: process.env.DATABASE_URL! } });
