import { config } from 'dotenv';
config({ path: ['.env.local', '.env'] });
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Copy .env.example to .env.local, set DATABASE_URL, and ensure PostgreSQL is running.');
  process.exitCode = 1;
} else {
  try {
    const url = new URL(process.env.DATABASE_URL);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('unsupported protocol');
    if (!url.hostname || !url.pathname || url.pathname === '/') throw new Error('missing host or database name');
    console.log(`DATABASE_URL found (${url.protocol}//${url.hostname}${url.pathname}). Credentials are not printed.`);
  } catch {
    console.error('DATABASE_URL is malformed. Use a PostgreSQL URL such as postgresql://user:password@localhost:5432/database.');
    process.exitCode = 1;
  }
}
