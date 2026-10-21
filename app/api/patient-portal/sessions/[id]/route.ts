import { cookies } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { auditEvents, patientPortalSessions } from '@/db/schema';
import { getPatientPortalAccount, PATIENT_PORTAL_COOKIE } from '@/lib/auth/patient-portal';
import { hashSessionToken } from '@/lib/auth/password';
import { isSameOriginRequest } from '@/lib/auth/api-guard';
export async function DELETE(request:Request,context:{params:Promise<{id:string}>}) {
 if(!isSameOriginRequest(request))return NextResponse.json({error:'Cross-origin request rejected.'},{status:403}); if(!process.env.DATABASE_URL)return NextResponse.json({error:'Database is not configured.'},{status:503});
 try { const account=await getPatientPortalAccount(); if(!account)return NextResponse.json({error:'Authentication required.'},{status:401}); const {id}=await context.params; const store=await cookies(); const token=store.get(PATIENT_PORTAL_COOKIE)?.value; const [target]=await db.select({id:patientPortalSessions.id,tokenHash:patientPortalSessions.tokenHash}).from(patientPortalSessions).where(and(eq(patientPortalSessions.id,id),eq(patientPortalSessions.accountId,account.id))).limit(1); if(!target)return NextResponse.json({error:'Session not found.'},{status:404}); await db.delete(patientPortalSessions).where(and(eq(patientPortalSessions.id,id),eq(patientPortalSessions.accountId,account.id))); const current=!!token&&target.tokenHash===hashSessionToken(token); await db.insert(auditEvents).values({actorId:`patient:${account.id}`,action:'PATIENT_PORTAL_SESSION_REVOKED',entityType:'patient_portal_session',entityId:id,details:{current}}); const res=NextResponse.json({data:{revoked:true,current}}); if(current)res.cookies.set(PATIENT_PORTAL_COOKIE,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0}); return res; }
 catch(e){console.error('Patient session revoke failed',e);return NextResponse.json({error:'Unable to revoke session.'},{status:500});}
}
