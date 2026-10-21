import { cookies } from 'next/headers';
import { and, desc, eq, gt } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { patientPortalSessions } from '@/db/schema';
import { getPatientPortalAccount, PATIENT_PORTAL_COOKIE } from '@/lib/auth/patient-portal';
import { hashSessionToken } from '@/lib/auth/password';
export async function GET() {
 if (!process.env.DATABASE_URL) return NextResponse.json({error:'Database is not configured.'},{status:503});
 try { const account=await getPatientPortalAccount(); if(!account)return NextResponse.json({error:'Authentication required.'},{status:401}); const store=await cookies(); const token=store.get(PATIENT_PORTAL_COOKIE)?.value; if(!token)return NextResponse.json({error:'Authentication required.'},{status:401}); const currentHash=hashSessionToken(token); const rows=await db.select({id:patientPortalSessions.id,createdAt:patientPortalSessions.createdAt,lastSeenAt:patientPortalSessions.lastSeenAt,expiresAt:patientPortalSessions.expiresAt,userAgent:patientPortalSessions.userAgent,tokenHash:patientPortalSessions.tokenHash}).from(patientPortalSessions).where(and(eq(patientPortalSessions.accountId,account.id),gt(patientPortalSessions.expiresAt,new Date()))).orderBy(desc(patientPortalSessions.createdAt)); return NextResponse.json({data:rows.map(({tokenHash,...row})=>({...row,current:tokenHash===currentHash}))}); }
 catch(e){console.error('Patient sessions lookup failed',e);return NextResponse.json({error:'Unable to load sessions.'},{status:500});}
}
