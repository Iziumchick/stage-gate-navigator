import { PersonalMeetings } from './PersonalMeetings';
import type {SemesterCalendar} from './SemesterCalendarEditor';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Admission, ModuleInfo, SemesterCourse, CourseOption, MilestonePlanning } from './api';
import { ExternalLink, Save, X } from 'lucide-react';

export interface ModuleExtras {
  elo: string;
  webuntis: string;
  schedule: string;
  room: string;
  notes: string;
  plannedTerm: string;
  selectedCourseId: string;
  placeConfirmed: string;
  registrationConfirmed: string;
  plannedCourseIds: string[];
  excludedAutoTerm: string;
  awCourses: {title:string;confirmed:boolean}[];
}
const empty: ModuleExtras = { elo: '', webuntis: '', schedule: '', room: '', notes: '', plannedTerm: '', selectedCourseId: '', placeConfirmed: '', registrationConfirmed:'', plannedCourseIds: [], excludedAutoTerm:'', awCourses:[] };
export function readExtras(key: string): ModuleExtras {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || '{}');
    return Object.fromEntries(Object.entries(empty).map(([field, fallback]) => [field, field === 'awCourses' ? (Array.isArray(stored?.awCourses) ? stored.awCourses.slice(0,2).map((v: {title?:unknown;confirmed?:unknown})=>({title:typeof v?.title==='string'?v.title.slice(0,200):'',confirmed:v?.confirmed===true})):[]) : field === 'plannedCourseIds' ? (Array.isArray(stored?.[field]) ? stored[field].filter((id: unknown) => typeof id === 'string') : []) : typeof stored?.[field] === 'string' ? stored[field] : fallback])) as unknown as ModuleExtras;
  } catch { return { ...empty }; }
}
export function awPartTitle(details:ModuleInfo|undefined,extras:ModuleExtras,index:number) {
 const part=details?.aw_components?.[index];
 return (part?.kind==='required'?part.title:extras.awCourses[index]?.title || '').trim();
}
export function awPartReady(details:ModuleInfo|undefined,extras:ModuleExtras,index:number) {
 const part=details?.aw_components?.[index],title=awPartTitle(details,extras,index).toLocaleLowerCase('de');
 if(!part || details?.components?.[index]?.status==='passed' || title.length<2 || !extras.awCourses[index]?.confirmed)return false;
 return !details?.aw_components?.some((_,i)=>i!==index && (details.components?.[i]?.status==='passed' || i<index && extras.awCourses[i]?.confirmed) && awPartTitle(details,extras,i).toLocaleLowerCase('de')===title);
}
export function plannedAwIndexes(details:ModuleInfo|undefined,extras:ModuleExtras) {
 const indexes=(details?.aw_components || []).map((_,i)=>i);
 const chosen=extras.plannedCourseIds.length?indexes.filter(i=>extras.plannedCourseIds.includes(`aw:${i}`)):indexes;
 return chosen.filter(i=>awPartReady(details,extras,i));
}
export function planningConfirmationLabel(planning?:MilestonePlanning) {
 return planning?.kind==='practice'?'Praktikumsplatz und Vertrag sind mit der OTH bestätigt.':planning?.kind==='thesis'?'Meine Bachelorarbeit ist offiziell angemeldet.':'';
}
function safeLink(value: string) {
  if (value === '/api/programs/wi/handbook' || /^\/api\/programs\/wi\/handbooks\/[a-f0-9]{64}\.pdf$/.test(value)) return value;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export function ModuleDetails({ open, onClose, storageKey, title, subtitle, term, passed, view = 'overview', offeredIn, details, admission, course, courseOptions = [], requiresCourseSelection = false, semesterOffered, plannedCourseId, onRemovePlannedCourse, children, onSaved, grade, ects, planning, externalPlanned = false, canRemovePlannedCourse = true, repeatExam = false, childrenAfter, calendar, calendarTitle, calendarScope }: {
  calendar?:SemesterCalendar;calendarTitle?:string;calendarScope?:string;
  externalPlanned?:boolean; canRemovePlannedCourse?:boolean; repeatExam?:boolean; childrenAfter?: ReactNode;
  grade?: string | null; ects?: number; planning?: MilestonePlanning;
  open: boolean; onClose: () => void; storageKey: string; title: string; subtitle: string; term: string; passed: boolean; view?: 'overview' | 'course'; offeredIn?: string; details?: ModuleInfo; admission?: Admission; course?: SemesterCourse; courseOptions?: CourseOption[]; requiresCourseSelection?: boolean; semesterOffered?: boolean; plannedCourseId?: string; onRemovePlannedCourse?: () => void; children?: ReactNode; onSaved?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [extras, setExtras] = useState<ModuleExtras>({ ...empty });
  const [message, setMessage] = useState('');
  const [eloEditing,setEloEditing]=useState(false),[scheduleOpen,setScheduleOpen]=useState(true);
  useEffect(() => {
    if (open) { setExtras(readExtras(storageKey)); setMessage('');setEloEditing(false);try{setScheduleOpen(localStorage.getItem(`${storageKey}:schedule-view`)!=='closed');}catch{setScheduleOpen(true);} dialog.current?.showModal(); }
    else dialog.current?.close();
  }, [open, storageKey]);
  function update(field: keyof ModuleExtras, value: string) { setExtras(prev => ({ ...prev, [field]: value })); setMessage(''); }
  function persist(value: ModuleExtras) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value)); setExtras(value);
      setMessage('Gespeichert in diesem Browser.'); onSaved?.();
      window.dispatchEvent(new Event('stage-gate-plan-changed'));return true;
    } catch { setMessage('Speichern nicht möglich. Bitte Browser-Speicher prüfen.');return false; }
  }
  function updateAw(index:number,patch:Partial<{title:string;confirmed:boolean}>) {
    const courses=(details?.aw_components || []).map((p,i)=>extras.awCourses[i]||{title:p.kind==='required'?p.title:'',confirmed:false});
    courses[index]={...courses[index],...patch};
    const remaining=extras.plannedTerm===term?plannedAwIndexes(details,extras).filter(i=>i!==index).map(i=>`aw:${i}`):[];
    persist({...extras,awCourses:courses,plannedCourseIds:remaining,plannedTerm:remaining.length?term:''});
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (extras.elo && !safeLink(extras.elo)) { setMessage('Bitte vollständige http:// oder https:// Links eingeben.'); return; }
    if(persist(extras))setEloEditing(false);
  }
  function removeFromPlan() {
    if(!canRemovePlannedCourse)return;
    if(onRemovePlannedCourse)onRemovePlannedCourse();
    else persist({...readExtras(storageKey),plannedTerm:'',plannedCourseIds:[]});
    onClose();
  }
  const eligibility = admission || { status: 'unknown', reason: 'Zulassung noch nicht geprüft.' };
  const awParts=details?.aw_components || [];
  const mandatoryParts = !awParts.length && !repeatExam && details?.completion_rule === 'all' && courseOptions.length > 0;
  const chosen = courseOptions.find(option => option.id === (plannedCourseId || extras.selectedCourseId)) || (!requiresCourseSelection && courseOptions.length === 1 ? courseOptions[0] : undefined);
  const activeCourse = mandatoryParts ? {...(course || courseOptions[0]?.course),meetings:[...(course?.meetings || []),...courseOptions.flatMap(option=>(option.course?.meetings || []).map(m=>({...m,component_titles:m.shared_with?.length?courseOptions.filter(o=>m.shared_with?.includes(o.id)).map(o=>o.title):[option.title]})))]} : chosen?.course || course;
  const effectiveElo=safeLink(readExtras(storageKey).elo)||(activeCourse?.elo?safeLink(activeCourse.elo):null);
  const activeDetails = view === 'course' && chosen?.details ? chosen.details : details;
  const canPlan = !passed && (planning ? planning.status === 'available' : repeatExam || eligibility.status === 'available' && (semesterOffered !== false || awParts.length>0));
  const confirmationLabel=planningConfirmationLabel(planning);
  const selectionReady = (!confirmationLabel||extras.registrationConfirmed==='yes')&&(repeatExam || (awParts.length>0 ? plannedAwIndexes(details,extras).length>0 : !requiresCourseSelection || (!!chosen && chosen.course?.offered !== false && extras.placeConfirmed === 'yes')));
  const handbook = activeDetails?.handbook;
  const handbookUrl = handbook?.url && safeLink(handbook.url);
  const pages = handbook?.pages;
  const pageLink = handbookUrl ? `${handbookUrl.split('#')[0]}${pages ? `#page=${pages.start}` : ''}` : null;
  return <dialog ref={dialog} onCancel={onClose} onClose={onClose} className="m-auto w-[700px] max-h-[85vh] overflow-auto rounded-2xl p-7 shadow-xl backdrop:bg-slate-900/30" aria-labelledby="module-detail-title">
    <div className="flex justify-between gap-4"><div><h2 id="module-detail-title" className="text-2xl">{view === 'course' && chosen ? chosen.title : title}</h2><p className="text-sm text-gray-500 mt-2">{subtitle}</p></div><button className="action-button self-start" aria-label="Details schließen" onClick={onClose}><X size={18} /></button></div>
    <section className="mt-5 space-y-3">
      {ects !== undefined ? <dl className="grid grid-cols-3 gap-4 rounded-xl bg-gray-50 p-4"><div><dt className="text-xs text-gray-500">Note</dt><dd className="text-lg mt-1">{grade?.replace('.',',') || (passed ? 'Mit Erfolg':'—')}</dd></div><div><dt className="text-xs text-gray-500">ECTS</dt><dd className="text-lg mt-1">{ects}</dd></div><div><dt className="text-xs text-gray-500">{view==='course'&&plannedCourseId?.startsWith('aw:')?'Gewicht des Gesamtmoduls':'Notengewicht'}</dt><dd className="text-lg mt-1">{details?.grade_weight==='0' ? 'Unbenotet':details?.grade_weight || '—'}</dd></div></dl> : <p className="text-sm"><span className="text-gray-500">Notengewicht: </span>{details?.grade_weight || 'Noch nicht bestätigt'}</p>}
      {!passed && !planning && !repeatExam && !awParts.length && <p className="text-sm"><span className="text-gray-500">Angeboten im: </span>{activeDetails?.offered_in || offeredIn || 'Noch nicht bestätigt'}</p>}
      {!passed && planning && <section className="rounded-lg bg-blue-50 p-4 text-sm text-blue-950"><p>{planning.registration_note}</p><details className="mt-3"><summary className="cursor-pointer">Anmeldung & Voraussetzungen</summary><ul className="list-disc pl-5 space-y-2 mt-3">{planning.steps.map(step=><li key={step}>{step}</li>)}</ul><a className="block mt-3 underline" href={safeLink(planning.info_url) || undefined} target="_blank" rel="noopener noreferrer">Informationen der Fakultät</a></details></section>}
      {children}
      {!passed && !planning && (pageLink || activeDetails?.description_pdf) && <details className="text-sm"><summary className="cursor-pointer text-gray-500">Modulhandbuch</summary><div className="mt-2 space-y-2">{pageLink && <a className="block text-blue-700" href={pageLink} target="_blank" rel="noopener noreferrer">{handbook?.label || 'Modulhandbuch öffnen'}{pages ? ` · S. ${pages.start}${pages.end ? `–${pages.end}`:''}`:''}<ExternalLink size={13} className="inline ml-1"/></a>}{activeDetails?.description_pdf && safeLink(activeDetails.description_pdf) && <a className="block text-blue-700" href={safeLink(activeDetails.description_pdf)!} target="_blank" rel="noopener noreferrer">Beschreibung als PDF</a>}</div></details>}
      {!passed && !!details?.components?.length && <section className="rounded-lg bg-gray-50 p-4"><h3 className="text-sm font-medium">Bestandteile des Moduls laut SPO</h3><ul className="mt-2 space-y-2 text-sm">{details.components.map((part, index) => <li key={index}>{part.title} · {part.ects} ECTS{part.status === 'passed' ? ` · Bestanden (${part.grade})` : part.status === 'failed' ? ` · Nicht bestanden (${part.grade})` : part.status ? ' · Noch nicht nachgewiesen' : ''}{part.grade_fraction ? ` · Anteil an der Modulnote: ${part.grade_fraction}` : part.grade_weight_as_printed ? ` · Gewicht laut Quelle: ${part.grade_weight_as_printed}` : ''}</li>)}</ul><p className="text-xs text-gray-500 mt-3">Die Bestandteile sind im Gesamtmodul enthalten und werden nicht zusätzlich als ECTS gezählt.</p></section>}
      {!passed && !planning && !repeatExam && details?.completion_rule && details.completion_rule!=='single' && <div className="bg-blue-50 rounded-lg p-4 text-sm"><p className="font-medium">{details.completion_rule === 'all' ? 'Alle Pflichtbestandteile abschließen' : details.completion_rule === 'one' ? 'Eine der zugelassenen Disziplinen abschließen' : details.completion_rule === 'catalog' ? 'Eine zugelassene FWPM-Disziplin auswählen' : 'Einzelmodul'}</p>{details.completion_rule === 'one' && <ul className="list-disc pl-5 mt-2">{details.linked_courses?.map(c => <li key={c.id}>{c.title}</li>)}</ul>}<p className="text-xs text-gray-600 mt-2">Planung und Kursauswahl erzeugen keine Anrechnung. Die Modulnote wird aus der Notenübersicht übernommen.</p></div>}
      {!passed && details?.composite_group && <section className="rounded-lg bg-gray-50 p-4 text-sm"><h3 className="font-medium">Gesamtmodul: {details.composite_group.title} · {details.composite_group.ects} ECTS{details.composite_group.grade ? ` · Gesamtnote ${details.composite_group.grade}`:''}</h3><p className="text-xs mt-2">Beide Bestandteile sind erforderlich. ECTS werden nur bei den Teilmodulen gezählt.</p><ul className="mt-2 space-y-2">{details.composite_group.children.map(c => <li key={c.id}>{c.title} · {c.ects} ECTS · {c.status === 'passed' ? `Bestanden${c.grade ? ` (${c.grade})` : ''}` : 'Noch nicht vollständig nachgewiesen'}</li>)}</ul></section>}
      </section>
    {view==='overview' && !passed && !repeatExam && awParts.length>0 && <section className="mt-4 border border-blue-200 bg-blue-50/40 rounded-lg p-4 text-sm" aria-label="AW-Kursauswahl">
      <h3 className="font-medium">Meine AW-Kurse</h3><p className="mt-2 text-blue-950">{awParts.length===2?'Zum Modul gehören zwei Teilmodule. Du kannst sie in unterschiedlichen Semestern planen.':'Trage deinen belegten AW-Kurs ein und bestätige deinen Platz.'}</p>
      {awParts.map((part,i)=>{
        const inPlan=extras.plannedTerm===term&&plannedAwIndexes(details,extras).includes(i);
        return <div key={i} className="mt-4 border-t border-blue-100 pt-3" aria-label={`AW-Teilmodul ${i+1}`}><p className="text-xs text-gray-500 mb-1">{part.title} · {part.ects} ECTS{details?.components?.[i]?.status==='passed'?' · Bereits bestanden':''}</p>
          {details?.components?.[i]?.status!=='passed' && <><label className="block">{`AW-Kurs ${i+1}`}<input className="form-input mt-1" maxLength={200} readOnly={part.kind==='required'} value={part.kind==='required'?part.title:extras.awCourses[i]?.title || ''} onChange={e=>updateAw(i,{title:e.target.value,confirmed:false})}/></label>
          <label className="flex gap-2 mt-2"><input type="checkbox" checked={extras.awCourses[i]?.confirmed || false} onChange={e=>updateAw(i,{confirmed:e.target.checked})}/>{`Platz für AW-Kurs ${i+1} bestätigt`}</label>
          {extras.awCourses[i]?.confirmed&&!awPartReady(details,extras,i)&&<p className="text-xs text-amber-800 mt-2">Bitte einen eigenen Kursnamen angeben; die beiden Kurse müssen verschieden sein.</p>}
          <button type="button" className="action-button mt-3" disabled={!canPlan||!awPartReady(details,extras,i)||inPlan} onClick={()=>persist({...extras,plannedTerm:term,excludedAutoTerm:'',plannedCourseIds:[...new Set([...(extras.plannedTerm===term?plannedAwIndexes(details,extras).map(n=>`aw:${n}`):[]),`aw:${i}`])]})}>{inPlan?'Eingeplant':`AW-Teilmodul ${i+1} hinzufügen`}</button></>}
        </div>;
      })}<p className="text-xs text-gray-500 mt-3">Für den Modulabschluss sind alle Bestandteile nötig. Die Planung erzeugt keine Anrechnung und keine Prüfungsanmeldung.</p>
    </section>}
    {view === 'overview' && !passed && !repeatExam && !awParts.length && courseOptions.length > 0 && <section className="mt-5 border rounded-lg p-4"><h3 className="text-sm font-medium">Disziplinen für {term}</h3>{requiresCourseSelection && !selectionReady && <p role="status" className="mt-3 rounded bg-blue-50 p-3 text-blue-950">Wähle zuerst deine Disziplin aus und bestätige deinen Platz. Danach kannst du das Modul zum Semester hinzufügen.</p>}{mandatoryParts ? <><p className="text-xs text-gray-500 mt-2">Alle Pflichtbestandteile werden gemeinsam zum Semester hinzugefügt.</p><ul className="mt-3 space-y-2 text-sm">{courseOptions.map(option=><li key={option.id}>{option.title}</li>)}</ul></> : requiresCourseSelection ? <><label className="block text-sm mt-3">Meine bestätigte Disziplin<select aria-label={details?.completion_rule === 'one' ? 'Vertiefungsdisziplin auswählen' : 'FWPM-Disziplin auswählen'} className="form-input mt-2" value={extras.selectedCourseId} onChange={e => { const next = { ...extras, selectedCourseId: e.target.value, placeConfirmed: '', elo: '', webuntis: '', schedule: '', room: '', notes: '', plannedTerm: '' }; persist(next); }}><option value="">Bitte auswählen</option>{courseOptions.map(option => <option key={option.id} value={option.id}>{option.short_title} · {option.title}{option.catalog_status === 'previous_summer' ? ` · Angebot aus ${option.source_term}` : ''}</option>)}</select></label>{chosen?.notice && <p className="text-xs text-amber-800 mt-3">{chosen.notice}</p>}{chosen?.course?.offered === false && <p className="text-xs text-amber-800 mt-3">Dieser Kurs ist für das Semester als nicht angeboten hinterlegt.</p>}<label className="flex gap-2 text-sm mt-3"><input type="checkbox" checked={extras.placeConfirmed === 'yes'} onChange={e => persist({ ...extras, placeConfirmed: e.target.checked ? 'yes' : '' })} />Ich habe für diese Disziplin einen Platz / eine Teilnahmebestätigung.</label><p className="text-xs text-gray-500 mt-3">Die Auswahl ist persönliche Planung und erzeugt keine Note oder Anrechnung.</p></> : <ul className="mt-3 text-sm space-y-2">{courseOptions.map(option => <li key={option.id}>{option.title}</li>)}</ul>}</section>}
    {childrenAfter}
    {view==='overview'&&!passed&&canPlan&&confirmationLabel&&<label className="flex gap-3 mt-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm"><input type="checkbox" checked={extras.registrationConfirmed==='yes'} onChange={e=>persist({...extras,registrationConfirmed:e.target.checked?'yes':'',plannedTerm:e.target.checked?extras.plannedTerm:'',excludedAutoTerm:''})}/><span>{confirmationLabel}<span className="block text-xs text-gray-500 mt-2">Deine Bestätigung für die Semesterplanung; keine Anmeldung durch dieses Dashboard.</span></span></label>}
    {view === 'overview' && !passed && <div className="mt-6 border-t pt-5">
      {!canPlan ? <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900"><p className="font-medium">{!planning && !repeatExam && !awParts.length && eligibility.status === 'available' && semesterOffered === false ? 'Kein bestätigtes Semesterangebot' : eligibility.status === 'blocked' ? 'Noch nicht verfügbar' : 'Zulassung noch nicht geprüft'}</p><p className="mt-2">{!planning && !repeatExam && !awParts.length && eligibility.status === 'available' && semesterOffered === false ? 'Für dieses Modul ist in diesem Semester kein Teilmodul zur Planung bestätigt.' : planning?.reason || eligibility.reason}</p>{eligibility.source && <p className="text-xs mt-2">Regelquelle: {eligibility.source}</p>}</div> : awParts.length&&!repeatExam ? <p className="text-sm text-gray-500">Füge die gewünschten AW-Teilmodule oben einzeln hinzu.</p> : (externalPlanned || extras.plannedTerm === term) && selectionReady ? <p className="text-sm text-green-700">Bereits für {term} eingeplant. Kurslinks und Termine findest du in „Aktuelles Semester“.</p> : <><button type="button" className="primary-button" disabled={!selectionReady} onClick={() => { if (canPlan && selectionReady) persist({ ...extras, plannedTerm: term,excludedAutoTerm:'',...(mandatoryParts?{plannedCourseIds:courseOptions.map(option=>option.id)}:{}) }); }}>Zum aktuellen Semester hinzufügen</button><p className="text-xs text-gray-500 mt-3">Persönliche Planung für {term}; keine Prüfungsanmeldung.</p></>}
      {(externalPlanned||extras.plannedTerm===term)&&<button type="button" className="action-button mt-4 text-sm" disabled={!canRemovePlannedCourse} onClick={removeFromPlan}>Aus aktuellem Semester entfernen</button>}
      {(externalPlanned||extras.plannedTerm===term)&&!canRemovePlannedCourse&&<p className="text-xs text-orange-800 mt-2">Zum Entfernen zuerst die bestätigte Verschiebung unter „Verschiebung & Entfernen aus dem Semester“ hinterlegen.</p>}
      <p role="status" className="text-sm text-gray-500 mt-3">{message}</p>
    </div>}
    {view === 'course' && canPlan && (externalPlanned || extras.plannedTerm === term || !!plannedCourseId) && <>
    {!planning && !repeatExam && <details className="mt-6 border-t pt-5 space-y-3" aria-label="Stundenplan & Kalender" open={scheduleOpen}><summary className="cursor-pointer text-lg" onClick={e=>{e.preventDefault();const value=!scheduleOpen;setScheduleOpen(value);try{localStorage.setItem(`${storageKey}:schedule-view`,value?'open':'closed');}catch{}}}>Kursangebot · {term}</summary>
      <PersonalMeetings key={storageKey} storageKey={storageKey} calendarScope={calendarScope} meetings={activeCourse?.meetings} fallback={activeCourse?.schedule} room={activeCourse?.room} calendar={calendar} shortTitle={chosen?.short_title||calendarTitle||title} title={chosen?.title||title} onExported={()=>{setScheduleOpen(false);try{localStorage.setItem(`${storageKey}:schedule-view`,'closed');}catch{}}}/>
    </details>}
    {!planning && !repeatExam && <form onSubmit={save} className="mt-6 border-t pt-5 space-y-4"><h3 className="text-lg">Meine persönlichen Kursangaben</h3><p className="text-xs text-gray-500">Optionaler ELO-Link und persönliche Notizen für {term}.</p>
      {effectiveElo&&!eloEditing?<div className="flex items-center justify-between gap-3"><a className="inline-flex items-center gap-1 text-sm text-blue-700" href={effectiveElo} target="_blank" rel="noopener noreferrer">ELO-Kurs öffnen<ExternalLink size={13}/></a><button type="button" className="action-button text-sm" onClick={()=>{setExtras(prev=>({...prev,elo:effectiveElo}));setEloEditing(true);}}>ELO-Link bearbeiten</button></div>:<label className="block text-sm">ELO-Kurslink<input aria-label="ELO-Kurslink" className="form-input mt-2" type="url" value={extras.elo} onChange={e=>update('elo',e.target.value.trim())} placeholder="https://…" maxLength={2000}/></label>}

      <label className="block text-sm">Notizen<textarea aria-label="Notizen" className="form-input mt-2" rows={3} value={extras.notes} onChange={e => update('notes', e.target.value)} placeholder="Lerngruppe, Aufgaben, Hinweise …" maxLength={4000} /></label>
      <div className="flex justify-between items-center gap-3"><p role="status" className="text-sm text-gray-500">{message}</p><button className="primary-button" type="submit"><Save size={16} />Kursangaben speichern</button></div>
    </form>}
    <button type="button" className="action-button mt-5 text-sm" disabled={!canRemovePlannedCourse} onClick={removeFromPlan}>Aus aktuellem Semester entfernen</button>
    {!canRemovePlannedCourse&&<p className="text-xs text-orange-800 mt-2">Zum Entfernen zuerst die bestätigte Verschiebung oben hinterlegen.</p>}
    </>}
  </dialog>;
}
