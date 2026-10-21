import { NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse } from '@/core/http';
import { authorizeApi } from '@/lib/auth/api-guard';
import { procurementUnitOfWork } from '@/modules/procurement/drizzle-repository';
import { receiveAgainstOrder } from '@/modules/procurement/use-cases';

const receiptSchema = z.object({
  lineId: z.string().uuid(), lotNumber: z.string().trim().min(1).max(80), expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), quantity: z.number().int().min(1).max(10_000_000),
  storageLocation: z.string().trim().max(100).optional(), reference: z.string().trim().max(120).optional(), quarantineOnReceipt: z.boolean().optional()
});
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authorizeApi(true, 'procurement.receive', request); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Invalid order.' }, { status: 400 });
  const parsed = receiptSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid receipt.', issues: parsed.error.flatten() }, { status: 400 });
  try { return NextResponse.json({ status: await receiveAgainstOrder(procurementUnitOfWork, auth.user.id, id, parsed.data) }, { status: 201 }); } catch (e) { return errorResponse(e, 'Purchase order receipt'); }
}
