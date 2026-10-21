/* eslint-disable react/jsx-key */
'use client';
import { useMemo, useState } from 'react';
import { Breadcrumb, BreadcrumbItem, Button, Dropdown, InlineNotification, Pagination, Tag, Tile, Table, TableHead, TableRow, TableHeader, TableBody, TableCell, TextInput } from '@carbon/react';
import { Download, Search, ShoppingCart } from '@carbon/icons-react';
import { useI18n } from '@/components/i18n-provider';
import { filterCatalog, seedTestCatalog, type TestDefinition } from '@/lib/catalog';

const departments = ['All departments', 'Hematology', 'Clinical chemistry', 'Coagulation', 'Immunology', 'Urinalysis'];
export function TestCatalog() {
  const { locale, direction, t } = useI18n();
  const [tests] = useState<TestDefinition[]>(seedTestCatalog);
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('All departments');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [notice, setNotice] = useState('');
  const filtered = useMemo(() => filterCatalog(tests, query, department), [tests, query, department]);
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);
  function exportCsv() {
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const headers = ['Code', 'Test name', 'Department', 'Specimen', 'Container', 'Method', 'Unit', 'TAT hours', 'Active'];
    const csv = [headers, ...filtered.map(test => [test.code, test.name, test.department, test.specimenType, test.container, test.method, test.unit, String(test.turnaroundHours), String(test.active)])].map(row => row.map(escape).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' })); const a = document.createElement('a'); a.href = url; a.download = 'northstar-test-catalog.csv'; a.click(); URL.revokeObjectURL(url);
  }
  return <>
    <Breadcrumb noTrailingSlash dir={direction}><BreadcrumbItem href="/worklist">{t('Home')}</BreadcrumbItem><BreadcrumbItem href="/worklist">{t('Laboratory')}</BreadcrumbItem><BreadcrumbItem isCurrentPage>{t('Test catalog')}</BreadcrumbItem></Breadcrumb>
    <div className="page-heading"><div><div className="eyebrow">{t('LABORATORY OPERATIONS / CATALOG')}</div><h1>{t('Test catalog')}</h1><p className="page-description">{t('Central definitions for test ordering, specimen requirements, analytical methods, and units.')}</p></div><div className="heading-actions"><Button kind="secondary" renderIcon={Download} onClick={exportCsv}>{t('Export CSV')}</Button><Button renderIcon={ShoppingCart} href="/orders">{t('Create order')}</Button></div></div>
    <div className="context-line"><span><span className="live-dot"/> {t('Fictional demonstration data')}</span><span>{t('Reference intervals are not configured in this increment')}</span></div>
    <div className="metric-grid"><Tile className="metric-tile"><div className="metric-label">{t('Catalog tests')}</div><div className="metric-value">{tests.length}</div><div className="metric-foot">{t('Current catalog')}</div></Tile><Tile className="metric-tile"><div className="metric-label">{t('Active tests')}</div><div className="metric-value">{tests.filter(test => test.active).length}</div><div className="metric-foot">{t('Available for ordering')}</div></Tile><Tile className="metric-tile"><div className="metric-label">{t('Departments')}</div><div className="metric-value">{new Set(tests.map(test => test.department)).size}</div><div className="metric-foot">{t('Catalog grouping')}</div></Tile><Tile className="metric-tile"><div className="metric-label">{t('Specimen types')}</div><div className="metric-value">{new Set(tests.map(test => test.specimenType)).size}</div><div className="metric-foot">{t('Collection requirements')}</div></Tile></div>
    {notice && <InlineNotification kind="info" lowContrast title={t('Catalog information')} subtitle={notice} onCloseButtonClick={() => setNotice('')} className="notice" />}
    <section className="worklist-panel" dir={direction}><div className="panel-header"><div><h2>{t('Test definitions')}</h2><p>{t('Search test codes, departments, methods, and specimen types.')}</p></div><Tag type="cool-gray">{filtered.length} {t('records')}</Tag></div>
      <div className="filter-toolbar" dir={direction}><div className="search-field"><TextInput id="catalog-search" labelText={t('Search catalog')} placeholder={t('Search code, test, method…')} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></div><div className="filter-select"><Dropdown id="catalog-department" titleText={t('Department')} label={t('All departments')} items={departments.map(t)} selectedItem={t(department)} onChange={({ selectedItem }) => { setDepartment(departments.find(item => t(item) === selectedItem) ?? 'All departments'); setPage(1); }} /></div><Button kind="ghost" renderIcon={Search} onClick={() => { setQuery(''); setDepartment('All departments'); setPage(1); }}>{t('Clear filters')}</Button></div>
      <div className="table-wrap"><Table size="lg" aria-label={t('Test definitions')}><TableHead><TableRow>{['Code', 'Test', 'Department', 'Specimen', 'Container', 'Method', 'Unit', 'TAT', 'Status'].map(col => <TableHeader key={col}>{t(col)}</TableHeader>)}</TableRow></TableHead><TableBody>{rows.map(test => <TableRow key={test.code}><TableCell><strong dir="ltr">{test.code}</strong></TableCell><TableCell><strong>{t(test.name)}</strong></TableCell><TableCell>{t(test.department)}</TableCell><TableCell>{t(test.specimenType)}</TableCell><TableCell>{t(test.container)}</TableCell><TableCell>{t(test.method)}</TableCell><TableCell><span dir="ltr">{test.unit}</span></TableCell><TableCell>{test.turnaroundHours} {t('hours')}</TableCell><TableCell><Tag type={test.active ? 'green' : 'gray'}>{test.active ? t('Active') : t('Inactive')}</Tag></TableCell></TableRow>)}</TableBody></Table>
      {filtered.length === 0 && <div className="empty-state"><Search size={24}/><strong>{t('No tests match these filters')}</strong><p>{t('Try another search term or clear the filters.')}</p><Button kind="tertiary" onClick={() => { setQuery(''); setDepartment('All departments'); }}>{t('Clear filters')}</Button></div>}</div>
      <Pagination totalItems={filtered.length} page={page} pageSize={pageSize} pageSizes={[10, 20, 50]} onChange={({ page: nextPage, pageSize: nextSize }) => { setPage(nextPage); setPageSize(nextSize); }} itemRangeText={(min, max, total) => locale === 'ar' ? `${min}–${max} من ${total}` : `${min}–${max} of ${total}`} pageRangeText={(current, total) => locale === 'ar' ? `الصفحة ${current} من ${total}` : `Page ${current} of ${total}`} />
    </section><div className="compliance-note">{t('Catalog values are fictional examples. Validate specimen and method requirements locally before clinical use.')}</div>
  </>;
}
