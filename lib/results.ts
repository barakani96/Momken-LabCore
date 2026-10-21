export type ResultFlag = 'Low' | 'Normal' | 'High' | 'Critical low' | 'Critical high' | 'Not entered';
export type ResultStatus = 'Needs entry' | 'Entered' | 'Technical review';
export type LabResult = {
  id: string;
  accession: string;
  patientName: string;
  patientId: string;
  department: string;
  testCode: string;
  testName: string;
  value: string;
  unit: string;
  referenceLow: number;
  referenceHigh: number;
  criticalLow?: number;
  criticalHigh?: number;
  status: ResultStatus;
  reviewedBy?: string;
  reviewedAt?: string;
};

// Fictional demonstration values and intervals only; not suitable for clinical use.
export const seedResults: LabResult[] = [
  { id: 'res-001', accession: 'LAB-2026-001842', patientName: 'Amal Hassan', patientId: 'PAT-004281', department: 'Hematology', testCode: 'HGB', testName: 'Hemoglobin', value: '10.8', unit: 'g/dL', referenceLow: 12, referenceHigh: 16, criticalLow: 6, criticalHigh: 20, status: 'Entered' },
  { id: 'res-002', accession: 'LAB-2026-001842', patientName: 'Amal Hassan', patientId: 'PAT-004281', department: 'Hematology', testCode: 'WBC', testName: 'White blood cells', value: '7.4', unit: '10⁹/L', referenceLow: 4, referenceHigh: 11, criticalLow: 1, criticalHigh: 50, status: 'Entered' },
  { id: 'res-003', accession: 'LAB-2026-001843', patientName: 'Nabil Abdullah', patientId: 'PAT-004282', department: 'Clinical chemistry', testCode: 'GLU', testName: 'Glucose, random', value: '168', unit: 'mg/dL', referenceLow: 70, referenceHigh: 140, criticalLow: 40, criticalHigh: 500, status: 'Entered' },
  { id: 'res-004', accession: 'LAB-2026-001844', patientName: 'Maha Mohammed', patientId: 'PAT-004283', department: 'Clinical chemistry', testCode: 'ALT', testName: 'Alanine aminotransferase', value: '32', unit: 'U/L', referenceLow: 7, referenceHigh: 35, criticalLow: 0, criticalHigh: 1000, status: 'Technical review' },
  { id: 'res-005', accession: 'LAB-2026-001849', patientName: 'Omar Yahya', patientId: 'PAT-004288', department: 'Clinical chemistry', testCode: 'K', testName: 'Potassium', value: '6.3', unit: 'mmol/L', referenceLow: 3.5, referenceHigh: 5.1, criticalLow: 2.5, criticalHigh: 6, status: 'Entered' },
  { id: 'res-006', accession: 'LAB-2026-001847', patientName: 'Faris Yasin', patientId: 'PAT-004286', department: 'Coagulation', testCode: 'INR', testName: 'INR', value: '', unit: '', referenceLow: 0.8, referenceHigh: 1.2, criticalLow: 0.5, criticalHigh: 8, status: 'Needs entry' },
  { id: 'res-007', accession: 'LAB-2026-001848', patientName: 'Safa Nasser', patientId: 'PAT-004287', department: 'Immunology', testCode: 'TSH', testName: 'Thyroid stimulating hormone', value: '2.1', unit: 'mIU/L', referenceLow: 0.4, referenceHigh: 4, criticalLow: 0.01, criticalHigh: 100, status: 'Technical review' },
  { id: 'res-008', accession: 'LAB-2026-001845', patientName: 'Yousef Saleh', patientId: 'PAT-004284', department: 'Immunology', testCode: 'CRP', testName: 'C-reactive protein', value: '8.2', unit: 'mg/L', referenceLow: 0, referenceHigh: 5, criticalLow: 0, criticalHigh: 500, status: 'Entered' },
];

export function parseResultValue(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function flagResult(result: LabResult): ResultFlag {
  const value = parseResultValue(result.value);
  if (value === null) return 'Not entered';
  if (result.criticalLow !== undefined && value < result.criticalLow) return 'Critical low';
  if (result.criticalHigh !== undefined && value > result.criticalHigh) return 'Critical high';
  if (value < result.referenceLow) return 'Low';
  if (value > result.referenceHigh) return 'High';
  return 'Normal';
}

export function validateResultEntry(value: string): string | null {
  if (!value.trim()) return 'A numeric result is required.';
  if (parseResultValue(value) === null) return 'Enter a valid numeric result.';
  return null;
}

export function filterResults(rows: LabResult[], query: string, status: string, department: string): LabResult[] {
  const q = query.trim().toLocaleLowerCase();
  return rows.filter(row => {
    const matchesQuery = !q || [row.accession, row.patientName, row.patientId, row.testCode, row.testName, row.department].some(v => v.toLocaleLowerCase().includes(q));
    return matchesQuery && (status === 'All statuses' || row.status === status) && (department === 'All departments' || row.department === department);
  });
}

export function submitForTechnicalReview(result: LabResult, reviewer: string, reviewedAt: string): LabResult {
  if (validateResultEntry(result.value)) throw new Error('Cannot review a missing or invalid result.');
  if (flagResult(result) === 'Critical low' || flagResult(result) === 'Critical high') {
    throw new Error('Critical-range demonstration result requires a separate critical-result workflow.');
  }
  if (result.status === 'Technical review') throw new Error('Result is already in technical review.');
  return { ...result, status: 'Technical review', reviewedBy: reviewer, reviewedAt };
}
