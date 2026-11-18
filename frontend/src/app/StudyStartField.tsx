// Regular initial enrollment; the server is authoritative for curriculum assignment.
import { currentSemester } from './semesterClock';
const latest = currentSemester();
const latestNumber = Number(latest.match(/\d{4}/)?.[0]) * 2 + Number(latest.startsWith('WiSe'));
export const studyStarts = Array.from({ length: latestNumber - (2012 * 2 + 1) + 1 }, (_, i) => {
  const number = latestNumber - i; const year = Math.floor(number / 2);
  return number % 2 ? `WiSe ${year}/${String((year + 1) % 100).padStart(2, '0')}` : `SoSe ${year}`;
});
export const validStudyStart = (value: string) => studyStarts.includes(value);
export function StudyStartField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm">Studienbeginn an der OTH in diesem Studiengang<select aria-label="Studienbeginn" className="form-input mt-2" required value={validStudyStart(value) ? value : ''} onChange={e => onChange(e.target.value)}><option value="">Bitte auswählen</option>{studyStarts.map(term => <option key={term}>{term}</option>)}</select><span className="block text-xs text-gray-500 mt-2">Die Studienordnung wird anhand deines Studienbeginns zugeordnet. Bei Hochschul- oder PO-Wechsel muss die Zuordnung gesondert geprüft werden.</span></label>;
}
