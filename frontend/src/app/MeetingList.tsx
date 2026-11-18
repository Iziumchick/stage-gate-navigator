import type {ReactNode} from 'react';
import { weekdays, type Meeting } from './CourseMeetingsEditor';

export function meetingVariants(meetings:Meeting[]){
  const unique = new Map<string, Meeting>();
  for (const meeting of meetings) {
    const key = JSON.stringify([meeting.weekday, meeting.start, meeting.end, meeting.room,
      [...(meeting.teachers || [])].sort(), meeting.source_group, meeting.source_code,
      meeting.source_color, meeting.recurrence, meeting.room_candidates,...(meeting.dates?.length?[meeting.dates]:[])]);
    const existing = unique.get(key);
    unique.set(key, existing ? { ...existing, group: [...new Set([existing.group, meeting.group].filter(Boolean).flatMap(g => g.split(' / ')))].join(' / '),component_titles:[...new Set([...(existing.component_titles||[]),...(meeting.component_titles||[])])] } : { ...meeting });
  }
  const sorted = [...unique.values()].sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start) || a.group.localeCompare(b.group));
  const groups = new Map<string, Meeting[]>();
  for (const meeting of sorted) {
    const key = meeting.source_color || meeting.source_group || meeting.teachers?.length ? JSON.stringify([
      meeting.source_color, meeting.source_group, [...(meeting.teachers || [])].sort(),
      meeting.room, meeting.room_candidates, meeting.source_group?null:[meeting.weekday,meeting.start,meeting.end],
    ]) : '';
    groups.set(key, [...(groups.get(key) || []), meeting]);
  }
  return [...groups.entries()].sort((a,b)=>a[1][0].source_group&&b[1][0].source_group?a[1][0].source_group.localeCompare(b[1][0].source_group,undefined,{numeric:true}):0).map(([key,items],i)=>({id:JSON.stringify([key,items.map(m=>[m.weekday,m.start,m.end])]),label:`Variante ${i+1}`,meetings:items,grouped:!!key}));
}
/** Without an explicit source group, distinct time slots are separate variants. */
export function MeetingList({ meetings = [], fallback, room, compact = false, variantAction, sourceNotes=true }: { sourceNotes?:boolean; meetings?: Meeting[]; fallback?: string; room?: string; compact?: boolean; variantAction?:(variant:ReturnType<typeof meetingVariants>[number])=>ReactNode }) {
  const variants=meetingVariants(meetings),sorted=variants.flatMap(v=>v.meetings);
  if(!sorted.length)return <span className="block text-sm text-gray-500">{fallback || 'Noch keine bestätigten Termine.'}{fallback&&room?` · Raum: ${room}`:''}</span>;
  if(compact)return <span className="block text-xs text-gray-600">{sorted.length} Quelltermine · Stundenplan und Gruppen in den Details</span>;
  const render = (items: Meeting[]) => items.map((m, i) => <span key={i} className="block text-sm border rounded-lg p-3">
    {m.component_titles?.length?<span className="block text-xs text-blue-900 mb-2">{m.shared_with?.length?'Gemeinsames Modul-Raster · ':'Teilmodul · '}{m.component_titles.join(' / ')}</span>:null}<span className="block">{m.dates?.length?m.dates.map(day=>new Date(`${day}T12:00:00Z`).toLocaleDateString('de-DE',{timeZone:'Europe/Berlin'})).join(', '):weekdays[m.weekday - 1]} {m.start}–{m.end} · {m.room_assignment === 'unresolved' ? 'Raum noch nicht zugeordnet' : m.room || 'Raum nicht angegeben'}</span>
    <span className="block text-gray-500 mt-1">{[m.group, m.source_group?`BOSS-Gruppe ${m.source_group.replace(/[\[\]]/g, '')}`:'', m.teachers?.join(', ')].filter(Boolean).join(' · ')}</span>
    {m.room_assignment === 'unresolved' && <span className="block text-xs text-amber-800 mt-1">BOSS nennt gemeinsam: {m.room_candidates?.join(' / ')}. Raumzuordnung für diese Gruppe offen.</span>}
    {sourceNotes&&m.recurrence === 'unconfirmed' && <span className="block text-xs text-amber-800 mt-1">{m.recurrence_note||'Rhythmus nicht bestätigt. Das bedeutet nicht automatisch einen Wechsel gerader/ungerader Wochen.'}</span>}
  </span>);
  const shared = sorted.some(m => m.shared_with?.length);
  return <span className="block space-y-3">
    {shared&&sourceNotes && <span className="block text-xs bg-blue-50 rounded-lg p-3">BOSS führt diese Termine gemeinsam unter {[...new Set(sorted.filter(m => m.shared_with?.length).map(m => m.source_code))].join(', ')}. Die Zuordnung einzelner Termine zu den Pflichtteilen ist nicht angegeben.</span>}
    {sourceNotes&&variants.length > 1 && <span className="block text-xs text-gray-500">Getrennte Terminvarianten · keine Zuordnung als Vorlesung oder Übung.</span>}
    {variants.map(({id,label,meetings:items,grouped})=>grouped?<details key={id} className="border rounded-lg p-3" data-testid="meeting-variant">
      <summary className="cursor-pointer text-sm">{label} · {items[0].teachers?.join(', ') || 'Lehrende nicht angegeben'}{items[0].room?` · ${items[0].room}`:''} · {items.length} {items.length===1?'Termin':'Termine'}</summary>
      <span className="block space-y-2 mt-3">{render(items)}{variantAction?.({id,label,meetings:items,grouped})}</span>
    </details>:<span key={id} className="block space-y-2">{render(items)}{variantAction?.({id,label,meetings:items,grouped})}</span>)}
  </span>;
}
