import { Tile } from '@carbon/react';
import { Ltr } from './bidi';

export function KpiTile({ label, value, helper, tone }: { label: string; value: number | string; helper?: string; tone?: 'warning' | 'error' }) {
  const color = tone === 'error' ? 'var(--cds-support-error)' : tone === 'warning' ? 'var(--cds-support-warning)' : 'transparent';
  return (
    <Tile style={{ borderInlineStart: `4px solid ${color}` }}>
      <p className="cds--label">{label}</p>
      <p className="cds--type-productive-heading-05" style={{ marginBlock: '0.25rem' }}><Ltr>{value}</Ltr></p>
      {helper && <p className="cds--type-helper-text-01">{helper}</p>}
    </Tile>
  );
}
export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', gap: '1px', marginBlock: '1rem' }}>{children}</div>;
}
