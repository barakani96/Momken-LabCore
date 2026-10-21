import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { appSettings } from '@/db/schema';
import { authorizeApi } from '@/lib/auth/api-guard';

export async function GET(request: Request) {
  const auth = await authorizeApi(false, undefined, request);
  if ('response' in auth) return auth.response;

  const result = await db.select().from(appSettings).where(eq(appSettings.key, 'inactivity_timeout_minutes')).limit(1);
  return NextResponse.json({ timeout: result[0]?.value ?? '15' });
}

export async function POST(request: Request) {
  const auth = await authorizeApi(true, undefined, request);
  if ('response' in auth) return auth.response;

  const { timeout } = await request.json();
  if (typeof timeout !== 'string') return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  await db.insert(appSettings)
    .values({ key: 'inactivity_timeout_minutes', value: timeout, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: timeout, updatedAt: new Date() } });

  return NextResponse.json({ success: true });
}
