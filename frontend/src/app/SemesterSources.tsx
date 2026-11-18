import { useState } from 'react';
import { request } from './api';
import type { Course, Semester } from './CatalogEditor';
import type { SemesterCalendar } from './SemesterCalendarEditor';

export type SourceKind = 'dates' | 'schedule' | 'core_handbook' | 'fwpm_handbook';
export type ImportReport = { status: 'ready' | 'partial' | 'unavailable' | 'error'; fetched_at: string; source_urls: string[]; found: number; missing: string[]; warnings: string[]; unmatched: string[] };
export type SourcePreview = { term?: string; report: ImportReport; calendar?: SemesterCalendar | null; modules?: Record<string, Partial<Course>>; url?: string; edition_id?: string | null; label?: string };
const labels: Record<SourceKind, string> = { dates: 'Semestertermine', schedule: 'Stundenplan & Lehrende', core_handbook: 'Modulhandbuch · Pflichtprogramm', fwpm_handbook: 'Modulhandbuch · FWPM' };
const states = { ready: 'Gefunden', partial: 'Teilweise gefunden', unavailable: 'Noch nicht verfügbar / nicht erkannt', error: 'Abruf fehlgeschlagen' };

export function SemesterSources({ term, semester, moduleLabels, busy, onBusy, onApply }: { term: string; semester: Semester; moduleLabels: Record<string, string>; busy: boolean; onBusy: (value: boolean) => void; onApply: (kind: SourceKind, result: SourcePreview) => void }) {
  const [previews, setPreviews] = useState<Partial<Record<SourceKind, SourcePreview>>>({});
  const [applied, setApplied] = useState<SourceKind[]>([]);
  const [running, setRunning] = useState<SourceKind | null>(null);
  async function load(kind: SourceKind, file?: File) {
    onBusy(true); setRunning(kind); setApplied(value => value.filter(item => item !== kind));
    try {
      let result: SourcePreview;
      if (file) {
        const body = new FormData(); body.append('file', file);
        result = await request<SourcePreview>(`/admin/programs/wi/handbook?kind=${kind === 'core_handbook' ? 'core' : 'fwpm'}`, { method: 'POST', body });
      } else result = await request<SourcePreview>(`/admin/programs/wi/import/${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ term }) });
      if (result.term && result.term !== term) throw new Error('Die Quelle gehört zu einem anderen Semester.');
      setPreviews(value => ({ ...value, [kind]: result }));
    } catch (error) {
      setPreviews(value => ({ ...value, [kind]: { report: { status: 'error', fetched_at: new Date().toISOString(), source_urls: [], found: 0, missing: [], unmatched: [], warnings: [error instanceof Error ? error.message : 'Import fehlgeschlagen.'] } } }));
    } finally { onBusy(false); setRunning(null); }
  }
  return <section className="bg-white border rounded-xl p-6 mb-6" aria-label="Semesterquellen"><h2 className="text-lg">Quellen für {term}</h2><p className="text-sm text-gray-500 mt-1">Abrufen → Ergebnis prüfen → in den Entwurf übernehmen → veröffentlichen. Fehlende Quellen ändern keine vorhandenen Kursdaten.</p><div className="grid grid-cols-2 gap-4 mt-5">{(Object.keys(labels) as SourceKind[]).map(kind => {
    const preview = previews[kind]; const info = preview?.report || semester.imports?.[kind];
    const handbook = kind === 'core_handbook' ? semester.handbook : kind === 'fwpm_handbook' ? semester.fwpm_handbook : undefined;
    return <section key={kind} className="rounded-lg border p-4" aria-label={labels[kind]}><h3 className="text-sm font-medium">{labels[kind]}</h3><p className="text-xs text-gray-500 mt-2">{kind === 'dates' ? 'Offizieller OTH-Terminplan (ICS): Lehrveranstaltungen, Prüfungen, vorlesungsfreie Zeiten.' : kind === 'schedule' ? 'B.O.S.S. IW: Zeiten, Räume, Gruppen und Namen aus dem Lehrendenverzeichnis.' : 'Ein PDF für diesen Bereich und dieses Semester. Nur PDF ersetzen; Disziplinen, Zuordnungen und Regeln bleiben unverändert. Seiten danach prüfen.'}</p>
      <div className="mt-4">{kind === 'dates' || kind === 'schedule' ? <button className="action-button" disabled={busy} onClick={() => void load(kind)}>{running === kind ? 'Wird abgerufen …' : kind === 'dates' ? 'OTH-Termine abrufen' : 'B.O.S.S.-Stundenplan abrufen'}</button> : <label className="block text-xs">{handbook?.url ? 'PDF bei Bedarf ersetzen' : 'PDF hochladen'}<input aria-label={kind === 'core_handbook' ? 'Pflichtprogramm-PDF' : 'FWPM-PDF'} className="block text-sm mt-2" type="file" disabled={busy} accept="application/pdf,.pdf" onChange={e => { const file = e.target.files?.[0]; if (file) void load(kind, file); e.target.value = ''; }} /></label>}</div>
      {kind === 'core_handbook' && Object.entries(semester.core_handbooks || {}).map(([edition, book]) => <p key={edition} className="text-xs mt-3">SPO {edition.slice(-4)}: <a className="text-blue-700 underline" href={book.url || undefined} target="_blank" rel="noreferrer">{book.label}</a></p>)}{handbook?.url && <a className="inline-block text-xs text-blue-600 underline mt-3" href={handbook.url} target="_blank" rel="noreferrer">Hinterlegtes PDF öffnen</a>}
      {info ? <div className="mt-4 text-xs"><p className={`font-medium ${info.status === 'ready' ? 'text-green-700' : info.status === 'error' ? 'text-red-700' : 'text-amber-800'}`}>{states[info.status]} · {info.found} {kind === 'dates' ? 'Zeiträume' : kind === 'schedule' ? 'Disziplinen' : 'PDF'}</p><p className="text-gray-500 mt-1">Abruf: {new Date(info.fetched_at).toLocaleString('de-DE')}{preview && !applied.includes(kind) ? ' · Vorschau' : semester.status === 'published' ? ' · Veröffentlicht' : ' · Im Entwurf'}</p>
        {!!info.warnings.length && <ul className="list-disc pl-4 mt-2 space-y-1">{info.warnings.map((text, i) => <li key={i}>{text}</li>)}</ul>}
        {!!(info.missing.length || info.unmatched.length) && <details className="mt-3"><summary className="cursor-pointer">Nicht gefunden / nicht zugeordnet ({info.missing.length + info.unmatched.length})</summary>{!!info.missing.length && <p className="mt-2">Ohne Treffer: {info.missing.join(', ')}</p>}{!!info.unmatched.length && <p className="mt-2">Unbekannte Kürzel: {info.unmatched.join(', ')}</p>}</details>}
        {preview?.modules && Object.keys(preview.modules).length > 0 && <details className="mt-3"><summary className="cursor-pointer">Gefundene Zuordnungen anzeigen</summary><div className="max-h-56 overflow-auto mt-2 space-y-2">{Object.entries(preview.modules).map(([id, course]) => <div key={id}><p className="font-medium">{moduleLabels[id] || 'Modul noch nicht zugeordnet'}</p>{course.handbook_pages && <a className="text-blue-600 underline" href={`${preview.url}#page=${course.handbook_pages.start}`} target="_blank" rel="noreferrer">PDF-Seite {course.handbook_pages.start}</a>}{course.meetings?.map((m, i) => <p key={i}>{['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][m.weekday - 1]} {m.start}–{m.end} · {m.room} · {m.teachers?.join(', ')} · {m.group}{m.recurrence === 'unconfirmed' ? ' · Wiederholung prüfen' : ''}</p>)}</div>)}</div></details>}
        {info.source_urls.map(url => <a key={url} className="block text-blue-600 underline mt-2 break-all" href={url} target="_blank" rel="noreferrer">Quelle öffnen</a>)}
        {preview && !applied.includes(kind) && <button className="action-button mt-3" onClick={() => { if ((preview.report.found > 0 || preview.url) && !window.confirm(preview.url ? 'PDF ersetzen? Alte Seitenzuordnungen für dieses Modulhandbuch werden entfernt, damit sie nicht auf falsche Seiten im neuen PDF zeigen. ELO-Links bleiben erhalten.' : 'Gefundene Angaben in den Entwurf übernehmen? Bereits vorhandene Angaben derselben Quelle werden ersetzt. ELO-Links bleiben erhalten.')) return; onApply(kind, preview); setApplied(value => [...value, kind]); }}>{preview.report.found > 0 || preview.url ? 'Ergebnis in Entwurf übernehmen' : 'Nur Abrufstatus übernehmen'}</button>}
      </div> : <p className="text-xs text-gray-400 mt-4">{handbook?.url ? 'PDF hinterlegt · noch kein Importbericht' : 'Noch nicht abgerufen'}</p>}
    </section>;
  })}</div><p className="text-xs text-gray-500 mt-4">ELO-Links bleiben manuell. Nicht erkannte Seiten oder besondere Termine können unten ergänzt werden. Ein zukünftiges Semester ohne Quellen erhält keine Daten aus dem aktuellen Semester.</p></section>;
}
