// Seeds FICTIONAL inventory for demos. Never run against a production database.
// Requires DATABASE_URL, applied migrations and at least one active Admin user (see `npm run db:auth-admin`).
import { config } from 'dotenv';
config({ path: ['.env.local', '.env'] });
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index';
import { appUsers, inventoryItems, inventoryLots, inventoryMovements } from '../db/schema';

const iso = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const items = [
  { itemCode: 'CHEM-ALT-R1', name: 'ALT (GPT) reagent kit', category: 'Reagent', unit: 'tests', storageCondition: '2-8 C', reorderLevel: 400, supplier: 'Demo Diagnostics Co.' },
  { itemCode: 'CHEM-CRE-R1', name: 'Creatinine reagent kit', category: 'Reagent', unit: 'tests', storageCondition: '2-8 C', reorderLevel: 400, supplier: 'Demo Diagnostics Co.' },
  { itemCode: 'HEM-DIL-20L', name: 'Hematology diluent 20 L', category: 'Reagent', unit: 'containers', storageCondition: 'Room temperature', reorderLevel: 2, supplier: 'Demo Hematology Ltd.' },
  { itemCode: 'COAG-PT-R', name: 'PT thromboplastin reagent', category: 'Reagent', unit: 'tests', storageCondition: '2-8 C', reorderLevel: 200, supplier: 'Demo Hemostasis AG' },
  { itemCode: 'QC-CHEM-L2', name: 'Chemistry control, level 2', category: 'Control', unit: 'vials', storageCondition: '-20 C', reorderLevel: 6, supplier: 'Demo Controls Inc.' },
  { itemCode: 'CON-EDTA-4ML', name: 'EDTA collection tube 4 mL', category: 'Consumable', unit: 'tubes', storageCondition: 'Room temperature', reorderLevel: 1000, supplier: 'Demo Medical Supplies' }
] as const;
const lots = [
  { itemCode: 'CHEM-ALT-R1', lotNumber: 'A24-0917', days: 25, qty: 150 }, { itemCode: 'CHEM-ALT-R1', lotNumber: 'A25-0214', days: 210, qty: 800 },
  { itemCode: 'CHEM-CRE-R1', lotNumber: 'C25-0102', days: 120, qty: 300 },
  { itemCode: 'HEM-DIL-20L', lotNumber: 'HD-7731', days: 300, qty: 6 },
  { itemCode: 'COAG-PT-R', lotNumber: 'PT-2290', days: 60, qty: 500 },
  { itemCode: 'QC-CHEM-L2', lotNumber: 'QC-L2-118', days: 90, qty: 10 },
  { itemCode: 'CON-EDTA-4ML', lotNumber: 'ED-55120', days: 400, qty: 5000 }
];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
  const [admin] = await db.select().from(appUsers).where(and(eq(appUsers.role, 'Admin'), eq(appUsers.active, true))).limit(1);
  if (!admin) throw new Error('Create an Admin user first (npm run db:auth-admin).');
  await db.insert(inventoryItems).values(items.map(i => ({ ...i, createdBy: admin.id }))).onConflictDoNothing();
  const rows = await db.select().from(inventoryItems);
  for (const l of lots) {
    const item = rows.find(r => r.itemCode === l.itemCode); if (!item) continue;
    await db.transaction(async tx => {
      const [lot] = await tx.insert(inventoryLots).values({ itemId: item.id, lotNumber: l.lotNumber, expiryDate: iso(l.days), receivedQty: l.qty, onHandQty: l.qty, receivedBy: admin.id, storageLocation: 'Main store' }).onConflictDoNothing().returning();
      if (lot) await tx.insert(inventoryMovements).values({ lotId: lot.id, itemId: item.id, movementType: 'receive', quantityDelta: l.qty, balanceAfter: l.qty, reference: 'DEMO-SEED', actorId: admin.id });
    });
  }
  console.log('Inventory demo data seeded (fictional).');
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
