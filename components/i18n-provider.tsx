'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { defaultLocale, directionFor, isLocale, translate, type Locale } from '@/lib/i18n';

export const CARBON_THEMES = ['white', 'g10', 'g90', 'g100'] as const;
export type CarbonTheme = typeof CARBON_THEMES[number];
type I18nValue = { locale: Locale; direction: 'ltr' | 'rtl'; setLocale: (locale: Locale) => void; toggleLocale: () => void; t: (source: string) => string; carbonTheme: CarbonTheme; setCarbonTheme: (theme: CarbonTheme) => void; cycleCarbonTheme: () => void };
const I18nContext = createContext<I18nValue | null>(null);
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [carbonTheme, setCarbonThemeState] = useState<CarbonTheme>('g10');
  useEffect(() => {
    try { const saved = window.localStorage.getItem('northstar-locale'); if (saved && isLocale(saved)) setLocaleState(saved); } catch { /* storage may be disabled */ }
    try { const savedTheme = window.localStorage.getItem('northstar-carbon-theme'); if (savedTheme && (CARBON_THEMES as readonly string[]).includes(savedTheme)) setCarbonThemeState(savedTheme as CarbonTheme); } catch { /* storage may be disabled */ }
  }, []);
  const direction = directionFor(locale);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
    document.documentElement.dataset.locale = locale;
    document.body.dir = direction;
    try { window.localStorage.setItem('northstar-locale', locale); } catch { /* storage may be disabled */ }
  }, [locale, direction]);
  const setCarbonTheme = useCallback((next: CarbonTheme) => { setCarbonThemeState(next); try { window.localStorage.setItem('northstar-carbon-theme', next); } catch { /* storage may be disabled */ } }, []);
  const cycleCarbonTheme = useCallback(() => setCarbonThemeState(current => { const next = CARBON_THEMES[(CARBON_THEMES.indexOf(current) + 1) % CARBON_THEMES.length]; try { window.localStorage.setItem('northstar-carbon-theme', next); } catch { /* storage may be disabled */ } return next; }), []);
  const setLocale = useCallback((next: Locale) => setLocaleState(next), []);
  const toggleLocale = useCallback(() => setLocaleState(current => current === 'en' ? 'ar' : 'en'), []);
  const t = useCallback((source: string) => translate(locale, source), [locale]);
  const value = useMemo(() => ({ locale, direction, setLocale, toggleLocale, t, carbonTheme, setCarbonTheme, cycleCarbonTheme }), [locale, direction, setLocale, toggleLocale, t, carbonTheme, setCarbonTheme, cycleCarbonTheme]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}
