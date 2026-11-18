import {useRef,useState,type FormEvent} from 'react';
import {MeetingList,meetingVariants} from './MeetingList';
import {weekdays,type Meeting} from './CourseMeetingsEditor';
import type {SemesterCalendar} from './SemesterCalendarEditor';
import {buildCalendar,validDay,validTime,type CalendarVariant} from './calendarExport';
type Personal=CalendarVariant;
type Settings={personal:Personal[];selected:string[];from:string;to:string;title:string};
const blank={label:'',weekday:1,start:'08:15',end:'09:45',room:'',mode:'weekly',date:''};
function read(key:string,title:string,calendar?:SemesterCalendar):Settings{
 try{const s=JSON.parse(localStorage.getItem(key)||'{}');return {personal:Array.isArray(s.personal)?s.personal.slice(0,30).filter((v:Personal)=>typeof v.id==='string'&&typeof v.label==='string'&&(!v.date||validDay(v.date))&&Array.isArray(v.meetings)&&v.meetings.length>0&&v.meetings.length<=50&&v.meetings.every(m=>m.weekday>=1&&m.weekday<=7&&validTime(m.start)&&validTime(m.end)&&m.end>m.start&&typeof m.room==='string'&&typeof m.group==='string')):[],selected:Array.isArray(s.selected)?s.selected.filter((v:unknown)=>typeof v==='string'):[],from:validDay(s.from)?s.from:calendar?.lectures?.start||'',to:validDay(s.to)?s.to:calendar?.lectures?.end||'',title:typeof s.title==='string'?s.title.slice(0,60):title};}catch{return {personal:[],selected:[],from:calendar?.lectures?.start||'',to:calendar?.lectures?.end||'',title};}
}
export function PersonalMeetings({storageKey,meetings=[],calendar,shortTitle,title,calendarScope,fallback,room,onExported}:{storageKey:string;calendarScope?:string;meetings?:Meeting[];calendar?:SemesterCalendar;shortTitle:string;title:string;fallback?:string;room?:string;onExported?:()=>void}){
 const key=`${storageKey}:personal-meetings`;
 const [settings,setSettings]=useState(()=>read(key,shortTitle,calendar));
 const [draft,setDraft]=useState({...blank}),[editing,setEditing]=useState<string|null>(null),[showForm,setShowForm]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const exportPanel=useRef<HTMLDetailsElement>(null);
 const source=meetingVariants(meetings).map(v=>({id:`source:${v.id}`,label:v.label,meetings:v.meetings}));
 const variants=[...source,...settings.personal];
 function persist(next:Settings){try{localStorage.setItem(key,JSON.stringify(next));setSettings(next);setMessage('');return true;}catch{setMessage('Änderung konnte nicht gespeichert werden.');return false;}}
 function add(event:FormEvent){event.preventDefault();
  if(!validTime(draft.start)||!validTime(draft.end)||draft.end<=draft.start){setMessage('Das Ende muss nach dem Beginn liegen.');return;}
  if(draft.mode==='once'&&!validDay(draft.date)){setMessage('Bitte das Datum des Einzeltermins angeben.');return;}
  if(!editing&&settings.personal.length>=30){setMessage('Bis zu 30 eigene Varianten pro Kurs sind möglich.');return;}
  const id=editing||`personal:${crypto.randomUUID()}`;
  const item:Personal={id,label:draft.label.trim()||'Eigener Termin',meetings:[{weekday:draft.mode==='once'?(new Date(`${draft.date}T12:00:00Z`).getUTCDay()||7):draft.weekday,start:draft.start,end:draft.end,room:draft.room.trim(),group:'Persönlicher Termin',recurrence:'weekly'}],...(draft.mode==='once'?{date:draft.date}:{})};
  if(persist({...settings,personal:editing?settings.personal.map(v=>v.id===editing?item:v):[...settings.personal,item]})){setShowForm(false);setEditing(null);setDraft({...blank});setMessage('Persönliche Terminvariante gespeichert.');}
 }
 async function download(){setBusy(true);setMessage('');try{
  if(!validDay(settings.from)||!validDay(settings.to)||settings.from>settings.to||!settings.title.trim()){
   if(exportPanel.current)exportPanel.current.open=true;
   throw new Error('Bitte Titel und Zeitraum für den Kalender ergänzen.');
  }
  const chosen=variants.filter(v=>settings.selected.includes(v.id));
  const selected=chosen;
  const result=await buildCalendar({scope:calendarScope||storageKey,title:settings.title,description:title,variants:selected,from:settings.from,to:settings.to,breaks:calendar?.breaks});
  const url=URL.createObjectURL(new Blob([result.text],{type:'text/calendar;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=`${settings.title.replace(/[^\p{L}\p{N}_-]/gu,'_')||'Termine'}.ics`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  onExported?.();
  setMessage(`${result.count} Termine als .ics heruntergeladen. Öffne die Datei oder importiere sie in Outlook. Noch keine direkte Übertragung an dein Konto.`);
 }catch(e){setMessage(e instanceof Error?e.message:'Kalender konnte nicht erstellt werden.');}finally{setBusy(false);}}
 const exportButton=(variant:Personal)=>{
  const selected=settings.selected.includes(variant.id);
  return <button type="button" className={`action-button mt-2 text-sm ${selected?'border-blue-300 bg-blue-50 text-blue-800':''}`} aria-label={`${variant.label}: ${selected?'Aus Kalender entfernen':'Zum Kalender hinzufügen'}`} aria-pressed={selected} onClick={()=>persist({...settings,selected:selected?settings.selected.filter(id=>id!==variant.id):[...settings.selected,variant.id]})}>{selected?'Im Kalenderplan · Entfernen':'Zum Kalender hinzufügen'}</button>;
 };
 return <><MeetingList sourceNotes={false} meetings={meetings} fallback={fallback} room={room} variantAction={v=>exportButton({...v,id:`source:${v.id}`})}/><section className="mt-5 border-t pt-5 text-sm" aria-label="Persönliche Terminvarianten">
  <div className="flex justify-between items-center gap-3"><h3 className="font-medium">Meine Terminvarianten</h3><button type="button" className="action-button" onClick={()=>{setEditing(null);setDraft({...blank});setShowForm(v=>!v);}}>Eigene Variante hinzufügen</button></div>
  {!!settings.personal.length&&<div className="mt-3 space-y-3">{settings.personal.map(v=><div key={v.id} className="rounded-lg border border-blue-200 bg-blue-50/30 p-3"><p className="font-medium">{v.label}{v.date?` · ${v.date}`:''}</p><MeetingList meetings={v.meetings}/>{exportButton(v)}<div className="flex gap-4 mt-2"><button type="button" className="text-blue-700" onClick={()=>{const m=v.meetings[0];setEditing(v.id);setDraft({label:v.label,weekday:m.weekday,start:m.start,end:m.end,room:m.room,mode:v.date?'once':'weekly',date:v.date||''});setShowForm(true);}}>Bearbeiten</button><button type="button" className="text-gray-500" onClick={()=>persist({...settings,personal:settings.personal.filter(p=>p.id!==v.id),selected:settings.selected.filter(id=>id!==v.id)})}>Entfernen</button></div></div>)}</div>}
  {showForm&&<form onSubmit={add} className="mt-3 rounded-lg border p-4 space-y-3" aria-label="Eigene Terminvariante bearbeiten">
   <label className="block">Bezeichnung<input className="form-input mt-1" maxLength={120} value={draft.label} onChange={e=>setDraft({...draft,label:e.target.value})} placeholder="z. B. AW-Kurs oder meine Übungsgruppe"/></label>
   <div className="grid grid-cols-2 gap-3"><label>Wiederholung<select aria-label="Wiederholung" className="form-input mt-1" value={draft.mode} onChange={e=>setDraft({...draft,mode:e.target.value})}><option value="weekly">Wöchentlich</option><option value="once">Einzeltermin</option></select></label>{draft.mode==='once'?<label>Datum<input className="form-input mt-1" type="date" required value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})}/></label>:<label>Wochentag<select aria-label="Wochentag" className="form-input mt-1" value={draft.weekday} onChange={e=>setDraft({...draft,weekday:Number(e.target.value)})}>{weekdays.map((d,i)=><option key={d} value={i+1}>{d}</option>)}</select></label>}</div>
   <div className="grid grid-cols-2 gap-3"><label>Beginn<input className="form-input mt-1" type="time" required value={draft.start} onChange={e=>setDraft({...draft,start:e.target.value})}/></label><label>Ende<input className="form-input mt-1" type="time" required value={draft.end} onChange={e=>setDraft({...draft,end:e.target.value})}/></label></div>
   <label className="block">Raum / Online-Ort<input className="form-input mt-1" maxLength={200} value={draft.room} onChange={e=>setDraft({...draft,room:e.target.value})}/></label>
   <div className="flex gap-3"><button type="submit" className="primary-button">Terminvariante speichern</button><button type="button" className="action-button" onClick={()=>setShowForm(false)}>Abbrechen</button></div>
  </form>}
  <section className="mt-4 border-t pt-4 space-y-3" aria-label="Kalenderexport">
   <div className="flex items-center justify-between gap-3"><p className="text-gray-600">{variants.filter(v=>settings.selected.includes(v.id)).length} {variants.filter(v=>settings.selected.includes(v.id)).length===1?'Variante':'Varianten'} im Kalenderplan</p><button type="button" className="primary-button" disabled={busy||!variants.some(v=>settings.selected.includes(v.id))} onClick={()=>void download()}>{busy?'Kalender wird erstellt …':'Für Outlook herunterladen (.ics)'}</button></div>
   <details ref={exportPanel} aria-label="Kalendereinstellungen"><summary className="cursor-pointer text-gray-500">Zeitraum & Kalendertitel</summary><div className="space-y-4 mt-3">
    <label className="block">Titel im Kalender<input className="form-input mt-1" maxLength={60} value={settings.title} onChange={e=>persist({...settings,title:e.target.value})}/></label>
    <div className="grid grid-cols-2 gap-3"><label>Zeitraum von<input className="form-input mt-1" type="date" value={settings.from} onChange={e=>persist({...settings,from:e.target.value})}/></label><label>Zeitraum bis<input className="form-input mt-1" type="date" min={settings.from} value={settings.to} onChange={e=>persist({...settings,to:e.target.value})}/></label></div>

   </div></details>
  </section>
  {message&&<p role="status" className="mt-3 text-sm text-blue-900">{message}</p>}
 </section></>;
}
