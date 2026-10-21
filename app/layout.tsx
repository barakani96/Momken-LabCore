import '@carbon/styles/css/styles.css';
import './globals.css';
import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { I18nProvider } from '@/components/i18n-provider';
export const metadata: Metadata = { title: 'Northstar | ERP + LIMS', description: 'Clinical laboratory operations and enterprise resource planning' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700&family=Noto+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body><I18nProvider><AppShell>{children}</AppShell></I18nProvider></body>
    </html>
  );
}
