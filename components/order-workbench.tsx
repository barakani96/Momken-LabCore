'use client';
import { useEffect, useMemo, useState } from 'react';
import { Breadcrumb, BreadcrumbItem, Button, Checkbox, Dropdown, InlineNotification, Tag, Tile, TextInput, Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@carbon/react';
import { Add, Checkmark, Reset, Barcode } from '@carbon/icons-react';
import { useI18n } from '@/components/i18n-provider';
import { seedTestCatalog, validateOrder, type OrderPriority } from '@/lib/catalog';

const priorities: OrderPriority[] = ['Routine', 'Urgent', 'STAT'];
type PersistedOrder = {
  id: string; accession: string; patientNumber: string; patientName: string; clinician: string;
  priority: OrderPriority; specimenType: string; testCodes: string[]; status: 'Ordered' | 'Collected' | 'In progress' | 'Cancelled';
  orderedAt: string; specimenAccession?: string;
};

export function OrderWorkbench() {
  const { direction, t } = useI18n();
  const [patientId, setPatientId] = useState(''); const [patientName, setPatientName] = useState(''); const [clinician, setClinician] = useState('');
  const [priority, setPriority] = useState<OrderPriority>('Routine'); const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [orders, setOrders] = useState<PersistedOrder[]>([]); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [accessioningId, setAccessioningId] = useState('');
  const selectedTests = useMemo(() => seedTestCatalog.filter(test => selectedCodes.includes(test.code)), [selectedCodes]);
  const specimenTypes = [...new Set(selectedTests.map(test => test.specimenType))];
  const errors = validateOrder({ patientId, patientName, clinician, testCodes: selectedCodes }, seedTestCatalog);

  async function loadOrders() {
    setLoading(true);
    try {
      const response = await fetch('/api/orders', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to load laboratory orders.');
      setOrders(body.data ?? []); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load laboratory orders.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadOrders(); }, []);

  function toggleCode(code: string, checked: boolean) {
    setSelectedCodes(current => checked ? [...current, code] : current.filter(item => item !== code));
    setError(''); setMessage('');
  }
  async function submit() {
    if (errors.length) { setError(errors.join(' ')); return; }
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ patientNumber: patientId, patientName, clinician, priority, testCodes: selectedCodes }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to create order.');
      setOrders(current => [body.data, ...current.filter(order => order.id !== body.data.id)]);
      setMessage(`${body.data.accession} · ${t('Order saved to database.')}`);
      setPatientId(''); setPatientName(''); setClinician(''); setPriority('Routine'); setSelectedCodes([]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create order.'); }
    finally { setSaving(false); }
  }
  async function accession(order: PersistedOrder) {
    setAccessioningId(order.id); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/orders/${order.id}/accession`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to accession order.');
      setMessage(`${body.data.specimen.accession} · ${t('Specimen accessioned successfully.')}`);
      await loadOrders();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to accession order.'); }
    finally { setAccessioningId(''); }
  }
  function reset() { setPatientId(''); setPatientName(''); setClinician(''); setPriority('Routine'); setSelectedCodes([]); setError(''); setMessage(''); }

  return <>
    <Breadcrumb noTrailingSlash dir={direction}><BreadcrumbItem href="/worklist">{t('Home')}</BreadcrumbItem><BreadcrumbItem href="/worklist">{t('Laboratory')}</BreadcrumbItem><BreadcrumbItem isCurrentPage>{t('Orders & accessioning')}</BreadcrumbItem></Breadcrumb>
    <div className="page-heading"><div><div className="eyebrow">{t('LABORATORY OPERATIONS / ORDER ENTRY')}</div><h1>{t('Orders & accessioning')}</h1><p className="page-description">{t('Create a laboratory order from the active catalog and verify specimen compatibility before accessioning.')}</p></div><div className="heading-actions"><Button kind="secondary" renderIcon={Reset} onClick={reset}>{t('Reset form')}</Button><Button kind="ghost" onClick={() => void loadOrders()}>{t('Refresh')}</Button></div></div>
    <div className="context-line"><span><span className="live-dot"/> {t('Database-backed workflow')}</span><span>{t('Use registered patient ID and exact registered name')}</span></div>
    <div className="metric-grid"><Tile className="metric-tile"><div className="metric-label">{t('Orders created')}</div><div className="metric-value">{orders.length}</div><div className="metric-foot">{t('Loaded from PostgreSQL')}</div></Tile><Tile className="metric-tile"><div className="metric-label">{t('Selected tests')}</div><div className="metric-value">{selectedCodes.length}</div><div className="metric-foot">{t('Active catalog items')}</div></Tile><Tile className="metric-tile"><div className="metric-label">{t('Specimen compatibility')}</div><div className="metric-value">{specimenTypes.length === 1 ? '1' : specimenTypes.length === 0 ? '—' : '!'}</div><div className="metric-foot">{specimenTypes.length > 1 ? t('Split tests by specimen type') : specimenTypes.length === 1 ? t(specimenTypes[0]) : t('Select tests to check')}</div></Tile><Tile className="metric-tile"><div className="metric-label">{t('Order validation')}</div><div className="metric-value">{errors.length === 0 ? '✓' : errors.length}</div><div className="metric-foot">{errors.length === 0 ? t('Ready to create') : t('Required fields remaining')}</div></Tile></div>
    {message && <InlineNotification kind="success" lowContrast title={t('Workflow updated')} subtitle={message} onCloseButtonClick={() => setMessage('')} className="notice" />}
    {error && <InlineNotification kind="error" lowContrast title={t('Request could not be completed')} subtitle={t(error)} onCloseButtonClick={() => setError('')} className="notice" />}
    <div className="order-layout"><section className="worklist-panel"><div className="panel-header"><div><h2>{t('Order details')}</h2><p>{t('Patient and ordering-provider details are required.')}</p></div><Tag type="cool-gray">{t('Draft')}</Tag></div><div className="order-form-grid"><TextInput id="order-patient-id" labelText={t('Patient ID')} placeholder="PAT-004281" value={patientId} onChange={e => setPatientId(e.target.value)} /><TextInput id="order-patient-name" labelText={t('Patient full name')} placeholder={t('Exact registered patient name')} value={patientName} onChange={e => setPatientName(e.target.value)} /><TextInput id="order-clinician" labelText={t('Ordering clinician')} placeholder={t('Ordering clinician')} value={clinician} onChange={e => setClinician(e.target.value)} /><Dropdown id="order-priority" titleText={t('Priority')} label={t('Routine')} items={priorities.map(t)} selectedItem={t(priority)} onChange={({ selectedItem }) => setPriority(priorities.find(item => t(item) === selectedItem) ?? 'Routine')} /></div>
      <div className="panel-header order-subheading"><div><h2>{t('Requested tests')}</h2><p>{t('Tests requiring different specimen types must be placed on separate orders.')}</p></div><Tag type={specimenTypes.length > 1 ? 'red' : 'blue'}>{selectedCodes.length} {t('selected')}</Tag></div>
      <div className="order-test-list">{seedTestCatalog.filter(test => test.active).map(test => <div className="order-test-option" key={test.code}><Checkbox id={`order-test-${test.code}`} labelText={<span><strong>{test.code} · {t(test.name)}</strong><span className="sub-cell">{t(test.department)} · {t(test.specimenType)} · {t(test.method)}</span></span>} checked={selectedCodes.includes(test.code)} onChange={checked => toggleCode(test.code, checked)} /></div>)}</div>
      {specimenTypes.length > 1 && <InlineNotification kind="error" lowContrast hideCloseButton title={t('Incompatible specimen requirements')} subtitle={t('Split tests by specimen type before creating the order.')} className="notice" />}
      <div className="order-submit-row"><span className="sub-cell">{t('The patient ID and name must match an existing patient record.')}</span><Button renderIcon={Add} disabled={errors.length > 0 || saving} loading={saving} onClick={() => void submit()}>{t('Create laboratory order')}</Button></div>
    </section><aside className="order-side-panel"><h2>{t('Order checks')}</h2><p>{t('Validation runs before an order can be created.')}</p>{[{label:t('Patient identity entered'),ok:Boolean(patientId.trim() && patientName.trim())},{label:t('Ordering clinician entered'),ok:Boolean(clinician.trim())},{label:t('At least one test selected'),ok:selectedCodes.length > 0},{label:t('One specimen type per order'),ok:specimenTypes.length === 1}].map(check => <div className="order-check" key={check.label}><span>{check.label}</span><Tag type={check.ok ? 'green' : 'gray'}>{check.ok ? t('Pass') : t('Pending')}</Tag></div>)}{selectedTests.length > 0 && <div className="order-specimen"><strong>{t('Required specimen')}</strong><p>{specimenTypes.map(t).join(' / ')}</p><strong>{t('Container')}</strong><p>{[...new Set(selectedTests.map(test => test.container))].map(t).join(' / ')}</p></div>}</aside></div>
    <section className="worklist-panel order-created-panel"><div className="panel-header"><div><h2>{t('Laboratory orders')}</h2><p>{t('Persisted orders and accessioning status.')}</p></div><Tag type="cool-gray">{orders.length} {t('records')}</Tag></div><div className="table-wrap"><Table size="lg" aria-label={t('Laboratory orders')}><TableHead><TableRow>{['Accession', 'Patient', 'Tests', 'Specimen', 'Priority', 'Status', 'Actions'].map(col => <TableHeader key={col}>{t(col)}</TableHeader>)}</TableRow></TableHead><TableBody>{orders.map(order => <TableRow key={order.id}><TableCell><strong dir="ltr">{order.accession}</strong></TableCell><TableCell><strong>{order.patientName}</strong><div className="sub-cell">{order.patientNumber}</div></TableCell><TableCell><div className="test-codes">{order.testCodes.map(code => <span key={code}>{code}</span>)}</div></TableCell><TableCell>{t(order.specimenType)}{order.specimenAccession && <div className="sub-cell" dir="ltr">{order.specimenAccession}</div>}</TableCell><TableCell><Tag type={order.priority === 'STAT' ? 'red' : order.priority === 'Urgent' ? 'warm-gray' : 'cool-gray'}>{t(order.priority)}</Tag></TableCell><TableCell><Tag type={order.status === 'Collected' ? 'green' : 'blue'}>{t(order.status)}</Tag></TableCell><TableCell>{order.status === 'Ordered' ? <Button size="sm" kind="tertiary" renderIcon={Barcode} disabled={Boolean(accessioningId)} loading={accessioningId === order.id} onClick={() => void accession(order)}>{t('Accession specimen')}</Button> : <Tag type="green">{t('Accessioned')}</Tag>}</TableCell></TableRow>)}</TableBody></Table>{!loading && orders.length === 0 && <div className="empty-state"><Checkmark size={24}/><strong>{t('No laboratory orders')}</strong><p>{t('Create an order using a registered patient and active catalog tests.')}</p></div>}{loading && <div className="empty-state">{t('Loading laboratory orders…')}</div>}</div></section>
  </>;
}
