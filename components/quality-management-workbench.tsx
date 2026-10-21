'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, DataTable, Table, TableHead, TableRow, TableHeader, TableBody, TableCell, TextInput, TextArea, Select, SelectItem, Tag, InlineNotification, Loading, Tabs, TabList, Tab, TabPanels, TabPanel } from '@carbon/react';
import { Add, Renew, Save, Search } from '@carbon/icons-react';
import { useI18n } from '@/components/i18n-provider';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts';

type QualityCase = { id:string; caseNumber:string; title:string; caseType:string; severity:string; status:string; description:string; source:string|null; linkedEntityType:string|null; linkedEntityId:string|null; rootCause:string|null; correctiveAction:string|null; preventiveAction:string|null; effectivenessCheck:string|null; ownerId:string|null; dueDate:string|null; createdAt:string; updatedAt:string };
type CaseEvent = { id:string; caseId:string; actorId:string; eventType:string; fromStatus:string|null; toStatus:string|null; notes:string|null; changes:Record<string,unknown>; occurredAt:string };
type MethodValidationItem = { id:string; testName:string; method:string; precisionCV:number; accuracyBias:number; sensitivity:number; specificity:number; status:'Draft' | 'In Validation' | 'Approved' | 'Rejected'; verifiedBy:string; updatedAt:string };

const statuses = ['Open','Investigating','Action planned','Verification','Closed','Cancelled'];
const types = ['Nonconformance','Incident','CAPA','Internal audit'];
const nextStates:Record<string,string[]> = { Open:['Investigating','Cancelled'], Investigating:['Action planned','Cancelled'], 'Action planned':['Verification','Investigating','Cancelled'], Verification:['Closed','Action planned','Investigating'], Closed:[], Cancelled:[] };

const sampleIqcData = [
  { run: 'Day 1', controlValue: 100.2, mean: 100, plus1: 102, minus1: 98, plus2: 104, minus2: 96, plus3: 106, minus3: 94 },
  { run: 'Day 2', controlValue: 99.8, mean: 100, plus1: 102, minus1: 98, plus2: 104, minus2: 96, plus3: 106, minus3: 94 },
  { run: 'Day 3', controlValue: 101.5, mean: 100, plus1: 102, minus1: 98, plus2: 104, minus2: 96, plus3: 106, minus3: 94 },
  { run: 'Day 4', controlValue: 98.5, mean: 100, plus1: 102, minus1: 98, plus2: 104, minus2: 96, plus3: 106, minus3: 94 },
  { run: 'Day 5', controlValue: 102.1, mean: 100, plus1: 102, minus1: 98, plus2: 104, minus2: 96, plus3: 106, minus3: 94 },
  { run: 'Day 6', controlValue: 103.2, mean: 100, plus1: 102, minus1: 98, plus2: 104, minus2: 96, plus3: 106, minus3: 94 },
  { run: 'Day 7', controlValue: 100.0, mean: 100, plus1: 102, minus1: 98, plus2: 104, minus2: 96, plus3: 106, minus3: 94 },
  { run: 'Day 8', controlValue: 101.0, mean: 100, plus1: 102, minus1: 98, plus2: 104, minus2: 96, plus3: 106, minus3: 94 },
  { run: 'Day 9', controlValue: 99.2, mean: 100, plus1: 102, minus1: 98, plus2: 104, minus2: 96, plus3: 106, minus3: 94 },
  { run: 'Day 10', controlValue: 100.8, mean: 100, plus1: 102, minus1: 98, plus2: 104, minus2: 96, plus3: 106, minus3: 94 },
];

export function QualityManagementWorkbench() {
 const {locale}=useI18n(); const ar=locale==='ar';
 const [cases,setCases]=useState<QualityCase[]>([]); const [events,setEvents]=useState<CaseEvent[]>([]); const [selectedId,setSelectedId]=useState('');
 const [query,setQuery]=useState(''); const [statusFilter,setStatusFilter]=useState(''); const [typeFilter,setTypeFilter]=useState(''); const [busy,setBusy]=useState(false); const [saving,setSaving]=useState(false); const [error,setError]=useState(''); const [notice,setNotice]=useState(''); const [createOpen,setCreateOpen]=useState(false);
 const [title,setTitle]=useState(''); const [caseType,setCaseType]=useState('Nonconformance'); const [severity,setSeverity]=useState('Medium'); const [description,setDescription]=useState(''); const [source,setSource]=useState(''); const [linkedEntityType,setLinkedEntityType]=useState(''); const [linkedEntityId,setLinkedEntityId]=useState(''); const [dueDate,setDueDate]=useState('');
 const [rootCause,setRootCause]=useState(''); const [correctiveAction,setCorrectiveAction]=useState(''); const [preventiveAction,setPreventiveAction]=useState(''); const [effectivenessCheck,setEffectivenessCheck]=useState(''); const [notes,setNotes]=useState(''); const [nextStatus,setNextStatus]=useState('');

 // Method validation state
 const [validations, setValidations] = useState<MethodValidationItem[]>([
   { id: 'VAL-001', testName: 'HbA1c HPLC Assay', method: 'High-Performance Liquid Chromatography', precisionCV: 1.2, accuracyBias: 0.8, sensitivity: 98.5, specificity: 99.1, status: 'Approved', verifiedBy: 'Dr. Sarah Al-Amin', updatedAt: '2026-10-15' },
   { id: 'VAL-002', testName: 'High-Sensitivity Troponin T', method: 'Electrochemiluminescence Immunoassay', precisionCV: 2.4, accuracyBias: 1.1, sensitivity: 99.2, specificity: 97.8, status: 'In Validation', verifiedBy: 'Dr. Tariq Ziyad', updatedAt: '2026-10-18' },
   { id: 'VAL-003', testName: 'SARS-CoV-2 RT-PCR Multiplex', method: 'Real-Time PCR', precisionCV: 0.9, accuracyBias: 0.4, sensitivity: 99.8, specificity: 99.9, status: 'Approved', verifiedBy: 'Dr. Sarah Al-Amin', updatedAt: '2026-09-30' }
 ]);

 const selected=cases.find(c=>c.id===selectedId)??null;
 const filteredEvents=useMemo(()=>events.filter(e=>e.caseId===selectedId),[events,selectedId]);
 const load=useCallback(async()=>{setBusy(true);setError('');try{const p=new URLSearchParams();if(query.trim())p.set('q',query.trim());if(statusFilter)p.set('status',statusFilter);if(typeFilter)p.set('caseType',typeFilter);const r=await fetch(`/api/quality/cases?${p}`,{cache:'no-store'});const raw=await r.text();let d:any;try{d=JSON.parse(raw)}catch{throw new Error(ar?'استجابة غير صالحة من الخادم':'Invalid server response')}if(!r.ok)throw new Error(d.error||'Unable to load quality cases');setCases(d.data);setEvents(d.events);if(!d.data.some((c:QualityCase)=>c.id===selectedId))setSelectedId(d.data[0]?.id??'');}catch(e){setError(e instanceof Error?e.message:'Unable to load quality cases')}finally{setBusy(false)}},[query,statusFilter,typeFilter,ar,selectedId]);
 useEffect(()=>{void load()},[load]);
 useEffect(()=>{if(selected){setRootCause(selected.rootCause??'');setCorrectiveAction(selected.correctiveAction??'');setPreventiveAction(selected.preventiveAction??'');setEffectivenessCheck(selected.effectivenessCheck??'');setNextStatus(selected.status);setNotes('')}},[selectedId, selected]);
 async function createCase(e:React.FormEvent){e.preventDefault();setSaving(true);setError('');setNotice('');try{const r=await fetch('/api/quality/cases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,caseType,severity,description,source:source||undefined,linkedEntityType:linkedEntityType||undefined,linkedEntityId:linkedEntityId||undefined,dueDate:dueDate?new Date(`${dueDate}T12:00:00.000Z`).toISOString():undefined})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Unable to create case');setCreateOpen(false);setTitle('');setDescription('');setSource('');setLinkedEntityType('');setLinkedEntityId('');setDueDate('');setNotice(ar?'تم إنشاء الحالة':'Quality case created');await load();setSelectedId(d.data.id)}catch(e){setError(e instanceof Error?e.message:'Unable to create case')}finally{setSaving(false)}}
 async function updateCase(e:React.FormEvent){e.preventDefault();if(!selected)return;setSaving(true);setError('');setNotice('');try{const r=await fetch(`/api/quality/cases/${selected.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({rootCause:rootCause||null,correctiveAction:correctiveAction||null,preventiveAction:preventiveAction||null,effectivenessCheck:effectivenessCheck||null,status:nextStatus!==selected.status?nextStatus:undefined,notes:notes||undefined})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Unable to update case');setNotice(ar?'تم تحديث الحالة':'Quality case updated');await load()}catch(e){setError(e instanceof Error?e.message:'Unable to update case')}finally{setSaving(false)}}
 const label=(en:string,arabic:string)=>ar?arabic:en;

 return <div className="module-page" dir={ar?'rtl':'ltr'}>
  <div className="page-heading"><div><p className="eyebrow">{label('QUALITY SYSTEM / CAPA & IQC','نظام الجودة / الرقابة الداخلية وإدارة الإجراءات')}</p><h1>{label('Quality Management & Method Validation','إدارة الجودة والتحقق من الطرق المخبرية')}</h1><p className="page-description">{label('Manage internal quality control Levey-Jennings charts, nonconformances, CAPA incidents, and method validation benchmarks in compliance with ISO 15189.','إدارة مخططات ليفي-جنينغز للرقابة الداخلية، حالات عدم المطابقة، الإجراءات التصحيحية، ومعايير التحقق من الطرق المخبرية وفق معيار ISO 15189.')}</p></div><div className="page-actions"><Button kind="secondary" renderIcon={Renew} onClick={()=>void load()}>{label('Refresh','تحديث')}</Button><Button renderIcon={Add} onClick={()=>setCreateOpen(v=>!v)}>{label('New quality case','حالة جودة جديدة')}</Button></div></div>
  {error&&<InlineNotification kind="error" title={label('Action failed','تعذر تنفيذ العملية')} subtitle={error} onCloseButtonClick={()=>setError('')}/>}{notice&&<InlineNotification kind="success" title={notice} onCloseButtonClick={()=>setNotice('')}/>}

  <Tabs>
    <TabList aria-label={label('Quality tabs','تبويبات الجودة')} className="carbon-tabs">
      <Tab>{label('Levey-Jennings IQC Charts','مخططات ليفي-جنينغز للرقابة')}</Tab>
      <Tab>{label('CAPA & Nonconformances','إدارة CAPA وعدم المطابقة')}</Tab>
      <Tab>{label('Method Validation','التحقق من الطرق المخبرية')}</Tab>
    </TabList>
    <TabPanels>
      <TabPanel>
        {/* Levey-Jennings IQC Section */}
        <div className="panel-card" style={{ marginTop: '1rem' }}>
          <div className="panel-heading">
            <div>
              <h2>{label('Internal Quality Control (IQC) — Levey-Jennings Chart','مخطط ليفي-جنينغز للرقابة الداخلية للجودة')}</h2>
              <p>{label('Biochemistry Control Level 2 (Glucose / Electrolytes) with Westgard Multi-rule Quality Assurance','مستوى الرقابة 2 للكيمياء الحيوية مع قواعد ويستغارد لضمان الجودة')}</p>
            </div>
            <Tag type="green">{label('In Control (1s / 2s Limits Passed)', 'ضمن حدود السيطرة')}</Tag>
          </div>
          <div style={{ width: '100%', height: 360, marginTop: '1.5rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sampleIqcData} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="run" />
                <YAxis domain={[92, 108]} />
                <Tooltip />
                <Legend />
                <ReferenceLine y={100} stroke="#0f62fe" strokeWidth={2} label="Mean (100)" />
                <ReferenceLine y={102} stroke="#24a148" strokeDasharray="3 3" label="+1SD" />
                <ReferenceLine y={98} stroke="#24a148" strokeDasharray="3 3" label="-1SD" />
                <ReferenceLine y={104} stroke="#f1c21b" strokeDasharray="3 3" label="+2SD" />
                <ReferenceLine y={96} stroke="#f1c21b" strokeDasharray="3 3" label="-2SD" />
                <ReferenceLine y={106} stroke="#da1e28" strokeDasharray="3 3" label="+3SD (Action limit)" />
                <ReferenceLine y={94} stroke="#da1e28" strokeDasharray="3 3" label="-3SD (Action limit)" />
                <Line type="monotone" dataKey="controlValue" name={label('Control Result', 'نتيجة الرقابة')} stroke="#0f62fe" strokeWidth={3} dot={{ r: 6 }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="kpi-grid" style={{ marginTop: '1.5rem' }}>
            <div className="kpi-card"><span>{label('Mean Target', 'القيمة المستهدفة')}</span><strong>100.0 mg/dL</strong></div>
            <div className="kpi-card"><span>{label('Standard Deviation (SD)', 'الانحراف المعياري')}</span><strong>2.0 mg/dL</strong></div>
            <div className="kpi-card"><span>{label('Coefficient of Variation (CV)', 'معامل الاختلاف')}</span><strong>2.0%</strong></div>
            <div className="kpi-card"><span>{label('Westgard Rule Status', 'حالة قواعد ويستغارد')}</span><strong style={{ color: '#24a148' }}>PASS</strong></div>
          </div>
        </div>
      </TabPanel>

      <TabPanel>
        {/* CAPA & Nonconformances */}
        <div style={{ marginTop: '1rem' }}>
          <div className="kpi-grid"><div className="kpi-card"><span>{label('Cases shown','الحالات المعروضة')}</span><strong>{cases.length}</strong></div><div className="kpi-card"><span>{label('Open / in progress','مفتوحة / قيد المعالجة')}</span><strong>{cases.filter(c=>!['Closed','Cancelled'].includes(c.status)).length}</strong></div><div className="kpi-card"><span>{label('High / critical','عالية / حرجة')}</span><strong>{cases.filter(c=>['High','Critical'].includes(c.severity)&&!['Closed','Cancelled'].includes(c.status)).length}</strong></div><div className="kpi-card"><span>{label('Overdue','متأخرة')}</span><strong>{cases.filter(c=>c.dueDate&&new Date(c.dueDate)<new Date()&&!['Closed','Cancelled'].includes(c.status)).length}</strong></div></div>
          {createOpen&&<form className="panel-card qms-create" onSubmit={createCase} style={{marginTop:'1rem'}}><div className="panel-heading"><div><h2>{label('Register a quality case','تسجيل حالة جودة')}</h2><p>{label('Use fictional data in development. Link a case to a specimen, result, or other controlled record where applicable.','استخدم بيانات افتراضية في بيئة التطوير، واربط الحالة بعينة أو نتيجة أو سجل آخر عند الحاجة.')}</p></div></div><div className="qms-form-grid"><TextInput id="qms-title" labelText={label('Title','العنوان')} value={title} onChange={e=>setTitle(e.target.value)} required maxLength={200}/><Select id="qms-type" labelText={label('Case type','نوع الحالة')} value={caseType} onChange={e=>setCaseType(e.target.value)}>{types.map(t=><SelectItem key={t} value={t} text={label(t,({'Nonconformance':'عدم مطابقة','Incident':'حادث','CAPA':'إجراء تصحيحي ووقائي','Internal audit':'تدقيق داخلي'} as Record<string,string>)[t])}/>)}</Select><Select id="qms-severity" labelText={label('Severity','الخطورة')} value={severity} onChange={e=>setSeverity(e.target.value)}>{['Low','Medium','High','Critical'].map(v=><SelectItem key={v} value={v} text={label(v,({'Low':'منخفضة','Medium':'متوسطة','High':'عالية','Critical':'حرجة'} as Record<string,string>)[v])}/>)}</Select><TextInput id="qms-source" labelText={label('Source / department','المصدر / القسم')} value={source} onChange={e=>setSource(e.target.value)} maxLength={80}/><TextInput id="qms-link-type" labelText={label('Linked record type','نوع السجل المرتبط')} value={linkedEntityType} onChange={e=>setLinkedEntityType(e.target.value)} placeholder="specimen / result / instrument"/><TextInput id="qms-link-id" labelText={label('Linked record ID','معرّف السجل المرتبط')} value={linkedEntityId} onChange={e=>setLinkedEntityId(e.target.value)}/><label className="qms-date">{label('Target due date','تاريخ الاستحقاق')}<input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label><div className="qms-full"><TextArea id="qms-description" labelText={label('Description and immediate containment','الوصف والاحتواء الفوري')} value={description} onChange={e=>setDescription(e.target.value)} required minLength={10} maxLength={10000} rows={4}/></div></div><div className="page-actions"><Button kind="secondary" type="button" onClick={()=>setCreateOpen(false)}>{label('Cancel','إلغاء')}</Button><Button type="submit" disabled={saving} renderIcon={Save}>{saving?label('Saving…','جارٍ الحفظ…'):label('Create case','إنشاء الحالة')}</Button></div></form>}
          <div className="panel-card" style={{marginTop:'1rem'}}><div className="panel-heading"><div><h2>{label('Quality register','سجل الجودة')}</h2><p>{label('Cases are stored in PostgreSQL; each update creates a history event and an audit entry.','تُحفظ الحالات في PostgreSQL، وينشئ كل تحديث حدثًا تاريخيًا وسجل تدقيق.')}</p></div></div><div className="qms-filters"><div className="qms-search"><TextInput id="qms-search" labelText={label('Search','بحث')} value={query} onChange={e=>setQuery(e.target.value)} placeholder={label('Case number, title, linked record…','رقم الحالة أو العنوان أو السجل المرتبط…')}/><Button kind="secondary" renderIcon={Search} onClick={()=>void load()}>{label('Search','بحث')}</Button></div><Select id="qms-status-filter" labelText={label('Status','الحالة')} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><SelectItem value="" text={label('All statuses','كل الحالات')}/>{statuses.map(v=><SelectItem key={v} value={v} text={label(v,({'Open':'مفتوحة','Investigating':'قيد التحقيق','Action planned':'خطة إجراءات','Verification':'التحقق من الفاعلية','Closed':'مغلقة','Cancelled':'ملغاة'} as Record<string,string>)[v])}/>)}</Select><Select id="qms-type-filter" labelText={label('Type','النوع')} value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><SelectItem value="" text={label('All types','كل الأنواع')}/>{types.map(v=><SelectItem key={v} value={v} text={label(v,({'Nonconformance':'عدم مطابقة','Incident':'حادث','CAPA':'إجراء تصحيحي ووقائي','Internal audit':'تدقيق داخلي'} as Record<string,string>)[v])}/>)}</Select></div>
          {busy?<Loading description={label('Loading quality register','جارٍ تحميل سجل الجودة')}/>:<DataTable rows={cases.map(c=>({...c,id:c.id}))} headers={[{key:'caseNumber',header:label('Case','الحالة')},{key:'title',header:label('Title','العنوان')},{key:'caseType',header:label('Type','النوع')},{key:'severity',header:label('Severity','الخطورة')},{key:'status',header:label('Status','الحالة')},{key:'dueDate',header:label('Due date','الاستحقاق')}]}>{({rows,headers,getHeaderProps,getRowProps})=><Table><TableHead><TableRow>{headers.map(h=><TableHeader key={h.key} {...getHeaderProps({header:h})}>{h.header}</TableHeader>)}</TableRow></TableHead><TableBody>{rows.map(row=>{const c=cases.find(x=>x.id===row.id)!;return <TableRow {...getRowProps({row})} onClick={()=>setSelectedId(c.id)} className={selectedId===c.id?'qms-selected-row':''}><TableCell><button className="qms-link" onClick={()=>setSelectedId(c.id)}>{c.caseNumber}</button></TableCell><TableCell>{c.title}</TableCell><TableCell>{label(c.caseType,({'Nonconformance':'عدم مطابقة','Incident':'حادث','CAPA':'إجراء تصحيحي ووقائي','Internal audit':'تدقيق داخلي'} as Record<string,string>)[c.caseType]??c.caseType)}</TableCell><TableCell><Tag type={c.severity==='Critical'?'red':c.severity==='High'?'magenta':c.severity==='Medium'?'warm-gray':'cool-gray'}>{label(c.severity,({'Low':'منخفضة','Medium':'متوسطة','High':'عالية','Critical':'حرجة'} as Record<string,string>)[c.severity])}</Tag></TableCell><TableCell><Tag type={c.status==='Closed'?'green':c.status==='Cancelled'?'gray':c.status==='Verification'?'blue':'teal'}>{label(c.status,({'Open':'مفتوحة','Investigating':'قيد التحقيق','Action planned':'خطة إجراءات','Verification':'التحقق من الفاعلية','Closed':'مغلقة','Cancelled':'ملغاة'} as Record<string,string>)[c.status])}</Tag></TableCell><TableCell>{c.dueDate?new Date(c.dueDate).toLocaleDateString(ar?'ar':'en'):'—'}</TableCell></TableRow>})}</TableBody></Table>}</DataTable>}
          {!busy&&cases.length===0&&<p className="qms-empty">{label('No quality cases match these filters. Create a case to start a documented investigation.','لا توجد حالات تطابق عوامل التصفية. أنشئ حالة لبدء تحقيق موثق.')}</p>}</div>
          {selected&&<div className="panel-card qms-detail" style={{marginTop:'1rem'}}><div className="panel-heading"><div><p className="eyebrow">{selected.caseNumber}</p><h2>{selected.title}</h2><p>{selected.description}</p></div><Tag type={selected.status==='Closed'?'green':'blue'}>{label(selected.status,({'Open':'مفتوحة','Investigating':'قيد التحقيق','Action planned':'خطة إجراءات','Verification':'التحقق من الفاعلية','Closed':'مغلقة','Cancelled':'ملغاة'} as Record<string,string>)[selected.status])}</Tag></div><div className="qms-meta"><span>{label('Created','تاريخ الإنشاء')}: {new Date(selected.createdAt).toLocaleString(ar?'ar':'en')}</span><span>{label('Source','المصدر')}: {selected.source||'—'}</span><span>{label('Linked record','السجل المرتبط')}: {selected.linkedEntityType&&selected.linkedEntityId?`${selected.linkedEntityType} / ${selected.linkedEntityId}`:'—'}</span></div>{!['Closed','Cancelled'].includes(selected.status)?<form onSubmit={updateCase}><div className="qms-form-grid"><div className="qms-full"><TextArea id="qms-root-cause" labelText={label('Root-cause analysis','تحليل السبب الجذري')} value={rootCause} onChange={e=>setRootCause(e.target.value)} rows={3} maxLength={10000}/></div><div className="qms-full"><TextArea id="qms-corrective" labelText={label('Corrective action','الإجراء التصحيحي')} value={correctiveAction} onChange={e=>setCorrectiveAction(e.target.value)} rows={3} maxLength={10000}/></div><div className="qms-full"><TextArea id="qms-preventive" labelText={label('Preventive action','الإجراء الوقائي')} value={preventiveAction} onChange={e=>setPreventiveAction(e.target.value)} rows={3} maxLength={10000}/></div><div className="qms-full"><TextArea id="qms-effectiveness" labelText={label('Effectiveness verification / evidence','التحقق من الفاعلية / الأدلة')} value={effectivenessCheck} onChange={e=>setEffectivenessCheck(e.target.value)} rows={3} maxLength={10000}/></div><Select id="qms-next-status" labelText={label('Workflow transition','انتقال الحالة')} value={nextStatus} onChange={e=>setNextStatus(e.target.value)}><SelectItem value={selected.status} text={label(selected.status,({'Open':'مفتوحة','Investigating':'قيد التحقيق','Action planned':'خطة إجراءات','Verification':'التحقق من الفاعلية','Closed':'مغلقة','Cancelled':'ملغاة'} as Record<string,string>)[selected.status])}/>{(nextStates[selected.status]??[]).map(v=><SelectItem key={v} value={v} text={label(v,({'Open':'مفتوحة','Investigating':'قيد التحقيق','Action planned':'خطة إجراءات','Verification':'التحقق من الفاعلية','Closed':'مغلقة','Cancelled':'ملغاة'} as Record<string,string>)[v])}/>)}</Select><div className="qms-full"><TextInput id="qms-notes" labelText={label('Change note (optional)','ملاحظة التغيير (اختياري)')} value={notes} onChange={e=>setNotes(e.target.value)} maxLength={2000}/></div></div><div className="page-actions"><Button type="submit" disabled={saving} renderIcon={Save}>{saving?label('Saving…','جارٍ الحفظ…'):label('Save quality record','حفظ سجل الجودة')}</Button></div></form>:<InlineNotification kind="info" title={label('Terminal record','سجل نهائي')} subtitle={label('Closed and cancelled cases cannot be edited.','لا يمكن تعديل الحالات المغلقة أو الملغاة.')}/>}<div className="qms-history"><h3>{label('Case history','تاريخ الحالة')}</h3>{filteredEvents.length?filteredEvents.map(e=><div className="qms-history-item" key={e.id}><strong>{label(e.eventType,({'CASE_CREATED':'إنشاء الحالة','CASE_UPDATED':'تحديث الحالة','STATUS_CHANGED':'تغيير الحالة'} as Record<string,string>)[e.eventType]??e.eventType)}</strong><span>{new Date(e.occurredAt).toLocaleString(ar?'ar':'en')} · {e.fromStatus?`${e.fromStatus} → `:''}{e.toStatus??''}</span>{e.notes&&<p>{e.notes}</p>}{Object.keys(e.changes??{}).length>0&&<details><summary>{label('Changed fields','الحقول المتغيرة')}</summary><pre>{JSON.stringify(e.changes,null,2)}</pre></details>}</div>):<p>{label('No history available.','لا يوجد سجل تاريخي.')}</p>}</div></div>}
        </div>
      </TabPanel>

      <TabPanel>
        {/* Method Validation Tab */}
        <div className="panel-card" style={{ marginTop: '1rem' }}>
          <div className="panel-heading">
            <div>
              <h2>{label('Clinical Test Method Validation & Verification','التحقق من صحة الطرق المخبرية السريرية')}</h2>
              <p>{label('Track precision (CV%), accuracy (bias%), sensitivity, and specificity benchmarks for new diagnostic assays.','تتبع دقة القياس (CV%)، الانحياز، الحساسية، والنوعية للمقايسات التشخيصية الجديدة.')}</p>
            </div>
            <Tag type="blue">{label('ISO 15189 Clause 5.5', 'بند ISO 15189')}</Tag>
          </div>
          <div className="table-wrap" style={{ marginTop: '1.5rem' }}>
            <Table size="lg" aria-label={label('Method validations', 'التحقق من الطرق')}>
              <TableHead>
                <TableRow>
                  {[label('Assay / Test Name', 'اسم التحليل'), label('Method', 'الطريقة'), label('Precision (CV%)', 'الدقة CV%'), label('Accuracy Bias', 'انحياز الدقة'), label('Sensitivity', 'الحساسية'), label('Specificity', 'النوعية'), label('Status', 'الحالة'), label('Verified By', 'المعتمد')].map(col => <TableHeader key={col}>{col}</TableHeader>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {validations.map(val => (
                  <TableRow key={val.id}>
                    <TableCell><strong>{val.testName}</strong><div className="sub-cell">{val.id}</div></TableCell>
                    <TableCell>{val.method}</TableCell>
                    <TableCell><strong dir="ltr">{val.precisionCV}%</strong></TableCell>
                    <TableCell><strong dir="ltr">{val.accuracyBias}%</strong></TableCell>
                    <TableCell><strong dir="ltr">{val.sensitivity}%</strong></TableCell>
                    <TableCell><strong dir="ltr">{val.specificity}%</strong></TableCell>
                    <TableCell><Tag type={val.status === 'Approved' ? 'green' : val.status === 'In Validation' ? 'blue' : 'gray'}>{val.status}</Tag></TableCell>
                    <TableCell>{val.verifiedBy}<div className="sub-cell">{val.updatedAt}</div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </TabPanel>
    </TabPanels>
  </Tabs>

  <div className="panel-card qms-note" style={{marginTop:'1.5rem'}}><strong>{label('Quality governance note','ملاحظة حوكمة الجودة')}</strong><p>{label('This QMS records quality events and workflow evidence; it does not itself certify compliance or replace approved SOPs, risk assessment, document control, training records, or authorized laboratory review. Validate the process against your quality manual before operational use.','يسجل النظام أحداث الجودة وأدلة سير العمل، لكنه لا يمنح اعتمادًا للامتثال ولا يستبدل الإجراءات التشغيلية المعتمدة أو تقييم المخاطر أو ضبط الوثائق أو سجلات التدريب أو المراجعة المختبرية المخولة. يجب مواءمة سير العمل مع دليل الجودة قبل الاستخدام التشغيلي.')}</p></div>
 </div>
}
