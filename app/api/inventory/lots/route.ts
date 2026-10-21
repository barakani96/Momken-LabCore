import { NextResponse } from 'next/server';
import { z } from 'zod';
import { systemClock } from '@/core/errors';
import { errorResponse } from '@/core/http';
import { authorizeApi } from '@/lib/auth/api-guard';
import { inventoryUnitOfWork } from '@/modules/inventory/drizzle-repository';
import { receiveLot } from '@/modules/inventory/use-cases';

const receiveSchema = z.object({
  itemId: z.string().uuid(), lotNumber: z.string().trim().min(1).max(80), expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantity: z.number().int().min(1).max(10_000_000), storageLocation: z.string().trim().max(100).optional(), reference: z.string().trim().max(120).optional(), quarantineOnReceipt: z.boolean().optional()
});
export async function POST(request: Request) {
  const auth = await authorizeApi(true, 'inventory.manage', request); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  const parsed = receiveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid lot receipt.', issues: parsed.error.flatten() }, { status: 400 });
  try { const { lot } = await receiveLot(inventoryUnitOfWork, systemClock, auth.user.id, parsed.data); return NextResponse.json({ data: lot }, { status: 201 }); } catch (e) { return errorResponse(e, 'Lot receipt'); }
}
