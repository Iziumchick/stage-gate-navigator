import type {Meeting} from './CourseMeetingsEditor';
import type {DateSpan} from './SemesterCalendarEditor';
export type CalendarVariant={id:string;label:string;meetings:Meeting[];date?:string;interval?:1|2;anchor?:string};
export function validDay(value:string){const d=new Date(`${value}T12:00:00Z`);return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;}
export function validTime(value:string){return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);}
const dayAfter=(day:string,n:number)=>{const d=new Date(`${day}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const stamp=(d:Date)=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
/** Convert wall-clock lecture time using Berlin's offset on that particular date. */
export function berlinUtc(day:string,time:string){
 const naive=Date.parse(`${day}T${time}:00Z`);
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(naive));
 const get=(key:string)=>Number(parts.find(p=>p.type===key)?.value);
 const wall=Date.UTC(get('year'),get('month')-1,get('day'),get('hour'),get('minute'),get('second'));
 const utc=new Date(naive-(wall-naive));
 const check=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(utc);
 const part=(key:string)=>Number(check.find(p=>p.type===key)?.value);
 if(Date.UTC(part('year'),part('month')-1,part('day'),part('hour'),part('minute'))!==naive)throw new Error('Diese Uhrzeit existiert wegen der Zeitumstellung in Berlin nicht.');
 return stamp(utc);
}
const escapeText=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
function fold(line:string){let result='',current='',bytes=0;for(const c of line){const n=new TextEncoder().encode(c).length;if(bytes+n>75){result+=current+'\r\n';current=' ';bytes=1;}current+=c;bytes+=n;}return result+current;}
async function digest(s:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
export async function buildCalendar({scope,title,description,variants,from,to,breaks=[],now=new Date()}:{scope:string;title:string;description:string;variants:CalendarVariant[];from:string;to:string;breaks?:DateSpan[];now?:Date}){
 if(!validDay(from)||!validDay(to)||to<from||Date.parse(to)-Date.parse(from)>370*86400000)throw new Error('Bitte einen gültigen Zeitraum von höchstens einem Jahr angeben.');
 if(!title.trim()||!variants.length)throw new Error('Bitte einen Kalendertitel und mindestens eine Terminvariante auswählen.');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Study Navigator//Semesterplan//DE','CALSCALE:GREGORIAN'];
 const seen=new Set<string>();let count=0;
 for(const variant of variants){
 if(variant.interval===2&&(!validDay(variant.anchor||'')||new Date(`${variant.anchor}T12:00:00Z`).getUTCDay()!==1))throw new Error('Bitte den Montag der ersten Unterrichtswoche für den 14-täglichen Rhythmus angeben.');
 for(const m of variant.meetings){
  if(!Number.isInteger(m.weekday)||m.weekday<1||m.weekday>7||!validTime(m.start)||!validTime(m.end)||m.end<=m.start)throw new Error('Ein ausgewählter Termin enthält ungültige Zeiten.');
  if(m.dates?.some(day=>!validDay(day)))throw new Error('Ein ausgewählter Termin enthält ungültige Datumsangaben.');
  for(let day=from;day<=to;day=dayAfter(day,1)){
   if(variant.date?day!==variant.date:m.dates?.length?!m.dates.includes(day):(new Date(`${day}T12:00:00Z`).getUTCDay()||7)!==m.weekday)continue;
   if(!variant.date&&!m.dates?.length&&variant.interval===2&&(day<variant.anchor!||Math.floor((Date.parse(day)-Date.parse(variant.anchor!))/604800000)%2!==0))continue;
   if(!variant.date&&!m.dates?.length&&breaks.some(b=>validDay(b.start)&&validDay(b.end)&&day>=b.start&&day<=b.end))continue;
   const identity=JSON.stringify([scope,day,m.start,m.end,m.room,[...(m.teachers||[])].sort()]);
   if(seen.has(identity))continue;seen.add(identity);
   const uid=await digest(identity);
   lines.push('BEGIN:VEVENT',`UID:${uid}@study-navigator.local`,`DTSTAMP:${stamp(now)}`,`DTSTART:${berlinUtc(day,m.start)}`,`DTEND:${berlinUtc(day,m.end)}`,`SUMMARY:${escapeText(title.trim())}`,`DESCRIPTION:${escapeText([description,variant.label,m.group,m.teachers?.join(', ')].filter(Boolean).join('\n'))}`);
   if(m.room)lines.push(`LOCATION:${escapeText(m.room)}`);
   lines.push('END:VEVENT');count++;
  }
 }
 }
 if(!count)throw new Error('Im gewählten Zeitraum gibt es keine passenden Termine außerhalb der vorlesungsfreien Zeiten.');
 lines.push('END:VCALENDAR');
 return {text:lines.map(fold).join('\r\n')+'\r\n',count};
}
