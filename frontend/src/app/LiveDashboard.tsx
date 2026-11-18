import { AttemptHistory } from './AttemptHistory';
import { useEffect, useState, type ReactNode, type DragEventHandler } from 'react';
import { Activity, Calendar, Check, CheckSquare, Lock, GripVertical, X, CalendarX } from 'lucide-react';
import { moduleRetakes, openRepeats, canRemoveRepeat } from './retakes';
import { RetakeDetails } from './RetakeDetails';
import { ModuleDetails, readExtras, planningConfirmationLabel, plannedAwIndexes, awPartTitle } from './ModuleDetails';
import type { StudyProfile } from './FirstVisit';
import { PaceSignal, MilestoneChecklist, signalClass } from './ProgressSignals';
import { HoverHint } from './HoverHint';
import { moduleColors, moduleLegend } from './moduleColors';
import { workloadSignal } from './progressMath';
import {studyRecommendations} from './recommendations';
import type { DashboardData, DashboardModule, SourceGroup, CourseOption } from './api';

const labels = { passed: 'Bestanden', failed: 'Nicht bestanden', review: 'Nachweis unklar', unknown: 'Offen' };
const number = (value: number | null) => value === null ? '—' : value.toLocaleString('de-DE');
const milestoneGroups = [
  { title:'Praktikum & Praxisseminar', ids:['wi.req.praktikum','wi.req.praxisseminar'] },
  { title:'Bachelorarbeit & Seminar', ids:['wi.req.bachelorarbeit','wi.req.bachelorseminar'] },
];
export const canPlanModule = (m:DashboardModule) => m.status !== 'passed' && (m.planning ? m.planning.status === 'available' : openRepeats(m).length ? openRepeats(m).some(r=>r.attempt<=2) : m.admission?.status === 'available' && (m.semester_offered !== false || !!m.details?.aw_components?.length));
function Panel({ title, icon, children, indicator, dropHandlers }: { dropHandlers?:{onDragOver:DragEventHandler<HTMLElement>;onDrop:DragEventHandler<HTMLElement>}; title: string; icon: ReactNode; children: ReactNode; indicator?:ReactNode }) {
  return <section aria-label={dropHandlers?'Module in aktuelles Semester ziehen':undefined} {...dropHandlers} className="bg-white rounded-xl border border-gray-200 p-6"><div className="flex items-center gap-2 mb-5"><h2 className="text-xl flex items-center gap-2">{icon}{title}</h2><div className="ml-auto">{indicator}</div></div>{children}</section>;
}
function Source({ group }: { group: SourceGroup }) {
  return <div className="border rounded p-3 text-sm"><p className="font-medium">{group.requirement_title}</p><p className="text-gray-600">{number(group.requirement_meta?.ects ?? null)} ECTS · Note {group.requirement_meta?.grade_val?.replace('.',',') ?? '—'}</p>{group.subs?.map((sub, i) => <p key={i} className="mt-2">{sub.title} · {number(sub.ects)} ECTS · {sub.grade_val?.replace('.',',') ?? 'ohne Note'}</p>)}</div>;
}
export function LiveDashboard({ data, profile, ownerKey = 'demo' }: { ownerKey?: string; data: DashboardData; profile?: StudyProfile | null }) {
  const [selected, setSelected] = useState<DashboardModule | null>(null);
  const [detailView, setDetailView] = useState<'overview' | 'course'>('overview');
  const [selectedPlannedCourse, setSelectedPlannedCourse] = useState('');
  const [planMessage,setPlanMessage] = useState('');
  const [, setExtrasRevision] = useState(0);
  const term = profile?.referenceTerm || 'WiSe 2026/27';
  const keyFor = (id: string) => `stage-gate.module:${ownerKey}:${data.curriculum_edition && data.curriculum_edition !== 'wi_bsc_2023' ? data.curriculum_edition : 'wi'}:${term}:${id}`;
  useEffect(() => { setSelected(null); }, [data]);
  const modules = data.stages.flatMap(stage => stage.modules);
  const retakes=new Map(modules.map(m=>[m.id,moduleRetakes(m,term,ownerKey,data.curriculum_edition||'wi')]));
  const removable=(m:DashboardModule)=>canRemoveRepeat(retakes.get(m.id)||[]);
  const automatic=(m:DashboardModule)=>retakes.get(m.id)?.some(r=>r.automatic) && (!removable(m) || readExtras(keyFor(m.id)).excludedAutoTerm!==term);
  const validChoice = (module: DashboardModule) => (!planningConfirmationLabel(module.planning)||readExtras(keyFor(module.id)).registrationConfirmed==='yes')&&(openRepeats(module).some(r=>r.attempt<=2) || (module.details?.aw_components?.length ? plannedAwIndexes(module.details,readExtras(keyFor(module.id))).length>0 : !module.requires_course_selection || !!module.course_options?.some(c => c.id===readExtras(keyFor(module.id)).selectedCourseId && c.course?.offered!==false)));
  const outdatedPlan = modules.some(m => m.status!=='passed' && readExtras(keyFor(m.id)).plannedTerm===term && (!canPlanModule(m) || !validChoice(m)));
  const planned = modules.filter(m => canPlanModule(m) && validChoice(m) && (readExtras(keyFor(m.id)).plannedTerm === term || automatic(m)));
  const plannedEntries:{module:DashboardModule;option?:CourseOption;awIndex?:number}[] = planned.flatMap<{module:DashboardModule;option?:CourseOption;awIndex?:number}>(module => {
    const extras = readExtras(keyFor(module.id));
    if (module.details?.aw_components?.length && !openRepeats(module).length)return plannedAwIndexes(module.details,extras).map(awIndex=>({module,awIndex}));
    return [{ module, option: module.completion_rule==='all'?undefined:module.course_options?.find(c => c.id === extras.selectedCourseId) }];
  });
  const entryEcts=(entry:{module:DashboardModule;option?:CourseOption;awIndex?:number})=>entry.awIndex!==undefined?entry.module.details?.aw_components?.[entry.awIndex]?.ects??null:entry.module.completion_rule==='all'&&entry.option&&!openRepeats(entry.module).length?entry.option.ects??null:entry.module.required_ects;
  const workload=workloadSignal(plannedEntries.map(e=>({ects:entryEcts(e)})));
  const planChoices=plannedEntries.map(e=>({moduleId:e.module.id,courseId:e.option?.id,partId:e.awIndex!==undefined?`aw:${e.awIndex}`:e.module.completion_rule==='all'&&!openRepeats(e.module).length?e.option?.id:undefined}));
  const hints=studyRecommendations(data,planChoices,workload.ects,term,workload.unknown===0);
  const workloadIndicator=<HoverHint align="right" placement="bottom" text="Planungsumfang nach ECTS: unter 16 rot; 16 bis unter 24 orange; 24 bis einschließlich 32 grün; über 32 bis unter 40 orange; ab 40 rot. Ein leerer Plan oder unbekannte ECTS werden noch nicht bewertet. Orientierung, keine individuelle Schwierigkeitsschätzung. Wiederholungen zählen zum geplanten Umfang, erzeugen aber keine zusätzlichen Abschluss-ECTS."><span className="inline-flex items-center gap-2 text-xl" data-testid="semester-ects"><span className={`w-6 h-6 rounded-full ${workload.color==='yellow'?'bg-orange-500':signalClass[workload.color]}`} aria-label={workload.label}/>{number(workload.ects)} ECTS{workload.unknown?' + offen':''}</span></HoverHint>;
  const selectedAwIndex=selectedPlannedCourse.startsWith('aw:')?Number(selectedPlannedCourse.slice(3)):undefined;
  const passed = modules.filter(m => m.status === 'passed').length;
  const failures = modules.filter(m => (m.open_exam_count || 0)>0 && m.status!=='passed');
  const shownStages = data.stages.filter(s=>s.id!=='praxissemester').map(s=>s.id==='abschnitt_2' ? {...s,modules:[...s.modules,...(data.stages.find(p=>p.id==='praxissemester')?.modules || [])]}:s);
  function openModule(module:DashboardModule, view:'overview'|'course'='overview', courseId='') { setDetailView(view); setSelectedPlannedCourse(courseId); setSelected(module); }
  function removePlanned(module:DashboardModule,courseId='') {
    if(!removable(module)){setPlanMessage('Für diese Pflichtwiederholung zuerst die bestätigte Verschiebung in der Modulkarte hinterlegen.');return;}
    const key=keyFor(module.id),extras=readExtras(key);
    const prior=module.details?.aw_components?.length?plannedAwIndexes(module.details,extras).map(i=>`aw:${i}`):(extras.plannedCourseIds.length?extras.plannedCourseIds:module.course_options?.map(c=>c.id)||[]);
    const remaining=courseId?prior.filter(id=>id!==courseId):[];
    try {localStorage.setItem(key,JSON.stringify({...extras,plannedCourseIds:remaining,plannedTerm:remaining.length?term:'',excludedAutoTerm:term}));setExtrasRevision(v=>v+1);setPlanMessage('Aus dem Semesterplan entfernt. Kursauswahl und Notizen bleiben gespeichert.');}catch{setPlanMessage('Änderung konnte nicht gespeichert werden.');}
  }
  function retakeSaved(module:DashboardModule) {
    const key=keyFor(module.id),extras=readExtras(key);
    // A new confirmation/revocation starts a new removal decision. In
    // particular, revoking and approving again must not reuse an old X click.
    const mustReturn=!canRemoveRepeat(moduleRetakes(module,term,ownerKey,data.curriculum_edition||'wi'));
    if(mustReturn||extras.excludedAutoTerm===term)localStorage.setItem(key,JSON.stringify({...extras,excludedAutoTerm:'',plannedTerm:mustReturn?term:extras.plannedTerm}));
    setPlanMessage(mustReturn?'Pflichtwiederholung wieder im aktuellen Semester eingeplant.':'');
    setExtrasRevision(v=>v+1);
  }
  function dropModules(ids:string[]) {
    const candidates=modules.filter(m=>ids.includes(m.id) && canPlanModule(m));
    const choice=candidates.find(m=>!openRepeats(m).length && (m.details?.aw_components?.length || m.requires_course_selection || !!planningConfirmationLabel(m.planning)&&readExtras(keyFor(m.id)).registrationConfirmed!=='yes'));
    if(choice) {setPlanMessage(planningConfirmationLabel(choice.planning)?'Bitte die bestätigte Praxisvereinbarung bzw. Anmeldung in der Modulkarte angeben.':choice.details?.aw_components?.length?'Bitte einen AW-Kurs auswählen, den Platz bestätigen und das gewünschte Teilmodul hinzufügen.':'Bitte zuerst eine Disziplin auswählen und deinen Platz bestätigen.');openModule(choice);return;}
    try {
      for(const m of candidates) localStorage.setItem(keyFor(m.id),JSON.stringify({...readExtras(keyFor(m.id)),plannedTerm:term,excludedAutoTerm:''}));
      if(candidates.length) { setExtrasRevision(v=>v+1); setPlanMessage(candidates.some(m=>m.planning) ? 'Eingeplant. Die Anmeldung erfolgt separat bei der OTH.':''); }
    } catch { setPlanMessage('Plan konnte nicht gespeichert werden. Bitte Browser-Speicher prüfen.'); }
  }
  function moduleCard(module: DashboardModule) {
    const available=canPlanModule(module), inPlan=planned.includes(module);
    const repeats=retakes.get(module.id)||[],urgent=repeats.some(r=>r.automatic);
    const seasonal=!module.planning && !module.details?.aw_components?.length && !repeats.length && module.admission?.status==='available' && module.semester_offered===false;
    const style=module.status==='passed'?moduleColors.passed:module.status==='failed'||repeats.length?moduleColors.failed:inPlan?moduleColors.planned:available?moduleColors.available:moduleColors.locked;
    return <button draggable={available} onDragStart={event => {event.stopPropagation();event.dataTransfer.setData('application/x-study-module',module.id);}} key={module.id} onClick={() => openModule(module)} title={module.completion_pending?module.credit_hold_reason:available ? `${module.title} · In das aktuelle Semester ziehen` : seasonal?`${module.title} · Kein bestätigtes Angebot in ${term}`:module.planning?.reason || module.admission?.reason || module.title} aria-label={`${module.title}: ${labels[module.status]}`} data-module-id={module.id} className={`text-left border rounded-lg p-3 min-h-[88px] flex flex-col justify-between hover:shadow-sm ${style}`}>
      <span className="flex justify-between gap-1"><span className="text-sm font-medium">{module.short_title}</span>{module.status==='passed' ? <span className="flex items-center gap-1 text-xs text-green-700">{module.grade?.replace('.',',')}<Check size={12}/></span> : seasonal ? <CalendarX size={13} className="text-gray-400"/> : available ? <GripVertical size={13} className="text-gray-400"/> : <Lock size={12} className="text-gray-400"/>}</span>
      <span className="text-xs text-gray-500 mt-2">{module.required_ects} ECTS</span><span className="text-[10px] text-gray-500 mt-1">{module.status==='passed' ? 'Bestanden' : module.completion_pending?'Nachweis vorhanden · Block offen':urgent?(removable(module)?'Verschiebung bestätigt':'Pflichtwiederholung'):module.status==='failed' ? 'Nicht bestanden' : module.status==='review' ? 'Nachweis unklar' : inPlan ? 'Im aktuellen Semester' : available ? (module.planning ? 'Einplanbar':'Verfügbar') : seasonal?'Nicht in diesem Semester':'Gesperrt'}{module.status==='failed' && inPlan ? ' · Im aktuellen Semester':''}</span>
    </button>;
  }
  function stageCards(rows: DashboardModule[]) {
    const shown = new Set<string>();
    return rows.map(module => {
      const milestone=milestoneGroups.find(g=>g.ids.includes(module.id));
      const composite=module.details?.composite_group;
      const group=milestone || (composite ? {title:composite.title,ids:composite.children.map(c=>c.id)}:null);
      if(!group) return moduleCard(module);
      if(shown.has(group.title)) return null;
      shown.add(group.title);
      const children=rows.filter(m=>group.ids.includes(m.id)), available=children.filter(canPlanModule);
      return <section key={group.title} aria-label={group.title} draggable={!!available.length} onDragStart={e=>e.dataTransfer.setData('application/x-study-module',JSON.stringify(available.map(m=>m.id)))} className={`col-span-2 rounded-xl border p-3 ${children.every(m=>m.status==='passed')?moduleColors.passed:children.some(m=>planned.includes(m))?moduleColors.planned:available.length?moduleColors.available:moduleColors.locked}`}><div className="flex justify-between gap-2 mb-3"><h3 className="text-xs font-medium">{group.title}</h3><span className="text-xs text-gray-500 whitespace-nowrap">{children.reduce((n,m)=>n+m.required_ects,0)} ECTS</span></div><div className="grid grid-cols-2 gap-2">{children.map(moduleCard)}</div></section>;
    });
  }
  function plannedCard(module:DashboardModule) {
    const repeats=retakes.get(module.id)||[],isRepeat=repeats.length>0;
    return plannedEntries.filter(e=>e.module.id===module.id).map(({option,awIndex})=>{
      const partId=awIndex!==undefined?`aw:${awIndex}`:module.completion_rule==='all' && !isRepeat ? option?.id||'':'';
      const awTitle=awIndex!==undefined?awPartTitle(module.details,readExtras(keyFor(module.id)),awIndex):'';
      const ects=entryEcts({module,option,awIndex});
      const fullTitle=isRepeat?repeats.map(r=>r.exam.title).join(' · '):awTitle || option?.title || module.actual_course_title || module.title;
      const partIndex=module.course_options?.findIndex(c=>c.id===partId)??-1;
      let shortTitle=module.short_title;
      if(awIndex!==undefined)shortTitle=`${module.short_title} · ${awIndex+1}`;
      else if(partId)shortTitle=option?.short_title||`${module.short_title} · ${partIndex+1}`;
      else if(module.requires_course_selection&&option?.short_title)shortTitle=`${module.short_title} · ${option.short_title}`;
      return <div key={`${module.id}:${partId||option?.id||''}`} data-planned-module={module.id} className={`relative min-w-0 border rounded-lg ${isRepeat?moduleColors.failed:moduleColors.planned}`}>
        <button className="w-full min-h-[88px] text-left p-3 pr-8 rounded-lg flex flex-col justify-between hover:shadow-sm" aria-label={`${fullTitle} ${isRepeat?'Prüfungswiederholung ':''}${ects??'—'} ECTS`} title={fullTitle} onClick={()=>openModule(module,'course',partId)}>
          <span className="block text-sm font-medium truncate">{shortTitle}</span>
          <span className="block text-xs text-gray-500 mt-2">{ects??'—'} ECTS</span>
          <span className={`block text-[10px] mt-1 ${isRepeat?'text-orange-900':'text-blue-800'}`}>{isRepeat?(repeats.some(r=>r.automatic)?(removable(module)?'Verschiebung bestätigt':'Pflichtwiederholung'):'Wiederholung'):module.planning?'Anmeldung separat':'Eingeplant'}</span>
        </button>
        <button type="button" disabled={!removable(module)} className="absolute right-2 top-2 p-1 text-gray-400 enabled:hover:text-red-700 disabled:opacity-40 rounded" aria-label={`${awTitle || option?.title || module.title} aus Semester entfernen`} title={removable(module)?'Aus Semester entfernen':'Erst bestätigte Verschiebung in der Modulkarte hinterlegen'} onClick={()=>removePlanned(module,partId)}>{removable(module)?<X size={15}/>:<Lock size={13}/>}</button>
      </div>;
    });
  }
  const legend=moduleLegend;
  const plannedShown=new Set<string>();
  return <main className="max-w-[1920px] mx-auto px-8 py-6" aria-label="Studienübersicht">
    <div className="grid grid-cols-3 gap-6 mb-6">
      <Panel title="Mein Status" icon={<Activity size={20}/>} indicator={profile&&<PaceSignal key={`${ownerKey}:${data.curriculum_edition}:${profile.startTerm}`} data={data} profile={profile}/>}>
        <dl className="grid grid-cols-2 gap-5"><div><dt className="text-sm text-gray-500">ECTS</dt><dd className="text-2xl mt-1" data-testid="official-credits">{number(data.official_credits)}{data.supported?' / 210':''}</dd></div><div><dt className="text-sm text-gray-500">Durchschnittsnote</dt><dd className="text-2xl mt-1" data-testid="official-grade">{number(data.official_grade)}</dd></div></dl>
        {data.supported && data.official_credits!==null && <progress className="w-full h-2 mt-5 accent-green-500" max={210} value={data.official_credits} aria-label="ECTS aus der PDF"/>}
        <p className="text-sm text-gray-600 mt-5">{passed} von {modules.length} abgeschlossen · {modules.length-passed} offen</p><MilestoneChecklist data={data}/>
      </Panel>
      <Panel title="Aktuelles Semester" icon={<Calendar size={20}/>} indicator={workloadIndicator} dropHandlers={{onDragOver:e=>{if(e.dataTransfer.types.includes('application/x-study-module'))e.preventDefault();},onDrop:e=>{if(!e.dataTransfer.types.includes('application/x-study-module'))return;e.preventDefault();const raw=e.dataTransfer.getData('application/x-study-module');try{const ids=JSON.parse(raw);if(Array.isArray(ids)&&ids.every(id=>typeof id==='string'))dropModules(ids);}catch{dropModules([raw]);}}}}>
        <div className="min-h-32">
          <p className="text-sm text-gray-500 mb-3">{term}</p>
          {outdatedPlan && <p className="text-xs text-amber-800 mb-3">Für einen geplanten Eintrag fehlt eine Bestätigung oder ein aktuelles Angebot. Die Modulkarte zeigt die erforderlichen Angaben.</p>}
          {planned.length ? <div className="grid grid-cols-2 gap-2" data-testid="semester-card-grid">{planned.map(module=>{
            const group=milestoneGroups.find(g=>g.ids.includes(module.id));
            if(group){if(plannedShown.has(group.title))return null;plannedShown.add(group.title);return <section key={group.title} className="col-span-2 rounded-xl border border-blue-300 bg-blue-50 p-3"><h3 className="text-xs font-medium text-blue-900 mb-3">{group.title}</h3><div className="grid grid-cols-2 gap-2">{planned.filter(m=>group.ids.includes(m.id)).flatMap(plannedCard)}</div></section>;}
            const parts=plannedEntries.filter(e=>e.module.id===module.id);
            return parts.length>1?<section key={module.id} className="col-span-2 rounded-xl border border-blue-300 bg-blue-50 p-3"><h3 className="text-xs font-medium text-blue-900 mb-3">{module.short_title}{module.details?.aw_components?.length?` · ${parts.length}/${module.details.aw_components.length} Teilmodule`:''}</h3><div className="grid grid-cols-2 gap-2">{plannedCard(module)}</div></section>:plannedCard(module);
          })}</div> : <div className="rounded-lg border border-dashed p-4 text-sm text-gray-500"><p>Dein Semesterplan ist noch leer.</p><p className="mt-2">Ziehe verfügbare Module hierher oder füge sie über die Modulkarte hinzu.</p></div>}
          {planMessage && <p role="status" className="text-xs text-blue-800 mt-3">{planMessage}</p>}
        </div>
      </Panel>
      <Panel title="Nächste Schritte" icon={<CheckSquare size={20}/>}><ul className="space-y-4 text-sm text-gray-700">
        {failures.map(m=><li key={m.id} className="rounded bg-orange-50 p-3 text-orange-900"><span className="font-medium">{m.short_title}: </span>{(retakes.get(m.id)||[]).length?(retakes.get(m.id)||[]).map(r=><span key={r.key} className="block mt-1">{r.state==='unknown'?'Das Veröffentlichungsdatum fehlt. HISinOne kann hier helfen, den Wiederholungsstatus zu klären.':r.state==='review'?'Eine weitere Wiederholung erfordert eine Klärung mit dem Prüfungsamt.':r.state==='later'?`Die Wiederholung ist für ${r.targetTerm} vorgesehen und noch nicht automatisch eingeplant.`:r.deferralApproved?(planned.includes(m)?'Bestätigte Verschiebung für dieses Semester hinterlegt. Das Modul ist trotzdem freiwillig eingeplant.':'Bestätigte Verschiebung für dieses Semester hinterlegt.'):planned.includes(m)?'Pflichtwiederholung im Semesterplan. Die Prüfungsanmeldung erfolgt separat.':'Für dieses Semester ist eine Pflichtwiederholung vorgesehen. Die Prüfungsanmeldung erfolgt separat.'}{r.noCourse?' Ein Blick auf das Lehrangebot und die Möglichkeit eines Antrags auf Verschiebung könnte hilfreich sein.':''}</span>):'Bei offenen negativen Ergebnissen bietet HISinOne Informationen zur nächsten Prüfungsanmeldung.'}<button type="button" className="block text-blue-700 underline mt-2" onClick={()=>openModule(m)}>Modul ansehen</button></li>)}
        {hints.slice(0,3).map(h=><li key={h.id} className={`rounded-lg p-3 ${h.tone==='warning'?'bg-amber-50 text-amber-950':h.tone==='success'?'bg-green-50 text-green-950':'bg-gray-50'}`}><p className="font-medium">{h.title}</p><p className="mt-2">{h.text}</p>{h.moduleId&&<button type="button" className="text-blue-700 underline mt-2" onClick={()=>{const m=modules.find(m=>m.id===h.moduleId);if(m)openModule(m);}}>Modul ansehen</button>}</li>)}
        {hints.length>3&&<li><details><summary className="cursor-pointer text-gray-500">Weitere Hinweise ({hints.length-3})</summary><ul className="space-y-4 mt-3">{hints.slice(3).map(h=><li key={h.id}><p className="font-medium">{h.title}</p><p className="mt-1">{h.text}</p>{h.moduleId&&<button type="button" className="text-blue-700 underline mt-1" onClick={()=>{const m=modules.find(m=>m.id===h.moduleId);if(m)openModule(m);}}>Modul ansehen</button>}</li>)}</ul></details></li>}
        {!!data.unmatched_groups.length && <li>{data.unmatched_groups.length} Nachweise lassen sich noch keinem Modul zuordnen. Die Details dazu stehen unten.</li>}
        {!!planned.length && <li>Für eingeplante Module die erforderliche Anmeldung separat erledigen.</li>}
      </ul></Panel>
    </div>
    {!data.supported ? <p className="bg-amber-50 border rounded p-4">Für diesen Studiengang ist noch kein Studienplan hinterlegt.</p> : <>
      <section className="bg-white rounded-xl border border-gray-200 p-6 grid grid-cols-3 gap-8" aria-label="Studienplan nach Abschnitten">{shownStages.map(stage=><section key={stage.id} data-testid={`study-stage-${stage.id}`} className={stage.modules.length>0&&stage.modules.every(m=>m.status==='passed')?'bg-green-50 rounded-xl p-3 -m-3 border border-green-200':''}>
        <div className="flex items-center justify-between mb-5"><h2 className="text-lg">{stage.title}</h2><HoverHint align="right" text={stage.access?.reason || 'Die Voraussetzungen werden aus den bestätigten Ergebnissen geprüft.'}><span className="text-xs text-gray-500">{stage.modules.every(m=>m.status==='passed')?'Abgeschlossen · ':stage.access ? (stage.access.status==='blocked'?'Abschnitt gesperrt · ':'Freigeschaltet · '):''}{stage.modules.filter(m=>m.status==='passed').length} / {stage.modules.length}</span></HoverHint></div><div className="grid grid-cols-2 gap-2">{stageCards(stage.modules)}</div>
      </section>)}</section>
      <div className="flex gap-5 mt-4 text-xs text-gray-500" aria-label="Kartenstatus">{legend.map(([style,label])=><span key={label} className="flex items-center gap-2"><span className={`w-3 h-3 border rounded ${style}`}/>{label}</span>)}</div>
    </>}
    {!!data.unmatched_groups.length && <details className="mt-6 bg-white border rounded-lg p-4"><summary className="cursor-pointer">Nicht zugeordnete Nachweise ({data.unmatched_groups.length})</summary><div className="grid grid-cols-3 gap-3 mt-4">{data.unmatched_groups.map((group,i)=><Source key={i} group={group}/>)}</div></details>}
    {selected && <ModuleDetails calendar={data.semester_calendar} calendarTitle={selected.short_title} calendarScope={keyFor(selected.id)} open onClose={()=>setSelected(null)} storageKey={keyFor(selected.id)+(selectedPlannedCourse?`:${selectedPlannedCourse}`:'')} plannedCourseId={selectedPlannedCourse || undefined} onRemovePlannedCourse={()=>removePlanned(selected,selectedPlannedCourse)} externalPlanned={planned.includes(selected)} canRemovePlannedCourse={removable(selected)} repeatExam={openRepeats(selected).some(r=>r.attempt<=2)} childrenAfter={(retakes.get(selected.id)||[]).length?<RetakeDetails plans={retakes.get(selected.id)!} onSaved={()=>retakeSaved(selected)}/>:undefined} title={selectedAwIndex!==undefined?awPartTitle(selected.details,readExtras(keyFor(selected.id)),selectedAwIndex):selected.title} subtitle={selected.completion_pending?'Nachweis vorhanden · Gesamtblock noch offen':labels[selected.status]} grade={selected.grade} ects={selectedAwIndex!==undefined?selected.details?.aw_components?.[selectedAwIndex]?.ects:selected.required_ects} planning={selected.planning} term={term} view={detailView} details={selected.details} admission={openRepeats(selected).length && !openRepeats(selected).some(r=>r.attempt<=2) ? {status:'unknown',reason:'Die Zulässigkeit einer weiteren Wiederholung zuerst mit dem Prüfungsamt klären.'}:selected.admission} course={selected.course} semesterOffered={selected.semester_offered} courseOptions={selected.course_options} requiresCourseSelection={selected.requires_course_selection} passed={selected.status==='passed'||!!selected.completion_pending} onSaved={()=>setExtrasRevision(v=>v+1)}>
      {selected.completion_pending&&<p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">{selected.credit_hold_reason}</p>}
      {((selected.exam_history?.length || 0)>0 || selected.source) && <details className="mt-5 text-sm"><summary className="cursor-pointer text-gray-600">Details aus HISinOne</summary>{selected.exam_history?.length ? <AttemptHistory rows={selected.exam_history} passed={selected.status==='passed'||!!selected.completion_pending}/> : selected.source ? <div className="mt-3"><Source group={selected.source}/></div>:null}</details>}
      {selected.status==='review' && <p className="text-sm text-amber-800">Der Nachweis lässt sich noch nicht eindeutig diesem Modul zuordnen.</p>}
    </ModuleDetails>}
  </main>;
}
