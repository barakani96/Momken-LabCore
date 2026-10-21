import { NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse } from '@/core/http';
import { authorizeApi } from '@/lib/auth/api-guard';
import { can } from '@/lib/auth/permissions';
import { procurementUnitOfWork } from '@/modules/procurement/drizzle-repository';
import { approveOrder, cancelOrder } from '@/modules/procurement/use-cases';

const bodySchema = z.discriminatedUnion('action', [z.object({ action: z.literal('approve') }), z.object({ action: z.literal('cancel'), reason: z.string().trim().min(3).max(500) })]);
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authorizeApi(true, 'procurement.read', request); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Invalid order.' }, { status: 400 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  if (!(await can(auth.user, parsed.data.action === 'approve' ? 'procurement.approve' : 'procurement.manage'))) return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 });
  try {
    if (parsed.data.action === 'approve') await approveOrder(procurementUnitOfWork, auth.user.id, id); else await cancelOrder(procurementUnitOfWork, auth.user.id, id, parsed.data.reason);
    return NextResponse.json({ ok: true });
  } catch (e) { return errorResponse(e, 'Purchase order update'); }
}
