import {test,expect} from '@playwright/test';
import {buildCalendar,berlinUtc} from '../src/app/calendarExport';
const meeting={weekday:1,start:'08:15',end:'09:45',room:'K001',group:'IW4',recurrence:'weekly' as const};
const base={scope:'student:SE',title:'SE',description:'Software Engineering',variants:[{id:'one',label:'Variante 1',meetings:[meeting]}],from:'2027-03-22',to:'2027-04-05'};
test('Berlin time remains the same across daylight saving while calendar UTC timestamps change',async()=>{
 expect(berlinUtc('2027-03-22','08:15')).toBe('20270322T071500Z');
 expect(berlinUtc('2027-03-29','08:15')).toBe('20270329T061500Z');
 const file=await buildCalendar(base);expect(file.count).toBe(3);expect(file.text).toContain('SUMMARY:SE\r\n');
 expect(file.text).toContain('DTSTART:20270322T071500Z');expect(file.text).toContain('DTSTART:20270329T061500Z');
});
test('lecture-free spans are inclusive and identical shared appointments are not exported twice',async()=>{
 const file=await buildCalendar({...base,breaks:[{label:'Pause',start:'2027-03-29',end:'2027-04-05'}],variants:[...base.variants,{...base.variants[0],id:'duplicate'}]});
 expect(file.count).toBe(1);expect(file.text).not.toContain('DTSTART:20270329');
 const repeated=await buildCalendar({...base,now:new Date('2030-01-01')});
 const original=await buildCalendar(base);
 expect(repeated.text.match(/^UID:.*$/gm)).toEqual(original.text.match(/^UID:.*$/gm));
});
test('one-time appointments stay single and text cannot inject calendar properties',async()=>{
 const file=await buildCalendar({...base,title:'SE\r\nATTENDEE:evil',variants:[{...base.variants[0],date:'2027-03-23'}]});
 expect(file.count).toBe(1);expect(file.text).toContain('SUMMARY:SE\\nATTENDEE:evil');
 expect(file.text).not.toContain('\r\nATTENDEE:');
 const unicode=await buildCalendar({...base,description:'Ü'.repeat(200)});
 expect(unicode.text.split('\r\n').every(line=>new TextEncoder().encode(line).length<=75)).toBe(true);
});
test('invalid ranges, missing selections and reverse time are rejected',async()=>{
 await expect(buildCalendar({...base,from:'2027-02-30'})).rejects.toThrow();
 await expect(buildCalendar({...base,variants:[]})).rejects.toThrow();
 await expect(buildCalendar({...base,variants:[{...base.variants[0],meetings:[{...meeting,end:'08:00'}]}]})).rejects.toThrow();
});

test('nonexistent spring wall-clock times are rejected and explicitly dated appointments can occur during a break',async()=>{
 expect(()=>berlinUtc('2027-03-28','02:30')).toThrow('Zeitumstellung');
 const result=await buildCalendar({...base,breaks:[{label:'Pause',start:'2027-03-22',end:'2027-04-05'}],variants:[{...base.variants[0],date:'2027-03-29'}]});
 expect(result.count).toBe(1);
});


test('14-day variants use an explicit first week rather than guessing even or odd weeks',async()=>{
 const result=await buildCalendar({...base,from:'2027-03-22',to:'2027-04-19',variants:[{...base.variants[0],interval:2,anchor:'2027-03-22'}]});
 expect(result.count).toBe(3);expect(result.text).toContain('DTSTART:20270322');expect(result.text).toContain('DTSTART:20270405');expect(result.text).not.toContain('DTSTART:20270329');
 await expect(buildCalendar({...base,variants:[{...base.variants[0],interval:2,anchor:'2027-03-23'}]})).rejects.toThrow('Montag');
});


test('source dates take precedence over a weekly grid and retain a specifically dated lecture-free appointment',async()=>{
 const file=await buildCalendar({...base,from:'2026-10-01',to:'2026-10-31',breaks:[{label:'Pause',start:'2026-10-01',end:'2026-10-01'}],variants:[{...base.variants[0],meetings:[{...meeting,weekday:4,dates:['2026-10-01']}]}]});
 expect(file.count).toBe(1);expect(file.text).toContain('DTSTART:20261001T061500Z');expect(file.text).not.toContain('DTSTART:20261008');
});
