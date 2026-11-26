import {test,expect} from './fixtures';

const module={id:'se',title:'Software Engineering',short_title:'SE',required_ects:5,actual_ects:null,grade:null,status:'unknown',source:null,semester_offered:true,admission:{status:'available',reason:'Test'},details:{handbook:{url:'https://example.org/handbook.pdf',pages:{start:42,end:44}},description:'Anforderungen, Architektur und Softwarequalität.'},course:{elo:'https://example.org/elo',meetings:[{weekday:1,start:'08:15',end:'09:45',room:'D201',group:'IW3'}]}};
async function open(page:any,value:any=module){
 await page.route('**/api/imports',(r:any)=>r.fulfill({json:[{id:1,status:'success'}]}));
 await page.route('**/api/imports/1/dashboard*',(r:any)=>r.fulfill({json:{import_id:1,program:'Wirtschaftsinformatik',supported:true,official_credits:0,official_grade:null,spo_version:'Test',stages:[{id:'abschnitt_2',title:'Abschnitt 2',modules:[value]}],unmatched_groups:[]}}));
 await page.goto('/?preview=dashboard');await page.getByRole('button',{name:'Software Engineering: Offen',exact:true}).click();
}
test('handbook ELO and readonly schedule are visible before planning and handbook remains after adding',async({page})=>{
 await open(page);const dialog=page.getByRole('dialog');
 await expect(dialog.getByRole('link',{name:/Modulhandbuch öffnen/})).toHaveAttribute('href','https://example.org/handbook.pdf#page=42');
 await expect(dialog.getByRole('link',{name:'ELO-Kurs öffnen',exact:true})).toHaveAttribute('href','https://example.org/elo');
 const schedule=dialog.getByRole('region',{name:'Stundenplan vor der Semesterplanung'});
 await expect(schedule.getByText('Montag 08:15–09:45 · D201',{exact:true})).not.toBeVisible();
 await schedule.locator('summary').first().click();
 await expect(schedule.getByText('Montag 08:15–09:45 · D201',{exact:true})).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Eigene Variante hinzufügen'})).toHaveCount(0);
 await expect(dialog.getByText('Anforderungen, Architektur und Softwarequalität.',{exact:true})).not.toBeVisible();
 await dialog.locator('summary').filter({hasText:'Kursbeschreibung'}).click();
 await expect(dialog.getByText('Anforderungen, Architektur und Softwarequalität.',{exact:true})).toBeVisible();
 await page.screenshot({path:'test-results/course-before-planning.png',fullPage:true});
 await dialog.getByRole('button',{name:'Zum aktuellen Semester hinzufügen',exact:true}).click();await dialog.getByRole('button',{name:'Details schließen'}).click();
 await page.getByLabel('Module in aktuelles Semester ziehen').getByRole('button',{name:'Software Engineering 5 ECTS',exact:true}).click();
 await expect(dialog.getByRole('link',{name:/Modulhandbuch öffnen/})).toHaveAttribute('href','https://example.org/handbook.pdf#page=42');
 await expect(dialog.getByRole('link',{name:'ELO-Kurs öffnen',exact:true})).toBeVisible();
});
test('each compulsory part exposes its own handbook and schedule without planning it',async({page})=>{
 await open(page,{...module,completion_rule:'all',details:{completion_rule:'all'},course_options:[{id:'a',title:'Teilmodul A',ects:3,details:module.details,course:module.course},{id:'b',title:'Teilmodul B',ects:2,details:{reference_handbook:{url:'https://example.org/current.pdf',label:'Aktuelles Referenz-Modulhandbuch'}},course:{meetings:[{weekday:3,start:'10:00',end:'11:30',room:'K014',group:'IW3'}]}}]});
 const preview=page.getByRole('region',{name:'Stundenplan vor der Semesterplanung'});
 await preview.locator('summary').first().click();
 await preview.locator('summary').filter({hasText:'Teilmodul A'}).click();await preview.locator('summary').filter({hasText:'Teilmodul B'}).click();
 await expect(preview.getByRole('link',{name:/Modulhandbuch öffnen/})).toBeVisible();
 await expect(preview.getByRole('link',{name:'Aktuelles Referenz-Modulhandbuch',exact:true})).toHaveAttribute('href','https://example.org/current.pdf');
 await expect(preview).toContainText('Mittwoch 10:00–11:30 · K014');
 await page.getByRole('button',{name:'Zum aktuellen Semester hinzufügen',exact:true}).click();await page.getByRole('button',{name:'Details schließen'}).click();
 await page.getByLabel('Module in aktuelles Semester ziehen').getByRole('button',{name:'Software Engineering 5 ECTS',exact:true}).click();
 const documents=page.getByRole('region',{name:'Unterlagen der Teilmodule'});
 await documents.locator('summary').filter({hasText:'Teilmodul B'}).click();
 await expect(documents.getByRole('link',{name:'Aktuelles Referenz-Modulhandbuch',exact:true})).toBeVisible();
});
test('missing demo downloads keep page information without exposing a protected URL',async({page})=>{
 await open(page,{...module,details:{handbook:{url:null,pages:{start:12,end:14}}},course:{}});
 const dialog=page.getByRole('dialog');await expect(dialog).toContainText('Seiten 12–14 · PDF-Link hier nicht verfügbar.');
 await expect(dialog.getByRole('link')).toHaveCount(0);await expect(dialog).toContainText('Noch keine bestätigten Termine.');
});
