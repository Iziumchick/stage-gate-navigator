import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, LogOut, Save } from 'lucide-react';
import { AdminSemesterOverview, compareSemesters } from './AdminSemesterOverview';
import { SemesterTimetable } from './SemesterTimetable';
import { FwpmEditor, FwpmLists, type Fwpm } from './FwpmEditor';
import { request } from './api';
import { summarizeMeetings, type Meeting } from './CourseMeetingsEditor';
import type { SemesterCalendar } from './SemesterCalendarEditor';
import type { ImportReport, SourceKind, SourcePreview } from './SemesterSources';

type Pages = { start: number; end?: number | null };
export type Course = { offered: boolean | null; source_term?: string | null; elo: string; webuntis: string; schedule: string; room: string; handbook_pages: Pages | null; meetings?: Meeting[]; handbook_kind?: 'core' | 'fwpm'; handbook_excerpt?: string; handbook_edition?: string; handbook_references?: Record<string, Pages | null> };
type Book = { url: string | null; label: string };
type Preparation = { core_documents: string[]; fwpm_document: string | null; confirmed: boolean; fwpm_courses?: Fwpm[] | null };
export type Semester = { calendar?: SemesterCalendar; imports?: Partial<Record<SourceKind, ImportReport>>; fwpm_handbook?: Book; core_handbooks?: Record<string, Book>; preparation?: Preparation | null; status: 'draft' | 'published'; handbook: Book; modules: Record<string, Course> };
type Document = { digest: string; url: string; kind: 'core' | 'fwpm'; edition_id: string | null; term: string | null; created_on: string | null; course_count: number; preliminary?: boolean; reference_only?: boolean };
export type CatalogCourse = { id: string; title: string; short_title: string; ects: number | null; kind: 'course' | 'elective'; frequency: string; frequency_label: string; pages: Pages | null; document_url: string; slots: string[]; iw_mark?: string | null; stages?: string[]; references?: Record<string, { url: string; pages: Pages }> };
export type ModuleGroup = { id: string; title: string; short_title: string; stage_id: string; completion_rule: string; teilmodule_ids: string[] };
type PreparedCatalog = { module_groups?: ModuleGroup[]; courses: Record<string, CatalogCourse>; pending: CatalogCourse[]; warnings: string[]; catalog_version?: string; counts?: { core: number; fwpm: number; total: number; pending: number } };
type Catalog = { program_id: string; revision: string; program: { name: string; spo_version: string }; documents?: Document[]; fwpm_library?: Fwpm[]; semesters: Record<string, Semester>; semester_catalogs?: Record<string, PreparedCatalog> };
type PreparedResponse = { term: string; catalog: PreparedCatalog; modules: Record<string, Partial<Course>>; core_handbooks: Record<string, Book>; handbook: Book; fwpm_handbook: Book };
const steps = ['Semester', 'FWPM-Angebot', 'Termine & veröffentlichen'];
const emptySemester = (): Semester => ({ status: 'draft', handbook: { url: null, label: 'Modulhandbuch' }, modules: {} });
const emptyCourse = (): Course => ({ offered: null, elo: '', webuntis: '', schedule: '', room: '', handbook_pages: null });
const order = compareSemesters;
const stamp = (d: Document) => (d.created_on || '').split('.').reverse().join('');
function defaultSelection(documents: Document[], term: string): Preparation {
  const latest: Record<string, Document> = {};
  for (const d of documents.filter(d => d.kind === 'core')) if (d.edition_id && (!latest[d.edition_id] || stamp(d) > stamp(latest[d.edition_id]))) latest[d.edition_id] = d;
  return { core_documents: Object.values(latest).sort((a,b) => (b.edition_id || '').localeCompare(a.edition_id || '') || stamp(b).localeCompare(stamp(a))).slice(0,1).map(d => d.digest), fwpm_document: documents.find(d => d.kind === 'fwpm' && d.term === term)?.digest || null, confirmed: false };
}
function semesterChoices(saved: string[]) {
  const year = new Date().getFullYear();
  const lastYear = Math.max(year + 3, ...saved.map(t => Number(t.slice(5,9)) + 1));
  return [...new Set([...saved, ...Array.from({ length: lastYear - year + 1 }, (_, i) => [`SoSe ${year + i}`, `WiSe ${year + i}/${String(year + i + 1).slice(-2)}`]).flat()])].sort(order);
}

export function CatalogEditor({ onLogout }: { onLogout: () => void }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [term, setTerm] = useState('');
  const [overview, setOverview] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savedCatalog, setSavedCatalog] = useState<Catalog | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [editingFwpm, setEditingFwpm] = useState(false);
  const [proposalSource, setProposalSource] = useState('');
  const [scheduleViews, setScheduleViews] = useState<Record<string, 'fresh' | 'saved' | 'failed'>>({});
  const [fwpmAccepted, setFwpmAccepted] = useState(false);
  const [publishAccepted, setPublishAccepted] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    request<Catalog>('/programs/wi/catalog', { signal: controller.signal }).then(value => {
      setCatalog(value); setSavedCatalog(structuredClone(value));
      const now = new Date(); const year = now.getFullYear();
      setTerm(Object.keys(value.semesters).sort(order).at(-1) || (now.getMonth() >= 9 ? `WiSe ${year}/${String(year + 1).slice(-2)}` : `SoSe ${year}`));
    }).catch(error => { if (!controller.signal.aborted) setMessage(error.message); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty || editingFwpm) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, editingFwpm]);
  const documents = catalog?.documents || [];
  const semester = catalog?.semesters[term] || emptySemester();
  const baseSelection = semester.preparation || defaultSelection(documents, term);
  const selection = { ...baseSelection, fwpm_courses:(baseSelection.fwpm_courses ?? []).map(c => c.slots.length ? c : { ...c, offered:false, confirmed:false }) };
  const prepared = catalog?.semester_catalogs?.[term];
  const courses = Object.values(prepared?.courses || {});
  const scheduledCount = courses.filter(c => semester.modules[c.id]?.meetings?.length).length;
  const scheduleView = scheduleViews[term];
  const fwpmLibrary = [...new Map([...(catalog?.fwpm_library || []), ...Object.values(catalog?.semesters || {}).flatMap(s => s.preparation?.fwpm_courses || [])].map(row => [row.id, row])).values()];
  function openSemester(selectedTerm?: string) {
    if (!catalog) return;
    const now = new Date(); const year = now.getFullYear();
    const current = now.getMonth() >= 9 ? `WiSe ${year}/${String(year + 1).slice(-2)}` : now.getMonth() < 2 || now.getMonth() === 2 && now.getDate() < 15 ? `WiSe ${year - 1}/${String(year).slice(-2)}` : `SoSe ${year}`;
    const available = semesterChoices(Object.keys(catalog.semesters)).filter(t => !catalog.semesters[t]);
    const nextTerm = selectedTerm || available.find(t => order(t,current) >= 0) || available[0];
    if (!nextTerm) { setMessage('Kein weiteres Semester auswählbar.'); return; }
    setTerm(nextTerm); setCreating(!selectedTerm); setStep(0); setOverview(false);
    setDirty(false); setMessage(''); setEditingFwpm(false); setFwpmAccepted(false); setPublishAccepted(false); setProposalSource(''); setScheduleViews({});
  }
  function backToOverview() {
    if ((dirty || editingFwpm) && !window.confirm('Ungespeicherte Änderungen verwerfen und zur Semesterübersicht zurückkehren?')) return;
    if (savedCatalog) setCatalog(structuredClone(savedCatalog));
    setDirty(false); setEditingFwpm(false); setOverview(true); setMessage('');
  }
  function chooseNewTerm(next: string) {
    if (next === term) return;
    if (dirty && !window.confirm('Ungespeicherte Änderungen für dieses Semester verwerfen?')) return;
    if (savedCatalog) setCatalog(structuredClone(savedCatalog));
    setTerm(next); setDirty(false); setMessage(''); setFwpmAccepted(false); setProposalSource(''); setPublishAccepted(false); setScheduleViews({});
  }
  function updateSemester(next: Semester) {
    setCatalog(prev => prev ? { ...prev, semesters: { ...prev.semesters, [term]: { ...next, status: 'draft' } } } : prev);
    setDirty(true); setMessage(''); setPublishAccepted(false);
  }
  function changeFwpm(rows: Fwpm[], digest?: string) {
    const ids=new Set(rows.map(r => r.id));
    updateSemester({ ...semester, preparation:{ ...selection, fwpm_courses:rows, ...(digest ? { fwpm_document:digest }:{}),confirmed:false }, modules:Object.fromEntries(Object.entries(semester.modules).filter(([id]) => !id.startsWith('wi.fwpm.') || ids.has(id))) });
    setFwpmAccepted(false);
    setScheduleViews(previous => { const next = { ...previous }; delete next[term]; return next; });
  }
  async function loadFwpm(source?: string) {
    setBusy(true); setMessage('');
    try {
      const result=await request<{term:string; source_term?:string; courses:Fwpm[]}>(`/admin/programs/wi/fwpm-proposal${source ? `?copy_from=${encodeURIComponent(source)}`:''}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({term,preparation:selection})});
      if(result.term!==term) throw new Error('Falsches Semester.');
      changeFwpm(result.courses); setProposalSource(result.source_term || source || term);
    } catch(error) { setMessage(error instanceof Error ? error.message:'FWPM-Vorschlag nicht verfügbar.'); }
    finally { setBusy(false); }
  }
  async function prepare() {
    setBusy(true); setMessage('');
    try {
      const acceptedSelection = { ...selection, fwpm_courses:(selection.fwpm_courses || []).map(c=>({...c,ects:5,confirmed:c.offered})) };
      const result = await request<PreparedResponse>('/admin/programs/wi/prepare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ term, preparation: acceptedSelection }) });
      if (result.term !== term) throw new Error('Die Antwort gehört zu einem anderen Semester.');
      const modules = Object.fromEntries(Object.entries(result.modules).map(([id, patch]) => [id, { ...emptyCourse(), ...semester.modules[id], ...(semester.modules[id]?.source_term === term && (!prepared?.courses[id] || (prepared.courses[id].title === result.catalog.courses[id]?.title && prepared.courses[id].short_title === result.catalog.courses[id]?.short_title)) ? {} : { meetings: [], schedule: '', room: '', source_term: null }), ...patch }]));
      setCatalog(prev => prev ? { ...prev, semester_catalogs: { ...prev.semester_catalogs, [term]: result.catalog }, semesters: { ...prev.semesters, [term]: { ...semester, status: 'draft', preparation: { ...acceptedSelection, confirmed: true }, modules, handbook: result.handbook, fwpm_handbook: result.fwpm_handbook, core_handbooks: result.core_handbooks } } } : prev);
      setDirty(true); setStep(2); setPublishAccepted(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Katalog konnte nicht vorbereitet werden.'); }
    finally { setBusy(false); }
  }
  async function importSource(kind: 'dates' | 'schedule') {
    setBusy(true); setMessage('');
    try {
      const result = await request<SourcePreview>(`/admin/programs/wi/import/${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ term, preparation: selection }) });
      if (result.term !== term) throw new Error('Die Quelle gehört zu einem anderen Semester.');
      const usable = result.report.status === 'ready' || result.report.status === 'partial';
      const modules = { ...semester.modules };
      if (usable && kind === 'schedule') for (const [id, patch] of Object.entries(result.modules || {})) {
        if (!prepared?.courses[id]) continue;
        const meetings = patch.meetings || [];
        modules[id] = { ...(modules[id] || emptyCourse()), ...patch, source_term: term, schedule: summarizeMeetings(meetings), room: [...new Set(meetings.map(m => m.room).filter(Boolean))].join('; ') };
      }
      if (kind === 'schedule') setScheduleViews(previous => ({ ...previous, [term]: usable ? 'fresh' : 'failed' }));
      updateSemester({ ...semester, modules, ...(usable && result.calendar ? { calendar: result.calendar } : {}), imports: { ...semester.imports, [kind]: result.report } });
      setMessage(usable ? 'Aktuelle Quelldaten übernommen. Bitte Ergebnis prüfen.' : 'Keine aktuellen Quelldaten übernommen. Vorhandene Angaben bleiben erhalten.');
    } catch (error) { if (kind === 'schedule') setScheduleViews(previous => ({ ...previous, [term]: 'failed' })); setMessage(error instanceof Error ? error.message : 'Quelle nicht erreichbar.'); }
    finally { setBusy(false); }
  }
  async function save(publish: boolean) {
    if (!catalog) return;
    setBusy(true); setMessage('');
    const next = { ...semester, status: publish ? 'published' as const : 'draft' as const };
    try {
      const semesters = { ...catalog.semesters, [term]: next };
      const result = await request<{ revision: string }>('/admin/programs/wi/catalog', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ program_id: catalog.program_id, revision: catalog.revision, semesters }) });
      const saved = { ...catalog, semesters, revision: result.revision };
      setCatalog(saved); setSavedCatalog(structuredClone(saved)); setDirty(false); setEditingFwpm(false); setOverview(true);
      setMessage(publish ? `${term} veröffentlicht. Studierende sehen die vorbereiteten Kursdaten beim nächsten Laden.` : `${term} als Entwurf gespeichert.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Speichern fehlgeschlagen.'); }
    finally { setBusy(false); }
  }
  const fwpmValid = (selection.fwpm_courses || []).filter(c=>c.offered).every(c=>c.title.trim() && c.short_title.trim() && c.slots.length);
  const canNext = step === 0 || step === 1 && semester.preparation?.fwpm_courses != null && fwpmAccepted && fwpmValid;
  const dates = semester.calendar;
  if (overview) return <AdminSemesterOverview programs={catalog ? [{ id:catalog.program_id,name:catalog.program.name,semesters:catalog.semesters }] : []} loading={!catalog && !message} message={message} onCreate={() => openSemester()} onEdit={(_,selected) => openSemester(selected)} onLogout={onLogout}/>;
  return <main className="min-w-[1100px] min-h-screen bg-gray-50"><header className="bg-white border-b px-10 py-5 flex items-center justify-between"><div><button className="inline-flex items-center gap-2 text-sm text-blue-700 mb-3" disabled={busy} onClick={backToOverview}><ArrowLeft size={15}/>Zur Semesterübersicht</button><h1 className="text-2xl">Semester vorbereiten</h1><p className="text-sm text-gray-500 mt-1">Wirtschaftsinformatik · Quellen prüfen, Kursdaten übernehmen, veröffentlichen</p></div><button className="action-button" onClick={() => { if ((!dirty && !editingFwpm) || window.confirm('Ungespeicherte Änderungen verwerfen und abmelden?')) onLogout(); }}><LogOut size={16} />Abmelden</button></header>
    <div className="max-w-[1350px] mx-auto p-8">{catalog ? <fieldset disabled={busy}>
      {!editingFwpm && <nav aria-label="Vorbereitungsschritte" className="flex gap-2 mb-7">{steps.map((label, i) => <div key={label} aria-current={i === step ? 'step' : undefined} className={`flex-1 px-3 py-3 rounded-lg border text-sm ${i === step ? 'bg-blue-50 border-blue-400 text-blue-900' : 'bg-white text-gray-500'}`}><span className={`inline-flex justify-center items-center rounded-full w-6 h-6 mr-2 text-xs ${i === step ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>{i + 1}</span>{label}</div>)}</nav>}
      <section className="bg-white border rounded-2xl p-7 min-h-[380px]">
      {editingFwpm ? <FwpmEditor key={term} value={selection.fwpm_courses || []} library={fwpmLibrary} term={term} onApply={(rows,digest)=>{changeFwpm(rows,digest);setEditingFwpm(false);}} onCancel={()=>setEditingFwpm(false)} /> : <>
      <div className="flex justify-between items-center mb-6"><h2 className="text-xl">{steps[step]}</h2><span className="text-sm text-gray-500">{term} · {semester.status === 'published' ? 'Veröffentlicht' : 'Entwurf'}</span></div>
      {step === 0 && <div className="max-w-2xl space-y-5"><p className="text-gray-600">{creating ? 'Wähle das neue Semester.' : `Semester bearbeiten: ${term}.`} Die Quellen werden ausschließlich für diesen Zeitraum abgerufen.</p><label className="block text-sm">Studiengang<select className="form-input mt-2" aria-label="Studiengang" value={catalog.program_id} onChange={() => {}}><option value={catalog.program_id}>{catalog.program.name}</option></select></label>{creating ? <label className="block text-sm">Semester<select className="form-input mt-2" aria-label="Semester" value={term} onChange={e => chooseNewTerm(e.target.value)}>{semesterChoices(Object.keys(savedCatalog?.semesters || {})).filter(t => !savedCatalog?.semesters[t]).map(t => <option key={t} value={t}>{t}</option>)}</select></label> : <div className="text-sm"><p>Semester</p><p className="mt-2 font-medium">{term}</p></div>}<p className="text-sm text-gray-500">Das FWPM-Angebot wird aus dem vorhandenen Semester oder dem letzten gleichen Saisonsemester vorbereitet. Vorlesungszeiten werden neu abgerufen.</p></div>}
      {step === 1 && <div className="space-y-5"><div className="flex justify-between items-center"><p className="text-sm text-gray-600">Angebot für {term}{proposalSource && proposalSource!==term ? ` · Vorlage: ${proposalSource}` : ''}. Prüfe die beiden Listen und bestätige das Angebot.</p><button className="action-button" onClick={()=>setEditingFwpm(true)}>Liste bearbeiten</button></div>{semester.preparation?.fwpm_courses == null ? <button className="action-button" onClick={()=>void loadFwpm()}>Angebot erneut laden</button> : <FwpmLists rows={selection.fwpm_courses || []}/>}{!fwpmValid && <p className="text-sm bg-amber-50 p-4 rounded-lg">Bei einigen ausgewählten Teilmodulen fehlen Angaben. Bitte unter „Liste bearbeiten“ prüfen.</p>}<label className="flex gap-3 text-sm"><input type="checkbox" disabled={!fwpmValid || semester.preparation?.fwpm_courses == null} checked={fwpmAccepted} onChange={e=>setFwpmAccepted(e.target.checked)}/>Dieses FWPM-Angebot für {term} bestätigen.</label></div>}
      {step === 2 && <div className="space-y-5"><p className="text-sm text-gray-600">Es werden nur Quellen mit dem ausgewählten Semester übernommen. Bei veralteten oder fehlenden Quellen bleiben vorhandene Angaben erhalten.</p>{(['dates', 'schedule'] as const).map(kind => {
        const storedInfo = semester.imports?.[kind];
        const info = kind === 'dates' || scheduleView === 'fresh' || (scheduleView === 'failed' && (storedInfo?.status === 'error' || storedInfo?.status === 'unavailable')) ? storedInfo : undefined;
        return <section key={kind} className="border rounded-lg p-5"><div className="flex items-center justify-between"><h3>{kind === 'dates' ? 'OTH-Semestertermine' : 'B.O.S.S. · Stundenplan & Lehrende'}</h3><button className="action-button" onClick={() => void importSource(kind)}>{kind === 'dates' ? 'OTH-Termine abrufen' : 'B.O.S.S.-Stundenplan abrufen'}</button></div>{info ? <div className="text-sm mt-4"><p className={info.found > 0 ? 'text-green-800' : 'text-amber-900'}>{info.status === 'error' ? 'Abruf fehlgeschlagen' : info.status === 'unavailable' ? 'Keine aktuellen Daten verfügbar' : `${info.found} ${kind === 'dates' ? 'Zeiträume' : 'Disziplinen'} gefunden`}{kind === 'dates' ? ` · ${new Date(info.fetched_at).toLocaleString('de-DE')}` : ''}</p>{kind === 'dates' && info.warnings.map((w, i) => <p key={i} className="text-xs text-gray-500 mt-2">{w}</p>)}{!!info.missing.length && <details className="mt-3"><summary className="cursor-pointer">Ohne Treffer ({info.missing.length})</summary><p className="mt-2 text-gray-500">{info.missing.join(', ')}</p></details>}{!!info.unmatched.length && <details className="mt-3"><summary className="cursor-pointer">Nicht zugeordnete Kürzel ({info.unmatched.length})</summary><p className="mt-2 text-gray-500">{info.unmatched.join(', ')}</p></details>}</div> : kind === 'dates' || !scheduledCount ? <p className="text-sm text-gray-400 mt-3">Noch nicht abgerufen.</p> : null}{kind === 'schedule' && scheduledCount > 0 && scheduleView !== 'fresh' && <div className="flex items-center justify-between mt-4 text-sm gap-3"><p>{scheduleView === 'saved' ? `Gespeicherter Stundenplan · ${scheduledCount} Disziplinen` : 'Gespeicherter Stundenplan vorhanden. Noch kein neuer BOSS-Abruf übernommen.'}</p>{scheduleView !== 'saved' && <button className="action-button" onClick={() => setScheduleViews(previous => ({ ...previous, [term]: 'saved' }))}>Gespeicherten Stundenplan anzeigen</button>}</div>}{kind === 'dates' && dates?.lectures && <div className="text-sm mt-4"><p>Lehrveranstaltungen: {dates.lectures.start} – {dates.lectures.end}</p>{dates.exam_registration && <p className="mt-1">Prüfungsanmeldung: {dates.exam_registration.start} – {dates.exam_registration.end}</p>}{dates.exams && <p className="mt-1">Prüfungszeitraum: {dates.exams.start} – {dates.exams.end}</p>}{dates.breaks?.map((b, i) => <p key={i} className="text-gray-500 mt-1">{b.label}: {b.start} – {b.end}</p>)}</div>}{kind === 'schedule' && prepared && (scheduleView === 'fresh' || scheduleView === 'saved') && scheduledCount > 0 && <SemesterTimetable courses={prepared.courses} groups={prepared.module_groups || []} semester={semester}/>}</section>;
      })}<div className="rounded-lg bg-gray-50 p-4 text-sm"><p>{courses.length} Teilmodule · {courses.filter(c=>c.kind==='elective').length} FWPM · {scheduledCount} mit {scheduleView === 'fresh' ? 'aktuellem' : 'gespeichertem'} Stundenplan</p>{!!prepared?.pending.length && <details className="mt-3"><summary className="cursor-pointer">Nicht automatisch eingeplant ({prepared.pending.length})</summary>{prepared.pending.map(c=><p key={c.id} className="text-gray-500 mt-2">{c.title} · {c.id === 'wi.course.enterprise_systems' ? 'SPO 2026 · Semesterangebot noch nicht bestätigt' : c.frequency_label}</p>)}</details>}{!!prepared?.warnings.length && <details className="mt-3"><summary className="cursor-pointer">Quellenhinweise</summary>{prepared.warnings.map((w,i)=><p key={i} className="text-gray-500 mt-2">{w}</p>)}</details>}</div><label className="flex gap-3 text-sm"><input type="checkbox" checked={publishAccepted} onChange={e=>setPublishAccepted(e.target.checked)}/>Verfügbare Daten für {term} veröffentlichen. Fehlende Quellen können später ergänzt werden.</label></div>}
      </>}
      </section>
      {!editingFwpm && <div className="flex justify-between items-center mt-6"><button className="action-button" onClick={() => { if (step === 0) backToOverview(); else { setStep(s => s - 1); setMessage(''); } }}><ArrowLeft size={16} />Zurück</button><div className="flex gap-3 items-center"><span className="text-xs text-gray-500">{dirty ? 'Ungespeicherte Änderungen' : 'Keine ungespeicherten Änderungen'}</span><button className="action-button" onClick={() => void save(false)} disabled={!dirty}><Save size={16} />Entwurf speichern</button>{step < 2 ? <button className="primary-button" disabled={!canNext} onClick={() => { if (step === 1) void prepare(); else { setStep(1); if(semester.preparation?.fwpm_courses == null) void loadFwpm(); } }}>Weiter<ArrowRight size={16} /></button> : <button className="primary-button" disabled={!publishAccepted || !selection.confirmed || !courses.length} onClick={() => void save(true)}><Check size={16} />Semester veröffentlichen</button>}</div></div>}
    </fieldset> : !message && <p role="status">Semesterquellen werden geladen …</p>}
    <p role="status" aria-live="polite" className="text-sm mt-5 text-gray-700">{busy ? 'Wird verarbeitet …' : message}</p></div>
  </main>;
}
