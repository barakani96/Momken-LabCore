import { PortalReportView } from '@/components/portal-report-view';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Secure laboratory report', robots: { index: false, follow: false } };
export default async function PortalReportPage({ params }: { params: Promise<{ token: string }> }) {
 const { token } = await params;
 return <PortalReportView token={token} />;
}
