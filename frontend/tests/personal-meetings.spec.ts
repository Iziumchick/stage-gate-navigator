import {test,expect} from './fixtures';
import {readFileSync} from 'node:fs';
const meeting={weekday:2,start:'10:00',end:'11:30',room:'K001',group:'IW4',teachers:['Professor'],recurrence:'weekly',source_color:'#ffffff'};
const module={id:'wi.req.software_engineering',title:'Software Engineering',short_title:'SE',required_ects:8,actual_ects:null,grade:null,status:'unknown',source:null,semester_offered:true,admission:{status:'available',reason:'OK'},course:{meetings:[meeting]}};
const data=(m:any)=>({import_id:null,program:'WI',supported:true,official_credits:60,official_grade:2.7,curriculum_edition:'wi_bsc_2023',example_scenario:'open',unmatched_groups:[],semester_calendar:{lectures:{label:'Vorlesungszeit',start:'2026-10-01',end:'2026-10-15'},breaks:[{label:'Pause',start:'2026-10-06',end:'2026-10-06'}]},stages:[{id:'abschnitt_2',title:'Abschnitt 2',modules:[m]}]});
async function open(page:any,m=module){
 await page.route('**/api/imports',(r:any)=>r.fulfill({json:[]}));
 await page.route('**/api/programs/wi/examples/*',(r:any)=>r.fulfill({json:data(m)}));
 await page.goto('/?example=open');
 await page.getByRole('button',{name:`${m.title}: Offen`,exact:true}).click();
 await page.getByRole('button',{name:'Zum aktuellen Semester hinzufügen',exact:true}).click();
 await page.getByRole('button',{name:'Details schließen'}).click();
 await page.getByLabel('Module in aktuelles Semester ziehen').getByRole('button',{name:/^Software Engineering 8 ECTS/}).click();
}

test('personal variants persist separately; selected appointments download with short title and can be edited',async({page},info)=>{
 await open(page);
 const dialog=page.getByRole('dialog');
 await dialog.getByRole('button',{name:'Eigene Variante hinzufügen'}).click();
 const form=dialog.getByRole('form',{name:'Eigene Terminvariante bearbeiten'});
 await form.getByLabel('Bezeichnung',{exact:true}).fill('Meine Übungsgruppe');
 await form.getByLabel('Wochentag',{exact:true}).selectOption('4');
 await form.getByLabel('Beginn',{exact:true}).fill('14:00');await form.getByLabel('Ende',{exact:true}).fill('15:30');
 await form.getByLabel('Raum / Online-Ort',{exact:true}).fill('K002');
 await form.getByRole('button',{name:'Terminvariante speichern'}).click();
 await dialog.getByRole('button',{name:'Meine Übungsgruppe: Zum Kalender hinzufügen',exact:true}).click();
 await dialog.getByRole('group',{name:'Kalendereinstellungen'}).locator('summary').click();
 await expect(dialog.getByLabel('Titel im Kalender',{exact:true})).toHaveValue('SE');
 const downloadEvent=page.waitForEvent('download');
 await dialog.getByRole('button',{name:'Für Outlook herunterladen (.ics)',exact:true}).click();
 const download=await downloadEvent;expect(download.suggestedFilename()).toBe('SE.ics');
 const path=info.outputPath('SE.ics');await download.saveAs(path);
 const content=readFileSync(path,'utf8');
 expect(content.match(/BEGIN:VEVENT/g)).toHaveLength(3);expect(content).toContain('SUMMARY:SE\r\n');
 expect(content).toContain('LOCATION:K002');expect(content).not.toContain('LOCATION:K001');
 await page.getByRole('button',{name:'Details schließen'}).click();await page.reload();
 await page.getByLabel('Module in aktuelles Semester ziehen').getByRole('button',{name:/^Software Engineering 8 ECTS/}).click();
 await expect(dialog.getByRole('group',{name:'Stundenplan & Kalender'})).not.toHaveAttribute('open','');
 await dialog.getByRole('group',{name:'Stundenplan & Kalender'}).locator('summary').first().click();
 await expect(dialog.getByRole('region',{name:'Persönliche Terminvarianten'})).toContainText('Meine Übungsgruppe');
 await dialog.getByRole('button',{name:'Bearbeiten',exact:true}).click();
 await form.getByLabel('Raum / Online-Ort',{exact:true}).fill('K003');await form.getByRole('button',{name:'Terminvariante speichern'}).click();
 await expect(dialog.getByRole('region',{name:'Persönliche Terminvarianten'})).toContainText('K003');
 await expect(dialog.locator('[data-testid="meeting-variant"]').first().locator('summary')).toContainText('K001');
 await dialog.getByRole('group',{name:'Kalendereinstellungen'}).locator('summary').click();
 await page.screenshot({path:'test-results/personal-variants-calendar.png',fullPage:true});
 await dialog.getByRole('button',{name:'Entfernen',exact:true}).click();
 await expect(dialog.getByRole('button',{name:/^Meine Übungsgruppe: /})).toHaveCount(0);
 await expect(page.getByTestId('official-credits')).toHaveText('60 / 210');
});

test('source variants are selected in place as weekly appointments, with one export and lecture-free days excluded',async({page},info)=>{
 await open(page,{...module,course:{meetings:[{...meeting,recurrence:'unconfirmed'}]}} as any);
 const dialog=page.getByRole('dialog'),variant=dialog.getByTestId('meeting-variant');
 await variant.locator('summary').click();
 await variant.getByRole('button',{name:'Variante 1: Zum Kalender hinzufügen',exact:true}).click();
 await expect(variant.getByRole('button',{name:'Variante 1: Aus Kalender entfernen',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(dialog.getByRole('checkbox')).toHaveCount(0);
 await expect(dialog.getByRole('combobox')).toHaveCount(0);
 await expect(dialog.getByText(/Rhythmus nicht bestätigt|Rhythmus wählen|gerader\/ungerader/)).toHaveCount(0);
 await expect(dialog.getByRole('button',{name:'Für Outlook herunterladen (.ics)',exact:true})).toHaveCount(1);
 const event=page.waitForEvent('download');await dialog.getByRole('button',{name:'Für Outlook herunterladen (.ics)',exact:true}).click();
 const file=await event,path=info.outputPath('source.ics');await file.saveAs(path);
 const text=readFileSync(path,'utf8');expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(1);expect(text).toContain('DTSTART:20261013T080000Z');expect(text).not.toContain('DTSTART:20261006');
});

test('AW can have its own appointment without a BOSS record and another student does not see it',async({page})=>{
 const aw={...module,id:'wi.req.aw2',title:'AW 2',short_title:'AW 2',required_ects:2,course:undefined,semester_offered:false,details:{aw_components:[{title:'AW-Kurs',ects:2,kind:'elective'}]}};
 await page.route('**/api/imports',r=>r.fulfill({json:[]}));await page.route('**/api/programs/wi/examples/*',r=>r.fulfill({json:data(aw)}));
 await page.goto('/?example=open');await page.getByRole('button',{name:'AW 2: Offen',exact:true}).click();
 const dialog=page.getByRole('dialog');
 await dialog.getByLabel('AW-Kurs 1',{exact:true}).fill('Spanisch');await dialog.getByLabel('Platz für AW-Kurs 1 bestätigt').check();
 await dialog.getByRole('button',{name:'AW-Teilmodul 1 hinzufügen'}).click();await page.getByRole('button',{name:'Details schließen'}).click();
 await page.getByLabel('Module in aktuelles Semester ziehen').getByRole('button',{name:/^Spanisch 2 ECTS/}).click();
 await dialog.getByRole('button',{name:'Eigene Variante hinzufügen'}).click();
 const form=dialog.getByRole('form',{name:'Eigene Terminvariante bearbeiten'});
 await form.getByLabel('Bezeichnung',{exact:true}).fill('Spanisch am Dienstag');await form.getByRole('button',{name:'Terminvariante speichern'}).click();
 await expect(dialog.getByRole('region',{name:'Persönliche Terminvarianten'})).toContainText('Spanisch am Dienstag');
 await page.route('**/api/auth/me',r=>r.fulfill({json:{id:2,name:'Another student',email:'another@example.test',role:'student'}}));
 await page.reload();await page.getByRole('button',{name:'AW 2: Offen',exact:true}).click();
 await expect(dialog.getByLabel('AW-Kurs 1',{exact:true})).toHaveValue('');
 const keys=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.endsWith(':personal-meetings')));
 expect(keys.length).toBeGreaterThan(0);expect(keys.every(k=>k.includes(':1:example:open:'))).toBe(true);
});


test('several variants can be toggled in place and only the remaining selection is exported together',async({page},info)=>{
 await open(page,{...module,course:{meetings:[meeting,{...meeting,weekday:4,room:'K002',teachers:['Other Professor']}]}} as any);
 const dialog=page.getByRole('dialog');let downloads=0;page.on('download',()=>downloads++);
 for(const variant of await dialog.getByTestId('meeting-variant').all())await variant.locator('summary').click();
 await dialog.getByRole('button',{name:'Variante 1: Zum Kalender hinzufügen',exact:true}).click();
 await dialog.getByRole('button',{name:'Variante 2: Zum Kalender hinzufügen',exact:true}).click();
 await expect(dialog.getByRole('region',{name:'Kalenderexport'})).toContainText('2 Varianten im Kalenderplan');expect(downloads).toBe(0);
 // A reload keeps the chosen variants without creating another list of times.
 await page.getByRole('button',{name:'Details schließen'}).click();await page.reload();
 await page.getByLabel('Module in aktuelles Semester ziehen').getByRole('button',{name:/^Software Engineering 8 ECTS/}).click();
 for(const variant of await dialog.getByTestId('meeting-variant').all())await variant.locator('summary').click();
 await expect(dialog.getByRole('button',{name:'Variante 1: Aus Kalender entfernen',exact:true})).toHaveAttribute('aria-pressed','true');
 await dialog.getByRole('button',{name:'Variante 1: Aus Kalender entfernen',exact:true}).click();
 const event=page.waitForEvent('download');await dialog.getByRole('button',{name:'Für Outlook herunterladen (.ics)',exact:true}).click();
 const file=await event,path=info.outputPath('selected-variants.ics');await file.saveAs(path);
 const text=readFileSync(path,'utf8');expect(file.suggestedFilename()).toBe('SE.ics');
 expect(text).toContain('LOCATION:K002');expect(text).not.toContain('LOCATION:K001');expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(3);
 expect(downloads).toBe(1);await page.screenshot({path:'test-results/calendar-single-selection.png',fullPage:true});
});

test('the single export reveals missing period settings without losing the selected variant',async({page})=>{
 await open(page);
 const dialog=page.getByRole('dialog'),variant=dialog.getByTestId('meeting-variant');
 await variant.locator('summary').click();await variant.getByRole('button',{name:'Variante 1: Zum Kalender hinzufügen',exact:true}).click();
 const settings=dialog.getByRole('group',{name:'Kalendereinstellungen'});await settings.locator('summary').click();
 await dialog.getByLabel('Zeitraum von',{exact:true}).fill('');await settings.locator('summary').click();
 await dialog.getByRole('button',{name:'Für Outlook herunterladen (.ics)',exact:true}).click();
 await expect(settings).toHaveAttribute('open','');await expect(dialog.getByRole('status').filter({hasText:'Bitte Titel und Zeitraum'})).toBeVisible();
 await expect(variant.getByRole('button',{name:'Variante 1: Aus Kalender entfernen',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('dated BOSS appointments export automatically once without asking for a rhythm',async({page},info)=>{
 await open(page,{...module,course:{meetings:[{...meeting,recurrence:'unconfirmed',dates:['2026-10-20']}]}} as any);
 const dialog=page.getByRole('dialog'),variant=dialog.getByTestId('meeting-variant');await variant.locator('summary').click();
 await variant.getByRole('button',{name:'Variante 1: Zum Kalender hinzufügen',exact:true}).click();
 await expect(dialog.getByRole('combobox')).toHaveCount(0);
 await dialog.getByRole('group',{name:'Kalendereinstellungen'}).locator('summary').click();await dialog.getByLabel('Zeitraum bis',{exact:true}).fill('2026-10-31');
 const event=page.waitForEvent('download');await dialog.getByRole('button',{name:'Für Outlook herunterladen (.ics)',exact:true}).click();
 const file=await event,path=info.outputPath('dated-source.ics');await file.saveAs(path);
 const content=readFileSync(path,'utf8');expect(content).toContain('DTSTART:20261020T080000Z');expect(content).not.toContain('DTSTART:20261013');expect(content.match(/BEGIN:VEVENT/g)).toHaveLength(1);
});
