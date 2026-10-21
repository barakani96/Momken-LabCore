export type CatalogOrderTest = { id: string; code: string; name: string; version: string; specimenType: string; department: string };
export type OrderInput = { patientNumber: string; patientName: string; clinician: string; priority: 'Routine' | 'Urgent' | 'STAT'; testCodes: string[] };

export function normalizePersonName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function validatePersistentOrder(input: OrderInput, tests: CatalogOrderTest[]) {
  const errors: string[] = [];
  if (!input.patientNumber.trim()) errors.push('Patient ID is required.');
  if (!input.patientName.trim()) errors.push('Patient name is required.');
  if (!input.clinician.trim()) errors.push('Ordering clinician is required.');
  const uniqueCodes = [...new Set(input.testCodes.map(code => code.trim()).filter(Boolean))];
  if (!uniqueCodes.length) errors.push('Select at least one test.');
  if (uniqueCodes.length !== tests.length) errors.push('One or more selected tests are inactive or unavailable.');
  const specimenTypes = new Set(tests.map(test => test.specimenType));
  if (specimenTypes.size > 1) errors.push('Selected tests require different specimen types; split the order by specimen.');
  return { errors, uniqueCodes, specimenType: tests[0]?.specimenType ?? null };
}
