import { and, desc, gte, ilike, lte, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { auditEvents, authEvents } from '@/db/schema';
import { authorizeApi } from '@/lib/auth/api-guard';

const querySchema = z.object({
  q: z.string().trim().max(160).optional(),
  source: z.enum(['audit', 'auth']).default('audit'),
  format: z.enum(['json', 'csv']).default('json'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
}).refine((value) => !value.from || !value.to || new Date(value.from) <= new Date(value.to), {
  message: '`from` must be before or equal to `to`', path: ['from'],
});

function csvCell(value: unknown): string {
  let text = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  // Neutralize spreadsheet formula injection, including after leading whitespace.
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
function csvResponse(filename: string, headers: string[], rows: unknown[][], truncated = false) {
  const content = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  return new NextResponse(`\uFEFF${content}\r\n`, { headers: {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...(truncated ? { 'X-Export-Truncated': 'true' } : {}),
  } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid audit filters.', issues: parsed.error.flatten() }, { status: 400 });
  const { q, source, format, page, from, to } = parsed.data;
  const auth = await authorizeApi(false, format === 'csv' ? 'audit.export' : 'audit.read', request);
  if ('response' in auth) return auth.response;
  const limit = format === 'csv' ? 5000 : 50;
  const offset = format === 'csv' ? 0 : (page - 1) * limit;

  if (source === 'auth') {
    const filters = [];
    if (from) filters.push(gte(authEvents.occurredAt, new Date(from)));
    if (to) filters.push(lte(authEvents.occurredAt, new Date(to)));
    if (q) filters.push(or(ilike(authEvents.emailAttempted, `%${q}%`), ilike(authEvents.eventType, `%${q}%`), ilike(authEvents.outcome, `%${q}%`))!);
    const events = await db.select({ id: authEvents.id, actorId: authEvents.userId, action: authEvents.eventType, outcome: authEvents.outcome, entityType: authEvents.emailAttempted, ipHash: authEvents.ipHash, userAgent: authEvents.userAgent, occurredAt: authEvents.occurredAt }).from(authEvents).where(filters.length ? and(...filters) : undefined).orderBy(desc(authEvents.occurredAt)).limit(limit + (format === 'csv' ? 1 : 0)).offset(offset);
    if (format === 'csv') return csvResponse('northstar-auth-audit.csv', ['id','actor_id','action','outcome','email_attempted','ip_hash','user_agent','occurred_at'], events.slice(0, limit).map(e => [e.id,e.actorId,e.action,e.outcome,e.entityType,e.ipHash,e.userAgent,e.occurredAt?.toISOString()]), events.length > limit);
    return NextResponse.json({ source, events, page, pageSize: limit, hasMore: events.length === limit });
  }

  const filters = [];
  if (from) filters.push(gte(auditEvents.occurredAt, new Date(from)));
  if (to) filters.push(lte(auditEvents.occurredAt, new Date(to)));
  if (q) filters.push(or(ilike(auditEvents.actorId, `%${q}%`), ilike(auditEvents.action, `%${q}%`), ilike(auditEvents.entityType, `%${q}%`), ilike(auditEvents.entityId, `%${q}%`))!);
  const events = await db.select({ id: auditEvents.id, actorId: auditEvents.actorId, action: auditEvents.action, entityType: auditEvents.entityType, entityId: auditEvents.entityId, details: auditEvents.details, occurredAt: auditEvents.occurredAt, chainSeq: auditEvents.chainSeq, previousHash: auditEvents.previousHash, eventHash: auditEvents.eventHash }).from(auditEvents).where(filters.length ? and(...filters) : undefined).orderBy(desc(auditEvents.chainSeq)).limit(limit + (format === 'csv' ? 1 : 0)).offset(offset);
  if (format === 'csv') return csvResponse('northstar-audit-events.csv', ['id','chain_seq','actor_id','action','entity_type','entity_id','details','occurred_at','previous_hash','event_hash'], events.slice(0, limit).map(e => [e.id,e.chainSeq,e.actorId,e.action,e.entityType,e.entityId,e.details,e.occurredAt?.toISOString(),e.previousHash,e.eventHash]), events.length > limit);
  return NextResponse.json({ source, events, page, pageSize: limit, hasMore: events.length === limit });
}
