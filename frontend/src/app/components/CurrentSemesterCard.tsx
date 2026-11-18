import { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import { ModuleDetails, readExtras } from '../ModuleDetails';
import { stages } from './StudyRoadmap';

const term = 'WiSe 2026/27';
const modules = stages.flatMap(stage => stage.modules);
const keyFor = (code: string) => `stage-gate.demo-module:${code}`;

export function CurrentSemesterCard() {
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<typeof modules[number] | null>(null);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener('stage-gate-plan-changed', refresh);
    return () => window.removeEventListener('stage-gate-plan-changed', refresh);
  }, []);
  const planned = modules.filter(module => module.status !== 'passed' && module.status !== 'locked' && readExtras(keyFor(module.shortCode)).plannedTerm === term);
  return <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
    <div className="h-1 bg-gray-300" />
    <div className="p-6"><h3 className="text-xl flex items-center gap-2 mb-6"><Calendar size={20} />Aktuelles Semester: {term}</h3>
      <p className="text-xs text-gray-500 mb-3">Beispieldaten · Persönliche Planung</p>
      {planned.length ? <div className="space-y-2">{planned.map(module => {
        return <button key={module.shortCode} type="button" aria-label={`Kursdetails: ${module.name}`} className="block w-full text-left border rounded-lg p-3 hover:bg-gray-50" onClick={() => setSelected(module)}><span className="text-sm font-medium">{module.name}</span><span className="block text-xs text-gray-500 mt-1">{module.ects} ECTS</span><span className="block text-xs text-gray-500 mt-1">Eingeplant</span></button>;
      })}</div> : <div className="rounded border border-dashed p-5 text-sm text-gray-600">Wähle ein offenes Modul im Überblick und klicke „Zum aktuellen Semester hinzufügen“.</div>}
    </div>
    {selected && <ModuleDetails open view="course" onClose={() => setSelected(null)} storageKey={keyFor(selected.shortCode)} title={selected.name} subtitle={`${selected.ects} ECTS · ${term}`} offeredIn={`${selected.semester} (Beispieldaten)`} term={term} admission={{ status: 'available', reason: 'Beispiel: Zulassungsbedingungen erfüllt.' }} passed={false}><p className="text-sm text-gray-500">Beispieldaten · Persönliche Semesterplanung</p></ModuleDetails>}
  </section>;
}
