import { test, expect } from './fixtures';
const planning=(kind:string,status='available')=>({status,kind,reason:status==='available'?'Persönlich einplanbar':'90 ECTS fehlen.',registration_note:'Anmeldung und Termin separat mit der OTH klären.',steps:['Betreuung und Termin abstimmen.'],info_url:'https://informatik-mathematik.oth-regensburg.de/studium',source:'SPO 2023'});
const milestone=(id:string,title:string,short:string,ects:number,kind:string)=>({id,title,short_title:short,required_ects:ects,actual_ects:null,grade:null,status:'unknown',source:null,semester_offered:false,admission:{status:'unknown',reason:'Formaler Status unbekannt.'},planning:planning(kind),details:{grade_weight:kind==='thesis'?'6':'0'}});
const rows=[milestone('wi.req.praktikum','Praktikum','PRAX',24,'practice'),milestone('wi.req.praxisseminar','Praxisseminar','PSEM',2,'practice_seminar'),milestone('wi.req.bachelorarbeit','Bachelorarbeit','BA',12,'thesis'),milestone('wi.req.bachelorseminar','Bachelorseminar','BSEM',3,'thesis_seminar')];
const data={import_id:null,program:'Wirtschaftsinformatik',supported:true,official_grade:2.5,official_credits:95,spo_version:'SPO 2023',example_scenario:'practice',example_label:'Vor dem Praxissemester',unmatched_groups:[],stages:[{id:'abschnitt_1',title:'Abschnitt 1',modules:[]},{id:'abschnitt_2',title:'Abschnitt 2',modules:[]},{id:'praxissemester',title:'Praxissemester',modules:rows.slice(0,2)},{id:'abschnitt_3',title:'Abschnitt 3 / Abschluss',modules:rows.slice(2)}]};
async function load(page:any){
 await page.route('**/api/imports', (r:any)=>r.fulfill({json:[]}));
 await page.route('**/api/programs/wi/examples/*', (r:any)=>r.fulfill({json:data}));
 await page.goto('/?example=practice');
 await expect(page.getByRole('heading',{name:'Mein Status',exact:true})).toBeVisible();
}

test('practice is in Abschnitt 2; source, SPO and printing help stay behind one information control',async({page})=>{
 await load(page);
 await expect(page.getByTestId('study-stage-abschnitt_2').getByRole('button',{name:'Praktikum: Offen',exact:true})).toBeVisible();
 await expect(page.getByTestId('study-stage-abschnitt_2').getByRole('button',{name:'Praxisseminar: Offen',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Praxissemester',exact:true})).toHaveCount(0);
 await expect(page.getByRole('region',{name:'Importprüfung'})).toHaveCount(0);
 await expect(page.getByText('SPO 2023',{exact:true})).not.toBeVisible();
 await expect(page.getByText('Zuordnung prüfen',{exact:true})).toHaveCount(0);
 await page.getByRole('group',{name:'Studieninformationen'}).locator('summary').first().click();
 await expect(page.getByText('SPO 2023',{exact:true})).toBeVisible();
 await expect(page.getByRole('group',{name:'Studieninformationen'}).getByText('PDF aus HISinOne erstellen',{exact:false})).toHaveCount(0);
 await page.getByRole('button',{name:'Studieninformationen schließen'}).click();
 await page.getByRole('group',{name:'PDF aus HISinOne erstellen'}).locator('summary').click();
 await expect(page.getByRole('group',{name:'PDF aus HISinOne erstellen'}).getByRole('heading',{name:'PDF aus HISinOne erstellen'})).toBeVisible();
 await page.getByRole('button',{name:'PDF aus HISinOne erstellen schließen'}).click();
 await expect(page.getByRole('group',{name:'PDF aus HISinOne erstellen'}).getByRole('heading')).not.toBeVisible();
 const stored=await page.evaluate(()=>localStorage.getItem('stage-gate.profile:1'));
 expect(stored).toBeNull();
});

test('a thesis can be dragged alone and both milestones can be dragged as one group',async({page})=>{
 await load(page);
 const target=page.getByLabel('Module in aktuelles Semester ziehen');
 const ba=page.getByRole('button',{name:'Bachelorarbeit: Offen',exact:true});
 await expect(ba).toHaveAttribute('draggable','true');
 await ba.dragTo(target);
 await expect(page.getByRole('dialog').getByRole('button',{name:'Zum aktuellen Semester hinzufügen'})).toBeDisabled();
 await page.getByRole('checkbox',{name:'Meine Bachelorarbeit ist offiziell angemeldet.',exact:false}).check();
 await page.getByRole('button',{name:'Zum aktuellen Semester hinzufügen',exact:true}).click();await page.getByRole('button',{name:'Details schließen'}).click();
 await expect(target.getByRole('button',{name:/^Bachelorarbeit 12 ECTS/})).toHaveCount(1);
 await expect(target.getByRole('button',{name:/^Bachelorseminar 3 ECTS/})).toHaveCount(0);
 await page.getByTestId('study-stage-abschnitt_3').getByRole('region',{name:'Bachelorarbeit & Seminar'}).dragTo(target);
 await expect(target.getByRole('button',{name:/^Bachelorseminar 3 ECTS/})).toHaveCount(1);
 await expect(page.getByTestId('official-credits')).toHaveText('95 / 210');
 await target.getByRole('button',{name:/^Bachelorarbeit 12 ECTS/}).click();
 await expect(page.getByRole('dialog')).toContainText('Anmeldung und Termin separat');
 await expect(page.getByRole('dialog').getByText('Noch keine bestätigten Termine')).toHaveCount(0);
 await page.getByRole('button',{name:'Aus aktuellem Semester entfernen'}).click();
 await expect(target.getByRole('button',{name:/^Bachelorarbeit 12 ECTS/})).toHaveCount(0);
 await expect(target.getByRole('button',{name:/^Bachelorseminar 3 ECTS/})).toHaveCount(1);
 await page.reload();
 await expect(target.getByRole('button',{name:/^Bachelorseminar 3 ECTS/})).toHaveCount(1);
 await expect(page.getByTestId('official-credits')).toHaveText('95 / 210');
});

test('planning a practice pair leaves blocked academic modules and real semester plans untouched',async({page})=>{
 await load(page);
 const target=page.getByLabel('Module in aktuelles Semester ziehen');
 await page.getByRole('button',{name:'Praktikum: Offen',exact:true}).click();await page.getByRole('checkbox',{name:'Praktikumsplatz und Vertrag sind mit der OTH bestätigt.',exact:false}).check();await page.getByRole('button',{name:'Details schließen'}).click();
 await page.getByTestId('study-stage-abschnitt_2').getByRole('region',{name:'Praktikum & Praxisseminar'}).dragTo(target);
 await expect(target.getByRole('button',{name:/^Praktikum 24 ECTS/})).toHaveCount(1);
 await expect(target.getByRole('button',{name:/^Praxisseminar 2 ECTS/})).toHaveCount(1);
 await expect(page.getByTestId('study-stage-abschnitt_2').getByRole('region',{name:'Praktikum & Praxisseminar'})).toHaveClass(/bg-blue-50/);
 await expect(target.locator('[data-planned-module="wi.req.praktikum"]')).toHaveClass(/bg-blue-50/);
 const keys=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('stage-gate.module:')));
 expect(keys).toHaveLength(2);expect(keys.every(k=>k.includes('example:practice'))).toBe(true);
 await page.getByRole('button',{name:'Praktikum: Offen',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Bereits für');
 await expect(page.getByRole('dialog').getByRole('button',{name:'Zum aktuellen Semester hinzufügen'})).toHaveCount(0);
});
