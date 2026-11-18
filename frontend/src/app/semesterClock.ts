export function currentSemester(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone:'Europe/Berlin',year:'numeric',month:'numeric',day:'numeric' }).formatToParts(date);
  const part = (type:string) => Number(parts.find(p => p.type===type)?.value);
  const year=part('year'), month=part('month'), day=part('day');
  if (month>=10) return `WiSe ${year}/${String((year+1)%100).padStart(2,'0')}`;
  if (month<3 || month===3 && day<15) return `WiSe ${year-1}/${String(year%100).padStart(2,'0')}`;
  return `SoSe ${year}`;
}
