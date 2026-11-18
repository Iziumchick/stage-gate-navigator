import { useState } from 'react';
import type { RetakePlan } from './retakes';
export function RetakeDetails({plans,onSaved}:{plans:RetakePlan[];onSaved:()=>void}) {
 return <section className="mt-4 space-y-3" aria-label="Wiederholungsplanung">{plans.map(p=><RetakeEntry key={p.key} plan={p} onSaved={onSaved}/>)}</section>;
}
function RetakeEntry({plan:p,onSaved}:{plan:RetakePlan;onSaved:()=>void}) {
 const [error,setError]=useState(''),[revoked,setRevoked]=useState(false);
 return <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm">
  <p className="font-medium">{p.state==='review'?'Weitere Wiederholung klären':p.automatic?'Pflichtwiederholung im aktuellen Semester':p.state==='later'?`Wiederholung für ${p.targetTerm} vormerken`:'Semester der Wiederholung prüfen'}</p>
  <details className="mt-2"><summary className="cursor-pointer">{p.automatic?'Verschiebung & Entfernen aus dem Semester':'Informationen zur Wiederholung'}</summary>
   <div className="mt-3 space-y-3">
    <p>{p.exam.title} · letzter Versuch: {p.exam.attempt} · Nicht bestanden</p>
    {p.sourceTerm?<p>Ergebnis veröffentlicht im {p.sourceTerm}. {p.exam.attempt===1?'Für den Semesterplan wird die erste Wiederholung im folgenden Semester vorgesehen.':p.exam.attempt===2?'Die zweite Wiederholung wird im zweiten Semester nach dem Ergebnis vorgesehen.':''}</p>:<p>Das Veröffentlichungsdatum fehlt oder ist nicht lesbar. Der Semesterplan ordnet deshalb keine Pflichtwiederholung automatisch zu. Bitte den Status in HISinOne prüfen.</p>}
    {p.state==='review'?<p>Eine weitere zulässige Wiederholung wird hier nicht automatisch angenommen. Bitte mit dem Prüfungsamt klären.</p>:<>
     <p>Eine Verschiebung kommt erst nach bestätigtem Antrag in den Plan. {p.noCourse?'Für dieses Semester ist keine Lehrveranstaltung bestätigt. Prüfe, ob eine Verschiebung beantragt werden kann; das fehlende Lehrangebot allein ist keine Bestätigung.':'Wenn eine Verschiebung nötig ist, den Antrag und die Voraussetzungen mit der OTH klären.'}</p>
     {p.automatic&&<label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={p.deferralApproved} onChange={e=>{try{localStorage.setItem(p.key,JSON.stringify({approved:e.target.checked}));setError('');onSaved();setRevoked(!e.target.checked);}catch{setError('Bestätigung konnte nicht gespeichert werden.');}}}/>Ich habe die Bestätigung erhalten, dass ich diese Prüfung in diesem Semester nicht wiederholen muss.</label>}
     {p.automatic&&revoked&&!p.deferralApproved&&<p role="status" className="rounded bg-orange-100 p-3 text-orange-950">Befreiung aufgehoben. Die Pflichtwiederholung ist wieder im aktuellen Semester eingeplant.</p>}
     {p.automatic&&<p className="text-xs text-gray-600">{p.deferralApproved?'Bestätigung hinterlegt. Du kannst die Karte jetzt aus dem aktuellen Semester entfernen.':'Ohne diese Bestätigung bleibt die automatisch eingeplante Karte im aktuellen Semester.'}</p>}
    </>}
    <p className="text-xs text-gray-500">Persönliche Semesterplanung. Anmeldung und individuelle Entscheidungen erfolgen bei der OTH.</p>
    {error&&<p role="alert" className="text-red-800">{error}</p>}
   </div>
  </details>
 </div>;
}
