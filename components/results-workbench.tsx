/* eslint-disable react/jsx-key */
'use client';
import { useMemo, useState } from 'react';
import { Breadcrumb, BreadcrumbItem, Button, Dropdown, InlineNotification, NumberInput, Pagination, Tag, Tile, Table, TableHead, TableRow, TableHeader, TableBody, TableCell, TextInput } from '@carbon/react';
import { Checkmark, Download, Filter, Search, WarningAlt } from '@carbon/icons-react';
import { useI18n } from '@/components/i18n-provider';
import { filterResults, flagResult, seedResults, submitForTechnicalReview, validateResultEntry, type LabResult } from '@/lib/results';

const statuses = ['All statuses', 'Needs entry', 'Entered', 'Technical review'];
const departments = ['All departments', 'Hematology', 'Clinical chemistry', 'Coagulation', 'Immunology'];
const flagTagType: Record<string, 'red' | 'magenta' | 'green' | 'blue' | 'gray' | 'warm-gray'> = { 'Critical low': 'red', 'Critical high': 'red', Low: 'warm-gray', High: 'warm-gray', Normal: 'green', 'Not entered': 'gray' };

export function ResultsWorkbench() {
  const { locale, direction, t } = useI18n();
  const [rows, setRows] = useState<LabResult[]>(seedResults);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All statuses');
  const [department, setDepartment] = useState('All departments');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const filtered = useMemo(() => filterResults(rows, query, status, department), [rows, query, status, department]);
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const counts = { total: rows.length, entry: rows.filter(r => r.status === 'Needs entry').length, review: rows.filter(r => r.status === 'Technical review').length, critical: rows.filter(r => ['Critical low', 'Critical high'].includes(flagResult(r))).length };
  const localeTag = locale === 'ar' ? 'ar' : 'en';

  function updateValue(id: string, value: string) {
    setRows(current => current.map(row => row.id === id ? { ...row, value, status: row.status === 'Needs entry' ? 'Entered' : row.status } : row));
    setError(''); setMessage('');
  }
  function review(row: LabResult) {
    try {
      const next = submitForTechnicalReview(row, 'Demo technical reviewer', new Date().toISOString());
      setRows(current => current.map(item => item.id === row.id ? next : item));
      setMessage(`${row.testCode} · ${t('Moved to technical review.')}`); setError('');
    } catch (e) { setError(t(e instanceof Error ? e.message : 'Unable to submit result.')); setMessage(''); }
  }
  function exportCsv() {
    const escape = (v: string) => `"${v.replaceAll('"', '""')}"`;
    const headers = ['Accession', 'Patient', 'Patient ID', 'Department', 'Test code', 'Test', 'Value', 'Unit', 'Reference interval', 'Flag', 'Status'];
    const csv = [headers, ...filtered.map(r => [r.accession, r.patientName, r.patientId, r.department, r.testCode, r.testName, r.value, r.unit, `${r.referenceLow}–${r.referenceHigh}`, flagResult(r), r.status])].map(line => line.map(escape).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' })); const a = document.createElement('a'); a.href = url; a.download = 'lims-results-workbench.csv'; a.click(); URL.revokeObjectURL(url);
  }

  return <>
    <Breadcrumb noTrailingSlash dir={direction}><BreadcrumbItem href="/worklist">{t('Home')}</BreadcrumbItem><BreadcrumbItem href="/worklist">{t('Laboratory')}</BreadcrumbItem><BreadcrumbItem isCurrentPage>{t('Results & validation')}</BreadcrumbItem></Breadcrumb>
    <div className="page-heading"><div><div className="eyebrow">{t('LABORATORY OPERATIONS / RESULTS')}</div><h1>{t('Results & validation')}</h1><p className="page-description">{t('Enter structured results, review demonstration reference intervals, and route eligible results for technical review.')}</p></div><div className="heading-actions"><Button kind="secondary" renderIcon={Download} onClick={exportCsv}>{t('Export CSV')}</Button></div></div>
    <div className="context-line"><span><span className="live-dot"/> {t('Fictional demonstration data')}</span><span>{t('Technical review only — no report release')}</span></div>
    <div className="metric-grid"><Tile className="metric-tile"><div className="metric-label">{t('Result records')}</div><div className="metric-value">{counts.total}</div><div className="metric-foot">{t('Current workbench')}</div></Tile><Tile className="metric-tile"><div className="metric-label">{t('Needs entry')}</div><div className="metric-value">{counts.entry}</div><div className="metric-foot">{t('Numeric value required')}</div></Tile><Tile className="metric-tile"><div className="metric-label">{t('Technical review')}</div><div className="metric-value">{counts.review}</div><div className="metric-foot">{t('Queued for review')}</div></Tile><Tile className="metric-tile"><div className="metric-label">{t('Critical-range flags')}</div><div className="metric-value metric-alert">{counts.critical}</div><div className="metric-foot">{t('Requires separate escalation')}</div></Tile></div>
    {message && <InlineNotification kind="success" lowContrast title={t('Result updated')} subtitle={message} onCloseButtonClick={() => setMessage('')} className="notice" />}
    {error && <InlineNotification kind="error" lowContrast title={t('Action could not be completed')} subtitle={error} onCloseButtonClick={() => setError('')} className="notice" />}
    <section className="worklist-panel" aria-label={t('Results table')} dir={direction}>
      <div className="panel-header"><div><h2>{t('Result workbench')}</h2><p>{t('Values and intervals are illustrative and must not be used for patient care.')}</p></div><Tag type="cool-gray">{filtered.length} {t('records')}</Tag></div>
      <div className="filter-toolbar" dir={direction}><div className="search-field"><TextInput id="result-search" labelText={t('Search results')} placeholder={t('Search accession, patient, test…')} value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} /></div><div className="filter-select"><Dropdown id="result-status" titleText={t('Status')} label={t('All statuses')} items={statuses.map(t)} selectedItem={t(status)} onChange={({ selectedItem }) => { setStatus(statuses.find(s => t(s) === selectedItem) ?? 'All statuses'); setPage(1); }} /></div><div className="filter-select"><Dropdown id="result-department" titleText={t('Department')} label={t('All departments')} items={departments.map(t)} selectedItem={t(department)} onChange={({ selectedItem }) => { setDepartment(departments.find(s => t(s) === selectedItem) ?? 'All departments'); setPage(1); }} /></div><Button kind="ghost" renderIcon={Filter} onClick={() => { setQuery(''); setStatus('All statuses'); setDepartment('All departments'); setPage(1); }}>{t('Clear filters')}</Button></div>
      <div className="table-wrap" dir={direction}><Table size="lg" aria-label={t('Results table')}><TableHead><TableRow>{['Accession', 'Patient', 'Test', 'Result', 'Reference interval', 'Flag', 'Status', 'Action'].map(c => <TableHeader key={c}>{t(c)}</TableHeader>)}</TableRow></TableHead><TableBody>{pageRows.map(row => { const flag = flagResult(row); const entryError = validateResultEntry(row.value); return <TableRow key={row.id} className={flag.startsWith('Critical') ? 'stat-row' : ''}>
        <TableCell><span className="accession-text" dir="ltr">{row.accession}</span><div className="sub-cell">{row.patientId}</div></TableCell>
        <TableCell><strong className="patient-name">{row.patientName}</strong><div className="sub-cell">{row.department}</div></TableCell>
        <TableCell><strong>{row.testCode}</strong><div className="sub-cell">{row.testName}</div></TableCell>
        <TableCell><div className="result-entry"><NumberInput id={`value-${row.id}`} label={t('Numeric result')} hideLabel value={row.value === '' ? '' : Number(row.value)} allowEmpty min={-1000000} max={1000000} step={0.1} invalid={Boolean(row.value && entryError)} invalidText={t('Enter a valid numeric result.')} onChange={(_event, data) => updateValue(row.id, data.value === '' ? '' : String(data.value))} /><span className="result-unit">{row.unit || '—'}</span></div></TableCell>
        <TableCell><span dir="ltr">{row.referenceLow}–{row.referenceHigh} {row.unit}</span></TableCell>
        <TableCell><Tag type={flagTagType[flag]}>{t(flag)}</Tag></TableCell>
        <TableCell><Tag type={row.status === 'Technical review' ? 'blue' : row.status === 'Needs entry' ? 'gray' : 'cool-gray'}>{t(row.status)}</Tag></TableCell>
        <TableCell>{row.status !== 'Technical review' ? <Button kind="ghost" size="sm" renderIcon={Checkmark} disabled={Boolean(entryError) || flag.startsWith('Critical')} onClick={() => review(row)}>{t('Send to review')}</Button> : <span className="sub-cell">{row.reviewedBy ? t('Review queued') : t('In review')}</span>}</TableCell>
      </TableRow>; })}</TableBody></Table>
      {filtered.length === 0 && <div className="empty-state"><Search size={24}/><strong>{t('No results match these filters')}</strong><p>{t('Try another search term or clear the filters.')}</p><Button kind="tertiary" onClick={() => { setQuery(''); setStatus('All statuses'); setDepartment('All departments'); }}>{t('Clear filters')}</Button></div>}
      </div>
      <Pagination totalItems={filtered.length} page={page} pageSize={pageSize} pageSizes={[10, 20, 50]} onChange={({ page: p, pageSize: ps }) => { setPage(p); setPageSize(ps); }} itemRangeText={(min, max, total) => localeTag === 'ar' ? `${min}–${max} من ${total}` : `${min}–${max} of ${total}`} pageRangeText={(current, total) => localeTag === 'ar' ? `الصفحة ${current} من ${total}` : `Page ${current} of ${total}`} />
    </section>
    <div className="compliance-note"><WarningAlt size={16}/><span>{t('This increment does not authorize results, notify clinicians, or release reports. Critical-range examples are blocked from the technical-review action and require a separately designed, audited escalation workflow.')}</span></div>
  </>;
}
