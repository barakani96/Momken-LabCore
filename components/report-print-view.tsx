/* eslint-disable react/jsx-key */
'use client';
import { useEffect, useState } from 'react';
import { Button, InlineNotification, Tag, Tile } from '@carbon/react';
import { Printer, ArrowLeft } from '@carbon/icons-react';
import { useI18n } from '@/components/i18n-provider';

type Snapshot = {
  patient?: { patientNumber?: string; name?: string; dateOfBirth?: string | null; sexAtBirth?: string | null };
  specimen?: { accession?: string; type?: string; department?: string; collectedAt?: string };
  results?: Array<{ code: string; name: string; value: string; unit: string; referenceLow: string | null; referenceHigh: string | null; status: string }>;
  report?: { reportNumber: string; version: number; issuedAt: string; correctionReason: string | null };
};

type PrintConfig = {
  headerTitle: string;
  headerSubtitle: string;
  footerText: string;
  logoPlacement: 'left' | 'center' | 'right';
  logoUrl: string;
};

export function ReportPrintView({ id }: { id: string }) {
  const { locale } = useI18n();
  const ar = locale === 'ar';
  const [report, setReport] = useState<{ snapshot: Snapshot; status: string; releasedAt: string; reportNumber: string; version: number; correctionReason: string | null } | null>(null);
  const [error, setError] = useState('');
  const [config, setConfig] = useState<PrintConfig>({
    headerTitle: 'NORTHSTAR · ERP + LIMS',
    headerSubtitle: 'Controlled clinical report',
    footerText: 'Electronically released by Northstar. Contact the laboratory for questions about this report.',
    logoPlacement: 'left',
    logoUrl: ''
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem('northstar_print_config');
      if (raw) {
        const parsed = JSON.parse(raw);
        setConfig(c => ({ ...c, ...parsed }));
      }
    } catch {}

    let alive = true;
    fetch(`/api/reports/${id}`).then(async r => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Unable to load report.');
      if (alive) setReport(j.data);
    }).catch(e => {
      if (alive) setError(e instanceof Error ? e.message : 'Unable to load report.');
    });
    return () => { alive = false; };
  }, [id]);

  const s = report?.snapshot;
  if (!s) return <div className="report-page">{error ? <InlineNotification kind="error" title={error} /> : <p>{ar ? 'جارٍ تحميل التقرير…' : 'Loading report…'}</p>}</div>;

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: config.logoPlacement === 'center' ? 'column' : config.logoPlacement === 'right' ? 'row-reverse' : 'row',
    alignItems: config.logoPlacement === 'center' ? 'center' : 'flex-start',
    justifyContent: 'space-between',
    gap: '1rem',
    textAlign: config.logoPlacement === 'center' ? 'center' : config.logoPlacement === 'right' ? 'right' : 'left'
  };

  return (
    <div className="report-page" dir={ar ? 'rtl' : 'ltr'}>
      <div className="report-toolbar no-print">
        <Button kind="tertiary" renderIcon={ArrowLeft} onClick={() => window.location.assign('/reports')}>
          {ar ? 'العودة للتقارير' : 'Back to reports'}
        </Button>
        <Button renderIcon={Printer} onClick={() => window.print()}>
          {ar ? 'طباعة التقرير' : 'Print report'}
        </Button>
      </div>

      <article className="clinical-report">
        <header className="clinical-report-header" style={headerStyle}>
          {config.logoUrl && (
            <div className="report-logo-wrap" style={{ order: config.logoPlacement === 'right' ? 2 : 0 }}>
              <img src={config.logoUrl} alt="Laboratory Logo" style={{ maxHeight: '48px', objectFit: 'contain' }} />
            </div>
          )}
          <div style={{ flex: 1 }}>
            <p className="eyebrow">{config.headerTitle}</p>
            <h1>{ar ? 'تقرير نتائج المختبر' : 'Laboratory Results Report'}</h1>
            <p>{config.headerSubtitle}</p>
          </div>
          <div className="report-number" style={{ order: config.logoPlacement === 'left' ? 2 : 0 }}>
            <strong>{report.reportNumber}</strong>
            <span>{ar ? 'الإصدار' : 'Version'} {report.version}</span>
            <Tag type={report.status === 'Superseded' ? 'red' : 'green'}>{report.status}</Tag>
          </div>
        </header>

        <div className="report-meta-grid">
          <div><span>{ar ? 'اسم المريض' : 'Patient name'}</span><strong>{s.patient?.name || '—'}</strong></div>
          <div><span>{ar ? 'رقم المريض' : 'Patient number'}</span><strong>{s.patient?.patientNumber || '—'}</strong></div>
          <div><span>{ar ? 'تاريخ الميلاد' : 'Date of birth'}</span><strong>{s.patient?.dateOfBirth || '—'}</strong></div>
          <div><span>{ar ? 'الجنس' : 'Sex at birth'}</span><strong>{s.patient?.sexAtBirth || '—'}</strong></div>
          <div><span>{ar ? 'رقم العينة' : 'Accession'}</span><strong>{s.specimen?.accession || '—'}</strong></div>
          <div><span>{ar ? 'نوع العينة' : 'Specimen type'}</span><strong>{s.specimen?.type || '—'}</strong></div>
          <div><span>{ar ? 'القسم' : 'Department'}</span><strong>{s.specimen?.department || '—'}</strong></div>
          <div><span>{ar ? 'وقت الجمع' : 'Collected at'}</span><strong>{s.specimen?.collectedAt ? new Date(s.specimen.collectedAt).toLocaleString(ar ? 'ar' : 'en') : '—'}</strong></div>
        </div>

        <h2>{ar ? 'النتائج' : 'Results'}</h2>
        <table className="clinical-results-table">
          <thead>
            <tr>
              <th>{ar ? 'الفحص' : 'Test'}</th>
              <th>{ar ? 'النتيجة' : 'Result'}</th>
              <th>{ar ? 'الوحدة' : 'Unit'}</th>
              <th>{ar ? 'الفاصل المرجعي' : 'Reference interval'}</th>
              <th>{ar ? 'الحالة' : 'Status'}</th>
            </tr>
          </thead>
          <tbody>
            {(s.results ?? []).map(r => (
              <tr key={r.code}>
                <td><strong>{r.name}</strong><small>{r.code}</small></td>
                <td>{r.value}</td>
                <td>{r.unit || '—'}</td>
                <td>{r.referenceLow ?? '—'} – {r.referenceHigh ?? '—'}</td>
                <td>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {report.correctionReason && (
          <div className="correction-note">
            <strong>{ar ? 'سبب التصحيح' : 'Correction reason'}:</strong> {report.correctionReason}
          </div>
        )}

        <footer className="clinical-report-footer">
          <p>{config.footerText}</p>
          <div><span>{ar ? 'وقت الإصدار' : 'Released at'}</span><strong>{new Date(report.releasedAt).toLocaleString(ar ? 'ar' : 'en')}</strong></div>
          <div><span>{ar ? 'رقم الإصدار' : 'Report version'}</span><strong>{report.reportNumber} · v{report.version}</strong></div>
        </footer>
      </article>
    </div>
  );
}
