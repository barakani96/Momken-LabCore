import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { appSessions } from '@/db/schema';
import { hashSessionToken } from '@/lib/auth/password';
import { SESSION_COOKIE } from '@/lib/auth/session';
export async function POST() {
  const store = await cookies(); const token = store.get(SESSION_COOKIE)?.value;
  if (token && process.env.DATABASE_URL) await db.delete(appSessions).where(eq(appSessions.tokenHash, hashSessionToken(token))).catch(() => undefined);
  const response = NextResponse.json({ ok: true }); response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 }); return response;
}
