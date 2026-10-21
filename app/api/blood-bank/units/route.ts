import { NextResponse } from 'next/server';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { auditEvents, bloodDonations, bloodDonors, bloodUnits } from '@/db/schema';
import { authorizeApi } from '@/lib/auth/api-guard';
const groups = ['O-','O+','A-','A+','B-','B+','AB-','AB+'] as const;
const components = ['Whole blood','Red cells','Platelets','Plasma','Cryoprecipitate'] as const;
const unavailable = () => NextResponse.json({ error: 'Database is not configured. Set DATABASE_URL and apply migrations.' }, { status: 503 });
export async function GET(request: Request) {
 const auth = await authorizeApi(false, 'bloodbank.read'); if ('response' in auth) return auth.response;
 if (!process.env.DATABASE_URL) return unavailable();
 const url = new URL(request.url); const q = (url.searchParams.get('q') ?? '').trim().slice(0,80); const status = url.searchParams.get('status');
 try {
  const rows = await db.select({ id:bloodUnits.id, unitNumber:bloodUnits.unitNumber, donationNumber:bloodDonations.donationNumber, donorNumber:bloodDonors.donorNumber, donorName:bloodDonors.givenName, donorFamilyName:bloodDonors.familyName, componentType:bloodUnits.componentType, bloodGroup:bloodUnits.bloodGroup, collectedAt:bloodUnits.collectedAt, expiresAt:bloodUnits.expiresAt, storageLocation:bloodUnits.storageLocation, status:bloodUnits.status, screeningStatus:bloodUnits.screeningStatus })
   .from(bloodUnits).innerJoin(bloodDonations,eq(bloodUnits.donationId,bloodDonations.id)).innerJoin(bloodDonors,eq(bloodDonations.donorId,bloodDonors.id))
   .where(and(status && ['Quarantined','Available','Reserved','Issued','Transfused','Discarded','Expired'].includes(status) ? eq(bloodUnits.status,status) : undefined, q ? or(ilike(bloodUnits.unitNumber,`%${q}%`),ilike(bloodDonors.donorNumber,`%${q}%`),ilike(bloodDonations.donationNumber,`%${q}%`)) : undefined))
   .orderBy(desc(bloodUnits.createdAt)).limit(300);
  return NextResponse.json({data:rows});
 } catch(e) { console.error('Blood inventory query failed',e); return NextResponse.json({error:'Unable to load blood inventory.'},{status:500}); }
}
const schema = z.object({ donorNumber:z.string().trim().min(2).max(32), donationNumber:z.string().trim().min(3).max(40), unitNumber:z.string().trim().min(3).max(48), componentType:z.enum(components), bloodGroup:z.enum(groups), collectedAt:z.string().datetime(), expiresAt:z.string().datetime(), collectionSite:z.string().trim().min(2).max(160), storageLocation:z.string().trim().min(2).max(120) }).refine(v=>new Date(v.expiresAt)>new Date(v.collectedAt),{message:'Expiry must be after collection.',path:['expiresAt']});
export async function POST(request:Request) {
 const auth=await authorizeApi(false,'bloodbank.manage',request); if('response' in auth)return auth.response;
 if(!process.env.DATABASE_URL)return unavailable();
 const parsed=schema.safeParse(await request.json().catch(()=>null)); if(!parsed.success)return NextResponse.json({error:'Invalid blood unit.',issues:parsed.error.flatten()},{status:400}); const v=parsed.data;
 try {
  const created=await db.transaction(async tx=>{
   const [donor]=await tx.select().from(bloodDonors).where(eq(bloodDonors.donorNumber,v.donorNumber)).limit(1);
   if(!donor)throw Object.assign(new Error('Donor number not found.'),{statusCode:404});
   if(donor.eligibilityStatus!=='Eligible')throw Object.assign(new Error('Donation cannot be registered unless donor eligibility is Eligible.'),{statusCode:409});
   const [donation]=await tx.insert(bloodDonations).values({donationNumber:v.donationNumber,donorId:donor.id,collectedAt:new Date(v.collectedAt),collectionSite:v.collectionSite,screeningStatus:'Pending',createdBy:auth.user.id}).returning();
   const [unit]=await tx.insert(bloodUnits).values({unitNumber:v.unitNumber,donationId:donation.id,componentType:v.componentType,bloodGroup:v.bloodGroup,collectedAt:new Date(v.collectedAt),expiresAt:new Date(v.expiresAt),storageLocation:v.storageLocation,status:'Quarantined',screeningStatus:'Pending'}).returning();
   await tx.insert(auditEvents).values({actorId:auth.user.id,action:'BLOOD_UNIT_REGISTERED',entityType:'blood_unit',entityId:unit.id,details:{unitNumber:unit.unitNumber,donationNumber:donation.donationNumber,initialStatus:'Quarantined'}}); return unit;
  }); return NextResponse.json({data:created},{status:201});
 } catch(e) { const status=typeof e==='object'&&e&&'statusCode'in e?Number(e.statusCode):500; if(status!==500&&e instanceof Error)return NextResponse.json({error:e.message},{status}); if(typeof e==='object'&&e&&'code'in e&&(e as {code:string}).code==='23505')return NextResponse.json({error:'Donation or unit number already exists.'},{status:409}); console.error('Blood unit registration failed',e);return NextResponse.json({error:'Unable to register blood unit.'},{status:500}); }
}
