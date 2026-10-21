import { hashPassword } from '../lib/auth/password';
import { appUsers } from './schema';
import { db } from './index';
import { patients, specimens, testCatalog } from './schema';
import { eq } from 'drizzle-orm';

const seed = [
  { patientNumber: 'PAT-004281', givenName: 'Amal', familyName: 'Hassan', specimen: 'LAB-2026-001842', tests: ['CBC'], type: 'EDTA whole blood', priority: 'STAT' as const, status: 'In progress' as const, department: 'Hematology', clinician: 'Dr. Samir Ali' },
  { patientNumber: 'PAT-004282', givenName: 'Nabil', familyName: 'Abdullah', specimen: 'LAB-2026-001843', tests: ['HbA1c', 'GLU'], type: 'Fluoride plasma', priority: 'Routine' as const, status: 'Collected' as const, department: 'Clinical chemistry', clinician: 'Dr. Rania Saleh' },
  { patientNumber: 'PAT-004283', givenName: 'Maha', familyName: 'Mohammed', specimen: 'LAB-2026-001844', tests: ['ALT', 'AST', 'ALP', 'BIL'], type: 'Serum', priority: 'Routine' as const, status: 'Pending review' as const, department: 'Clinical chemistry', clinician: 'Dr. Khaled Omar' },
  { patientNumber: 'PAT-004284', givenName: 'Yousef', familyName: 'Saleh', specimen: 'LAB-2026-001845', tests: ['CRP'], type: 'Serum', priority: 'Urgent' as const, status: 'Collected' as const, department: 'Immunology', clinician: 'Dr. Samir Ali' },
  { patientNumber: 'PAT-004285', givenName: 'Huda', familyName: 'Ahmed', specimen: 'LAB-2026-001846', tests: ['UA'], type: 'Urine', priority: 'Routine' as const, status: 'Authorized' as const, department: 'Urinalysis', clinician: 'Dr. Muneer Qasim' }
];
for (const row of seed) {
  let [patient] = await db.insert(patients).values({ patientNumber: row.patientNumber, givenName: row.givenName, familyName: row.familyName }).onConflictDoUpdate({ target: patients.patientNumber, set: { givenName: row.givenName, familyName: row.familyName } }).returning();
  await db.insert(specimens).values({ accession: row.specimen, patientId: patient.id, testCodes: row.tests, specimenType: row.type, priority: row.priority, status: row.status, department: row.department, orderingClinician: row.clinician }).onConflictDoNothing({ target: specimens.accession });
}
console.log(`Seeded ${seed.length} fictional patients and specimens.`);

const catalogSeed = [
  { code: 'CBC', version: '1.0', name: 'Complete blood count', department: 'Hematology', specimenType: 'EDTA whole blood', container: 'Lavender-top EDTA tube', method: 'Automated hematology', unit: 'panel', turnaroundHours: 2, status: 'Active' as const },
  { code: 'RETIC', version: '1.0', name: 'Reticulocyte count', department: 'Hematology', specimenType: 'EDTA whole blood', container: 'Lavender-top EDTA tube', method: 'Flow cytometry', unit: '%', turnaroundHours: 4, status: 'Active' as const },
  { code: 'CMP', version: '1.0', name: 'Comprehensive metabolic panel', department: 'Clinical chemistry', specimenType: 'Serum', container: 'Gold-top serum separator tube', method: 'Photometry / ISE', unit: 'panel', turnaroundHours: 4, status: 'Active' as const },
  { code: 'CRP', version: '1.0', name: 'C-reactive protein', department: 'Clinical chemistry', specimenType: 'Serum', container: 'Gold-top serum separator tube', method: 'Immunoturbidimetry', unit: 'mg/L', turnaroundHours: 4, status: 'Active' as const },
  { code: 'PTINR', version: '1.0', name: 'Prothrombin time / INR', department: 'Coagulation', specimenType: 'Citrated plasma', container: 'Blue-top sodium citrate tube', method: 'Clot detection', unit: 's / ratio', turnaroundHours: 2, status: 'Active' as const },
  { code: 'HBA1C', version: '1.0', name: 'Hemoglobin A1c', department: 'Clinical chemistry', specimenType: 'EDTA whole blood', container: 'Lavender-top EDTA tube', method: 'HPLC', unit: '%', turnaroundHours: 8, status: 'Active' as const },
  { code: 'TSH', version: '1.0', name: 'Thyroid-stimulating hormone', department: 'Immunology', specimenType: 'Serum', container: 'Gold-top serum separator tube', method: 'Chemiluminescent immunoassay', unit: 'mIU/L', turnaroundHours: 8, status: 'Active' as const },
  { code: 'UA', version: '1.0', name: 'Urinalysis', department: 'Urinalysis', specimenType: 'Urine', container: 'Sterile urine container', method: 'Dipstick / microscopy', unit: 'panel', turnaroundHours: 2, status: 'Active' as const },
  { code: 'GLU', version: '1.0', name: 'Glucose', department: 'Clinical chemistry', specimenType: 'Fluoride plasma', container: 'Gray-top fluoride tube', method: 'Hexokinase', unit: 'mmol/L', turnaroundHours: 2, status: 'Active' as const },
  { code: 'FERR', version: '1.0', name: 'Ferritin', department: 'Immunology', specimenType: 'Serum', container: 'Gold-top serum separator tube', method: 'Chemiluminescent immunoassay', unit: 'ng/mL', turnaroundHours: 12, status: 'Active' as const }
];
for (const test of catalogSeed) {
  await db.insert(testCatalog).values(test).onConflictDoUpdate({
    target: [testCatalog.code, testCatalog.version],
    set: { name: test.name, department: test.department, specimenType: test.specimenType, container: test.container, method: test.method, unit: test.unit, turnaroundHours: test.turnaroundHours, status: test.status, updatedAt: new Date() }
  });
}
console.log(`Seeded ${catalogSeed.length} fictional test definitions.`);

const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
if (adminEmail && adminPassword) {
  if (adminPassword.length < 14) throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 14 characters.');
  await db.insert(appUsers).values({ email: adminEmail, displayName: process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'System Administrator', passwordHash: hashPassword(adminPassword), role: 'Admin' }).onConflictDoNothing({ target: appUsers.email });
  console.log('Bootstrap administrator ensured (existing accounts are never overwritten).');
} else {
  console.log('No bootstrap administrator created. Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD to provision one securely.');
}

process.exit(0);
