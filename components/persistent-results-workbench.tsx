/* eslint-disable react/jsx-key */
'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Breadcrumb, BreadcrumbItem, Button, Dropdown, InlineNotification, NumberInput, Tag, Table, TableHead, TableRow, TableHeader, TableBody, TableCell, TextInput, Tile } from '@carbon/react';
import { Add, Checkmark, Renew, Save } from '@carbon/icons-react';
import { useI18n } from '@/components/i18n-provider';

type Specimen = { id: string; accession: string; testCodes: string[]; status: string; patientName: string; patientNumber: string };
type Result = { id: string; specimenId: string; accession: string; patientName: string; patientNumber: string; testCode: string; testName: string; department: string; value: string; unit: string; referenceLow: string | null; referenceHigh: string | null; criticalLow: string | null; criticalHigh: string | null; status: 'Needs entry' | 'Entered' | 'Technical review' | 'Validated' | 'Critical pending'; version: number; enteredBy: string | null };
const statuses = ['All','Needs entry','Entered','Technical review','Validated','Critical pending'];
export function PersistentResultsWorkbench() {
  const { locale, direction, t } = useI18n();
  const [rows, setRows] = useState<Result[]>([]); const [specimens, setSpecimens] = useState<Specimen[]>([]);
  const [query, setQuery] = useState(''); const [status, setStatus] = useState('All'); const [specimenId, setSpecimenId] = useState(''); const [testCode, setTestCode] = useState('');
  const [values, setValues] = useState<Record<string, string>>({}); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const specimen = specimens.find(s => s.id === specimenId); const availableTests = specimen?.testCodes ?? [];
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [resultResponse, specimenResponse] = await Promise.all([fetch(`/api/results?status=${encodeURIComponent(status)}&q=${encodeURIComponent(query)}`, { cache: 'no-store' }), fetch('/api/specimens', { cache: 'no-store' })]);
      const resultJson = await resultResponse.json(); const specimenJson = await specimenResponse.json();
      if (!resultResponse.ok) throw new Error(resultJson.error ?? 'Unable to load results.');
      if (!specimenResponse.ok) throw new Error(specimenJson.error ?? 'Unable to load specimens.');
      setRows(resultJson.data); setSpecimens(specimenJson.data);
      setValues(current => Object.fromEntries(resultJson.data.map((r: Result) => [r.id, current[r.id] ?? r.value])));
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load results.'); }
    finally { setLoading(false); }
  }, [query, status]);
  useEffect(() => { void refresh(); }, [refresh]);
  async function act(key: string, url: string, method: string, body: unknown) {
    setBusy(key); setError(''); setMessage('');
    try { const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const json = await response.json(); if (!response.ok) throw new Error(json.error ?? 'Action failed.'); setMessage(t('Saved successfully.')); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Action failed.'); } finally { setBusy(''); }
  }
  async function createResult() {
    if (!specimenId || !testCode) { setError(t('Choose a specimen and test code first.')); return; }
    await act('create', '/api/results', 'POST', { specimenId, testCode }); setTestCode('');
  }
  const counts = useMemo(() => ({ total: rows.length, entry: rows.filter(r => ['Needs entry','Entered'].includes(r.status)).length, review: rows.filter(r => r.status === 'Technical review').length, validated: rows.filter(r => r.status === 'Validated').length, critical: rows.filter(r => r.status === 'Critical pending').length }), [rows]);
  const statusType: Record<string, 'red'|'green'|'blue'|'gray'|'warm-gray'> = { 'Needs entry':'gray', Entered:'warm-gray', 'Technical review':'blue', Validated:'green', 'Critical pending':'red' };
  const localeTag = locale === 'ar' ? 'ar' : 'en';
  return <>
    <Breadcrumb noTrailingSlash dir={direction}><BreadcrumbItem href="/worklist">{t('Home')}</BreadcrumbItem><BreadcrumbItem href="/worklist">{t('Laboratory')}</BreadcrumbItem><BreadcrumbItem isCurrentPage>{t('Results & validation')}</BreadcrumbItem></Breadcrumb>
    <div className="page-heading"><div><div className="eyebrow">{t('LABORATORY OPERATIONS / RESULTS')}</div><h1>{t('Results & validation')}</h1><p className="page-description">{t('Persistent result entry, independent technical review, and validation workflow.')}</p></div><div className="heading-actions"><Button kind="secondary" renderIcon={Renew} onClick={() => void refresh()}>{t('Refresh')}</Button></div></div>
    <div className="context-line"><span><span className="live-dot"/> {t('Database-backed workflow')}</span><span>{t('Validation does not release a clinical report')}</span></div>
    {error && <InlineNotification kind="error" lowContrast title={t('Action could not be completed')} subtitle={error} onCloseButtonClick={() => setError('')} className="notice" />}
    {message && <InlineNotification kind="success" lowContrast title={t('Result updated')} subtitle={message} onCloseButtonClick={() => setMessage('')} className="notice" />}
    <div className="metric-grid"><Tile className="metric-tile"><div className="metric-label">{t('Result records')}</div><div className="metric-value">{counts.total}</div><div className="metric-foot">{t('Filtered records')}</div></Tile><Tile className="metric-tile"><div className="metric-label">{t('Needs entry')}</div><div className="metric-value">{counts.entry}</div><div className="metric-foot">{t('Entry queue')}</div></Tile><Tile className="metric-tile"><div className="metric-label">{t('Technical review')}</div><div className="metric-value">{counts.review}</div><div className="metric-foot">{t('Independent review')}</div></Tile><Tile className="metric-tile"><div className="metric-label">{t('Validated')}</div><div className="metric-value">{counts.validated}</div><div className="metric-foot">{t('Not report-released')}</div></Tile><Tile className="metric-tile"><div className="metric-label">{t('Critical pending')}</div><div className="metric-value metric-alert">{counts.critical}</div><div className="metric-foot">{t('Escalation required')}</div></Tile></div>
    <section className="worklist-panel" dir={direction}><div className="panel-header"><div><h2>{t('Create result record')}</h2><p>{t('Select a registered specimen and one of its ordered test codes.')}</p></div></div>
      <div className="filter-toolbar"><div className="filter-select"><Dropdown id="result-specimen" titleText={t('Specimen accession')} label={t('Choose specimen')} items={specimens.map(s => s.accession)} selectedItem={specimens.find(s => s.id === specimenId)?.accession ?? null} onChange={({ selectedItem }) => { const found = specimens.find(s => s.accession === selectedItem); setSpecimenId(found?.id ?? ''); setTestCode(''); }} /></div><div className="filter-select"><Dropdown id="result-test-code" titleText={t('Test code')} label={t('Choose test')} items={availableTests} selectedItem={testCode || null} onChange={({ selectedItem }) => setTestCode(selectedItem ?? '')} /></div><Button renderIcon={Add} disabled={!specimenId || !testCode || busy === 'create'} onClick={() => void createResult()}>{t('Create result')}</Button></div>
    </section>
    <section className="worklist-panel" aria-label={t('Results table')} dir={direction}><div className="panel-header"><div><h2>{t('Result workbench')}</h2><p>{t('Numeric intervals must be configured from an approved laboratory source before clinical use.')}</p></div><Tag type="cool-gray">{rows.length} {t('records')}</Tag></div>
      <div className="filter-toolbar"><div className="search-field"><TextInput id="persistent-result-search" labelText={t('Search results')} placeholder={t('Search accession, patient, test…')} value={query} onChange={e => setQuery(e.target.value)} /></div><div className="filter-select"><Dropdown id="persistent-result-status" titleText={t('Status')} label={t('All statuses')} items={statuses.map(t)} selectedItem={t(status)} onChange={({ selectedItem }) => setStatus(statuses.find(s => t(s) === selectedItem) ?? 'All')} /></div></div>
      <div className="table-wrap"><Table size="lg" aria-label={t('Results table')}><TableHead><TableRow>{['Accession','Patient','Test','Result','Status','Action'].map(h => <TableHeader key={h}>{t(h)}</TableHeader>)}</TableRow></TableHead><TableBody>{rows.map(row => <TableRow key={row.id}><TableCell><span className="accession-text" dir="ltr">{row.accession}</span><div className="sub-cell">{row.patientNumber}</div></TableCell><TableCell><strong className="patient-name">{row.patientName}</strong><div className="sub-cell">{row.department}</div></TableCell><TableCell><strong>{row.testCode}</strong><div className="sub-cell">{row.testName}</div></TableCell><TableCell>{row.status === 'Validated' ? <strong dir="ltr">{row.value} {row.unit}</strong> : <div className="result-entry"><NumberInput id={`persistent-value-${row.id}`} label={t('Numeric result')} hideLabel value={values[row.id] === '' ? '' : Number(values[row.id])} allowEmpty min={-1000000000} max={1000000000} step={0.1} onChange={(_e, d) => setValues(v => ({ ...v, [row.id]: d.value === '' ? '' : String(d.value) }))} /><span className="result-unit">{row.unit || '—'}</span><Button kind="ghost" size="sm" hasIconOnly renderIcon={Save} iconDescription={t('Save result')} disabled={busy === row.id || values[row.id] === '' || !Number.isFinite(Number(values[row.id]))} onClick={() => void act(row.id, `/api/results/${row.id}`, 'PATCH', { value: Number(values[row.id]), expectedVersion: row.version })} /></div>}</TableCell><TableCell><Tag type={statusType[row.status]}>{t(row.status)}</Tag></TableCell><TableCell><div className="row-actions">{row.status === 'Entered' && <Button kind="ghost" size="sm" renderIcon={Checkmark} disabled={Boolean(busy)} onClick={() => void act(row.id, `/api/results/${row.id}/review`, 'POST', { action: 'review', expectedVersion: row.version })}>{t('Technical review')}</Button>}{row.status === 'Technical review' && <Button kind="primary" size="sm" renderIcon={Checkmark} disabled={Boolean(busy) || row.enteredBy === null} onClick={() => void act(row.id, `/api/results/${row.id}/review`, 'POST', { action: 'validate', expectedVersion: row.version })}>{t('Validate')}</Button>}{row.status === 'Critical pending' && <Tag type="red">{t('Escalation required')}</Tag>}</div></TableCell></TableRow>)}</TableBody></Table>{loading && <div className="empty-state">{t('Loading results…')}</div>}{!loading && rows.length === 0 && <div className="empty-state">{t('No result records yet. Create one from a registered specimen above.')}</div>}</div>
      <div className="compliance-note"><span>{localeTag === 'ar' ? 'القيم المرجعية والحرجة غير معتمدة افتراضياً. لا تستخدم هذه الشاشة لاتخاذ قرارات علاجية أو لإصدار تقارير سريرية قبل التحقق السريري والتنظيمي.' : 'Reference and critical intervals are not approved by default. Do not use this screen for care decisions or clinical report release before clinical and regulatory validation.'}</span></div>
    </section>
  </>;
}
