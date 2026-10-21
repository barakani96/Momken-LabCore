import { Suspense } from 'react'; import { PatientPortalActivation } from '@/components/patient-portal-auth';
export const metadata={title:'Activate patient portal account',robots:{index:false,follow:false}};
export default function Page(){return <Suspense fallback={<main className="patient-auth">Loading…</main>}><PatientPortalActivation/></Suspense>}
