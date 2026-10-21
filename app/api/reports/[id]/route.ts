import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { labReports } from '@/db/schema';
import { authorizeApi } from '@/lib/auth/api-guard';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
 const auth=await authorizeApi(false,'results.read'); if('response' in auth)return auth.response;
 if(!process.env.DATABASE_URL)return NextResponse.json({error:'Database is not configured. Set DATABASE_URL and apply migrations.'},{status:503});
 const {id}=await params; try {const [report]=await db.select().from(labReports).where(eq(labReports.id,id)).limit(1);if(!report)return NextResponse.json({error:'Report not found.'},{status:404});return NextResponse.json({data:report});}catch(e){console.error('Report fetch failed',e);return NextResponse.json({error:'Unable to load report.'},{status:500});}
}
