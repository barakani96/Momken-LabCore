/* eslint-disable react/jsx-key */
'use client';
import { useCallback, useEffect, useState } from 'react';
import { Add, Renew, Search, UserMultiple } from '@carbon/icons-react';
import { Breadcrumb, BreadcrumbItem, Button, InlineNotification, Modal, Select, SelectItem, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag, TextInput } from '@carbon/react';
import { useI18n } from '@/components/i18n-provider';

type Patient = { id: string; patientNumber: string; givenName: string; familyName: string; dateOfBirth: string | null; sexAtBirth: string | null; createdAt: string };
export function PatientRegistry() {
  const { t, locale, direction } = useI18n();
  const [rows, setRows] = useState<Patient[]>([]); const [query, setQuery] = useState(''); const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false); const [patientNumber, setPatientNumber] = useState(''); const [givenName, setGivenName] = useState(''); const [familyName, setFamilyName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState(''); const [sexAtBirth, setSexAtBirth] = useState('Unknown'); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const load = useCallback(async (q = '') => { setLoading(true); try { const response = await fetch(`/api/patients?q=${encodeURIComponent(q)}`, { cache: 'no-store' }); const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to load patient registry.'); setRows(body.data); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load patient registry.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(''); }, [load]);
  async function submit(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); setError(''); setMessage(''); try { const response = await fetch('/api/patients', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ patientNumber, givenName, familyName, dateOfBirth, sexAtBirth }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to register patient.'); setMessage(`${body.data.patientNumber} · ${body.data.givenName} ${body.data.familyName}`); setOpen(false); setPatientNumber(''); setGivenName(''); setFamilyName(''); setDateOfBirth(''); setSexAtBirth('Unknown'); await load(''); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to register patient.'); } }
  const fmtDate = (value: string | null) => value ? new Date(value).toLocaleDateString(locale === 'ar' ? 'ar' : 'en-GB') : '—';
  return <>
    <Breadcrumb noTrailingSlash dir={direction}><BreadcrumbItem href="/overview">{t('Home')}</BreadcrumbItem><BreadcrumbItem href="/people">{t('Enterprise')}</BreadcrumbItem><BreadcrumbItem isCurrentPage>{t('Patient registry')}</BreadcrumbItem></Breadcrumb>
    <div className="page-heading"><div><div className="eyebrow">{t('IDENTITY & REGISTRATION')}</div><h1>{t('Patient registry')}</h1><p className="page-description">{t('Search and register unique patient identities used by laboratory orders.')}</p></div><div className="heading-actions"><Button kind="secondary" renderIcon={Renew} onClick={() => void load()}>{t('Refresh')}</Button><Button renderIcon={Add} onClick={() => { setError(''); setOpen(true); }}>{t('Register patient')}</Button></div></div>
    <div className="context-line"><span><UserMultiple size={16} /> {t('Database-backed registry')}</span><span>{rows.length} {t('records shown')}</span></div>
    {message && <InlineNotification kind="success" lowContrast title={t('Patient registered')} subtitle={message} onCloseButtonClick={() => setMessage('')} className="notice" />}
    {error && <InlineNotification kind="error" title={t('Action could not be completed')} subtitle={error} onCloseButtonClick={() => setError('')} className="notice" />}
    <section className="worklist-panel"><div className="panel-header"><div><h2>{t('Registered patients')}</h2><p>{t('Patient identifiers are unique. Duplicate IDs are rejected rather than silently overwritten.')}</p></div><Tag type="cool-gray">{rows.length} {t('records')}</Tag></div>
      <form className="filter-toolbar" onSubmit={e => { e.preventDefault(); void load(query); }}><div className="search-field"><TextInput id="patient-search" labelText={t('Search patients')} placeholder={t('Search patient ID or name')} value={query} onChange={e => setQuery(e.target.value)} /></div><Button type="submit" renderIcon={Search}>{t('Search')}</Button><Button kind="ghost" type="button" onClick={() => { setQuery(''); void load(''); }}>{t('Clear filters')}</Button></form>
      <div className="table-wrap"><Table aria-label={t('Registered patients')}><TableHead><TableRow><TableHeader>{t('Patient ID')}</TableHeader><TableHeader>{t('Patient name')}</TableHeader><TableHeader>{t('Date of birth')}</TableHeader><TableHeader>{t('Sex at birth')}</TableHeader><TableHeader>{t('Registered')}</TableHeader></TableRow></TableHead><TableBody>{rows.map(row => <TableRow key={row.id}><TableCell><strong dir="ltr">{row.patientNumber}</strong></TableCell><TableCell>{row.givenName} {row.familyName}</TableCell><TableCell>{fmtDate(row.dateOfBirth)}</TableCell><TableCell>{row.sexAtBirth ? t(row.sexAtBirth) : '—'}</TableCell><TableCell>{fmtDate(row.createdAt)}{loading ? ' · …' : ''}</TableCell></TableRow>)}</TableBody></Table>
        {!loading && rows.length === 0 && <div className="empty-state"><h3>{t('No patients found')}</h3><p>{t('Search by patient number or register a new patient record.')}</p></div>}
      </div>
    </section>
    <Modal open={open} modalHeading={t('Register patient')} primaryButtonText={t('Save patient')} secondaryButtonText={t('Cancel')} onRequestClose={() => setOpen(false)} onRequestSubmit={() => document.getElementById('patient-register-submit')?.click()}>
      <form id="patient-register-form" className="registration-form" dir={direction} onSubmit={submit}>
        <p className="modal-intro">{t('Create a unique identity record. Do not enter real patient data in this development environment.')}</p>
        <TextInput id="patient-number" labelText={t('Patient ID')} placeholder="PAT-004289" value={patientNumber} onChange={e => setPatientNumber(e.target.value)} required />
        <div className="form-two-col"><TextInput id="patient-given-name" labelText={t('Given name')} value={givenName} onChange={e => setGivenName(e.target.value)} required /><TextInput id="patient-family-name" labelText={t('Family name')} value={familyName} onChange={e => setFamilyName(e.target.value)} required /></div>
        <TextInput id="patient-dob" type="date" labelText={t('Date of birth')} value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} />
        <Select id="patient-sex" labelText={t('Sex at birth')} value={sexAtBirth} onChange={e => setSexAtBirth(e.target.value)}><SelectItem value="Unknown" text={t('Unknown')} /><SelectItem value="Female" text={t('Female')} /><SelectItem value="Male" text={t('Male')} /><SelectItem value="Intersex" text={t('Intersex')} /></Select>
        <button id="patient-register-submit" type="submit" hidden aria-hidden="true">Save</button>
      </form>
    </Modal>
  </>;
}
