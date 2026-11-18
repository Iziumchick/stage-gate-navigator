import type { ExamAttempt } from './api';
const result = (row:ExamAttempt) => row.status==='BE' ? 'Bestanden' : row.status==='NB' ? 'Nicht bestanden' : row.status;
export function AttemptHistory({ rows, passed }: { rows:ExamAttempt[]; passed:boolean }) {
 if (!rows.length) return null;
 return <section className="mt-5 border rounded-lg p-4" aria-label="Prüfungsversuche"><h3 className="font-medium">Prüfungsversuche aus HISinOne</h3>
  <p className="text-sm text-gray-600 mt-2">{passed ? 'Das Modul ist abgeschlossen. Frühere Fehlversuche bleiben in der Historie sichtbar.' : 'Angezeigt werden die im Export enthaltenen Ergebnisse. Termine und Prüfungsanmeldung bitte in HISinOne prüfen.'}</p>
  <div className="overflow-auto mt-3"><table className="w-full text-sm text-left"><thead><tr className="border-b text-gray-500"><th className="py-2 pr-3">Prüfung</th><th className="pr-3">Versuch</th><th className="pr-3">Note</th><th className="pr-3">Ergebnis</th><th>Freigabe am</th></tr></thead><tbody>{rows.map(row => <tr key={`${row.code}:${row.attempt}`} className="border-b last:border-0"><td className="py-3 pr-3">{row.title}<span className="block text-xs text-gray-500">{row.short_code} · {row.code}</span></td><td className="pr-3">{row.attempt}</td><td className="pr-3">{row.grade===null?'—':row.grade.toLocaleString('de-DE')}</td><td className={row.status==='NB'?'text-orange-800 pr-3':row.status==='BE'?'text-green-800 pr-3':'pr-3'}>{result(row)}</td><td>{row.released_on || '—'}</td></tr>)}</tbody></table></div>
 </section>;
}
