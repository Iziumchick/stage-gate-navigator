import type {DashboardData,DashboardModule} from './api';
import {openRepeats} from './retakes';
export type PlannedChoice={moduleId:string;partId?:string;courseId?:string};
export type StudyHint={id:string;title:string;text:string;tone:'warning'|'info'|'success';moduleId?:string;priority:number};
const isRepeat=(m:DashboardModule)=>m.status==='failed'||(m.open_exam_count||0)>0||openRepeats(m).length>0;
const norm=(s:string)=>s.normalize('NFKC').toLocaleLowerCase('de').replace(/^\d+(?:\.\d+)*\s*/,'').replace(/[^\p{L}\p{N}]/gu,'');
export function offeringSeason(m:DashboardModule):'both'|'winter'|'summer'|undefined {
 const labels=[m.details?.offered_in,...(m.course_options||[]).map(c=>c.details?.offered_in)].filter(Boolean) as string[];
 const seasons=labels.map(value=>{const v=value.toLowerCase();if(/unregel|irregular/.test(v))return undefined;const w=/winter|wise/.test(v),s=/sommer|sose/.test(v);return w&&s||/jedes semester|every semester/.test(v)?'both':w?'winter':s?'summer':undefined;});
 const known=[...new Set(seasons.filter(Boolean))];
 return known.length===1?known[0] as 'both'|'winter'|'summer':undefined;
}
/** Forecast whole requirements only. A selected Teilmodul never awards its parent ECTS by itself. */
export function forecastProgress(data:DashboardData,choices:PlannedChoice[]) {
 const modules=data.stages.flatMap(s=>s.modules),selected=new Map<string,Set<string>>();
 for(const c of choices)selected.set(c.moduleId,new Set([...(selected.get(c.moduleId)||[]),c.partId||'whole']));
 const complete=new Set(modules.filter(m=>m.status==='passed'||m.completion_pending).map(m=>m.id));
 const incompletePlanned:string[]=[],duplicatePlanned:string[]=[],usedCourses=new Set<string>();
 for(const m of modules){
  const ids=selected.get(m.id);if(!ids||complete.has(m.id))continue;
  const courseId=choices.find(c=>c.moduleId===m.id)?.courseId;
  if(m.requires_course_selection&&courseId){if(usedCourses.has(courseId)){duplicatePlanned.push(m.id);continue;}usedCourses.add(courseId);}
  let done=true;
  if(m.details?.aw_components?.length){
   done=m.details.aw_components.every((_,i)=>ids.has(`aw:${i}`)||m.details?.components?.[i]?.status==='passed');
  }else if(m.completion_rule==='all'&&m.course_options?.length){
   done=ids.has('whole')||m.course_options.every(o=>ids.has(o.id)||m.details?.components?.some(p=>p.status==='passed'&&norm(p.title)===norm(o.title)));
  }
  if(done)complete.add(m.id);else incompletePlanned.push(m.id);
 }
 for(const pair of [['wi.req.praktikum','wi.req.praxisseminar'],['wi.req.bachelorarbeit','wi.req.bachelorseminar']]){
  if(pair.some(id=>modules.some(m=>m.id===id))&&!pair.every(id=>complete.has(id)))pair.forEach(id=>complete.delete(id));
 }
 const first=data.stages.find(s=>s.id==='abschnitt_1')?.modules||[];
 const ects=modules.reduce((n,m)=>n+(complete.has(m.id)?m.required_ects:0),0);
 const firstEcts=first.reduce((n,m)=>n+(complete.has(m.id)?m.required_ects:0),0);
 return {complete,ects,firstEcts,firstDone:first.length>0&&first.every(m=>complete.has(m.id)),incompletePlanned,duplicatePlanned};
}
export function studyRecommendations(data:DashboardData,choices:PlannedChoice[],load:number,term:string,knownLoad=true):StudyHint[]{
 const modules=data.stages.flatMap(s=>s.modules),byId=new Map(modules.map(m=>[m.id,m]));
 const planned=new Set(choices.map(c=>c.moduleId));
 const current=forecastProgress(data,[]),future=forecastProgress(data,choices);
 const hints:StudyHint[]=[];
 const add=(hint:StudyHint)=>hints.push(hint);
 const eligible=(m:DashboardModule)=>m.status!=='passed'&&!m.completion_pending&&(m.planning?m.planning.status==='available':m.admission?.status==='available')&&m.semester_offered!==false;
 const selectedRepeats=modules.filter(m=>planned.has(m.id)&&isRepeat(m));
 if(load>32){
  const flexible=modules.filter(m=>planned.has(m.id)&&!m.planning&&!isRepeat(m)&&offeringSeason(m)==='both').sort((a,b)=>b.required_ects-a.required_ects)[0];
  add({id:'load',title:selectedRepeats.length?'Mögliche Entlastung bei Wiederholungen':'Mögliche Entlastung im Semester',tone:'warning',priority:10,moduleId:flexible?.id,
   text:`${knownLoad?'':'Mindestens '}${load.toLocaleString('de')} ECTS sind eingeplant.${selectedRepeats.length?' Darunter eine oder mehrere Wiederholungen: etwas mehr Zeit für deren Vorbereitung könnte hilfreich sein.':''}${flexible?` Da ${flexible.short_title} regulär in beiden Semestern angeboten wird, könntest du überlegen, dieses Modul ins nächste Semester zu verschieben. Das wäre eine Möglichkeit, deinen Plan etwas zu entlasten.`:' Vielleicht kommt für dich infrage, eines der zusätzlichen Module auf ein späteres Semester zu verteilen.'}`});
 }
 for(const gate of data.progress?.gates||[]){
  const now=gate.scope==='first'?current.firstEcts:current.ects;
  const after=gate.scope==='first'?future.firstEcts:future.ects;
  const already=now>=gate.minimum_ects&&(!gate.all_first||current.firstDone);
  if(already)continue;
  const missing=Math.max(0,gate.minimum_ects-now),remaining=Math.max(0,gate.minimum_ects-after);
  if(missing>35&&remaining>35)continue;
  const label=gate.id==='practice'?'Praxis':gate.id==='abschnitt_2'?'Abschnitt 2':'Abschnitt 3';
  const firstMissing=gate.all_first?data.stages.find(s=>s.id==='abschnitt_1')?.modules.filter(m=>!future.complete.has(m.id)).map(m=>m.short_title)||[]:[];
  const projectedReady=remaining===0&&(!gate.all_first||future.firstDone);
  let text=missing?`Bis zur ECTS-Voraussetzung für ${label} fehlen ${missing} ECTS.`:`Die ECTS-Schwelle für ${label} ist erreicht.`;
  if(choices.length)text+=projectedReady?` Wenn du die ausgewählten Module erfolgreich und vollständig abschließt, wäre diese Voraussetzung für das nächste Semester erfüllt.`:` Wenn du die ausgewählten Module erfolgreich und vollständig abschließt, fehlen danach noch ${remaining} ECTS.`;
  if(firstMissing.length)text+=` Außerdem offen aus Abschnitt 1: ${firstMissing.join(', ')}.`;
  if(gate.id==='practice')text+=projectedReady?' Eine unverbindliche Suche nach Stellen und Bewerbungsfristen könnte bereits sinnvoll sein. Beginn und Anmeldung wären nach bestätigten Voraussetzungen mit der OTH abzustimmen.':' Du kannst dich bereits unverbindlich über Praxisstellen und Bewerbungsfristen informieren.';
  add({id:`gate:${gate.id}`,title:projectedReady?`${label} rückt in Reichweite`:`Nächster Schritt: ${label}`,text,tone:projectedReady?'success':'info',priority:gate.id==='practice'?20:25});
  // Suggest adding only a whole available module that actually closes this gap,
  // within the 30-ECTS planning range. Never increase an already heavy plan.
  if(knownLoad&&choices.length&&remaining>0&&remaining<=5&&load<30&&!selectedRepeats.length){
   const fit=modules.find(m=>!planned.has(m.id)&&eligible(m)&&!isRepeat(m)&&!m.requires_course_selection&&!m.details?.aw_components?.length&&(!m.completion_rule||m.completion_rule==='single')&&load+m.required_ects<=30&&m.required_ects>=remaining&&(gate.scope!=='first'||data.stages.find(s=>s.id==='abschnitt_1')?.modules.some(p=>p.id===m.id)));
   if(fit){const withFit=forecastProgress(data,[...choices,{moduleId:fit.id}]);
    if((gate.scope==='first'?withFit.firstEcts:withFit.ects)>=gate.minimum_ects&&(!gate.all_first||withFit.firstDone))add({id:`bridge:${gate.id}`,title:`${fit.short_title} könnte die Lücke schließen`,text:`Mit zusätzlich ${fit.required_ects} ECTS aus ${fit.short_title} läge dein Plan bei ${load+fit.required_ects} ECTS. Bei erfolgreichem Abschluss aller gewählten Module wäre die Voraussetzung für ${label} erreicht. Das ist eine Planungsoption, keine Zulassungszusage.`,tone:'info',priority:24,moduleId:fit.id});
   }
  }
 }
 for(const m of modules.filter(m=>eligible(m)&&!planned.has(m.id)&&!isRepeat(m))){
  const season=offeringSeason(m);
  if(season!==(term.startsWith('WiSe')?'winter':'summer'))continue;
  add({id:`season:${m.id}`,title:`Saisonales Angebot: ${m.short_title}`,text:`${m.short_title} wird regulär nur im ${season==='winter'?'Wintersemester':'Sommersemester'} angeboten. ${load>=30||!knownLoad?'Bei diesem Umfang könnte es sinnvoll sein, das saisonale Angebot gegen die bereits gewählten Module abzuwägen.':'Vielleicht passt es noch in deinen Plan für dieses Semester.'} Die nächste reguläre Angebotsphase wäre voraussichtlich in einem Jahr.`,tone:'info',priority:35,moduleId:m.id});
 }
 for(const id of future.incompletePlanned){const m=byId.get(id)!;add({id:`parts:${id}`,title:`${m.short_title}: Teilmodule eingeplant`,text:'Die ausgewählten Teile zählen zur Semesterlast. Für die Vorschau der Abschnitts- und Praxisvoraussetzungen zählen die Modul-ECTS erst nach Abschluss aller erforderlichen Teile.',tone:'info',priority:30,moduleId:id});}
 const covered=(id:string)=>{const m=byId.get(id);return !!m&&(m.status==='passed'||m.completion_pending||planned.has(id));};
 for(const pair of [['wi.req.praktikum','wi.req.praxisseminar'],['wi.req.bachelorarbeit','wi.req.bachelorseminar']]){
  const [mainId,seminarId]=pair;
  const main=byId.get(mainId),seminar=byId.get(seminarId);
  if(!main||!seminar||covered(mainId)===covered(seminarId))continue;
  const missing=covered(mainId)?seminar:main;
  const proof=[main,seminar].find(m=>m.completion_pending);
  const practice=mainId==='wi.req.praktikum';
  add({id:proof?`finish:${missing.id}`:`pair:${missing.id}`,title:covered(mainId)?`${seminar.short_title} ebenfalls einplanen?`:`${main.short_title} noch nicht eingeplant`,
   text:`${proof?`Der Nachweis für ${proof.title} ist vorhanden.`:`${covered(mainId)?main.short_title:seminar.short_title} ist bereits eingeplant.`} ${covered(mainId)?`Vielleicht passt ${seminar.short_title} ebenfalls in dieses Semester. Ein abweichender Termin wäre mit der OTH abzustimmen.`:`Vielleicht kannst du auch ${main.short_title} für dieses Semester berücksichtigen und die erforderliche Bestätigung klären.`} Der vollständige ${practice?'Praxisblock':'Bachelorblock'} mit ${main.required_ects+seminar.required_ects} ECTS ist erst nach erfolgreichem Abschluss beider Bestandteile erreicht.`,tone:'info',priority:18,moduleId:missing.id});
 }
 for(const id of future.duplicatePlanned){const m=byId.get(id)!;add({id:`duplicate:${id}`,title:`Mögliche doppelte Kursauswahl: ${m.short_title}`,text:'Dieselbe Disziplin ist für mehrere Wahlmodule ausgewählt. Im Fortschrittsausblick wird sie nicht doppelt angerechnet. Eine andere passende Disziplin wäre eine Möglichkeit, beide Wahlmodule abzudecken.',tone:'warning',priority:12,moduleId:id});}
 const thesis=modules.find(m=>m.planning?.kind==='thesis'&&m.planning.status==='available'&&m.status!=='passed'&&!m.completion_pending);
 const practice=modules.find(m=>m.planning?.kind==='practice'&&m.planning.status==='available'&&m.status!=='passed'&&!m.completion_pending);
 if(thesis&&!covered(thesis.id)&&!covered('wi.req.bachelorseminar'))add({id:'thesis-ready',title:'Bachelorarbeit vorbereiten',text:'Du könntest dich bereits nach Betreuung und einem Thema umsehen. Arbeit und Seminar lassen sich persönlich einplanen; die offizielle Anmeldung und Zulassung erfolgen separat mit der OTH.',tone:'info',priority:26,moduleId:thesis.id});
 else if(practice&&!covered(practice.id)&&!covered('wi.req.praxisseminar'))add({id:'practice-ready',title:'ECTS-Voraussetzung für Praxis erfüllt',text:'Eine Suche nach einer passenden Praktikumsstelle könnte jetzt sinnvoll sein. Vertrag und Anmeldung erfolgen in Abstimmung mit der OTH. Praktikum und Praxisseminar benötigen beide ihren Abschlussnachweis.',tone:'info',priority:26,moduleId:practice.id});
 if(!hints.length)add({id:'choose',title:choices.length?'Dein Semesterplan':'Möglicher nächster Schritt',text:choices.length?'Ein Blick auf Termine, persönliche Gruppen und erforderliche Anmeldungen könnte bei der weiteren Planung helfen.':'Du könntest mit den verfügbaren Modulen aus deinem Studienplan beginnen und einen für dich passenden Semesterumfang zusammenstellen.',tone:'info',priority:50});
 return hints.sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
}
