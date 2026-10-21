import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { auditEvents, patientPortalAccounts, patients } from '@/db/schema';
import { authorizeApi } from '@/lib/auth/api-guard';
const schema = z.object({ patientId: z.string().uuid(), email: z.string().email().max(254).transform(v=>v.trim().toLowerCase()) });
export async function GET(request: Request) {
 const auth = await authorizeApi(false, 'reports.portal.manage'); if ('response' in auth) return auth.response;
 if (!process.env.DATABASE_URL) return NextResponse.json({error:'Database is not configured.'},{status:503});
 const q = new URL(request.url).searchParams.get('q')?.trim().slice(0,100) ?? '';
 try { const rows = await db.select({id:patientPortalAccounts.id,patientId:patientPortalAccounts.patientId,email:patientPortalAccounts.email,active:patientPortalAccounts.active,createdAt:patientPortalAccounts.createdAt,lastLoginAt:patientPortalAccounts.lastLoginAt,patientNumber:patients.patientNumber,givenName:patients.givenName,familyName:patients.familyName}).from(patientPortalAccounts).innerJoin(patients,eq(patientPortalAccounts.patientId,patients.id)).where(q?or(ilike(patientPortalAccounts.email,`%${q}%`),ilike(patients.patientNumber,`%${q}%`),ilike(patients.familyName,`%${q}%`)):undefined).orderBy(desc(patientPortalAccounts.createdAt)).limit(100); return NextResponse.json({data:rows}); }
 catch(e){console.error('Portal accounts list failed',e);return NextResponse.json({error:'Unable to load portal accounts.'},{status:500});}
}
export async function POST(request: Request) {
 const auth = await authorizeApi(true, 'reports.portal.manage', request); if ('response' in auth) return auth.response;
 if (!process.env.DATABASE_URL) return NextResponse.json({error:'Database is not configured.'},{status:503});
 const parsed=schema.safeParse(await request.json().catch(()=>null)); if(!parsed.success)return NextResponse.json({error:'Enter a valid patient and email.'},{status:400});
 try {
  const [patient]=await db.select({id:patients.id,patientNumber:patients.patientNumber}).from(patients).where(eq(patients.id,parsed.data.patientId)).limit(1); if(!patient)return NextResponse.json({error:'Patient not found.'},{status:404});
  const token=randomBytes(32).toString('base64url'); const tokenHash=createHash('sha256').update(token).digest('hex'); const expiresAt=new Date(Date.now()+24*60*60*1000);
  const [account]=await db.insert(patientPortalAccounts).values({patientId:patient.id,email:parsed.data.email,activationTokenHash:tokenHash,activationExpiresAt:expiresAt,active:false,createdBy:auth.user.id}).onConflictDoNothing().returning({id:patientPortalAccounts.id,email:patientPortalAccounts.email,patientId:patientPortalAccounts.patientId});
  if(!account)return NextResponse.json({error:'An account already exists for this patient or email.'},{status:409});
  await db.insert(auditEvents).values({actorId:auth.user.id,action:'PATIENT_PORTAL_ACCOUNT_INVITED',entityType:'patient_portal_account',entityId:account.id,details:{patientNumber:patient.patientNumber,expiresAt:expiresAt.toISOString()}});
  return NextResponse.json({data:{...account,activationPath:`/patient-portal/activate?token=${token}`,expiresAt},warning:'Activation token is shown once. Verify patient identity before delivering it through an approved channel.'},{status:201});
 } catch(e){console.error('Portal account invite failed',e);return NextResponse.json({error:'Unable to create patient portal invitation.'},{status:500});}
}
