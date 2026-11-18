import { test, expect } from './fixtures';

async function dashboard(page: any, module: any) {
  await page.route('**/api/imports', (route: any) => route.fulfill({ json: [{ id: 1, status: 'success' }] }));
  await page.route('**/api/imports/1/dashboard*', (route: any) => route.fulfill({ json: { import_id: 1, program: 'Wirtschaftsinformatik', supported: true, official_grade: null, official_credits: 0, spo_version: 'SPO 2026', stages: [{ id: 'abschnitt_1', title: 'Abschnitt 1', modules: [module] }], unmatched_groups: [] } }));
  await page.goto('/?preview=dashboard');
  await page.getByLabel('Datenquelle').selectOption('1');
}

const bwl2={id:'wi.req.bwl2',title:'Betriebswirtschaftslehre 2',short_title:'BW2',required_ects:7,status:'unknown',grade:null,source:null,completion_rule:'all',admission:{status:'available',reason:'Test'},details:{completion_rule:'all',components:[{title:'Grundlagen',ects:5},{title:'Fallstudie',ects:2}]},course_options:[
 {id:'wi.course.bwl2_grundlagen',title:'Grundlagen der BWL2',ects:5,course:{offered:true,meetings:[{weekday:1,start:'08:15',end:'09:45',room:'D201',group:'IW2'}]}},
 {id:'wi.course.bwl2_fallstudie',title:'Fallstudie BWL2',ects:2,course:{offered:true,meetings:[{weekday:3,start:'10:00',end:'11:30',room:'K014',group:'IW2'}]}},
]};
test('BWL2 is one whole semester card with both parts and a single credit total',async({page})=>{
 await dashboard(page,bwl2);
 const overview=page.getByRole('button',{name:'Betriebswirtschaftslehre 2: Offen',exact:true}),dialog=page.getByRole('dialog');
 await overview.click();await expect(dialog.getByRole('button',{name:'Teilmodul hinzufügen'})).toHaveCount(0);
 await dialog.getByRole('button',{name:'Zum aktuellen Semester hinzufügen',exact:true}).click();await page.getByRole('button',{name:'Details schließen'}).click();
 const card=page.getByLabel('Module in aktuelles Semester ziehen').getByRole('button',{name:'Betriebswirtschaftslehre 2 7 ECTS',exact:true});
 await expect(card).toHaveCount(1);await expect(page.getByTestId('semester-ects')).toHaveText('7 ECTS');
 await card.click();await expect(dialog).toContainText('Montag 08:15–09:45 · D201');await expect(dialog).toContainText('Mittwoch 10:00–11:30 · K014');
 await page.getByLabel('Notizen',{exact:true}).fill('Beide Bestandteile zusammen');await page.getByRole('button',{name:'Kursangaben speichern'}).click();
 await page.getByRole('button',{name:'Details schließen'}).click();await page.reload();await page.getByLabel('Datenquelle').selectOption('1');await expect(page.getByTestId('official-credits')).toHaveText('0 / 210');await expect(overview).toBeVisible();await card.click();
 await expect(page.getByLabel('Notizen',{exact:true})).toHaveValue('Beide Bestandteile zusammen');
 await page.getByRole('button',{name:'Aus aktuellem Semester entfernen',exact:true}).click();await expect(card).toHaveCount(0);await expect(page.getByTestId('semester-ects')).toHaveText('0 ECTS');
 await overview.dragTo(page.getByLabel('Module in aktuelles Semester ziehen'));await expect(card).toBeVisible();
 await expect(page.getByTestId('semester-ects')).toHaveText('7 ECTS');await expect(page.getByTestId('official-credits')).toHaveText('0 / 210');
 await page.screenshot({path:'test-results/whole-bwl2.png',fullPage:true});
});

test('an earlier plan containing only one BWL2 part now displays the complete module once',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-11-16T10:00:00Z'));
 await page.addInitScript(()=>localStorage.setItem('stage-gate.module:1:wi:WiSe 2026/27:wi.req.bwl2',JSON.stringify({plannedTerm:'WiSe 2026/27',plannedCourseIds:['wi.course.bwl2_grundlagen']})));
 await dashboard(page,bwl2);
 await expect(page.getByLabel('Module in aktuelles Semester ziehen').locator('[data-planned-module="wi.req.bwl2"]')).toHaveCount(1);
 await expect(page.getByTestId('semester-ects')).toHaveText('7 ECTS');
});

test('IW3 offers one alternative and keeps the parent as a single requirement', async ({ page }) => {
  await dashboard(page, { id: 'wi.req.vertiefung_iw3', title: 'Vertiefungsmodul IW 3', short_title: 'IW3', required_ects: 5, status: 'unknown', grade: null, source: null, completion_rule: 'one', requires_course_selection: true, admission: { status: 'available', reason: 'Test' }, details: { completion_rule: 'one', linked_courses: [{ id: 'is', title: 'Informationssicherheit' }, { id: 'isc', title: 'Informationssicherheit und Compliance' }] }, course_options: [{ id: 'is', title: 'Informationssicherheit', short_title: 'IS', course: { offered: true } }, { id: 'isc', title: 'Informationssicherheit und Compliance', short_title: 'ISC', course: { offered: true } }] });
  await page.getByRole('button', { name: 'Vertiefungsmodul IW 3: Offen' }).click();
  await expect(page.getByRole('dialog')).toContainText('Eine der zugelassenen Disziplinen abschließen');
  await page.getByLabel('Vertiefungsdisziplin auswählen').selectOption('is');
  await page.getByLabel('Ich habe für diese Disziplin einen Platz / eine Teilnahmebestätigung.').check();
  await page.getByRole('button', { name: 'Zum aktuellen Semester hinzufügen' }).click();
  await page.getByRole('button', { name: 'Details schließen' }).click();
  await expect(page.getByRole('button', { name: /Informationssicherheit.*5 ECTS/ })).toHaveCount(1);
  await expect(page.getByTestId('official-credits')).toHaveText('0 / 210');
});

test('available modules drag into current semester; locked and out-of-season modules cannot', async ({page}) => {
 await dashboard(page,{id:'pg2',title:'Programmieren 2',short_title:'PG2',required_ects:8,status:'unknown',grade:null,source:null,semester_offered:true,admission:{status:'available',reason:'Test'}});
 const card=page.getByRole('button',{name:'Programmieren 2: Offen'});
 await expect(card).toHaveAttribute('draggable','true');
 await card.dragTo(page.getByLabel('Module in aktuelles Semester ziehen'));
 await expect(page.getByRole('button',{name:/Programmieren 2.*8 ECTS/})).toBeVisible();
 await expect(card).toContainText('Im aktuellen Semester');
 await expect(page.getByTestId('official-credits')).toHaveText('0 / 210');
 await expect(page.getByRole('button',{name:/Eigenen.*hinzufügen|Eigenen.*erstellen/})).toHaveCount(0);
 await dashboard(page,{id:'pg2',title:'Programmieren 2',short_title:'PG2',required_ects:8,status:'unknown',grade:null,source:null,semester_offered:false,admission:{status:'available',reason:'Test'}});
 await expect(card).toHaveAttribute('draggable','false'); await card.click();
 await expect(page.getByRole('dialog')).toContainText('Kein bestätigtes Semesterangebot');
 await expect(page.getByRole('button',{name:'Zum aktuellen Semester hinzufügen'})).toHaveCount(0);
});

test('shared BWL2 source slots remain single and are not falsely assigned to part 2.1 or 2.2',async({page})=>{
 const meeting={weekday:2,start:'15:45',end:'17:15',room:'K008',group:'IW2',source_code:'BW2',source_color:'#ffffff',shared_with:bwl2.course_options.map(o=>o.id)};
 await dashboard(page,{...bwl2,course_options:bwl2.course_options.map(o=>({...o,course:{offered:true,meetings:[meeting]}}))});
 await page.getByRole('button',{name:'Betriebswirtschaftslehre 2: Offen',exact:true}).click();await page.getByRole('button',{name:'Zum aktuellen Semester hinzufügen',exact:true}).click();await page.getByRole('button',{name:'Details schließen'}).click();
 await page.getByLabel('Module in aktuelles Semester ziehen').getByRole('button',{name:'Betriebswirtschaftslehre 2 7 ECTS',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog.getByText('Die Zuordnung einzelner Termine zu den Pflichtteilen ist nicht angegeben.',{exact:false})).toHaveCount(0);
 await dialog.getByTestId('meeting-variant').locator('summary').click();await expect(dialog.getByText('Dienstag 15:45–17:15 · K008',{exact:true})).toHaveCount(1);
 await expect(dialog.getByText(/Gemeinsames Modul-Raster/)).toContainText('Grundlagen der BWL2 / Fallstudie BWL2');
});
