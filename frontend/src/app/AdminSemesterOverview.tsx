import { CalendarDays, LogOut, Plus } from 'lucide-react';
import type { Semester } from './CatalogEditor';

export type SemesterProgram = { id: string; name: string; semesters: Record<string, Semester> };
export const compareSemesters = (a: string, b: string) => a.slice(5, 9).localeCompare(b.slice(5, 9)) || Number(a.startsWith('WiSe')) - Number(b.startsWith('WiSe'));

export function AdminSemesterOverview({ programs, loading, message, onCreate, onEdit, onLogout }: {
  programs: SemesterProgram[];
  loading: boolean;
  message: string;
  onCreate: (programId: string) => void;
  onEdit: (programId: string, term: string) => void;
  onLogout: () => void;
}) {
  return <main className="min-w-[1100px] min-h-screen bg-gray-50">
    <header className="bg-white border-b px-10 py-5 flex items-center justify-between">
      <div><h1 className="text-2xl">Semesterübersicht</h1><p className="text-sm text-gray-500 mt-1">Studiengänge und vorbereitete Semester</p></div>
      <button className="action-button" onClick={onLogout}><LogOut size={16}/>Abmelden</button>
    </header>
    <div className="max-w-[1350px] mx-auto p-8 space-y-6">
      {loading && <p role="status">Semester werden geladen …</p>}
      {programs.map(program => {
        const terms = Object.keys(program.semesters).sort(compareSemesters);
        return <section key={program.id} aria-label={program.name} className="bg-white border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-4 p-6 border-b">
            <h2 className="text-xl">{program.name}</h2>
            <button className="primary-button" aria-label={`Semester für ${program.name} erstellen`} onClick={() => onCreate(program.id)}><Plus size={17}/>Semester erstellen</button>
          </div>
          {terms.length ? <table className="w-full text-sm text-left">
            <thead className="bg-gray-50"><tr><th scope="col" className="px-6 py-3 font-medium">Semester</th><th scope="col" className="px-6 py-3 font-medium">Status</th><th scope="col" className="px-6 py-3 font-medium"><span className="sr-only">Aktion</span></th></tr></thead>
            <tbody>{terms.map(term => <tr key={term} className="border-t">
              <th scope="row" className="px-6 py-5 font-medium">{term}</th>
              <td className="px-6 py-5"><span className={`inline-flex rounded-full px-3 py-1 text-xs ${program.semesters[term].status === 'published' ? 'bg-green-50 text-green-800' : 'bg-blue-50 text-blue-800'}`}>{program.semesters[term].status === 'published' ? 'Veröffentlicht' : 'Entwurf'}</span></td>
              <td className="px-6 py-5 text-right"><button className="action-button inline-flex" aria-label={`${term} bearbeiten`} onClick={() => onEdit(program.id,term)}>Bearbeiten</button></td>
            </tr>)}</tbody>
          </table> : <div className="p-12 text-center"><CalendarDays size={32} className="mx-auto mb-4 text-gray-400"/><p>Noch keine Semester angelegt.</p></div>}
        </section>;
      })}
      {message && <p role="status" className="text-sm text-gray-700">{message}</p>}
      {!loading && !programs.length && message && <button className="action-button" onClick={() => window.location.reload()}>Erneut versuchen</button>}
    </div>
  </main>;
}
