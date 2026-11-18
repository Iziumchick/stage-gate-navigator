import {Check,Minus} from 'lucide-react';
import type {DashboardData} from './api';
import type {StudyProfile} from './FirstVisit';
import {HoverHint} from './HoverHint';
import {paceSignal,type Signal} from './progressMath';
export const signalClass:Record<Signal,string>={green:'bg-green-500',yellow:'bg-amber-400',red:'bg-red-500',neutral:'bg-gray-300'};
export function PaceSignal({data,profile}:{data:DashboardData;profile:StudyProfile}) {
 const status=paceSignal(data.official_credits,profile.startTerm,profile.referenceTerm);
 const n=(value:number)=>value.toLocaleString('de-DE',{maximumFractionDigits:1});
 const explanation=[status.label,status.average!==null?`${n(data.official_credits!)} ECTS ÷ ${status.completedSemesters} abgeschlossene Semester = ${n(status.average)} ECTS pro Semester.`:data.official_credits===null?'Importiere deine Leistungen, um dein bisheriges ECTS-Tempo zu sehen.':'Im ersten laufenden Semester wird noch kein Durchschnitt bewertet.', 'Grün: ab 24 ECTS pro Semester. Gelb: ab 18 bis unter 24. Rot: unter 18.', 'Abgeschlossene Kalendersemester seit Studienbeginn; das laufende Semester zählt noch nicht mit. Bereits verbuchte ECTS sind enthalten. Individuelle Pausen werden nicht gesondert berücksichtigt.'].join('\n\n');
 return <HoverHint text={explanation} align="right" placement="bottom"><span aria-label={`ECTS-Tempo: ${status.color}`} className={`block w-6 h-6 rounded-full ${signalClass[status.color]}`}/></HoverHint>;
}
export function MilestoneChecklist({data}:{data:DashboardData}) {
 if(!data.progress?.milestones?.length)return null;
 return <table className="w-full mt-4 text-xs text-left" aria-label="Studienfortschritt nach Etappen"><thead><tr className="text-gray-400"><th className="font-normal py-2">Etappe</th><th className="font-normal text-center">Freigegeben</th><th className="font-normal text-center">Erledigt</th></tr></thead><tbody>{data.progress.milestones.map(m=><tr key={m.id} className="border-t border-gray-100"><td className="py-2"><HoverHint text={m.reason}>{m.title}</HoverHint></td><td className="text-center"><span aria-label={`${m.title}: ${m.available?'freigeschaltet':'gesperrt'}`}>{m.available?<Check size={13} className="inline text-green-600"/>:<Minus size={13} className="inline text-gray-300"/>}</span></td><td className="text-center"><span aria-label={`${m.title}: ${m.completed?'abgeschlossen':'noch offen'}`}>{m.completed?<Check size={13} className="inline text-green-600"/>:<Minus size={13} className="inline text-gray-300"/>}</span></td></tr>)}</tbody></table>;
}
