import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { auditEvents, qualityCases, qualityCaseEvents } from '@/db/schema';
import { authorizeApi } from '@/lib/auth/api-guard';

const types = ['Nonconformance', 'Incident', 'CAPA', 'Internal audit'] as const;
const severities = ['Low', 'Medium', 'High', 'Critical'] as const;
const statuses = ['Open', 'Investigating', 'Action planned', 'Verification', 'Closed', 'Cancelled'] as const;
const createSchema = z.object({
  title: z.string().trim().min(3).max(200), caseType: z.enum(types), severity: z.enum(severities).default('Medium'),
  description: z.string().trim().min(10).max(10000), source: z.string().trim().max(80).optional(),
  linkedEntityType: z.string().trim().max(80).optional(), linkedEntityId: z.string().trim().max(160).optional(),
  ownerId: z.string().uuid().optional(), dueDate: z.string().datetime().optional(),
});
const listSchema = z.object({ q: z.string().trim().max(160).optional(), status: z.enum(statuses).optional(), caseType: z.enum(types).optional(), severity: z.enum(severities).optional(), page: z.coerce.number().int().min(1).max(10000).default(1) });
function caseNumber() { return `QMS-${new Date().getUTCFullYear()}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`; }

export async function GET(request: Request) {
  const auth = await authorizeApi(false, 'quality.read', request); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  const parsed = listSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid quality filters.' }, { status: 400 });
  const { q, status, caseType, severity, page } = parsed.data;
  const filters = [];
  if (status) filters.push(eq(qualityCases.status, status));
  if (caseType) filters.push(eq(qualityCases.caseType, caseType));
  if (severity) filters.push(eq(qualityCases.severity, severity));
  if (q) filters.push(or(ilike(qualityCases.caseNumber, `%${q}%`), ilike(qualityCases.title, `%${q}%`), ilike(qualityCases.description, `%${q}%`), ilike(qualityCases.linkedEntityId, `%${q}%`))!);
  try {
    const rows = await db.select().from(qualityCases).where(filters.length ? and(...filters) : undefined).orderBy(desc(qualityCases.updatedAt)).limit(50).offset((page - 1) * 50);
    const ids = rows.map(row => row.id);
    const events = ids.length ? await db.select().from(qualityCaseEvents).where(or(...ids.map(id => eq(qualityCaseEvents.caseId, id)))!).orderBy(desc(qualityCaseEvents.occurredAt)) : [];
    return NextResponse.json({ data: rows, events, page, pageSize: 50, hasMore: rows.length === 50 });
  } catch (error) { console.error('Quality list failed', error); return NextResponse.json({ error: 'Unable to load quality cases.' }, { status: 500 }); }
}

export async function POST(request: Request) {
  const auth = await authorizeApi(true, 'quality.manage', request); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid quality case.', issues: parsed.error.flatten() }, { status: 400 });
  const value = parsed.data;
  try {
    const row = await db.transaction(async tx => {
      const [created] = await tx.insert(qualityCases).values({ caseNumber: caseNumber(), title: value.title, caseType: value.caseType, severity: value.severity, description: value.description, source: value.source, linkedEntityType: value.linkedEntityType, linkedEntityId: value.linkedEntityId, ownerId: value.ownerId, dueDate: value.dueDate ? new Date(value.dueDate) : undefined, createdBy: auth.user.id }).returning();
      await tx.insert(qualityCaseEvents).values({ caseId: created.id, actorId: auth.user.id, eventType: 'CASE_CREATED', toStatus: 'Open', notes: 'Quality case created.' });
      await tx.insert(auditEvents).values({ actorId: auth.user.id, action: 'QUALITY_CASE_CREATED', entityType: 'quality_case', entityId: created.id, details: { caseNumber: created.caseNumber, caseType: created.caseType, severity: created.severity } });
      return created;
    });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (error) { console.error('Quality create failed', error); return NextResponse.json({ error: 'Unable to create quality case.' }, { status: 500 }); }
}
