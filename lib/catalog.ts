export type SpecimenType = 'EDTA whole blood' | 'Serum' | 'Fluoride plasma' | 'Citrated plasma' | 'Urine';
export type TestDefinition = {
  code: string; name: string; department: string; specimenType: SpecimenType; container: string;
  method: string; unit: string; turnaroundHours: number; active: boolean;
};
export type OrderPriority = 'Routine' | 'Urgent' | 'STAT';
export type DemoOrder = {
  id: string; accession: string; patientId: string; patientName: string; clinician: string;
  priority: OrderPriority; specimenType: SpecimenType; testCodes: string[]; status: 'Ordered' | 'Collected'; createdAt: string;
};

// All values below are fictional demonstration definitions, not clinical guidance.
export const seedTestCatalog: TestDefinition[] = [
  { code: 'CBC', name: 'Complete blood count', department: 'Hematology', specimenType: 'EDTA whole blood', container: 'Lavender-top EDTA tube', method: 'Automated hematology', unit: 'panel', turnaroundHours: 2, active: true },
  { code: 'RETIC', name: 'Reticulocyte count', department: 'Hematology', specimenType: 'EDTA whole blood', container: 'Lavender-top EDTA tube', method: 'Flow cytometry', unit: '%', turnaroundHours: 4, active: true },
  { code: 'CMP', name: 'Comprehensive metabolic panel', department: 'Clinical chemistry', specimenType: 'Serum', container: 'Gold-top serum separator tube', method: 'Photometry / ISE', unit: 'panel', turnaroundHours: 4, active: true },
  { code: 'CRP', name: 'C-reactive protein', department: 'Clinical chemistry', specimenType: 'Serum', container: 'Gold-top serum separator tube', method: 'Immunoturbidimetry', unit: 'mg/L', turnaroundHours: 4, active: true },
  { code: 'PTINR', name: 'Prothrombin time / INR', department: 'Coagulation', specimenType: 'Citrated plasma', container: 'Blue-top sodium citrate tube', method: 'Clot detection', unit: 's / ratio', turnaroundHours: 2, active: true },
  { code: 'HBA1C', name: 'Hemoglobin A1c', department: 'Clinical chemistry', specimenType: 'EDTA whole blood', container: 'Lavender-top EDTA tube', method: 'HPLC', unit: '%', turnaroundHours: 8, active: true },
  { code: 'TSH', name: 'Thyroid-stimulating hormone', department: 'Immunology', specimenType: 'Serum', container: 'Gold-top serum separator tube', method: 'Chemiluminescent immunoassay', unit: 'mIU/L', turnaroundHours: 8, active: true },
  { code: 'UA', name: 'Urinalysis', department: 'Urinalysis', specimenType: 'Urine', container: 'Sterile urine container', method: 'Dipstick / microscopy', unit: 'panel', turnaroundHours: 2, active: true },
  { code: 'GLU', name: 'Glucose', department: 'Clinical chemistry', specimenType: 'Fluoride plasma', container: 'Gray-top fluoride tube', method: 'Hexokinase', unit: 'mmol/L', turnaroundHours: 2, active: true },
  { code: 'FERR', name: 'Ferritin', department: 'Immunology', specimenType: 'Serum', container: 'Gold-top serum separator tube', method: 'Chemiluminescent immunoassay', unit: 'ng/mL', turnaroundHours: 12, active: true },
];

export function filterCatalog(tests: TestDefinition[], query: string, department: string, activeOnly = true): TestDefinition[] {
  const q = query.trim().toLocaleLowerCase();
  return tests.filter(test => (!activeOnly || test.active)
    && (department === 'All departments' || test.department === department)
    && (!q || [test.code, test.name, test.department, test.specimenType, test.method].some(v => v.toLocaleLowerCase().includes(q))));
}

export function validateOrder(input: { patientId: string; patientName: string; clinician: string; testCodes: string[] }, catalog: TestDefinition[]): string[] {
  const errors: string[] = [];
  if (!input.patientId.trim()) errors.push('Patient ID is required.');
  if (!input.patientName.trim()) errors.push('Patient name is required.');
  if (!input.clinician.trim()) errors.push('Ordering clinician is required.');
  if (!input.testCodes.length) errors.push('Select at least one test.');
  const selected = input.testCodes.map(code => catalog.find(test => test.code === code));
  if (selected.some(test => !test || !test.active)) errors.push('One or more selected tests are unavailable.');
  const specimenTypes = new Set(selected.filter((test): test is TestDefinition => Boolean(test)).map(test => test.specimenType));
  if (specimenTypes.size > 1) errors.push('Selected tests require different specimen types; split the order by specimen.');
  return errors;
}

export function createDemoOrder(input: { patientId: string; patientName: string; clinician: string; priority: OrderPriority; testCodes: string[] }, catalog: TestDefinition[], sequence: number, now = new Date().toISOString()): DemoOrder {
  const errors = validateOrder(input, catalog);
  if (errors.length) throw new Error(errors.join(' '));
  const specimenType = catalog.find(test => test.code === input.testCodes[0])!.specimenType;
  return { id: `demo-${sequence}`, accession: `NS-${new Date(now).getUTCFullYear()}-${String(sequence).padStart(5, '0')}`, patientId: input.patientId.trim(), patientName: input.patientName.trim(), clinician: input.clinician.trim(), priority: input.priority, specimenType, testCodes: [...new Set(input.testCodes)], status: 'Ordered', createdAt: now };
}
