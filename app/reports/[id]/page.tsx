import { ReportPrintView } from '@/components/report-print-view';
export default async function ReportPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ReportPrintView id={id}/>;}
