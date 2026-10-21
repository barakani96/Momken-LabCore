import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { auditEvents, controlledDocuments, controlledDocumentVersions, documentAcknowledgements } from '@/db/schema';
import { authorizeApi } from '@/lib/auth/api-guard';
const types = ['SOP','Policy','Form','Work instruction','Manual'] as const;
const statuses = ['Draft','In review','Approved','Obsolete'] as const;
const createSchema = z.object({ documentCode:z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/), title:z.string().trim().min(3).max(240), documentType:z.enum(types), department:z.string().trim().max(100).optional(), content:z.string().trim().min(20).max(50000), changeSummary:z.string().trim().min(3).max(2000), reviewDueAt:z.string().datetime().optional() });
const querySchema = z.object({ q:z.string().trim().max(160).optional(), status:z.enum(statuses).optional(), documentType:z.enum(types).optional() });
export async function GET(request:Request) {
 const auth=await authorizeApi(false,'documents.read',request); if('response' in auth)return auth.response;
 if(!process.env.DATABASE_URL)return NextResponse.json({error:'Database is not configured.'},{status:503});
 const parsed=querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams)); if(!parsed.success)return NextResponse.json({error:'Invalid document filters.'},{status:400});
 const f=[]; if(parsed.data.status)f.push(eq(controlledDocuments.status,parsed.data.status)); if(parsed.data.documentType)f.push(eq(controlledDocuments.documentType,parsed.data.documentType)); if(parsed.data.q)f.push(or(ilike(controlledDocuments.documentCode,`%${parsed.data.q}%`),ilike(controlledDocuments.title,`%${parsed.data.q}%`),ilike(controlledDocuments.department,`%${parsed.data.q}%`))!);
 try { const docs=await db.select().from(controlledDocuments).where(f.length?and(...f):undefined).orderBy(desc(controlledDocuments.updatedAt)).limit(200); const ids=docs.map(d=>d.id); const versions=ids.length?await db.select().from(controlledDocumentVersions).where(or(...ids.map(id=>eq(controlledDocumentVersions.documentId,id)))!).orderBy(desc(controlledDocumentVersions.versionNumber)):[]; const acknowledgements=ids.length?await db.select({documentId:documentAcknowledgements.documentId,versionNumber:documentAcknowledgements.versionNumber,userId:documentAcknowledgements.userId,acknowledgedAt:documentAcknowledgements.acknowledgedAt}).from(documentAcknowledgements).where(eq(documentAcknowledgements.userId,auth.user.id)):[]; return NextResponse.json({data:docs,versions,acknowledgements}); }
 catch(e){console.error('Document register failed',e);return NextResponse.json({error:'Unable to load controlled documents.'},{status:500});}
}
export async function POST(request:Request) {
 const auth=await authorizeApi(true,'documents.manage',request); if('response' in auth)return auth.response;
 if(!process.env.DATABASE_URL)return NextResponse.json({error:'Database is not configured.'},{status:503});
 const parsed=createSchema.safeParse(await request.json().catch(()=>null)); if(!parsed.success)return NextResponse.json({error:'Invalid controlled document.',issues:parsed.error.flatten()},{status:400}); const v=parsed.data;
 try { const result=await db.transaction(async tx=>{ const [doc]=await tx.insert(controlledDocuments).values({documentCode:v.documentCode,title:v.title,documentType:v.documentType,department:v.department,reviewDueAt:v.reviewDueAt?new Date(v.reviewDueAt):undefined,createdBy:auth.user.id}).returning(); const [version]=await tx.insert(controlledDocumentVersions).values({documentId:doc.id,versionNumber:1,content:v.content,changeSummary:v.changeSummary,createdBy:auth.user.id}).returning(); await tx.insert(auditEvents).values({actorId:auth.user.id,action:'DOCUMENT_CREATED',entityType:'controlled_document',entityId:doc.id,details:{documentCode:doc.documentCode,version:1}}); return {document:doc,version}; }); return NextResponse.json({data:result},{status:201}); }
 catch(e){console.error('Document create failed',e);return NextResponse.json({error:'Unable to create document. Check that the document code is unique.'},{status:500});}
}
