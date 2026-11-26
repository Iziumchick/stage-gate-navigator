import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { Brand, type StudyProfile } from './FirstVisit';
import { LiveDashboard } from './LiveDashboard';
import { InfoPopover } from './InfoPopover';
import { ResearchFooter } from './Privacy';
import { request, type DashboardData } from './api';

const examples = [
  ['first', 'Studienstart · Abschnitt 1'],
  ['open', 'Abschnitt 2 · Praxis noch gesperrt'],
  ['practice', 'Praxis möglich · Abschnitt 3 gesperrt'],
  ['repeat-first', 'Pflichtwiederholung im aktuellen Semester'],
  ['thesis', 'Studienabschluss · Bachelorarbeit und Seminar'],
];

function initialScenario() {
  const value = new URLSearchParams(window.location.search).get('demo');
  return examples.some(([key]) => key === value) ? value! : 'first';
}

export function GuestDemo() {
  const [scenario, setScenario] = useState(initialScenario);
  const [data, setData] = useState<(DashboardData & {example_term: string}) | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError('');
    request<DashboardData & {example_term: string}>(`/demo/wi/examples/${scenario}`, {signal: controller.signal})
      .then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [scenario, revision]);
  useEffect(() => {
    const url = new URL(window.location.href); url.searchParams.set('demo', scenario);
    window.history.replaceState(null, '', url);
  }, [scenario]);
  function reset() {
    const owner = `guest-demo:${scenario}`;
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(`stage-gate.module:${owner}:`) || key.startsWith(`stage-gate.retake-deferral:${owner}:`)) localStorage.removeItem(key);
      }
      setRevision(value => value + 1);
    } catch { setError('Das Beispiel konnte nicht zurückgesetzt werden. Bitte die Browser-Einstellungen prüfen.'); }
  }
  const profile: StudyProfile | null = data ? {
    name: 'Demobeispiel', program: 'Wirtschaftsinformatik (B.Sc.)',
    startTerm: data.example_start_term!, referenceTerm: data.example_term,
  } : null;
  return <div className="min-h-screen min-w-[1280px] bg-gray-50">
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-[1920px] mx-auto px-8 py-5 flex items-center justify-between gap-8">
        <Brand/>
        <div className="min-w-0 flex-1 max-w-lg"><label htmlFor="demo-scenario" className="text-xs text-gray-500 block mb-1">Demonstration · Beispiel auswählen</label><select id="demo-scenario" className="form-input" value={scenario} onChange={event => setScenario(event.target.value)}>{examples.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
        <div className="flex gap-3"><button className="action-button" onClick={reset}><RotateCcw size={16}/>Beispiel zurücksetzen</button><a href="/" className="action-button"><ArrowLeft size={16}/>Zur Anmeldung</a></div>
      </div>
    </header>
    <section className="max-w-[1920px] mx-auto px-8 pt-5" aria-label="Demonstrationshinweis">
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 flex justify-between gap-8 items-center">
        <div><p className="font-medium text-blue-950">Demodaten · Keine persönlichen Leistungsdaten</p><p className="text-sm text-blue-900 mt-1">Ergebnisse, Stundenplan und Kursbeschreibungen sind fiktive Beispiele. Namen und Zuständigkeiten in den Beschreibungen sind Platzhalter, keine offiziellen Angaben. Deine Änderungen bleiben nur in diesem Browser und getrennt von einem persönlichen Konto.</p></div>
        <a href="/" className="action-button bg-white whitespace-nowrap">Eigene Leistungen ansehen<ArrowRight size={16}/></a>
      </div>
      {profile && <div className="text-sm text-gray-500 mt-4"><InfoPopover label="Studieninformationen" trigger={<>Beispielsemester {profile.referenceTerm} · Start {profile.startTerm}</>}><p>{data?.spo_version}</p><p className="mt-2">Die SPO gehört zum ausgewählten Beispiel. Ein persönliches Studienprofil wird nicht verändert.</p></InfoPopover></div>}
    </section>
    {error ? <div role="alert" className="px-8 py-6 text-red-700">{error}<button className="action-button ml-4" onClick={() => setRevision(value => value + 1)}>Erneut versuchen</button></div> : data ? <LiveDashboard key={`${scenario}:${revision}`} data={data} profile={profile} ownerKey={`guest-demo:${scenario}`}/> : <p role="status" className="p-8 text-gray-600">Beispiel wird geladen …</p>}
    <ResearchFooter/>
  </div>;
}
