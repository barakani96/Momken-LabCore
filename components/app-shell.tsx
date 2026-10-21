'use client';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Header, HeaderName, HeaderGlobalBar, HeaderGlobalAction, SideNav, SideNavItems, SideNavLink, SideNavMenu, SideNavMenuItem, Content, Theme } from '@carbon/react';
import { Notification, Search, UserAvatar, Dashboard, Chemistry, Finance, Settings, Language, Logout, ColorPalette } from '@carbon/icons-react';
import { useI18n } from '@/components/i18n-provider';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { locale, toggleLocale, t, direction, carbonTheme, cycleCarbonTheme } = useI18n();
  const pathname = usePathname(); const router = useRouter();
  const [active, setActive] = useState('worklist');
  const [notice, setNotice] = useState(false);
  if (pathname === '/login' || pathname.startsWith('/patient-portal/')) return <>{children}</>;
  async function signOut() { await fetch('/api/auth/logout', { method: 'POST' }); router.replace('/login'); router.refresh(); }
  return <Theme theme={carbonTheme}>
    <Header aria-label="Northstar ERP and LIMS" dir={direction}>
      <HeaderName href="#main" prefix="Northstar">ERP + LIMS</HeaderName>
      <HeaderGlobalBar>
        <HeaderGlobalAction aria-label={`${locale === 'ar' ? 'سمة كربون الحالية' : 'Current Carbon theme'}: ${carbonTheme}. ${locale === 'ar' ? 'تغيير السمة' : 'Change theme'}`} tooltipAlignment="end" onClick={cycleCarbonTheme}><ColorPalette /></HeaderGlobalAction>
        <HeaderGlobalAction aria-label={locale === 'en' ? 'Switch language to Arabic' : 'تغيير اللغة إلى الإنجليزية'} tooltipAlignment="end" onClick={toggleLocale}><Language /></HeaderGlobalAction>
        <HeaderGlobalAction aria-label={t("Search")} onClick={() => { document.getElementById('specimen-search')?.focus(); }}><Search /></HeaderGlobalAction>
        <HeaderGlobalAction aria-label={t("Notifications")} onClick={() => setNotice(!notice)}><Notification /></HeaderGlobalAction>
        <HeaderGlobalAction aria-label={locale === 'ar' ? 'تسجيل الخروج' : 'Sign out'} tooltipAlignment="end" onClick={signOut}><Logout /></HeaderGlobalAction>
      </HeaderGlobalBar>
    </Header>
    <SideNav aria-label={locale === 'ar' ? 'التنقل الرئيسي' : 'Primary navigation'} expanded isFixedNav>
      <SideNavItems>
        <SideNavLink href="/overview" renderIcon={Dashboard} isActive={active === 'overview'} onClick={() => setActive('overview')}>{t("Overview")}</SideNavLink>
        <SideNavMenu title={t("Laboratory")} renderIcon={Chemistry} defaultExpanded>
          <SideNavMenuItem href="/worklist" isActive={active === 'worklist'} onClick={() => setActive('worklist')}>{t("Specimen worklist")}</SideNavMenuItem>
          <SideNavMenuItem href="/orders" onClick={() => setActive('orders')}>{t("Orders & accessioning")}</SideNavMenuItem>
          <SideNavMenuItem href="/reference-ranges" onClick={() => setActive('reference-ranges')}>{locale === 'ar' ? 'الفواصل المرجعية والحرجة' : 'Reference ranges & criticals'}</SideNavMenuItem>
          <SideNavMenuItem href="/results" onClick={() => setActive('results')}>{t("Results & validation")}</SideNavMenuItem><SideNavMenuItem href="/reports" onClick={() => setActive('reports')}>{locale === 'ar' ? 'إصدار التقارير' : 'Report release'}</SideNavMenuItem>
          <SideNavMenuItem href="/catalog" onClick={() => setActive('catalog')}>{t("Test catalog")}</SideNavMenuItem>
          <SideNavMenuItem href="/quality" onClick={() => setActive('quality')}>{t("Quality control")}</SideNavMenuItem><SideNavMenuItem href="/documents" onClick={() => setActive('documents')}>{locale === 'ar' ? 'ضبط الوثائق وSOPs' : 'Document control & SOPs'}</SideNavMenuItem>
        </SideNavMenu>
        <SideNavMenu title={locale === 'ar' ? 'بنك الدم' : 'Blood bank'} renderIcon={Chemistry}><SideNavMenuItem href="/blood-bank" onClick={() => setActive('blood-bank')}>{locale === 'ar' ? 'المتبرعون والمخزون' : 'Donors & inventory'}</SideNavMenuItem><SideNavMenuItem href="/blood-bank/operations" onClick={() => setActive('blood-bank-operations')}>{locale === 'ar' ? 'طلبات ونقل الدم' : 'Requests & transfusions'}</SideNavMenuItem></SideNavMenu>
        <SideNavMenu title={t("Enterprise")} renderIcon={Finance}>
          <SideNavMenuItem href="/patients" onClick={() => setActive('patients')}>{t("Patient registry")}</SideNavMenuItem>
          <SideNavMenuItem href="/finance" onClick={() => setActive('finance')}>{t("Finance")}</SideNavMenuItem>
          <SideNavMenuItem href="/procurement" onClick={() => setActive('procurement')}>{t("Procurement")}</SideNavMenuItem>
          <SideNavMenuItem href="/inventory" onClick={() => setActive('inventory')}>{t("Inventory")}</SideNavMenuItem>
          <SideNavMenuItem href="/people" onClick={() => setActive('people')}>{t("People & organization")}</SideNavMenuItem>
        </SideNavMenu>
        <SideNavMenu title={t("Administration")} renderIcon={Settings}><SideNavMenuItem href="/admin/users" onClick={() => setActive('users')}>{locale === 'ar' ? 'المستخدمون والصلاحيات' : 'Users & permissions'}</SideNavMenuItem><SideNavMenuItem href="/admin/audit" onClick={() => setActive('audit')}>{locale === 'ar' ? 'سجل التدقيق' : 'Audit trail'}</SideNavMenuItem><SideNavMenuItem href="/admin/portal" onClick={() => setActive("portal")}>{locale === "ar" ? "بوابة المرضى" : "Patient portal access"}</SideNavMenuItem><SideNavMenuItem href="/admin/patient-accounts" onClick={() => setActive("patient-accounts")}>{locale === "ar" ? "حسابات المرضى" : "Patient portal accounts"}</SideNavMenuItem><SideNavMenuItem href="/settings" onClick={() => setActive('settings')}>{t("Settings")}</SideNavMenuItem><SideNavMenuItem href="/security" onClick={() => setActive('security')}>{locale === 'ar' ? 'أمان الحساب وMFA' : 'Account security & MFA'}</SideNavMenuItem></SideNavMenu>
      </SideNavItems>
    </SideNav>
    {notice && <div className="notification-popover" role="status"><strong>{t("Notifications")}</strong><p>{t("No new notifications. Critical-result alerts will appear here when configured.")}</p></div>}
    <Content id="main"><div className="content-frame" dir={direction}>{children}</div></Content>
  </Theme>;
}
