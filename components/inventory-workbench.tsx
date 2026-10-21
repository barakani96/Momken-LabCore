'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionableNotification, Button, DataTable, Table, TableBody, TableCell, TableContainer, TableExpandHeader, TableExpandRow, TableExpandedRow, TableHead, TableHeader, TableRow, TableToolbar, TableToolbarContent, TableToolbarSearch, Tabs, TabList, Tab, TabPanels, TabPanel, Tag, Tile, Modal, TextInput, TextArea, Select, SelectItem, NumberInput, Checkbox, InlineNotification, Pagination, DataTableSkeleton } from '@carbon/react';
import { Add, Renew, Download } from '@carbon/icons-react';
import { useI18n } from '@/components/i18n-provider';
import { PageHeader } from '@/components/ui/page-header';
import { KpiGrid, KpiTile } from '@/components/ui/kpi-tile';
import { StatusTag } from '@/components/ui/status-tag';
import { Ltr } from '@/components/ui/bidi';
import { ITEM_CATEGORIES, STORAGE_CONDITIONS, daysUntil, expiryState, type StockSummary } from '@/lib/inventory';

type Item = { id: string; itemCode: string; name: string; category: string; unit: string; storageCondition: string; reorderLevel: number; supplier: string | null; active: boolean; summary: StockSummary };
type Lot = { id: string; itemId: string; lotNumber: string; expiryDate: string; receivedQty: number; onHandQty: number; status: string; storageLocation: string | null; receivedAt: string };
type Movement = { id: number; lotId: string; movementType: string; quantityDelta: number; balanceAfter: number; reason: string | null; reference: string | null; occurredAt: string; lotNumber: string; itemCode: string; itemName: string };
type MovementKind = 'consume' | 'adjust' | 'discard' | 'quarantine' | 'release';

const typeLabels: Record<string, [string, string]> = { receive: ['Receive', 'استلام'], consume: ['Consume', 'استهلاك'], adjust: ['Adjust', 'تسوية'], discard: ['Discard', 'إتلاف'], quarantine: ['Quarantine', 'حجر'], release: ['Release', 'إفراج'] };
const categoryAr: Record<string, string> = { Reagent: 'كاشف', Calibrator: 'معايِر', Control: 'مادة ضبط', Consumable: 'مستهلكات', Kit: 'طقم' };
const storageAr: Record<string, string> = { 'Room temperature': 'درجة حرارة الغرفة', '2-8 C': '2–8 °م', '-20 C': '‎−20 °م', '-80 C': '‎−80 °م' };
const ltr = (v: string | number) => <Ltr>{v}</Ltr>;

export function InventoryWorkbench() {
  const { locale } = useI18n(); const ar = locale === 'ar'; const L = (en: string, a: string) => (ar ? a : en);
  const [items, setItems] = useState<Item[]>([]); const [lots, setLots] = useState<Lot[]>([]); const [ledger, setLedger] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [query, setQuery] = useState(''); const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(10); const [tab, setTab] = useState(0);
  const [modal, setModal] = useState<null | 'item' | 'receive' | 'movement'>(null);
  const [itemForm, setItemForm] = useState({ itemCode: '', name: '', category: 'Reagent', unit: 'tests', storageCondition: '2-8 C', reorderLevel: 0, supplier: '' });
  const [lotForm, setLotForm] = useState({ itemId: '', lotNumber: '', expiryDate: '', quantity: 1, storageLocation: '', reference: '', quarantineOnReceipt: false });
  const [mv, setMv] = useState<{ type: MovementKind; lotId: string; itemId: string; quantity: number; reason: string; reference: string }>({ type: 'consume', lotId: '', itemId: '', quantity: 1, reason: '', reference: '' });
  const now = useMemo(() => new Date(), [items, lots]);
  
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [a, b] = await Promise.all([fetch('/api/inventory/items', { cache: 'no-store' }), fetch('/api/inventory/movements', { cache: 'no-store' })]);
      const ad = await a.json().catch(() => ({})); const bd = await b.json().catch(() => ({}));
      if (!a.ok) throw new Error(ad.error || 'Unable to load inventory.'); if (!b.ok) throw new Error(bd.error || 'Unable to load the stock ledger.');
      setItems(ad.data ?? []); setLots(ad.lots ?? []); setLedger(bd.data ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load inventory.'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function submit(url: string, body: unknown, done: string) {
    setSaving(true); setError(''); setNotice('');
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'The request was rejected.');
      setModal(null); setNotice(done); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'The request was rejected.'); } finally { setSaving(false); }
  }

  const lotsByItem = useMemo(() => { const m = new Map<string, Lot[]>(); for (const l of lots) m.set(l.itemId, [...(m.get(l.itemId) ?? []), l]); return m; }, [lots]);
  const filtered = useMemo(() => { const q = query.trim().toLowerCase(); return q ? items.filter(i => [i.itemCode, i.name, i.category, i.supplier ?? ''].some(s => s.toLowerCase().includes(q))) : items; }, [items, query]);
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const kpi = useMemo(() => ({
    active: items.filter(i => i.active).length, low: items.filter(i => i.summary.belowReorder).length,
    soon: lots.filter(l => l.onHandQty > 0 && l.status !== 'Discarded' && expiryState(l.expiryDate, now) === 'Expiring soon').length,
    held: lots.filter(l => l.onHandQty > 0 && (l.status === 'Quarantined' || expiryState(l.expiryDate, now) === 'Expired')).length
  }), [items, lots, now]);

  function openMovement(type: MovementKind, lot: Lot) { setMv({ type, lotId: lot.id, itemId: '', quantity: type === 'consume' || type === 'discard' ? 1 : type === 'adjust' ? 1 : 0, reason: '', reference: '' }); setError(''); setModal('movement'); }
  function exportCsv() {
    const esc = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Item code', 'Item', 'Lot', 'Expiry', 'On hand', 'Status', 'Expiry state'], ...lots.map(l => { const it = items.find(i => i.id === l.itemId); return [it?.itemCode ?? '', it?.name ?? '', l.lotNumber, l.expiryDate, l.onHandQty, l.status, expiryState(l.expiryDate, now)]; })];
    const url = URL.createObjectURL(new Blob([rows.map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'inventory-lots.csv'; a.click(); URL.revokeObjectURL(url);
  }
  const lotTag = (l: Lot) => <StatusTag status={l.status === 'Available' && expiryState(l.expiryDate, now) === 'Expired' ? 'Expired' : l.status} locale={locale} />;
  const expiryTag = (l: Lot) => { if (l.onHandQty === 0 || l.status === 'Discarded') return null; const ex = expiryState(l.expiryDate, now); return ex === 'OK' || (ex === 'Expired' && l.status === 'Available') ? null : <StatusTag status={ex} locale={locale} suffix={ex === 'Expiring soon' ? `${daysUntil(l.expiryDate, now)} ${L('d', 'يوم')}` : undefined} />; };

  const itemHeaders = [{ key: 'code', header: L('Item code', 'رمز الصنف') }, { key: 'name', header: L('Item', 'الصنف') }, { key: 'category', header: L('Category', 'الفئة') }, { key: 'storage', header: L('Storage', 'التخزين') }, { key: 'usable', header: L('Usable stock', 'المخزون الصالح') }, { key: 'reorder', header: L('Reorder level', 'حد إعادة الطلب') }, { key: 'expiry', header: L('Nearest expiry', 'أقرب انتهاء') }, { key: 'status', header: L('Status', 'الحالة') }];
  const itemRows = pageRows.map(i => ({ id: i.id, code: i.itemCode, name: i.name, category: i.category, storage: i.storageCondition, usable: i.summary.usableQty, reorder: i.reorderLevel, expiry: i.summary.nearestUsableExpiry ?? '—', status: '' }));
  const lotHeaders = [{ key: 'item', header: L('Item', 'الصنف') }, { key: 'lot', header: L('Lot', 'الدفعة') }, { key: 'expiry', header: L('Expiry', 'الانتهاء') }, { key: 'onhand', header: L('On hand', 'الرصيد') }, { key: 'location', header: L('Location', 'الموقع') }, { key: 'status', header: L('Status', 'الحالة') }, { key: 'actions', header: L('Actions', 'الإجراءات') }];
  const lotRows = lots.map(l => ({ id: l.id, item: l.itemId, lot: l.lotNumber, expiry: l.expiryDate, onhand: l.onHandQty, location: l.storageLocation ?? '—', status: '', actions: '' }));
  const ledgerHeaders = [{ key: 'time', header: L('Time', 'الوقت') }, { key: 'item', header: L('Item', 'الصنف') }, { key: 'lot', header: L('Lot', 'الدفعة') }, { key: 'type', header: L('Movement', 'الحركة') }, { key: 'delta', header: L('Change', 'التغيّر') }, { key: 'balance', header: L('Balance', 'الرصيد') }, { key: 'reason', header: L('Reason / reference', 'السبب / المرجع') }];
  const ledgerRows = ledger.map(m => ({ id: String(m.id), time: m.occurredAt, item: m.itemName, lot: m.lotNumber, type: m.movementType, delta: m.quantityDelta, balance: m.balanceAfter, reason: m.reason ?? m.reference ?? '—' }));
  const itemById = (id: string) => items.find(i => i.id === id); const lotById = (id: string) => lots.find(l => l.id === id);
  const fmtTime = (iso: string) => new Date(iso).toLocaleString(ar ? 'ar-u-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const needsReason = mv.type !== 'consume'; const needsQty = mv.type !== 'quarantine' && mv.type !== 'release';

  return (
    <div>
      <PageHeader crumbs={[{ label: L('Enterprise', 'المؤسسة'), href: '/overview' }, { label: L('Inventory', 'المخزون') }]} title={L('Inventory & reagent control', 'المخزون وضبط الكواشف')} description={L('Lot-tracked reagents, calibrators, controls and consumables with first-expired-first-out consumption and an append-only stock ledger.', 'كواشف ومعايِرات ومواد ضبط ومستهلكات متتبَّعة بالدفعات مع الاستهلاك بقاعدة الأقدم انتهاءً أولًا وسجل حركات لا يقبل التعديل.')} />
      {error && !modal && <InlineNotification kind="error" lowContrast title={L('Action failed', 'تعذّر الإجراء')} subtitle={error} onCloseButtonClick={() => setError('')} />}
      {notice && <InlineNotification kind="success" lowContrast title={notice} onCloseButtonClick={() => setNotice('')} />}
      {!loading && kpi.low > 0 && (
        <ActionableNotification kind="warning" lowContrast hideCloseButton inline title={L(`${kpi.low} item(s) at or below reorder level`, `${kpi.low} صنف عند حد إعادة الطلب أو دونه`)} subtitle={items.filter(i => i.summary.belowReorder).slice(0, 3).map(i => i.itemCode).join(', ')} actionButtonLabel={L('Create purchase order', 'إنشاء أمر شراء')} onActionButtonClick={() => { window.location.href = '/procurement'; }} />
      )}
      <KpiGrid>
        <KpiTile label={L('Active items', 'الأصناف النشطة')} value={kpi.active} />
        <KpiTile label={L('Below reorder level', 'تحت حد إعادة الطلب')} value={kpi.low} tone={kpi.low > 0 ? 'warning' : undefined} />
        <KpiTile label={L('Lots expiring within 30 days', 'دفعات تنتهي خلال 30 يومًا')} value={kpi.soon} tone={kpi.soon > 0 ? 'warning' : undefined} />
        <KpiTile label={L('Quarantined or expired lots', 'دفعات محجورة أو منتهية')} value={kpi.held} tone={kpi.held > 0 ? 'error' : undefined} />
      </KpiGrid>
      <Tabs selectedIndex={tab} onChange={({ selectedIndex }: { selectedIndex: number }) => setTab(selectedIndex)}>
        <TabList aria-label={L('Inventory sections', 'أقسام المخزون')}><Tab>{L('Stock', 'المخزون')}</Tab><Tab>{L('Lots', 'الدفعات')}</Tab><Tab>{L('Stock ledger', 'سجل الحركات')}</Tab></TabList>
        <TabPanels>
          <TabPanel>
            {loading ? <DataTableSkeleton columnCount={8} rowCount={6} headers={itemHeaders} showToolbar={false} /> : (
              <DataTable rows={itemRows} headers={itemHeaders}>
                {({ rows, headers, getHeaderProps, getRowProps, getTableProps, getTableContainerProps }: any) => (
                  <TableContainer title={L('Item stock position', 'وضع مخزون الأصناف')} description={L('Expand an item to see its lots. Counts exclude expired and quarantined stock.', 'وسّع الصنف لعرض دفعاته. لا تشمل الأرصدة المخزون المنتهي أو المحجور.')} {...getTableContainerProps()}>
                    <TableToolbar>
                      <TableToolbarContent>
                        <TableToolbarSearch persistent placeholder={L('Search code, item, category or supplier', 'ابحث بالرمز أو الصنف أو الفئة أو المورّد')} onChange={(_e: unknown, v?: string) => { setQuery(typeof v === 'string' ? v : ''); setPage(1); }} />
                        <Button kind="ghost" hasIconOnly iconDescription={L('Refresh', 'تحديث')} renderIcon={Renew} tooltipPosition="bottom" onClick={() => void load()} />
                        <Button kind="ghost" hasIconOnly iconDescription={L('Export lots as CSV', 'تصدير الدفعات CSV')} renderIcon={Download} tooltipPosition="bottom" onClick={exportCsv} />
                        <Button kind="tertiary" renderIcon={Add} onClick={() => { setError(''); setModal('item'); }}>{L('New item', 'صنف جديد')}</Button>
                        <Button renderIcon={Add} disabled={items.length === 0} onClick={() => { setError(''); setLotForm(f => ({ ...f, itemId: f.itemId || items[0]?.id || '' })); setModal('receive'); }}>{L('Receive lot', 'استلام دفعة')}</Button>
                      </TableToolbarContent>
                    </TableToolbar>
                    <Table {...getTableProps()}>
                      <TableHead><TableRow><TableExpandHeader />{headers.map((h: any) => { const { key, ...rest } = getHeaderProps({ header: h }); return <TableHeader key={key} {...rest}>{h.header}</TableHeader>; })}</TableRow></TableHead>
                      <TableBody>
                        {rows.length === 0 && <TableRow><TableCell colSpan={9}>{items.length === 0 ? L('No inventory items yet. Create the first item to start tracking lots.', 'لا توجد أصناف بعد. أنشئ أول صنف لبدء تتبع الدفعات.') : L('No items match the search.', 'لا توجد أصناف مطابقة للبحث.')}</TableCell></TableRow>}
                        {rows.map((row: any) => { const it = itemById(row.id)!; const itemLots = lotsByItem.get(it.id) ?? []; const { key, ...rowProps } = getRowProps({ row });
                          return [
                            <TableExpandRow key={key} {...rowProps}>
                              <TableCell>{ltr(it.itemCode)}</TableCell><TableCell>{it.name}</TableCell><TableCell>{ar ? categoryAr[it.category] ?? it.category : it.category}</TableCell><TableCell>{ar ? storageAr[it.storageCondition] ?? it.storageCondition : it.storageCondition}</TableCell>
                              <TableCell>{ltr(it.summary.usableQty)} {it.unit}</TableCell><TableCell>{ltr(it.reorderLevel)}</TableCell><TableCell>{it.summary.nearestUsableExpiry ? ltr(it.summary.nearestUsableExpiry) : '—'}</TableCell>
                              <TableCell>{!it.active ? <Tag type="gray" size="sm">{L('Inactive', 'غير نشط')}</Tag> : it.summary.usableQty === 0 ? <Tag type="red" size="sm">{L('Out of stock', 'نفد المخزون')}</Tag> : it.summary.belowReorder ? <Tag type="magenta" size="sm">{L('Reorder', 'إعادة طلب')}</Tag> : it.summary.expiringSoonQty > 0 ? <Tag type="warm-gray" size="sm">{L('Expiring soon', 'قارب على الانتهاء')}</Tag> : <Tag type="green" size="sm">{L('In stock', 'متوفر')}</Tag>}</TableCell>
                            </TableExpandRow>,
                            <TableExpandedRow key={`${key}-x`} colSpan={headers.length + 1}>
                              {itemLots.length === 0 ? <p>{L('No lots received for this item.', 'لم تُستلم دفعات لهذا الصنف.')}</p> : (
                                <Table size="sm" aria-label={L('Lots', 'الدفعات')}>
                                  <TableHead><TableRow><TableHeader>{L('Lot', 'الدفعة')}</TableHeader><TableHeader>{L('Expiry', 'الانتهاء')}</TableHeader><TableHeader>{L('On hand', 'الرصيد')}</TableHeader><TableHeader>{L('Status', 'الحالة')}</TableHeader></TableRow></TableHead>
                                  <TableBody>{itemLots.map(l => <TableRow key={l.id}><TableCell>{ltr(l.lotNumber)}</TableCell><TableCell>{ltr(l.expiryDate)}</TableCell><TableCell>{ltr(l.onHandQty)}</TableCell><TableCell>{lotTag(l)} {expiryTag(l)}</TableCell></TableRow>)}</TableBody>
                                </Table>
                              )}
                            </TableExpandedRow>
                          ]; })}
                      </TableBody>
                    </Table>
                    <Pagination page={page} pageSize={pageSize} pageSizes={[10, 25, 50]} totalItems={filtered.length} itemsPerPageText={L('Items per page', 'عدد العناصر في الصفحة')} onChange={({ page: p, pageSize: s }: { page: number; pageSize: number }) => { setPage(p); setPageSize(s); }} />
                  </TableContainer>
                )}
              </DataTable>
            )}
          </TabPanel>
          <TabPanel>
            {loading ? <DataTableSkeleton columnCount={7} rowCount={6} headers={lotHeaders} showToolbar={false} /> : (
              <DataTable rows={lotRows} headers={lotHeaders}>
                {({ rows, headers, getHeaderProps, getRowProps, getTableProps, getTableContainerProps }: any) => (
                  <TableContainer title={L('Lot register', 'سجل الدفعات')} description={L('Consume, adjust, discard or quarantine a specific lot. Each action requires the right permission and is written to the ledger and audit trail.', 'استهلك دفعة محددة أو سوِّها أو أتلفها أو احجرها. يتطلب كل إجراء الصلاحية المناسبة ويُسجَّل في الدفتر وسجل التدقيق.')} {...getTableContainerProps()}>
                    <Table {...getTableProps()}>
                      <TableHead><TableRow>{headers.map((h: any) => { const { key, ...rest } = getHeaderProps({ header: h }); return <TableHeader key={key} {...rest}>{h.header}</TableHeader>; })}</TableRow></TableHead>
                      <TableBody>
                        {rows.length === 0 && <TableRow><TableCell colSpan={7}>{L('No lots have been received.', 'لم تُستلم أي دفعات.')}</TableCell></TableRow>}
                        {rows.map((row: any) => { const l = lotById(row.id)!; const it = itemById(l.itemId); const { key, ...rowProps } = getRowProps({ row });
                          return <TableRow key={key} {...rowProps}>
                            <TableCell>{it ? `${it.name} ` : ''}{it && ltr(it.itemCode)}</TableCell><TableCell>{ltr(l.lotNumber)}</TableCell><TableCell>{ltr(l.expiryDate)}</TableCell><TableCell>{ltr(l.onHandQty)}</TableCell><TableCell>{l.storageLocation ?? '—'}</TableCell>
                            <TableCell>{lotTag(l)} {expiryTag(l)}</TableCell>
                            <TableCell>
                              <Button size="sm" kind="ghost" disabled={l.status !== 'Available' || l.onHandQty === 0} onClick={() => openMovement('consume', l)}>{L('Consume', 'استهلاك')}</Button>
                              <Button size="sm" kind="ghost" disabled={l.status === 'Discarded'} onClick={() => openMovement('adjust', l)}>{L('Adjust', 'تسوية')}</Button>
                              <Button size="sm" kind="ghost" disabled={l.status === 'Discarded' || l.onHandQty === 0} onClick={() => openMovement('discard', l)}>{L('Discard', 'إتلاف')}</Button>
                              {l.status === 'Quarantined' ? <Button size="sm" kind="ghost" onClick={() => openMovement('release', l)}>{L('Release', 'إفراج')}</Button> : <Button size="sm" kind="ghost" disabled={l.status !== 'Available'} onClick={() => openMovement('quarantine', l)}>{L('Quarantine', 'حجر')}</Button>}
                            </TableCell>
                          </TableRow>; })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </DataTable>
            )}
          </TabPanel>
          <TabPanel>
            {loading ? <DataTableSkeleton columnCount={7} rowCount={6} headers={ledgerHeaders} showToolbar={false} /> : (
              <DataTable rows={ledgerRows} headers={ledgerHeaders}>
                {({ rows, headers, getHeaderProps, getRowProps, getTableProps, getTableContainerProps }: any) => (
                  <TableContainer title={L('Stock ledger', 'سجل حركات المخزون')} description={L('Most recent 200 movements. Entries cannot be edited or deleted; corrections are new adjustment entries.', 'أحدث 200 حركة. لا يمكن تعديل الإدخالات أو حذفها؛ التصحيحات تُسجَّل كحركات تسوية جديدة.')} {...getTableContainerProps()}>
                    <Table {...getTableProps()}>
                      <TableHead><TableRow>{headers.map((h: any) => { const { key, ...rest } = getHeaderProps({ header: h }); return <TableHeader key={key} {...rest}>{h.header}</TableHeader>; })}</TableRow></TableHead>
                      <TableBody>
                        {rows.length === 0 && <TableRow><TableCell colSpan={7}>{L('No stock movements recorded.', 'لا توجد حركات مخزون مسجلة.')}</TableCell></TableRow>}
                        {rows.map((row: any) => { const m = ledger.find(x => String(x.id) === row.id)!; const { key, ...rowProps } = getRowProps({ row });
                          return <TableRow key={key} {...rowProps}><TableCell>{fmtTime(m.occurredAt)}</TableCell><TableCell>{m.itemName} {ltr(m.itemCode)}</TableCell><TableCell>{ltr(m.lotNumber)}</TableCell><TableCell>{ar ? typeLabels[m.movementType]?.[1] : typeLabels[m.movementType]?.[0]}</TableCell><TableCell>{ltr(m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta)}</TableCell><TableCell>{ltr(m.balanceAfter)}</TableCell><TableCell>{m.reason ?? m.reference ?? '—'}</TableCell></TableRow>; })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </DataTable>
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>

      <Modal open={modal === 'item'} size="sm" modalHeading={L('New inventory item', 'صنف مخزون جديد')} primaryButtonText={L('Create item', 'إنشاء الصنف')} secondaryButtonText={L('Cancel', 'إلغاء')} primaryButtonDisabled={saving || itemForm.itemCode.trim().length < 2 || itemForm.name.trim().length < 2 || !itemForm.unit.trim()} onRequestClose={() => setModal(null)} onRequestSubmit={() => void submit('/api/inventory/items', { ...itemForm, supplier: itemForm.supplier || undefined }, L('Inventory item created.', 'تم إنشاء صنف المخزون.'))}>
        {error && <InlineNotification kind="error" lowContrast hideCloseButton title={L('Action failed', 'تعذّر الإجراء')} subtitle={error} />}
        <TextInput id="inv-code" labelText={L('Item code', 'رمز الصنف')} value={itemForm.itemCode} onChange={e => setItemForm({ ...itemForm, itemCode: e.target.value })} />
        <TextInput id="inv-name" labelText={L('Item name', 'اسم الصنف')} value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} />
        <Select id="inv-cat" labelText={L('Category', 'الفئة')} value={itemForm.category} onChange={e => setItemForm({ ...itemForm, category: e.target.value })}>{ITEM_CATEGORIES.map(c => <SelectItem key={c} value={c} text={ar ? categoryAr[c] : c} />)}</Select>
        <TextInput id="inv-unit" labelText={L('Unit (tests, vials, boxes…)', 'الوحدة (فحوص، قوارير، علب…)')} value={itemForm.unit} onChange={e => setItemForm({ ...itemForm, unit: e.target.value })} />
        <Select id="inv-storage" labelText={L('Storage condition', 'شروط التخزين')} value={itemForm.storageCondition} onChange={e => setItemForm({ ...itemForm, storageCondition: e.target.value })}>{STORAGE_CONDITIONS.map(c => <SelectItem key={c} value={c} text={ar ? storageAr[c] : c} />)}</Select>
        <NumberInput id="inv-reorder" label={L('Reorder level', 'حد إعادة الطلب')} min={0} step={1} allowEmpty value={itemForm.reorderLevel} onChange={(_e: unknown, d: { value: string | number }) => setItemForm({ ...itemForm, reorderLevel: Math.max(0, Math.trunc(Number(d.value) || 0)) })} />
        <TextInput id="inv-supplier" labelText={L('Supplier (optional)', 'المورّد (اختياري)')} value={itemForm.supplier} onChange={e => setItemForm({ ...itemForm, supplier: e.target.value })} />
      </Modal>

      <Modal open={modal === 'receive'} size="sm" modalHeading={L('Receive lot', 'استلام دفعة')} primaryButtonText={L('Receive', 'استلام')} secondaryButtonText={L('Cancel', 'إلغاء')} primaryButtonDisabled={saving || !lotForm.itemId || !lotForm.lotNumber.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(lotForm.expiryDate) || lotForm.quantity < 1} onRequestClose={() => setModal(null)} onRequestSubmit={() => void submit('/api/inventory/lots', { ...lotForm, storageLocation: lotForm.storageLocation || undefined, reference: lotForm.reference || undefined }, L('Lot received.', 'تم استلام الدفعة.'))}>
        {error && <InlineNotification kind="error" lowContrast hideCloseButton title={L('Action failed', 'تعذّر الإجراء')} subtitle={error} />}
        <Select id="lot-item" labelText={L('Item', 'الصنف')} value={lotForm.itemId} onChange={e => setLotForm({ ...lotForm, itemId: e.target.value })}>{items.filter(i => i.active).map(i => <SelectItem key={i.id} value={i.id} text={`${i.itemCode} — ${i.name}`} />)}</Select>
        <TextInput id="lot-number" labelText={L('Lot number', 'رقم الدفعة')} value={lotForm.lotNumber} onChange={e => setLotForm({ ...lotForm, lotNumber: e.target.value })} />
        <TextInput id="lot-expiry" type="date" labelText={L('Expiry date', 'تاريخ الانتهاء')} value={lotForm.expiryDate} onChange={e => setLotForm({ ...lotForm, expiryDate: e.target.value })} />
        <NumberInput id="lot-qty" label={L('Quantity received', 'الكمية المستلمة')} min={1} step={1} value={lotForm.quantity} onChange={(_e: unknown, d: { value: string | number }) => setLotForm({ ...lotForm, quantity: Math.trunc(Number(d.value) || 0) })} />
        <TextInput id="lot-loc" labelText={L('Storage location (optional)', 'موقع التخزين (اختياري)')} value={lotForm.storageLocation} onChange={e => setLotForm({ ...lotForm, storageLocation: e.target.value })} />
        <TextInput id="lot-ref" labelText={L('Delivery note / PO reference (optional)', 'مرجع إشعار التسليم / أمر الشراء (اختياري)')} value={lotForm.reference} onChange={e => setLotForm({ ...lotForm, reference: e.target.value })} />
        <Checkbox id="lot-quarantine" labelText={L('Hold in quarantine until released', 'احتجاز الدفعة حتى الإفراج عنها')} checked={lotForm.quarantineOnReceipt} onChange={(_e: unknown, { checked }: { checked: boolean }) => setLotForm({ ...lotForm, quarantineOnReceipt: checked })} />
      </Modal>

      <Modal open={modal === 'movement'} size="sm" danger={mv.type === 'discard'} modalHeading={`${L(typeLabels[mv.type][0], typeLabels[mv.type][1])} — ${lotById(mv.lotId)?.lotNumber ?? ''}`} primaryButtonText={L(typeLabels[mv.type][0], typeLabels[mv.type][1])} secondaryButtonText={L('Cancel', 'إلغاء')} primaryButtonDisabled={saving || (needsReason && mv.reason.trim().length < 3) || (needsQty && (mv.type === 'adjust' ? mv.quantity === 0 : mv.quantity < 1))} onRequestClose={() => setModal(null)} onRequestSubmit={() => void submit('/api/inventory/movements', { type: mv.type, lotId: mv.lotId, quantity: needsQty ? mv.quantity : 0, reason: mv.reason || undefined, reference: mv.reference || undefined }, L('Stock movement recorded.', 'تم تسجيل حركة المخزون.'))}>
        {error && <InlineNotification kind="error" lowContrast hideCloseButton title={L('Action failed', 'تعذّر الإجراء')} subtitle={error} />}
        <p className="cds--type-body-compact-01">{L('On hand', 'الرصيد')}: {ltr(lotById(mv.lotId)?.onHandQty ?? 0)} · {L('Expiry', 'الانتهاء')}: {ltr(lotById(mv.lotId)?.expiryDate ?? '')}</p>
        {needsQty && <NumberInput id="mv-qty" label={mv.type === 'adjust' ? L('Signed change (use a minus sign to reduce)', 'التغيّر بإشارته (استخدم الناقص للتخفيض)') : L('Quantity', 'الكمية')} step={1} min={mv.type === 'adjust' ? undefined : 1} value={mv.quantity} onChange={(_e: unknown, d: { value: string | number }) => setMv({ ...mv, quantity: Math.trunc(Number(d.value) || 0) })} />}
        <TextArea id="mv-reason" labelText={needsReason ? L('Reason (required)', 'السبب (مطلوب)') : L('Reason (optional)', 'السبب (اختياري)')} rows={3} value={mv.reason} onChange={e => setMv({ ...mv, reason: e.target.value })} />
        <TextInput id="mv-ref" labelText={L('Reference — run, worklist or ticket (optional)', 'المرجع — التشغيل أو قائمة العمل أو التذكرة (اختياري)')} value={mv.reference} onChange={e => setMv({ ...mv, reference: e.target.value })} />
      </Modal>
    </div>
  );
}
