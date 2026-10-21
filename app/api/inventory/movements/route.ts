import { NextResponse } from 'next/server';
import { z } from 'zod';
import { systemClock } from '@/core/errors';
import { errorResponse } from '@/core/http';
import { authorizeApi } from '@/lib/auth/api-guard';
import { can, type Permission } from '@/lib/auth/permissions';
import { inventoryUnitOfWork, listMovements } from '@/modules/inventory/drizzle-repository';
import { recordMovement } from '@/modules/inventory/use-cases';

const movementSchema = z.object({
  type: z.enum(['consume', 'adjust', 'discard', 'quarantine', 'release']), lotId: z.string().uuid().optional(), itemId: z.string().uuid().optional(),
  quantity: z.number().int().min(-10_000_000).max(10_000_000).default(0), reason: z.string().trim().max(500).optional(), reference: z.string().trim().max(120).optional()
});
export async function GET(request: Request) {
  const auth = await authorizeApi(false, 'inventory.read', request); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  const lotId = new URL(request.url).searchParams.get('lotId') ?? undefined;
  if (lotId && !z.string().uuid().safeParse(lotId).success) return NextResponse.json({ error: 'Invalid lot.' }, { status: 400 });
  try { return NextResponse.json({ data: await listMovements(lotId) }); } catch (e) { return errorResponse(e, 'Stock ledger'); }
}
export async function POST(request: Request) {
  const auth = await authorizeApi(true, 'inventory.read', request); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  const parsed = movementSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid stock movement.', issues: parsed.error.flatten() }, { status: 400 });
  const needed: Permission = parsed.data.type === 'consume' ? 'inventory.consume' : 'inventory.manage';
  if (!(await can(auth.user, needed))) return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 });
  try { return NextResponse.json({ data: await recordMovement(inventoryUnitOfWork, systemClock, auth.user.id, parsed.data) }, { status: 201 }); } catch (e) { return errorResponse(e, 'Stock movement'); }
}
