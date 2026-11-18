import {termNumber} from './retakes';
export type Signal='green'|'yellow'|'red'|'neutral';
export function paceSignal(credits:number|null,startTerm:string,currentTerm:string) {
 const completedSemesters=Math.max(0,termNumber(currentTerm)-termNumber(startTerm));
 const average=credits===null||completedSemesters===0?null:credits/completedSemesters;
 if(average===null)return {color:'neutral' as Signal,label:credits===null?'Noch kein Leistungsstand':'Noch kein abgeschlossenes Semester',average,completedSemesters};
 const color:Signal=average>=24?'green':average<18?'red':'yellow';
 return {color,label:color==='green'?'Zügiges ECTS-Tempo':color==='yellow'?'Mittleres ECTS-Tempo':'Niedriges ECTS-Tempo',average,completedSemesters};
}
// Nominal ECTS only: pass rates are a questionnaire proposal, not a load factor.
export function workloadSignal(entries:{ects:number|null}[]) {
 const unknown=entries.filter(e=>e.ects===null).length;
 const ects=entries.reduce((n,e)=>n+(e.ects||0),0);
 const color:Signal=!entries.length||unknown?'neutral':ects<16||ects>=40?'red':ects<24||ects>32?'yellow':'green';
 return {ects,unknown,color,label:color==='red'?(ects<16?'Sehr niedriger ECTS-Umfang':'Sehr hoher ECTS-Umfang'):color==='yellow'?(ects<24?'Niedriger ECTS-Umfang':'Erhöhter ECTS-Umfang'):color==='green'?'24 bis 32 ECTS geplant':'Umfang noch offen'};
}
