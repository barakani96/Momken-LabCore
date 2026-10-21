import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { translate, directionFor, isLocale, locales } from '../lib/i18n.ts';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('English and Arabic locales are supported and directions are correct', () => {
  assert.deepEqual(locales, ['en', 'ar']);
  assert.equal(directionFor('en'), 'ltr');
  assert.equal(directionFor('ar'), 'rtl');
  assert.equal(isLocale('ar'), true);
  assert.equal(isLocale('fr'), false);
});

test('Arabic translations cover navigation, worklist, filters, and specimen form', () => {
  const cases = [
    ['Overview', 'نظرة عامة'], ['Laboratory', 'المختبر'], ['Specimen worklist', 'قائمة العينات'],
    ['Export CSV', 'تصدير CSV'], ['Accession', 'رقم التسجيل'], ['Patient', 'المريض'],
    ['Status', 'الحالة'], ['Priority', 'الأولوية'], ['Clear filters', 'مسح عوامل التصفية'],
    ['Register specimen', 'تسجيل عينة'], ['Patient full name', 'اسم المريض الكامل'],
    ['Patient ID', 'رقم المريض'], ['Specimen type', 'نوع العينة'], ['Authorized', 'معتمد']
  ];
  for (const [source, expected] of cases) assert.equal(translate('ar', source), expected, source);
  assert.equal(translate('en', 'Specimen worklist'), 'Specimen worklist');
  assert.equal(translate('ar', 'Untranslated laboratory extension'), 'Untranslated laboratory extension');
});

test('language switch updates document language and direction and persists preference', async () => {
  const provider = await read('../components/i18n-provider.tsx');
  const shell = await read('../components/app-shell.tsx');
  assert.match(provider, /document\.documentElement\.lang = locale/);
  assert.match(provider, /document\.documentElement\.dir = direction/);
  assert.match(provider, /localStorage\.setItem\('northstar-locale', locale\)/);
  assert.match(provider, /current => current === 'en' \? 'ar' : 'en'/);
  assert.match(shell, /onClick=\{toggleLocale\}/);
  assert.match(shell, /dir=\{direction\}/);
});

test('key screens propagate RTL direction to Carbon navigation, worklist table, and form', async () => {
  const shell = await read('../components/app-shell.tsx');
  const worklist = await read('../components/worklist.tsx');
  const css = await read('../app/globals.css');
  assert.match(shell, /<SideNav[\s\S]*?aria-label/);
  assert.match(shell, /className="content-frame" dir=\{direction\}/);
  assert.match(worklist, /className="filter-toolbar" dir=\{direction\}/);
  assert.match(worklist, /className="table-wrap" dir=\{direction\}/);
  assert.match(worklist, /<form dir=\{direction\} className="registration-form"/);
  assert.match(css, /html\[dir='rtl'\] \.cds--side-nav/);
  assert.match(css, /html\[dir='rtl'\] \.cds--data-table/);
  assert.match(css, /overflow-wrap: anywhere/);
});


test('Google Fonts provide the shared Carbon and Arabic font stacks without IBM Plex', async () => {
  const layout = await read('../app/layout.tsx');
  const css = await read('../app/globals.css');
  assert.match(layout, /fonts\.googleapis\.com\/css2\?family=Noto\+Sans\+Arabic/);
  assert.match(layout, /family=Noto\+Sans:wght/);
  assert.match(layout, /fonts\.gstatic\.com/);
  assert.match(css, /--app-font-sans: 'Noto Sans', 'Noto Sans Arabic', sans-serif/);
  assert.match(css, /--cds-font-family-sans: var\(--app-font-sans\)/);
  assert.match(css, /html\[dir='rtl'\] body, html\[dir='rtl'\] body \* \{ font-family: 'Noto Sans Arabic'/);
  assert.doesNotMatch(css + layout, /IBM Plex|@ibm\/plex/i);
});

test('results workbench route and core labels have Arabic coverage', async () => {
  const page = await read('../app/results/page.tsx');
  const component = await read('../components/results-workbench.tsx');
  assert.match(page, /ResultsWorkbench/);
  assert.match(component, /dir=\{direction\}/);
  for (const [source, expected] of [
    ['Results & validation', 'النتائج والتحقق'], ['Result workbench', 'مساحة عمل النتائج'],
    ['Needs entry', 'بانتظار الإدخال'], ['Technical review', 'المراجعة الفنية'],
    ['Reference interval', 'المجال المرجعي'], ['Critical high', 'مرتفع حرج']
  ]) assert.equal(translate('ar', source), expected, source);
});


test('catalog and order workbenches have routes and Arabic coverage', async () => {
  const catalogPage = await read('../app/catalog/page.tsx');
  const orderPage = await read('../app/orders/page.tsx');
  const catalog = await read('../components/test-catalog.tsx');
  const orders = await read('../components/order-workbench.tsx');
  assert.match(catalogPage, /TestCatalog/);
  assert.match(orderPage, /OrderWorkbench/);
  assert.match(catalog, /dir=\{direction\}/);
  assert.match(orders, /dir=\{direction\}/);
  for (const [source, expected] of [
    ['Test catalog', 'دليل الفحوصات'], ['Orders & accessioning', 'الطلبات وتسجيل العينات'],
    ['Test definitions', 'تعريفات الفحوصات'], ['Requested tests', 'الفحوصات المطلوبة'],
    ['Create laboratory order', 'إنشاء طلب مختبري'], ['Required specimen', 'العينة المطلوبة']
  ]) assert.equal(translate('ar', source), expected, source);
});
