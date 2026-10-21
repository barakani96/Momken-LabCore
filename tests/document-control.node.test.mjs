import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = p => readFile(new URL(p, import.meta.url), 'utf8');
test('document control migration models controlled revisions and acknowledgement retention', async()=>{
 const sql=await read('../db/migrations/0020_document_control_sop.sql');
 for(const table of ['controlled_documents','controlled_document_versions','document_acknowledgements']) assert.match(sql,new RegExp(`CREATE TABLE ${table}`));
 assert.match(sql,/CREATE UNIQUE INDEX controlled_document_versions_unique_idx ON controlled_document_versions\(document_id, version_number\)/);assert.match(sql,/CREATE UNIQUE INDEX document_acknowledgements_unique_idx ON document_acknowledgements\(document_id, version_number, user_id\)/);assert.match(sql,/controlled document version content is immutable/);assert.match(sql,/document acknowledgements are append-only/);
 const j=JSON.parse(await read('../db/migrations/meta/_journal.json'));assert.equal(j.entries.find(e=>e.tag==='0020_document_control_sop')?.idx,19);
});
test('document APIs enforce role-specific workflow and independent author approval',async()=>{
 const route=await read('../app/api/documents/[id]/route.ts');const base=await read('../app/api/documents/route.ts');const ack=await read('../app/api/documents/[id]/acknowledge/route.ts');
 assert.match(route,/documents\.approve/);assert.match(route,/current\.createdBy===auth\.user\.id/);assert.match(route,/Only a version in review can be approved/);assert.match(base,/documents\.manage/);assert.match(ack,/Only the current approved version can be acknowledged/);
});
test('document permissions and navigation are registered',async()=>{const p=await read('../lib/auth/permissions.ts');const nav=await read('../components/app-shell.tsx');const page=await read('../app/documents/page.tsx');assert.match(p,/documents\.read/);assert.match(p,/documents\.approve/);assert.match(nav,/href="\/documents"/);assert.match(page,/DocumentControlWorkbench/);});
test('workflow UI supports bilingual revisions, approval and acknowledgements',async()=>{const ui=await read('../components/document-control-workbench.tsx');assert.match(ui,/Submit for review/);assert.match(ui,/Approve version/);assert.match(ui,/Reject/);assert.match(ui,/Acknowledge reading/);assert.match(ui,/Version history/);assert.match(ui,/تم الإقرار بالاطلاع/);});
