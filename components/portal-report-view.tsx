'use client';
import { useEffect, useState } from 'react';
import { Button, InlineLoading, InlineNotification, Tag, Theme } from '@carbon/react';
type Report = { reportNumber: string; version: number; snapshot: Record<string, unknown> };
export function PortalReportView({ token }: { token: string }) {
 const [report, setReport] = useState<Report | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
 useEffect(() => { let live = true; fetch(`/api/portal/reports/${encodeURIComponent(token)}`, { cache: 'no-store', credentials: 'omit' }).then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error ?? 'Unable to load report.'); return body.data as Report; }).then(v => { if(live)setReport(v); }).catch(e => { if(live)setError(e instanceof Error ? e.message : 'Unable to load report.'); }).finally(() => { if(live)setLoading(false); }); return () => { live = false; }; }, [token]);
 const snapshot = report?.snapshot as { patient?: { name?: string; patientNumber?: string }; specimen?: { accession?: string; collectedAt?: string }; results?: Array<{ name?: string; code?: string; value?: string; unit?: string; referenceLow?: string | null; referenceHigh?: string | null; status?: string }>; report?: { issuedAt?: string; correctionReason?: string | null } } | undefined;
 return <Theme theme="white"><main className="portal-report-page" dir="auto"><header><p className="portal-eyebrow">NORTHSTAR · PATIENT PORTAL</p><h1>Secure laboratory report</h1><p>Confidential health information. Do not share this page or access link.</p></header>
 {loading && <InlineLoading description="Loading report securely…" />}
 {error && <InlineNotification kind="error" title="Report unavailable" subtitle={error} hideCloseButton />}
 {report && snapshot && <article className="portal-report-card"><div className="portal-report-heading"><div><h2>{report.reportNumber}</h2><p>Version {report.version} · {snapshot.report?.issuedAt ? new Date(snapshot.report.issuedAt).toLocaleString() : ''}</p></div><Tag type="green">Released</Tag></div>
 <section><h3>Patient</h3><p>{snapshot.patient?.name ?? '—'} · {snapshot.patient?.patientNumber ?? '—'}</p><p>Accession: {snapshot.specimen?.accession ?? '—'}</p></section>
 <section><h3>Results</h3><div className="portal-results-table"><div className="portal-results-row portal-results-head"><span>Test</span><span>Result</span><span>Reference interval</span></div>{(snapshot.results ?? []).map((r,i)=><div className="portal-results-row" key={`${r.code}-${i}`}><span>{r.name ?? r.code ?? 'Test'}</span><strong>{r.value ?? '—'} {r.unit ?? ''}</strong><span>{r.referenceLow ?? '—'} – {r.referenceHigh ?? '—'}</span></div>)}</div></section>
 {snapshot.report?.correctionReason && <InlineNotification kind="warning" title="Corrected report" subtitle={snapshot.report.correctionReason} hideCloseButton />}
 <p className="portal-disclaimer">Interpretation of laboratory results should be made by a qualified healthcare professional in the context of your clinical history.</p><Button onClick={() => window.print()}>Print report</Button></article>}
 <footer>Northstar ERP + LIMS · Secure report access</footer></main></Theme>;
}
