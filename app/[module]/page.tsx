import Link from 'next/link';
import { Tile, Button } from '@carbon/react';
const modules: Record<string, { title: string; description: string }> = {
  overview: { title: 'Operations overview', description: 'The enterprise overview will consolidate laboratory throughput, turnaround time, finance, and operational alerts.' },
  orders: { title: 'Orders & accessioning', description: 'Order intake, identity matching, collection tracking, barcode printing, and accession exception handling.' },
  results: { title: 'Results & validation', description: 'Structured result entry, technical review, authorization, critical-result handling, and controlled report release.' },
  catalog: { title: 'Test catalog', description: 'Manage test definitions, panels, specimen requirements, methods, units, and versioned reference intervals.' },
  quality: { title: 'Quality control', description: 'Quality-control runs, lot tracking, Westgard rule configuration, nonconformances, and corrective actions.' },
  finance: { title: 'Finance', description: 'Chart of accounts, journals, payables, receivables, period close, and financial reporting.' },
  procurement: { title: 'Procurement', description: 'Supplier records, requisitions, purchase orders, approvals, and receiving.' },
  inventory: { title: 'Inventory', description: 'Reagent and consumable lots, expiry monitoring, stock movements, and replenishment.' },
  people: { title: 'People & organization', description: 'Organization structure, staff records, roles, departments, and competency tracking.' },
  settings: { title: 'Administration', description: 'Identity integration, permission policies, site configuration, audit review, and system controls.' }
};
export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const item = modules[module];
  if (!item) return <div><h1>Page not found</h1><Button href="/worklist">Return to worklist</Button></div>;
  return <><div className="eyebrow">NORTHSTAR / ENTERPRISE</div><h1 style={{ fontWeight: 400, marginTop: '1rem' }}>{item.title}</h1><p className="page-description">{item.description}</p><Tile style={{ marginTop: '2rem', maxWidth: '760px', padding: '2rem' }}><h3 style={{ marginBottom: '1rem' }}>Planned module</h3><p style={{ lineHeight: 1.6, marginBottom: '1.5rem' }}>This navigation destination is registered, but its operational workflows are scheduled for a later tested increment. No placeholder actions are presented as completed functionality.</p><Link href="/worklist">Return to specimen worklist</Link></Tile></>;
}
