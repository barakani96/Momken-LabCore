import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser, SESSION_COOKIE } from '@/lib/auth/session';
export async function GET() { const store = await cookies(); const user = await getSessionUser(store.get(SESSION_COOKIE)?.value); return user ? NextResponse.json({ user }) : NextResponse.json({ error: 'Unauthenticated' }, { status: 401 }); }
