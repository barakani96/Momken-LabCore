// Currency helpers. Amounts are integer minor units; parsing is string-based so no floating-point error is introduced.
export function minorDigits(currency: string): number {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2; } catch { return 2; }
}
export function parseMajorToMinor(text: string, currency: string): number | null {
  const digits = minorDigits(currency);
  const m = /^(\d{1,12})(?:\.(\d+))?$/.exec(text.trim().replace(/,/g, ''));
  if (!m) return null;
  const frac = m[2] ?? '';
  if (frac.length > digits) return null;
  const minor = Number(m[1]) * 10 ** digits + Number(frac.padEnd(digits, '0') || '0');
  return Number.isSafeInteger(minor) ? minor : null;
}
export function formatMinor(minor: number, currency: string, locale: string): string {
  const digits = minorDigits(currency);
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en', { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(minor / 10 ** digits);
}
