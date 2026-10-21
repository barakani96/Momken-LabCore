'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, ContentSwitcher, DataTable, DataTableSkeleton, InlineNotification, Modal, NumberInput, Pagination, ProgressBar, Select, SelectItem, Switch, Table, TableBody, TableCell, TableContainer, TableExpandHeader, TableExpandRow, TableExpandedRow, TableHead, TableHeader, TableRow, TableToolbar, TableToolbarContent, TableToolbarSearch, TextArea, TextInput } from '@carbon/react';
import { Add, Renew, TrashCan } from '@carbon/icons-react';
import { useI18n } from '@/components/i18n-provider';
import { Ltr } from '@/components/ui/bidi';
import { KpiGrid, KpiTile } from '@/components/ui/kpi-tile';
import { PageHeader } from '@/components/ui/page-header';
import { StatusTag } from '@/components/ui/status-tag';
import { formatMinor, parseMajorToMinor } from '@/lib/money';
import { orderTotalMinor, outstandingQty } from '@/modules/procurement/domain';

type Line = { id: string; itemId: string; itemCode: string; itemName: string; unit: string; orderedQty: number; receivedQty: number; unitPriceMinor: number };
type Order = { id: string; poNumber: string; supplier: string; currency: string; status: string; createdBy: string; createdAt: string; lines: Line[] };
type CatalogItem = { id: string; itemCode: string; name: string; unit: string; active: boolean };
type DraftLine = { itemId: string; qty: number; price: string };
const FILTERS = [['All', 'الكل', ''], ['Draft', 'مسودة', 'Draft'], ['Approved', 'معتمد', 'Approved'], ['Partial', 'جزئي', 'Partially received'], ['Received', 'مستلم', 'Received']] as const;
const CURRENCIES = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'EGP', 'KWD'];

export function ProcurementWorkbench() {
  const { locale } = useI18n(); const ar = locale === 'ar'; const L = (en: string, a: string) => (ar ? a : en);
  const [orders, setOrders] = useState<Order[]>([]); const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState(0); const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(10);
  const [modal, setModal] = useState<null | 'create' | 'receive' | 'cancel'>(null); const [target, setTarget] = useState<Order | null>(null);
  const [supplier, setSupplier] = useState(''); const [currency, setCurrency] = useState('USD'); const [draft, setDraft] = useState<DraftLine[]>([{ itemId: '', qty: 1, price: '' }]);
  const [rc, setRc] = useState({ lineId: '', lotNumber: '', expiryDate: '', quantity: 1, storageLocation: '', quarantineOnReceipt: false }); const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [a, b] = await Promise.all([fetch('/api/procurement/orders', { cache: 'no-store' }), fetch('/api/inventory/items', { cache: 'no-store' })]);
      const ad = await a.json().catch(() => ({})); const bd = await b.json().catch(() => ({}));
      if (!a.ok) throw new Error(ad.error || 'Unable to load purchase orders.');
      setOrders(ad.data ?? []); setCatalog(b.ok ? (bd.data ?? []) : []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load purchase orders.'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function send(url: string, method: string, body: unknown, done: string) {
    setSaving(true); setError(''); setNotice('');
    try {
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'The request was rejected.');
      setModal(null); setNotice(done); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'The request was rejected.'); } finally { setSaving(false); }
  }

  const statusFilter = FILTERS[filter][2];
  const filtered = useMemo(() => { const q = query.trim().toLowerCase(); return orders.filter(o => (!statusFilter || o.status === statusFilter) && (!q || o.poNumber.toLowerCase().includes(q) || o.supplier.toLowerCase().includes(q) || o.lines.some(l => l.itemCode.toLowerCase().includes(q) || l.itemName.toLowerCase().includes(q)))); }, [orders, query, statusFilter]);
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const kpi = useMemo(() => ({ draft: orders.filter(o => o.status === 'Draft').length, open: orders.filter(o => o.status === 'Approved' || o.status === 'Partially received').length, outstanding: orders.filter(o => o.status === 'Approved' || o.status === 'Partially received').reduce((n, o) => n + o.lines.reduce((m, l) => m + outstandingQty(l), 0), 0), received: orders.filter(o => o.status === 'Received').length }), [orders]);

  const draftMinor = draft.map(d => parseMajorToMinor(d.price || '0', currency)); const draftValid = supplier.trim().length >= 2 && draft.length > 0 && draft.every((d, i) => d.itemId && d.qty >= 1 && draftMinor[i] !== null) && new Set(draft.map(d => d.itemId)).size === draft.length;
  const draftTotal = draft.reduce((t, d, i) => t + d.qty * (draftMinor[i] ?? 0), 0);
  const openReceive = (o: Order) => { const line = o.lines.find(l => outstandingQty(l) > 0); setTarget(o); setRc({ lineId: line?.id ?? '', lotNumber: '', expiryDate: '', quantity: line ? outstandingQty(line) : 1, storageLocation: '', quarantineOnReceipt: false }); setError(''); setModal('receive'); };
  const receiveLine = target?.lines.find(l => l.id === rc.lineId);
  const money = (minor: number, cur: string) => formatMinor(minor, cur, locale);
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(ar ? 'ar-u-nu-latn' : 'en-GB', { dateStyle: 'medium' });
  const headers = [{ key: 'po', header: L('Order', 'الأمر') }, { key: 'supplier', header: L('Supplier', 'المورّد') }, { key: 'lines', header: L('Lines', 'البنود') }, { key: 'total', header: L('Total', 'الإجمالي') }, { key: 'created', header: L('Created', 'تاريخ الإنشاء') }, { key: 'status', header: L('Status', 'الحالة') }, { key: 'actions', header: L('Actions', 'الإجراءات') }];
  const rows = pageRows.map(o => ({ id: o.id, po: o.poNumber, supplier: o.supplier, lines: o.lines.length, total: '', created: o.createdAt, status: o.status, actions: '' }));

  return (
    <div>
      <PageHeader crumbs={[{ label: L('Enterprise', 'المؤسسة'), href: '/overview' }, { label: L('Procurement', 'المشتريات') }]} title={L('Procurement', 'المشتريات')} description={L('Purchase orders with separation of duties between author and approver. Receiving creates inventory lots and links every receipt to its order line.', 'أوامر شراء مع فصل المهام بين المُعِدّ والمعتمِد. يُنشئ الاستلام دفعات مخزون ويربط كل استلام ببند الأمر.')} />
      {error && !modal && <InlineNotification kind="error" lowContrast title={L('Action failed', 'تعذّر الإجراء')} subtitle={error} onCloseButtonClick={() => setError('')} />}
      {notice && <InlineNotification kind="success" lowContrast title={notice} onCloseButtonClick={() => setNotice('')} />}
      <KpiGrid>
        <KpiTile label={L('Awaiting approval', 'بانتظار الاعتماد')} value={kpi.draft} tone={kpi.draft > 0 ? 'warning' : undefined} />
        <KpiTile label={L('Open orders', 'أوامر مفتوحة')} value={kpi.open} />
        <KpiTile label={L('Units outstanding', 'وحدات متبقية')} value={kpi.outstanding} />
        <KpiTile label={L('Fully received', 'مستلمة بالكامل')} value={kpi.received} />
      </KpiGrid>
      {loading ? <DataTableSkeleton columnCount={8} rowCount={6} headers={headers} showToolbar={false} /> : (
        <DataTable rows={rows} headers={headers}>
          {({ rows: rs, headers: hs, getHeaderProps, getRowProps, getTableProps, getTableContainerProps }: any) => (
            <TableContainer title={L('Purchase orders', 'أوامر الشراء')} description={L('Expand an order to see line progress.', 'وسّع الأمر لعرض تقدم البنود.')} {...getTableContainerProps()}>
              <TableToolbar>
                <TableToolbarContent>
                  <TableToolbarSearch persistent placeholder={L('Search order, supplier or item', 'ابحث بالأمر أو المورّد أو الصنف')} onChange={(_e: unknown, v?: string) => { setQuery(typeof v === 'string' ? v : ''); setPage(1); }} />
                  <Button kind="ghost" hasIconOnly iconDescription={L('Refresh', 'تحديث')} renderIcon={Renew} tooltipPosition="bottom" onClick={() => void load()} />
                  <Button renderIcon={Add} disabled={catalog.length === 0} onClick={() => { setError(''); setDraft([{ itemId: catalog.find(c => c.active)?.id ?? '', qty: 1, price: '' }]); setSupplier(''); setModal('create'); }}>{L('New purchase order', 'أمر شراء جديد')}</Button>
                </TableToolbarContent>
              </TableToolbar>
              <div style={{ padding: '0.5rem 1rem' }}>
                <ContentSwitcher size="sm" selectedIndex={filter} onChange={({ index }: { index?: number }) => { setFilter(index ?? 0); setPage(1); }}>
                  {FILTERS.map(f => <Switch key={f[0]} name={f[0]} text={ar ? f[1] : f[0]} />)}
                </ContentSwitcher>
              </div>
              <Table {...getTableProps()}>
                <TableHead><TableRow><TableExpandHeader />{hs.map((h: any) => { const { key, ...rest } = getHeaderProps({ header: h }); return <TableHeader key={key} {...rest}>{h.header}</TableHeader>; })}</TableRow></TableHead>
                <TableBody>
                  {rs.length === 0 && <TableRow><TableCell colSpan={8}>{orders.length === 0 ? L('No purchase orders yet. Create the first order from your inventory items.', 'لا توجد أوامر شراء بعد. أنشئ أول أمر من أصناف المخزون.') : L('No orders match the filters.', 'لا توجد أوامر مطابقة للمرشحات.')}</TableCell></TableRow>}
                  {rs.map((row: any) => { const o = orders.find(x => x.id === row.id)!; const { key, ...rowProps } = getRowProps({ row });
                    return [
                      <TableExpandRow key={key} {...rowProps}>
                        <TableCell><Ltr>{o.poNumber}</Ltr></TableCell><TableCell>{o.supplier}</TableCell><TableCell><Ltr>{o.lines.length}</Ltr></TableCell><TableCell><Ltr>{money(orderTotalMinor(o.lines), o.currency)}</Ltr></TableCell><TableCell>{fmtDate(o.createdAt)}</TableCell>
                        <TableCell><StatusTag status={o.status} locale={locale} /></TableCell>
                        <TableCell>
                          {o.status === 'Draft' && <Button size="sm" kind="ghost" onClick={() => void send(`/api/procurement/orders/${o.id}`, 'PATCH', { action: 'approve' }, L('Order approved.', 'تم اعتماد الأمر.'))}>{L('Approve', 'اعتماد')}</Button>}
                          {(o.status === 'Approved' || o.status === 'Partially received') && <Button size="sm" kind="ghost" onClick={() => openReceive(o)}>{L('Receive', 'استلام')}</Button>}
                          {(o.status === 'Draft' || o.status === 'Approved') && <Button size="sm" kind="danger--ghost" onClick={() => { setTarget(o); setReason(''); setError(''); setModal('cancel'); }}>{L('Cancel', 'إلغاء')}</Button>}
                        </TableCell>
                      </TableExpandRow>,
                      <TableExpandedRow key={`${key}-x`} colSpan={hs.length + 1}>
                        <Table size="sm" aria-label={L('Order lines', 'بنود الأمر')}>
                          <TableHead><TableRow><TableHeader>{L('Item', 'الصنف')}</TableHeader><TableHeader>{L('Unit price', 'سعر الوحدة')}</TableHeader><TableHeader>{L('Ordered', 'المطلوب')}</TableHeader><TableHeader>{L('Received', 'المستلم')}</TableHeader><TableHeader>{L('Progress', 'التقدم')}</TableHeader></TableRow></TableHead>
                          <TableBody>{o.lines.map(l => <TableRow key={l.id}><TableCell>{l.itemName} <Ltr>{l.itemCode}</Ltr></TableCell><TableCell><Ltr>{money(l.unitPriceMinor, o.currency)}</Ltr></TableCell><TableCell><Ltr>{l.orderedQty}</Ltr> {l.unit}</TableCell><TableCell><Ltr>{l.receivedQty}</Ltr></TableCell><TableCell><ProgressBar size="small" label={`${l.itemCode} ${L('received', 'مستلم')}`} hideLabel value={l.receivedQty} max={l.orderedQty} status={l.receivedQty >= l.orderedQty ? 'finished' : 'active'} /></TableCell></TableRow>)}</TableBody>
                        </Table>
                      </TableExpandedRow>
                    ]; })}
                </TableBody>
              </Table>
              <Pagination page={page} pageSize={pageSize} pageSizes={[10, 25, 50]} totalItems={filtered.length} itemsPerPageText={L('Items per page', 'عدد العناصر في الصفحة')} onChange={({ page: p, pageSize: s }: { page: number; pageSize: number }) => { setPage(p); setPageSize(s); }} />
            </TableContainer>
          )}
        </DataTable>
      )}

      <Modal open={modal === 'create'} size="md" modalHeading={L('New purchase order', 'أمر شراء جديد')} primaryButtonText={L('Create draft', 'إنشاء مسودة')} secondaryButtonText={L('Cancel', 'إلغاء')} primaryButtonDisabled={saving || !draftValid} onRequestClose={() => setModal(null)}
        onRequestSubmit={() => void send('/api/procurement/orders', 'POST', { supplier, currency, lines: draft.map((d, i) => ({ itemId: d.itemId, orderedQty: d.qty, unitPriceMinor: draftMinor[i] })) }, L('Draft order created. A second person must approve it.', 'تم إنشاء مسودة الأمر. يجب أن يعتمدها شخص آخر.'))}>
        {error && <InlineNotification kind="error" lowContrast hideCloseButton title={L('Action failed', 'تعذّر الإجراء')} subtitle={error} />}
        <TextInput id="po-supplier" labelText={L('Supplier', 'المورّد')} value={supplier} onChange={e => setSupplier(e.target.value)} />
        <Select id="po-currency" labelText={L('Currency', 'العملة')} value={currency} onChange={e => setCurrency(e.target.value)}>{CURRENCIES.map(c => <SelectItem key={c} value={c} text={c} />)}</Select>
        {draft.map((d, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end', marginBlockStart: '1rem' }}>
            <Select id={`po-item-${i}`} labelText={i === 0 ? L('Item', 'الصنف') : ''} hideLabel={i !== 0} value={d.itemId} invalid={!!d.itemId && draft.filter(x => x.itemId === d.itemId).length > 1} invalidText={L('Duplicate item', 'صنف مكرر')} onChange={e => setDraft(draft.map((x, j) => (j === i ? { ...x, itemId: e.target.value } : x)))}>
              <SelectItem value="" text={L('Select an item', 'اختر صنفًا')} />{catalog.filter(c => c.active).map(c => <SelectItem key={c.id} value={c.id} text={`${c.itemCode} — ${c.name}`} />)}
            </Select>
            <NumberInput id={`po-qty-${i}`} label={i === 0 ? L('Quantity', 'الكمية') : ''} hideLabel={i !== 0} min={1} step={1} value={d.qty} onChange={(_e: unknown, v: { value: string | number }) => setDraft(draft.map((x, j) => (j === i ? { ...x, qty: Math.trunc(Number(v.value) || 0) } : x)))} />
            <TextInput id={`po-price-${i}`} labelText={i === 0 ? L('Unit price', 'سعر الوحدة') : ''} hideLabel={i !== 0} inputMode="decimal" placeholder="0.00" value={d.price} invalid={draftMinor[i] === null} invalidText={L('Invalid amount', 'مبلغ غير صالح')} onChange={e => setDraft(draft.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
            <Button kind="ghost" hasIconOnly size="md" iconDescription={L('Remove line', 'حذف البند')} renderIcon={TrashCan} disabled={draft.length === 1} onClick={() => setDraft(draft.filter((_, j) => j !== i))} />
          </div>
        ))}
        <Button kind="tertiary" size="sm" renderIcon={Add} style={{ marginBlockStart: '1rem' }} onClick={() => setDraft([...draft, { itemId: '', qty: 1, price: '' }])}>{L('Add line', 'إضافة بند')}</Button>
        <p className="cds--type-productive-heading-03" style={{ marginBlockStart: '1rem' }}>{L('Total', 'الإجمالي')}: <Ltr>{money(draftTotal, currency)}</Ltr></p>
      </Modal>

      <Modal open={modal === 'receive'} size="sm" modalHeading={`${L('Receive stock', 'استلام مخزون')} — ${target?.poNumber ?? ''}`} primaryButtonText={L('Receive', 'استلام')} secondaryButtonText={L('Cancel', 'إلغاء')} primaryButtonDisabled={saving || !rc.lineId || !rc.lotNumber.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(rc.expiryDate) || rc.quantity < 1 || (!!receiveLine && rc.quantity > outstandingQty(receiveLine))} onRequestClose={() => setModal(null)}
        onRequestSubmit={() => target && void send(`/api/procurement/orders/${target.id}/receipts`, 'POST', { ...rc, storageLocation: rc.storageLocation || undefined }, L('Stock received into inventory.', 'تم استلام المخزون.'))}>
        {error && <InlineNotification kind="error" lowContrast hideCloseButton title={L('Action failed', 'تعذّر الإجراء')} subtitle={error} />}
        <Select id="rc-line" labelText={L('Order line', 'بند الأمر')} value={rc.lineId} onChange={e => { const l = target?.lines.find(x => x.id === e.target.value); setRc({ ...rc, lineId: e.target.value, quantity: l ? outstandingQty(l) : 1 }); }}>
          {target?.lines.filter(l => outstandingQty(l) > 0).map(l => <SelectItem key={l.id} value={l.id} text={`${l.itemCode} — ${L('outstanding', 'المتبقي')} ${outstandingQty(l)} ${l.unit}`} />)}
        </Select>
        <TextInput id="rc-lot" labelText={L('Lot number', 'رقم الدفعة')} value={rc.lotNumber} onChange={e => setRc({ ...rc, lotNumber: e.target.value })} />
        <TextInput id="rc-exp" type="date" labelText={L('Expiry date', 'تاريخ الانتهاء')} value={rc.expiryDate} onChange={e => setRc({ ...rc, expiryDate: e.target.value })} />
        <NumberInput id="rc-qty" label={L('Quantity received', 'الكمية المستلمة')} min={1} max={receiveLine ? outstandingQty(receiveLine) : undefined} step={1} value={rc.quantity} invalid={!!receiveLine && rc.quantity > outstandingQty(receiveLine)} invalidText={L('Exceeds the outstanding quantity', 'تتجاوز الكمية المتبقية')} onChange={(_e: unknown, v: { value: string | number }) => setRc({ ...rc, quantity: Math.trunc(Number(v.value) || 0) })} />
        <TextInput id="rc-loc" labelText={L('Storage location (optional)', 'موقع التخزين (اختياري)')} value={rc.storageLocation} onChange={e => setRc({ ...rc, storageLocation: e.target.value })} />
        <Checkbox id="rc-q" labelText={L('Hold in quarantine until released', 'احتجاز الدفعة حتى الإفراج عنها')} checked={rc.quarantineOnReceipt} onChange={(_e: unknown, { checked }: { checked: boolean }) => setRc({ ...rc, quarantineOnReceipt: checked })} />
      </Modal>

      <Modal open={modal === 'cancel'} size="xs" danger modalHeading={`${L('Cancel order', 'إلغاء الأمر')} — ${target?.poNumber ?? ''}`} primaryButtonText={L('Cancel order', 'إلغاء الأمر')} secondaryButtonText={L('Keep order', 'الإبقاء على الأمر')} primaryButtonDisabled={saving || reason.trim().length < 3} onRequestClose={() => setModal(null)}
        onRequestSubmit={() => target && void send(`/api/procurement/orders/${target.id}`, 'PATCH', { action: 'cancel', reason }, L('Order cancelled.', 'تم إلغاء الأمر.'))}>
        {error && <InlineNotification kind="error" lowContrast hideCloseButton title={L('Action failed', 'تعذّر الإجراء')} subtitle={error} />}
        <TextArea id="po-cancel-reason" labelText={L('Reason (required)', 'السبب (مطلوب)')} rows={3} value={reason} onChange={e => setReason(e.target.value)} />
      </Modal>
    </div>
  );
}
