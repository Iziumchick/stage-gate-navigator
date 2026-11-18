import type { DashboardModule, ExamAttempt } from './api';
import { currentSemester } from './semesterClock';

export interface RetakePlan {
 exam:ExamAttempt; key:string; sourceTerm?:string; targetTerm?:string;
 state:'unknown'|'later'|'due'|'review'; automatic:boolean; noCourse:boolean;
 deferralApproved:boolean;
}
export const termNumber=(term:string)=>Number(term.slice(5,9))*2+Number(term.startsWith('WiSe'));
function shiftedTerm(term:string,offset:number) {
 const n=termNumber(term)+offset,y=Math.floor(n/2);
 return n%2?`WiSe ${y}/${String((y+1)%100).padStart(2,'0')}`:`SoSe ${y}`;
}
export function resultSemester(value:string|null) {
 const de=value?.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s|$)/);
 const iso=de?`${de[3]}-${de[2]}-${de[1]}`:value?.match(/^\d{4}-\d{2}-\d{2}(?=T|\s|$)/)?.[0];
 if(!iso)return undefined;
 const d=new Date(`${iso}T12:00:00Z`);
 if(isNaN(d.getTime())||d.toISOString().slice(0,10)!==iso)return undefined;
 return currentSemester(d);
}
export function openRepeats(m:DashboardModule) {
 if(m.status==='passed'||m.planning)return [];
 const byCode=new Map<string,ExamAttempt>();
 for(const r of m.exam_history||[])if(!byCode.has(r.code)||byCode.get(r.code)!.attempt<r.attempt)byCode.set(r.code,r);
 return [...byCode.values()].filter(r=>r.status==='NB');
}
export function readDeferral(key:string) {
 try{return JSON.parse(localStorage.getItem(key)||'null')?.approved===true;}catch{return false;}
}
export function calculateRetake(exam:ExamAttempt,term:string) {
 const sourceTerm=resultSemester(exam.released_on);
 if(exam.attempt<1||exam.attempt>2)return {sourceTerm,state:'review' as const,automatic:false};
 if(!sourceTerm)return {state:'unknown' as const,automatic:false};
 // Semester planning based on the PDF publication date, as requested. This is
 // not a personal legal deadline or a reconstruction of the examination date.
 const targetTerm=shiftedTerm(sourceTerm,exam.attempt===1?1:2);
 const automatic=termNumber(term)>=termNumber(targetTerm);
 return {sourceTerm,targetTerm,state:automatic?'due' as const:'later' as const,automatic};
}
export function moduleRetakes(m:DashboardModule,term:string,owner:string,edition:string):RetakePlan[] {
 return openRepeats(m).map(exam=>{
  const key=`stage-gate.retake-deferral:${owner}:${edition}:${m.id}:${exam.code}:${exam.attempt}:${term}`;
  return {exam,key,...calculateRetake(exam,term),noCourse:m.semester_offered===false,deferralApproved:readDeferral(key)};
 });
}
export const canRemoveRepeat=(plans:RetakePlan[])=>plans.filter(p=>p.automatic).every(p=>p.deferralApproved);
