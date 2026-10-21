import { NextResponse } from 'next/server';
import { z } from 'zod';
import { systemClock } from '@/core/errors';
import { errorResponse } from '@/core/http';
import { authorizeApi } from '@/lib/auth/api-guard';
import { PO_STATUSES } from '@/modules/procurement/domain';
import { listOrders, procurementUnitOfWork } from '@/modules/procurement/drizzle-repository';
import { createOrder } from '@/modules/procurement/use-cases';

const createSchema = z.object({
  supplier: z.string().trim().min(2).max(160), currency: z.string().trim().toUpperCase().length(3),
  lines: z.array(z.object({ itemId: z.string().uuid(), orderedQty: z.number().int().min(1).max(10_000_000), unitPriceMinor: z.number().int().min(0).max(1_000_000_000_000) })).min(1).max(100)
});
export async function GET(request: Request) {
  const auth = await authorizeApi(false, 'procurement.read', request); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  const status = new URL(request.url).searchParams.get('status') ?? undefined;
  if (status && !(PO_STATUSES as readonly string[]).includes(status)) return NextResponse.json({ error: 'Invalid status filter.' }, { status: 400 });
  try { return NextResponse.json({ data: await listOrders(status) }); } catch (e) { return errorResponse(e, 'Purchase order list'); }
}
export async function POST(request: Request) {
  const auth = await authorizeApi(true, 'procurement.manage', request); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid purchase order.', issues: parsed.error.flatten() }, { status: 400 });
  try { return NextResponse.json({ data: await createOrder(procurementUnitOfWork, systemClock, auth.user.id, parsed.data) }, { status: 201 }); } catch (e) { return errorResponse(e, 'Purchase order create'); }
}
