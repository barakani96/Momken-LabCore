export const specimenStatuses = ['Collected', 'In progress', 'Pending review', 'Authorized', 'Rejected'] as const;
export type SpecimenStatus = (typeof specimenStatuses)[number];
export type Priority = 'Routine' | 'Urgent' | 'STAT';
export type Specimen = {
  id: string; accession: string; patientId: string; patientName: string; tests: string[];
  specimenType: string; priority: Priority; status: SpecimenStatus; collectedAt: string;
  department: string; orderingClinician: string;
};
export const seedSpecimens: Specimen[] = [
  { id: 'sp-1842', accession: 'LAB-2026-001842', patientId: 'PAT-004281', patientName: 'Amal Hassan', tests: ['CBC'], specimenType: 'EDTA whole blood', priority: 'STAT', status: 'In progress', collectedAt: '2026-10-21T07:42:00+03:00', department: 'Hematology', orderingClinician: 'Dr. Samir Ali' },
  { id: 'sp-1843', accession: 'LAB-2026-001843', patientId: 'PAT-004282', patientName: 'Nabil Abdullah', tests: ['HbA1c', 'GLU'], specimenType: 'Fluoride plasma', priority: 'Routine', status: 'Collected', collectedAt: '2026-10-21T07:48:00+03:00', department: 'Clinical chemistry', orderingClinician: 'Dr. Rania Saleh' },
  { id: 'sp-1844', accession: 'LAB-2026-001844', patientId: 'PAT-004283', patientName: 'Maha Mohammed', tests: ['ALT', 'AST', 'ALP', 'BIL'], specimenType: 'Serum', priority: 'Routine', status: 'Pending review', collectedAt: '2026-10-21T07:12:00+03:00', department: 'Clinical chemistry', orderingClinician: 'Dr. Khaled Omar' },
  { id: 'sp-1845', accession: 'LAB-2026-001845', patientId: 'PAT-004284', patientName: 'Yousef Saleh', tests: ['CRP'], specimenType: 'Serum', priority: 'Urgent', status: 'Collected', collectedAt: '2026-10-21T08:01:00+03:00', department: 'Immunology', orderingClinician: 'Dr. Samir Ali' },
  { id: 'sp-1846', accession: 'LAB-2026-001846', patientId: 'PAT-004285', patientName: 'Huda Ahmed', tests: ['UA'], specimenType: 'Urine', priority: 'Routine', status: 'Authorized', collectedAt: '2026-10-21T06:58:00+03:00', department: 'Urinalysis', orderingClinician: 'Dr. Muneer Qasim' },
  { id: 'sp-1847', accession: 'LAB-2026-001847', patientId: 'PAT-004286', patientName: 'Faris Yasin', tests: ['PT', 'INR'], specimenType: 'Citrated plasma', priority: 'Urgent', status: 'In progress', collectedAt: '2026-10-21T08:06:00+03:00', department: 'Coagulation', orderingClinician: 'Dr. Rania Saleh' },
  { id: 'sp-1848', accession: 'LAB-2026-001848', patientId: 'PAT-004287', patientName: 'Safa Nasser', tests: ['TSH', 'FT4'], specimenType: 'Serum', priority: 'Routine', status: 'Collected', collectedAt: '2026-10-21T08:11:00+03:00', department: 'Immunology', orderingClinician: 'Dr. Khaled Omar' },
  { id: 'sp-1849', accession: 'LAB-2026-001849', patientId: 'PAT-004288', patientName: 'Omar Yahya', tests: ['K', 'Na', 'CREA'], specimenType: 'Lithium heparin plasma', priority: 'STAT', status: 'Pending review', collectedAt: '2026-10-21T07:32:00+03:00', department: 'Clinical chemistry', orderingClinician: 'Dr. Muneer Qasim' }
];
const allowedTransitions: Record<SpecimenStatus, SpecimenStatus[]> = {
  'Collected': ['In progress', 'Rejected'],
  'In progress': ['Pending review', 'Rejected'],
  'Pending review': ['In progress', 'Authorized', 'Rejected'],
  'Authorized': [],
  'Rejected': ['Collected']
};
export function transitionSpecimen(specimen: Specimen, next: SpecimenStatus): Specimen {
  if (!allowedTransitions[specimen.status].includes(next)) {
    throw new Error(`Invalid specimen transition: ${specimen.status} → ${next}`);
  }
  return { ...specimen, status: next };
}
export function filterSpecimens(rows: Specimen[], query: string, status: string): Specimen[] {
  const q = query.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    const matchesQuery = !q || [row.accession, row.patientId, row.patientName, row.department, ...row.tests].some(v => v.toLocaleLowerCase().includes(q));
    return matchesQuery && (status === 'All statuses' || row.status === status);
  });
}
