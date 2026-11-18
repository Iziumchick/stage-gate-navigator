import {test,expect} from './fixtures';
const course={id:'SE',title:'Software Engineering',short_title:'SE',required_ects:8,status:'unknown',grade:null,source:null,semester_offered:true,admission:{status:'available',reason:'OK'},course:{meetings:[{weekday:2,start:'10:00',end:'11:30',room:'K001',group:'IW4',recurrence:'weekly',source_color:'#ffffff'}]}};
const milestone=(id:string,title:string,short:string,ects:number,kind:string)=>({id,title,short_title:short,required_ects:ects,status:'unknown',grade:null,source:null,planning:{kind,status:'available',reason:'OK',registration_note:'Anmeldung separat',steps:[],info_url:'https://example.org',source:'SPO2023'}});
const practice=milestone('wi.req.praktikum','Praktikum','PRAX',24,'practice'),seminar=milestone('wi.req.praxisseminar','Praxisseminar','PSEM',2,'practice_seminar');
async function load(page:any){
 await page.clock.setFixedTime(new Date('2026-11-16T10:00:00Z'));
 await page.route('**/api/imports',(r:any)=>r.fulfill({json:[]}));
 await page.route('**/api/programs/wi/examples/*',(r:any)=>r.fulfill({json:{import_id:null,program:'WI',supported:true,official_grade:2.7,official_credits:90,spo_version:'SPO2023',example_scenario:'practice',unmatched_groups:[],semester_calendar:{lectures:{start:'2026-11-16',end:'2026-11-22'}},progress:{confirmed_ects:90,milestones:Array.from({length:10},(_,i)=>({id:`row${i}`,title:`Etappe ${i}`,available:true,completed:false,reason:'Test'}))},stages:[{id:'abschnitt_1',title:'Abschnitt 1',modules:[course]},{id:'abschnitt_2',title:'Abschnitt 2',modules:[practice,seminar]}]}}));
 await page.goto('/?example=practice');await expect(page.getByTestId('official-credits')).toHaveText('90 / 210');
}
test('practice confirmation applies to drag and buttons; pair reminders follow the current plan',async({page})=>{
 await load(page);const target=page.getByLabel('Module in aktuelles Semester ziehen'),dialog=page.getByRole('dialog');
 await page.getByRole('button',{name:'Praktikum: Offen',exact:true}).dragTo(target);
 const add=dialog.getByRole('button',{name:'Zum aktuellen Semester hinzufügen',exact:true});await expect(add).toBeDisabled();
 await dialog.getByRole('checkbox',{name:'Praktikumsplatz und Vertrag sind mit der OTH bestätigt.',exact:false}).check();await add.click();await page.getByRole('button',{name:'Details schließen'}).click();
 await expect(page.getByText('ECTS-Voraussetzung für Praxis erfüllt',{exact:true})).toHaveCount(0);
 const hint=page.getByText('PSEM ebenfalls einplanen?',{exact:true});await expect(hint).toBeVisible();
 await hint.locator('..').getByRole('button',{name:'Modul ansehen',exact:true}).click();await add.click();await page.getByRole('button',{name:'Details schließen'}).click();
 await expect(hint).toHaveCount(0);await expect(page.getByTestId('semester-ects')).toHaveText('26 ECTS');
 await target.getByRole('button',{name:'Praxisseminar aus Semester entfernen',exact:true}).click();await expect(hint).toBeVisible();
 await expect(page.getByTestId('official-credits')).toHaveText('90 / 210');
});
test('the empty bottom of the whole current-semester panel accepts a drop',async({page})=>{
 await load(page);const target=page.getByLabel('Module in aktuelles Semester ziehen');
 const box=await target.boundingBox();expect(box!.height).toBeGreaterThan(400);
 await page.getByRole('button',{name:'Software Engineering: Offen',exact:true}).dragTo(target,{targetPosition:{x:80,y:box!.height-25}});
 await expect(target.getByRole('button',{name:'Software Engineering 8 ECTS',exact:true})).toBeVisible();
});
test('saved ELO links switch to edit mode only on demand and exported schedules collapse on the next visit',async({page})=>{
 await load(page);const target=page.getByLabel('Module in aktuelles Semester ziehen');
 await page.getByRole('button',{name:'Software Engineering: Offen',exact:true}).dragTo(target);
 const card=target.getByRole('button',{name:'Software Engineering 8 ECTS',exact:true});await card.click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('ELO-Kurslink',{exact:true}).fill('https://example.org/elo');
 await dialog.getByRole('button',{name:'Kursangaben speichern',exact:true}).click();
 await expect(dialog.getByLabel('ELO-Kurslink',{exact:true})).toHaveCount(0);await expect(dialog.getByRole('link',{name:'ELO-Kurs öffnen',exact:true})).toHaveAttribute('href','https://example.org/elo');
 await dialog.getByRole('button',{name:'ELO-Link bearbeiten',exact:true}).click();await dialog.getByLabel('ELO-Kurslink',{exact:true}).fill('https://example.org/elo2');await dialog.getByRole('button',{name:'Kursangaben speichern',exact:true}).click();
 await dialog.getByTestId('meeting-variant').locator('summary').click();await dialog.getByRole('button',{name:'Variante 1: Zum Kalender hinzufügen',exact:true}).click();
 const download=page.waitForEvent('download');await dialog.getByRole('button',{name:'Für Outlook herunterladen (.ics)',exact:true}).click();await download;
 await page.getByRole('button',{name:'Details schließen'}).click();await card.click();
 await expect(dialog.getByRole('group',{name:'Stundenplan & Kalender',exact:true})).not.toHaveAttribute('open','');
 await expect(dialog.getByRole('link',{name:'ELO-Kurs öffnen',exact:true})).toHaveAttribute('href','https://example.org/elo2');
 await expect(dialog.getByLabel('ELO-Kurslink',{exact:true})).toHaveCount(0);
 await page.screenshot({path:'test-results/course-compact-configured.png',fullPage:true});
});
