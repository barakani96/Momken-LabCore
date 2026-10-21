import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { authorizeApi } from '@/lib/auth/api-guard';

export async function GET(request: Request) {
  const auth = await authorizeApi(false, 'audit.read', request);
  if ('response' in auth) return auth.response;
  try {
    const result = await db.execute(sql`
      WITH ordered AS (
        SELECT e.*, lag(e.event_hash) OVER (ORDER BY e.chain_seq) AS prior_hash
        FROM audit_events e
      ), checked AS (
        SELECT id, chain_seq, event_hash, previous_hash,
          (previous_hash IS DISTINCT FROM prior_hash OR event_hash IS DISTINCT FROM encode(
            digest(coalesce(previous_hash, '') ||
              (to_jsonb(ordered) - 'previous_hash' - 'event_hash' - 'chain_seq' - 'prior_hash')::text,
              'sha256'), 'hex')) AS invalid
        FROM ordered
      )
      SELECT count(*)::int AS total,
        count(*) FILTER (WHERE invalid)::int AS invalid,
        max(chain_seq)::bigint AS latest_sequence,
        (array_agg(event_hash ORDER BY chain_seq DESC))[1] AS latest_hash
      FROM checked
    `);
    const row = (result as unknown as { rows: Array<{ total: number; invalid: number; latest_sequence: number | null; latest_hash: string | null }> }).rows[0];
    return NextResponse.json({ verified: Number(row.invalid) === 0, total: Number(row.total), invalid: Number(row.invalid), latestSequence: row.latest_sequence == null ? null : Number(row.latest_sequence), latestHash: row.latest_hash, checkedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Audit integrity verification failed', error);
    return NextResponse.json({ error: 'Unable to verify audit integrity. Confirm migration 0018 and pgcrypto are installed.' }, { status: 503 });
  }
}
