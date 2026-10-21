'use client';
import { useState, useEffect } from 'react';
import { Button, TextInput, TextArea, Select, SelectItem, Tile, InlineNotification } from '@carbon/react';
import { Save, Printer, Settings as SettingsIcon } from '@carbon/icons-react';
import { useI18n } from '@/components/i18n-provider';
import Link from 'next/link';

export default function SettingsPage() {
  const { locale } = useI18n();
  const ar = locale === 'ar';

  const [headerTitle, setHeaderTitle] = useState('NORTHSTAR · ERP + LIMS');
  const [headerSubtitle, setHeaderSubtitle] = useState('Controlled clinical report');
  const [footerText, setFooterText] = useState('Electronically released by Northstar. Contact the laboratory for questions about this report.');
  const [logoPlacement, setLogoPlacement] = useState<'left' | 'center' | 'right'>('left');
  const [logoUrl, setLogoUrl] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('northstar_print_config');
      if (raw) {
        const config = JSON.parse(raw);
        if (config.headerTitle) setHeaderTitle(config.headerTitle);
        if (config.headerSubtitle) setHeaderSubtitle(config.headerSubtitle);
        if (config.footerText) setFooterText(config.footerText);
        if (config.logoPlacement) setLogoPlacement(config.logoPlacement);
        if (config.logoUrl) setLogoUrl(config.logoUrl);
      }
    } catch {}
  }, []);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const config = { headerTitle, headerSubtitle, footerText, logoPlacement, logoUrl };
      localStorage.setItem('northstar_print_config', JSON.stringify(config));
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save settings.');
    }
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setError('Logo image file is too large (max 1MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="module-page" dir={ar ? 'rtl' : 'ltr'}>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{ar ? 'الإعدادات / إدارة النظام' : 'SETTINGS / ADMINISTRATION'}</p>
          <h1>{ar ? 'إعدادات الطباعة والتقارير' : 'Print configuration & clinical report settings'}</h1>
          <p className="page-description">
            {ar
              ? 'تخصيص ترويسات التقارير السريرية، وتذييل الصفحات، وموضع شعار المختبر للتقارير المطبوعة والمصدرة.'
              : 'Customize clinical report headers, footers, accreditation disclaimers, and laboratory logo placement for printed reports.'}
          </p>
        </div>
        <div className="page-actions">
          <Button kind="secondary" as={Link} href="/reports">
            {ar ? 'عرض التقارير' : 'View released reports'}
          </Button>
        </div>
      </div>

      {saved && (
        <InlineNotification
          kind="success"
          title={ar ? 'تم الحفظ بنجاح' : 'Settings saved'}
          subtitle={ar ? 'تم تحديث إعدادات الطباعة والترويسة بنجاح وستظهر في كافة التقارير المطبوعة.' : 'Report header, footer, and logo configuration updated successfully.'}
          onCloseButtonClick={() => setSaved(false)}
        />
      )}

      {error && (
        <InlineNotification
          kind="error"
          title={ar ? 'خطأ في الحفظ' : 'Action failed'}
          subtitle={error}
          onCloseButtonClick={() => setError('')}
        />
      )}

      <form onSubmit={handleSave} className="panel-card" style={{ padding: '2rem', marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <h2>{ar ? 'تخصيص الترويسة والتذييل والشعار' : 'Clinical report layout & branding'}</h2>
          <p style={{ color: 'var(--cds-text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {ar ? 'تنطبق هذه الإعدادات فوريًا على معاينة الطباعة للتقارير السريرية المعتمدة.' : 'Changes apply immediately to the report print view for all released reports.'}
          </p>
        </div>

        <TextInput
          id="header-title"
          labelText={ar ? 'عنوان الترويسة / اسم المختبر' : 'Header title / Laboratory name'}
          value={headerTitle}
          onChange={e => setHeaderTitle(e.target.value)}
          helperText={ar ? 'مثال: NORTHSTAR · مستشفى المركز الطبي التخصصي' : 'e.g. NORTHSTAR · Academic Medical Center Laboratory'}
          required
        />

        <TextInput
          id="header-subtitle"
          labelText={ar ? 'العنوان الفرعي للترويسة' : 'Header subtitle / Accreditation note'}
          value={headerSubtitle}
          onChange={e => setHeaderSubtitle(e.target.value)}
          helperText={ar ? 'مثال: معتمد حسب معايير CAP وISO 15189' : 'e.g. ISO 15189 Accredited & CAP Certified Laboratory'}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <Select
            id="logo-placement"
            labelText={ar ? 'موضع الشعار' : 'Logo placement'}
            value={logoPlacement}
            onChange={e => setLogoPlacement(e.target.value as 'left' | 'center' | 'right')}
          >
            <SelectItem value="left" text={ar ? 'يسار الترويسة' : 'Left aligned'} />
            <SelectItem value="center" text={ar ? 'وسط الترويسة' : 'Centered'} />
            <SelectItem value="right" text={ar ? 'يمين الترويسة' : 'Right aligned'} />
          </Select>

          <div>
            <label className="cds--label" style={{ display: 'block', marginBottom: '0.5rem' }}>
              {ar ? 'رفع شعار المختبر (صورة)' : 'Upload laboratory logo'}
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              style={{ fontSize: '0.875rem', padding: '0.5rem 0' }}
            />
            {logoUrl && (
              <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <img src={logoUrl} alt="Logo preview" style={{ height: '36px', objectFit: 'contain' }} />
                <Button kind="ghost" size="sm" type="button" onClick={() => setLogoUrl('')}>
                  {ar ? 'إزالة الشعار' : 'Remove logo'}
                </Button>
              </div>
            )}
          </div>
        </div>

        <TextArea
          id="footer-text"
          labelText={ar ? 'نص تذييل التقرير / إخلاء المسؤولية' : 'Footer disclaimer & release text'}
          value={footerText}
          onChange={e => setFooterText(e.target.value)}
          rows={3}
          helperText={ar ? 'النص القانوني أو السريري الذي يظهر أسفل كل تقرير مطبوع.' : 'Mandatory regulatory and quality disclaimer displayed at the bottom of printed reports.'}
          required
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
          <Button type="submit" renderIcon={Save} size="lg">
            {ar ? 'حفظ إعدادات الطباعة' : 'Save print configuration'}
          </Button>
        </div>
      </form>
    </div>
  );
}
