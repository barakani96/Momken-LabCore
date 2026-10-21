import { NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse } from '@/core/http';
import { authorizeApi } from '@/lib/auth/api-guard';
import { ITEM_CATEGORIES, STORAGE_CONDITIONS } from '@/lib/inventory';
import { inventoryUnitOfWork, listStock } from '@/modules/inventory/drizzle-repository';
import { createItem } from '@/modules/inventory/use-cases';

const createSchema = z.object({
  itemCode: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/),
  name: z.string().trim().min(2).max(200), category: z.enum(ITEM_CATEGORIES), unit: z.string().trim().min(1).max(24),
  storageCondition: z.enum(STORAGE_CONDITIONS), reorderLevel: z.number().int().min(0).max(1_000_000), supplier: z.string().trim().max(160).optional()
});

export async function GET(request: Request) {
  const auth = await authorizeApi(false, 'inventory.read', request); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  try { const now = new Date(); return NextResponse.json({ ...(await listStock(now)), asOf: now.toISOString() }); } catch (e) { return errorResponse(e, 'Inventory load'); }
}
export async function POST(request: Request) {
  const auth = await authorizeApi(true, 'inventory.manage', request); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid inventory item.', issues: parsed.error.flatten() }, { status: 400 });
  try { const v = parsed.data; return NextResponse.json({ data: await createItem(inventoryUnitOfWork, auth.user.id, { ...v, supplier: v.supplier || null }) }, { status: 201 }); } catch (e) { return errorResponse(e, 'Inventory item create'); }
}
