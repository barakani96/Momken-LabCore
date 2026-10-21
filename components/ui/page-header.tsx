import type { ReactNode } from 'react';
import { Breadcrumb, BreadcrumbItem } from '@carbon/react';

// Carbon-composed page header used by every module: breadcrumb, productive heading, description and an actions slot.
export function PageHeader({ crumbs, title, description, actions }: { crumbs: { label: string; href?: string }[]; title: string; description?: string; actions?: ReactNode }) {
  return (
    <header style={{ marginBlockEnd: '1.5rem' }}>
      <Breadcrumb noTrailingSlash>
        {crumbs.map((c, i) => <BreadcrumbItem key={c.label} href={c.href} isCurrentPage={i === crumbs.length - 1}>{c.label}</BreadcrumbItem>)}
      </Breadcrumb>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem', marginBlockStart: '0.75rem' }}>
        <div>
          <h1 className="cds--type-productive-heading-05">{title}</h1>
          {description && <p className="cds--type-body-compact-01" style={{ marginBlockStart: '0.5rem', maxInlineSize: '48rem', color: 'var(--cds-text-secondary)' }}>{description}</p>}
        </div>
        {actions && <div style={{ display: 'flex', gap: '0.5rem' }}>{actions}</div>}
      </div>
    </header>
  );
}
