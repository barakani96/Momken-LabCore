'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Breadcrumb, BreadcrumbItem, Button, Search, Dropdown, Tag, Tile, Table, TableHead, TableRow, TableHeader, TableBody, TableCell, Pagination, Modal, TextInput, InlineNotification, Select, SelectItem } from '@carbon/react';
import { Add, Download, Renew, Filter, ArrowRight, CheckmarkFilled, WarningAlt, Printer } from '@carbon/icons-react';
import { filterSpecimens, seedSpecimens, specimenStatuses, transitionSpecimen, type Specimen, type SpecimenStatus } from '@/lib/specimens';
import { useI18n } from '@/components/i18n-provider';

const columns = [
  { key: 'accession', header: 'Accession' }, { key: 'patient', header: 'Patient' }, { key: 'tests', header: 'Tests' },
  { key: 'specimenType', header: 'Specimen' }, { key: 'department', header: 'Department' },
  { key: 'priority', header: 'Priority' }, { key: 'status', header: 'Status' }, { key: 'collectedAt', header: 'Collected' }, { key: 'actions', header: '' }
];
const nextStep: Partial<Record<SpecimenStatus, SpecimenStatus>> = { 'Collected': 'In progress', 'In progress': 'Pending review', 'Pending review': 'Authorized', 'Rejected': 'Collected' };
function statusTag(status: SpecimenStatus, t: (source: string) => string) {
  const type = status === 'Authorized' ? 'green' : status === 'Rejected' ? 'red' : status === 'Pending review' ? 'purple' : status === 'In progress' ? 'blue' : 'cool-gray';
  return <Tag type={type}>{t(status)}</Tag>;
}
function priorityTag(priority: Specimen['priority'], t: (source: string) => string) {
  return <Tag type={priority === 'STAT' ? 'red' : priority === 'Urgent' ? 'magenta' : 'cool-gray'}>{t(priority)}</Tag>;
}
export function Worklist() {
  const { t, locale, direction } = useI18n();
  const [rows, setRows] = useState<Specimen[]>(seedSpecimens);
  const [sourceMode, setSourceMode] = useState<'demo' | 'database'>('demo');
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All statuses');
  const [priority, setPriority] = useState('All priorities');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [patientId, setPatientId] = useState('');
  const [testCode, setTestCode] = useState('CBC');
  const [specimenType, setSpecimenType] = useState('EDTA whole blood');
  const [newPriority, setNewPriority] = useState('Routine');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const filtered = useMemo(() => filterSpecimens(rows, query, status).filter(r => priority === 'All priorities' || r.priority === priority), [rows, query, status, priority]);
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const counts = { total: rows.length, active: rows.filter(r => ['Collected', 'In progress'].includes(r.status)).length, review: rows.filter(r => r.status === 'Pending review').length, urgent: rows.filter(r => r.priority !== 'Routine' && r.status !== 'Authorized' && r.status !== 'Rejected').length };

  const loadSpecimens = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/specimens', { cache: 'no-store' }); const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load specimens.');
      const data: Specimen[] = body.data.map((item: Record<string, unknown>) => ({
        id: String(item.id), accession: String(item.accession), patientId: String(item.patientNumber), patientName: String(item.patientName),
        tests: Array.isArray(item.testCodes) ? item.testCodes.map(String) : [], specimenType: String(item.specimenType), priority: item.priority as Specimen['priority'],
        status: item.status as SpecimenStatus, collectedAt: new Date(String(item.collectedAt)).toISOString(), department: String(item.department), orderingClinician: String(item.orderingClinician)
      }));
      setRows(data); setSourceMode('database'); setError('');
    } catch (e) { setSourceMode('demo'); setError(e instanceof Error ? `${e.message} ${t('Showing fictional demonstration rows until the database is available.')}` : 'Unable to load specimens.'); }
    finally { setLoading(false); }
  }, [t]);
  useEffect(() => { void loadSpecimens(); }, [loadSpecimens]);
  async function advance(row: Specimen) {
    const next = nextStep[row.status]; if (!next) return;
    const transitionReason = row.status === 'Rejected' ? window.prompt(t('Enter recollection details (required):'))?.trim() : undefined;
    if (row.status === 'Rejected' && !transitionReason) return;
    if (sourceMode === 'database') {
      try {
        const response = await fetch(`/api/specimens/${row.id}/transition`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: next, reason: transitionReason }) });
        const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to update specimen.');
        await loadSpecimens(); setMessage(locale === 'ar' ? `${row.accession}: ${t(next)}` : `${row.accession} moved to ${next}.`); setError('');
      } catch (e) { setError(e instanceof Error ? e.message : 'Unable to update specimen.'); }
      return;
    }
    try { setRows(current => current.map(item => item.id === row.id ? transitionSpecimen(item, next) : item)); setMessage(locale === 'ar' ? `${row.accession}: ${t(next)}` : `${row.accession} moved to ${next}.`); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to update specimen.'); }
  }
  async function rejectSpecimen(row: Specimen) {
    if (row.status === 'Authorized' || row.status === 'Rejected') return;
    const reason = window.prompt(t('Enter the specimen rejection reason (required):'))?.trim();
    if (!reason) return;
    if (sourceMode === 'database') {
      try {
        const response = await fetch(`/api/specimens/${row.id}/transition`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'Rejected', reason }) });
        const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to reject specimen.');
        await loadSpecimens(); setMessage(`${row.accession}: ${t('Rejected')}`); setError('');
      } catch (e) { setError(e instanceof Error ? e.message : 'Unable to reject specimen.'); }
      return;
    }
    setRows(current => current.map(item => item.id === row.id ? transitionSpecimen(item, 'Rejected') : item));
    setMessage(`${row.accession}: ${t('Rejected')} · ${reason}`);
  }
  async function printLabel(row: Specimen) {
    const escape = (value: string) => value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] ?? ch));
    const popup = window.open('', '_blank', 'width=520,height=420');
    if (!popup) { setError(t('Allow pop-ups to print the specimen label.')); return; }
    try {
      const barcodeResponse = await fetch(`/api/barcode?text=${encodeURIComponent(row.accession)}`);
      if (!barcodeResponse.ok) throw new Error('Barcode rendering failed.');
      const barcodeSvg = await barcodeResponse.text();
      // SVG comes from the server-side Code 128 renderer and the accession is validated there.
      popup.document.write(`<!doctype html><html><head><title>${escape(row.accession)}</title><style>body{font:14px Arial,sans-serif;padding:18px;color:#161616}.label{border:1px solid #777;padding:10px;max-width:360px}.brand{font-size:11px;letter-spacing:1px}.accession{font:700 20px monospace;margin:8px 0}.barcode{display:block;width:100%;height:64px}.line{margin:5px 0}@media print{@page{size:80mm 50mm;margin:3mm}body{padding:0}.label{border:0}}</style></head><body><section class="label"><div class="brand">NORTHSTAR · LABORATORY</div><div class="accession">${escape(row.accession)}</div><div class="barcode">${barcodeSvg}</div><div class="line"><b>Patient:</b> ${escape(row.patientName)} (${escape(row.patientId)})</div><div class="line"><b>Specimen:</b> ${escape(row.specimenType)}</div><div class="line"><b>Tests:</b> ${escape(row.tests.join(', '))}</div><div class="line"><b>Collected:</b> ${escape(new Date(row.collectedAt).toLocaleString())}</div></section><script>window.onload=()=>window.print()</script></body></html>`);
      popup.document.close(); setError('');
    } catch (error) {
      popup.close(); setError(error instanceof Error ? error.message : 'Unable to print specimen label.');
    }
  }
  async function createSpecimen(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!patientName.trim() || !patientId.trim() || !testCode.trim()) { setError(t('Patient name, patient ID, and at least one test code are required.')); return; }
    try {
      const [givenName, ...familyParts] = patientName.trim().split(/\s+/); const familyName = familyParts.join(' ');
      if (!familyName) throw new Error(t('Enter the registered patient first and last name.'));
      const response = await fetch('/api/specimens', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ patientNumber: patientId.trim().toUpperCase(), givenName, familyName, specimenType, priority: newPriority, department: 'Laboratory', orderingClinician: 'Development user', testCodes: testCode.split(',').map(v => v.trim().toUpperCase()).filter(Boolean) }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to register specimen.');
      setCreateOpen(false); setPatientName(''); setPatientId(''); setTestCode('CBC'); setMessage(locale === 'ar' ? `تم تسجيل العينة ${body.data.accession}.` : `Specimen ${body.data.accession} registered.`); setError(''); setQuery(''); setStatus('All statuses'); setPriority('All priorities'); setPage(1); await loadSpecimens();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to register specimen.'); }
  }
  function exportCsv() {
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const csv = [columns.slice(0, 8).map(c => escape(c.header)).join(','), ...filtered.map(r => [r.accession, `${r.patientName} (${r.patientId})`, r.tests.join('; '), r.specimenType, r.department, r.priority, r.status, new Date(r.collectedAt).toLocaleString(locale === "ar" ? "ar" : "en")].map(escape).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })); const a = document.createElement('a'); a.href = url; a.download = 'lims-specimen-worklist.csv'; a.click(); URL.revokeObjectURL(url);
  }
  return <>
    <Breadcrumb noTrailingSlash dir={direction}><BreadcrumbItem href="#main">{t("Home")}</BreadcrumbItem><BreadcrumbItem href="#laboratory">{t("Laboratory")}</BreadcrumbItem><BreadcrumbItem isCurrentPage>{t("Specimen worklist")}</BreadcrumbItem></Breadcrumb>
    <div className="page-heading"><div><div className="eyebrow">{t("LABORATORY OPERATIONS / ACCESSIONING")}</div><h1>{t("Specimen worklist")}</h1><p className="page-description">{t("Track collected specimens, monitor priority, and move work through laboratory review.")}</p></div><div className="heading-actions"><Button kind="secondary" renderIcon={Download} onClick={exportCsv}>{t("Export CSV")}</Button><Button renderIcon={Add} onClick={() => setCreateOpen(true)}>{t("Register specimen")}</Button></div></div>
    <div className="context-line"><span><span className="live-dot"/> {sourceMode === 'database' ? t('Loaded from PostgreSQL') : t('Fictional demo data')}</span><span>{loading ? t('Loading specimens…') : t('Last refreshed just now')}</span><Button kind="ghost" size="sm" renderIcon={Renew} onClick={() => void loadSpecimens()}>{t("Refresh")}</Button></div>
    <div className="metric-grid">
      <Tile className="metric-tile"><div className="metric-label">{t("Total specimens")}</div><div className="metric-value">{counts.total}</div><div className="metric-foot">{t("Current worklist")}</div></Tile>
      <Tile className="metric-tile"><div className="metric-label">{t("In process")}</div><div className="metric-value">{counts.active}</div><div className="metric-foot">{t("Collected or processing")}</div></Tile>
      <Tile className="metric-tile"><div className="metric-label">{t("Pending review")}</div><div className="metric-value">{counts.review}</div><div className="metric-foot">{t("Awaiting technical review")}</div></Tile>
      <Tile className="metric-tile"><div className="metric-label">{t("Urgent / STAT")}</div><div className="metric-value metric-alert">{counts.urgent}</div><div className="metric-foot">{t("Not yet authorized")}</div></Tile>
    </div>
    {message && <InlineNotification kind="success" lowContrast title={t("Worklist updated")} subtitle={message} onCloseButtonClick={() => setMessage('')} className="notice" />}
    {error && <InlineNotification kind="error" title={t("Action could not be completed")} subtitle={error} onCloseButtonClick={() => setError('')} className="notice" />}
    <section className="worklist-panel" aria-label={t("Specimen table")} dir={direction}>
      <div className="panel-header"><div><h2>{t("All specimens")}</h2><p>{sourceMode === 'database' ? t("Operational queue · persisted specimen records") : t("Operational queue · fictional sample data")}</p></div><Tag type="cool-gray">{filtered.length} {locale === "ar" ? "سجلًا" : "records"}</Tag></div>
      <div className="filter-toolbar" dir={direction}><div className="search-field"><Search id="specimen-search" labelText={t("Search specimens")} placeholder={t("Search accession, patient, test code…")} value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} /></div><div className="filter-select"><Dropdown id="status-filter" titleText={t("Status")} label={t("All statuses")} items={['All statuses', ...specimenStatuses].map(item => t(item))} selectedItem={t(status)} onChange={({ selectedItem }) => { const source = ['All statuses', ...specimenStatuses].find(item => t(item) === selectedItem) ?? 'All statuses'; setStatus(source); setPage(1); }} /></div><div className="filter-select"><Dropdown id="priority-filter" titleText={t("Priority")} label={t("All priorities")} items={['All priorities', 'Routine', 'Urgent', 'STAT'].map(item => t(item))} selectedItem={t(priority)} onChange={({ selectedItem }) => { const source = ['All priorities', 'Routine', 'Urgent', 'STAT'].find(item => t(item) === selectedItem) ?? 'All priorities'; setPriority(source); setPage(1); }} /></div><Button kind="ghost" renderIcon={Filter} onClick={() => { setQuery(''); setStatus('All statuses'); setPriority('All priorities'); setPage(1); }}>{t("Clear filters")}</Button></div>
      <div className="table-wrap" dir={direction}><Table size="lg" useZebraStyles={false} aria-label={t("Specimen table")}><TableHead><TableRow>{columns.map(c => <TableHeader key={c.key}>{t(c.header)}</TableHeader>)}</TableRow></TableHead><TableBody>{pageRows.map(row => <TableRow key={row.id} className={row.priority === 'STAT' ? 'stat-row' : ''}>
        <TableCell><button dir="ltr" className="accession-link" onClick={() => setMessage(`${row.accession} · ${row.patientName} · ${t("Ordered by")} ${row.orderingClinician}`)}>{row.accession}</button><div className="sub-cell">{row.patientId}</div></TableCell>
        <TableCell><strong className="patient-name">{row.patientName}</strong><div className="sub-cell">{row.orderingClinician}</div></TableCell>
        <TableCell><div className="test-codes">{row.tests.map(t => <span key={t}>{t}</span>)}</div></TableCell>
        <TableCell>{row.specimenType}</TableCell><TableCell>{row.department}</TableCell><TableCell>{priorityTag(row.priority, t)}</TableCell><TableCell>{statusTag(row.status, t)}</TableCell><TableCell><span className="date-cell">{new Date(row.collectedAt).toLocaleTimeString(locale === 'ar' ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit' })}</span><div className="sub-cell">{new Date(row.collectedAt).toLocaleDateString(locale === 'ar' ? 'ar' : 'en', { month: 'short', day: 'numeric' })}</div></TableCell>
        <TableCell><div className="row-actions"><Button kind="ghost" size="sm" hasIconOnly renderIcon={Printer} iconDescription={`${t('Print label')} ${row.accession}`} onClick={() => printLabel(row)} />{nextStep[row.status] ? <Button kind="ghost" size="sm" hasIconOnly renderIcon={ArrowRight} iconDescription={`${t("Move")} ${row.accession} ${t("to")} ${t(nextStep[row.status] ?? "")}`} onClick={() => void advance(row)} /> : null}{!['Authorized', 'Rejected'].includes(row.status) ? <Button kind="ghost" size="sm" hasIconOnly renderIcon={WarningAlt} iconDescription={`${t('Reject specimen')} ${row.accession}`} onClick={() => void rejectSpecimen(row)} /> : <span className="sub-cell">{t("Complete")}</span>}</div></TableCell>
      </TableRow>)}</TableBody></Table>
      {filtered.length === 0 && <div className="empty-state"><WarningAlt size={24}/><strong>{t("No specimens match these filters")}</strong><p>{t("Try another search term or clear the filters.")}</p><Button kind="tertiary" onClick={() => { setQuery(''); setStatus('All statuses'); setPriority('All priorities'); }}>{t("Clear filters")}</Button></div>}
      </div>
      <Pagination totalItems={filtered.length} page={page} pageSize={pageSize} pageSizes={[10, 20, 50]} onChange={({ page: p, pageSize: ps }) => { setPage(p); setPageSize(ps); }} itemRangeText={(min, max, total) => locale === "ar" ? `${min}–${max} من ${total} عينة` : `${min}–${max} of ${total} specimens`} pageRangeText={(current, total) => locale === "ar" ? `الصفحة ${current} من ${total}` : `Page ${current} of ${total}`} />
    </section>
    <div className="compliance-note"><CheckmarkFilled size={16}/><span>{t("Workflow guardrails enabled in the demo. Authorization and clinical result release require a separately implemented identity, role, and audit policy before production use.")}</span></div>
    <Modal open={createOpen} modalHeading={t("Register specimen")} primaryButtonText={t("Register specimen")} secondaryButtonText={t("Cancel")} onRequestClose={() => setCreateOpen(false)} onRequestSubmit={createSpecimen} primaryButtonDisabled={!patientName.trim() || !patientId.trim() || !testCode.trim()} size="sm">
      <form dir={direction} className="registration-form" onSubmit={createSpecimen}><p className="modal-intro">{t("Specimen registration requires an existing patient ID and matching registered name. New patient identities are created in Patient registry.")}</p>
        <TextInput id="patient-name" labelText={t("Patient full name")} value={patientName} onChange={e => setPatientName(e.target.value)} required />
        <TextInput id="patient-id" labelText={t("Patient ID")} placeholder="PAT-004289" value={patientId} onChange={e => setPatientId(e.target.value)} required />
        <TextInput id="test-code" labelText={t("Test code(s)")} helperText={t("Separate multiple codes with commas, e.g. CBC, CMP")} value={testCode} onChange={e => setTestCode(e.target.value)} required />
        <Select id="specimen-type" labelText={t("Specimen type")} value={specimenType} onChange={e => setSpecimenType(e.target.value)}><SelectItem value="EDTA whole blood" text={t("EDTA whole blood")}/><SelectItem value="Serum" text={t("Serum")}/><SelectItem value="Fluoride plasma" text={t("Fluoride plasma")}/><SelectItem value="Urine" text={t("Urine")}/><SelectItem value="Citrated plasma" text={t("Citrated plasma")}/></Select>
        <Select id="specimen-priority" labelText={t("Priority")} value={newPriority} onChange={e => setNewPriority(e.target.value)}><SelectItem value="Routine" text={t("Routine")}/><SelectItem value="Urgent" text={t("Urgent")}/><SelectItem value="STAT" text={t("STAT")}/></Select>
      </form>
    </Modal>
  </>;
}
