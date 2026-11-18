import {test,expect} from './fixtures';
const exam={code:'4720040',short_code:'ST',title:'Statistik',attempt:1,grade:5,ects:0,status:'NB',released_on:'01.08.2026'};
const failed={id:'wi.req.statistik',title:'Statistik',short_title:'ST',required_ects:5,actual_ects:0,grade:'5.0',status:'failed',source:null,open_exam_count:1,exam_history:[exam],semester_offered:true,admission:{status:'available',reason:'Abschnitt geöffnet.'},details:{grade_weight:'2'}};
async function show(page:any,module:any,scenario='repeat-first') {
 await page.clock.setFixedTime(new Date('2026-11-11T10:00:00Z'));
 await page.route('**/api/imports',(r:any)=>r.fulfill({json:[]}));
 await page.route('**/api/programs/wi/examples/*',(r:any)=>r.fulfill({json:{import_id:null,program:'Wirtschaftsinformatik',supported:true,official_grade:2.7,official_credits:60,spo_version:'SPO 2023',curriculum_edition:'wi_bsc_2023',example_scenario:scenario,example_label:'Test',unmatched_groups:[],stages:[{id:'abschnitt_2',title:'Abschnitt 2',access:{status:'available'},modules:[module]}]}}));
 await page.goto(`/?example=${scenario}`);
 await expect(page.getByTestId('official-credits')).toBeVisible();
}

test('an automatic repeat stays orange and requires approved deferral to remove from either view',async({page})=>{
 await show(page,failed);
 const target=page.getByLabel('Module in aktuelles Semester ziehen'),overview=page.locator('[data-module-id="wi.req.statistik"]');
 const card=target.getByRole('button',{name:/^Statistik Prüfungswiederholung/});
 await expect(card).toBeVisible();
 await expect(overview).toHaveClass(/bg-orange-50/);
 await expect(target.locator('[data-planned-module]')).toHaveClass(/bg-orange-50/);
 await expect(target.getByRole('button',{name:'Statistik aus Semester entfernen',exact:true})).toBeDisabled();
 await overview.click();
 const dialog=page.getByRole('dialog'),remove=dialog.getByRole('button',{name:'Aus aktuellem Semester entfernen',exact:true});
 await expect(remove).toBeDisabled();
 await expect(dialog.locator('input[type="date"]')).toHaveCount(0);
 const info=dialog.locator('summary').filter({hasText:'Verschiebung & Entfernen aus dem Semester'});
 await expect(dialog.getByLabel('Ich habe die Bestätigung erhalten',{exact:false})).not.toBeVisible();
 await info.click();
 await dialog.getByLabel('Ich habe die Bestätigung erhalten',{exact:false}).check();
 await expect(remove).toBeEnabled();await remove.click();
 await expect(card).toHaveCount(0);
 await expect(page.getByText('Bestätigte Verschiebung für dieses Semester hinterlegt.')).toBeVisible();
 await page.reload();await expect(card).toHaveCount(0);
 await overview.click();await info.click();
 await dialog.getByLabel('Ich habe die Bestätigung erhalten',{exact:false}).uncheck();
 await page.getByRole('button',{name:'Details schließen'}).click();
 await expect(card).toBeVisible();
 await card.click();await info.click();
 await dialog.getByLabel('Ich habe die Bestätigung erhalten',{exact:false}).check();
 await remove.click();
 await expect(card).toHaveCount(0);
 await expect(page.getByTestId('official-credits')).toHaveText('60 / 210');
});

test('a second repeat is only a reminder until its semester based on PDF publication',async({page})=>{
 await show(page,{...failed,exam_history:[exam,{...exam,attempt:2}]},'repeat-later');
 await expect(page.getByLabel('Module in aktuelles Semester ziehen').getByRole('button')).toHaveCount(0);
 await expect(page.getByText(/Wiederholung ist für SoSe 2027 vorgesehen/)).toBeVisible();
});

test('a missing publication date remains unknown and never asks the student to enter dates',async({page})=>{
 await show(page,{...failed,exam_history:[{...exam,released_on:null}]},'repeat-unknown');
 const target=page.getByLabel('Module in aktuelles Semester ziehen');
 await expect(target.getByRole('button')).toHaveCount(0);
 await page.getByRole('button',{name:'Statistik: Nicht bestanden',exact:true}).click();
 const dialog=page.getByRole('dialog');
 await expect(dialog).toContainText('Semester der Wiederholung prüfen');
 await expect(dialog.locator('input[type="date"]')).toHaveCount(0);
 await dialog.locator('summary').filter({hasText:'Informationen zur Wiederholung'}).click();
 await expect(dialog).toContainText('Das Veröffentlichungsdatum fehlt');
});

test('no current lecture keeps an orange repeat and explains postponement without automatically approving it',async({page})=>{
 await show(page,{...failed,semester_offered:false},'repeat-no-course');
 await expect(page.locator('[data-module-id="wi.req.statistik"]')).toHaveClass(/bg-orange-50/);
 await page.getByRole('button',{name:'Statistik: Nicht bestanden',exact:true}).click();
 const dialog=page.getByRole('dialog');
 await dialog.locator('summary').filter({hasText:'Verschiebung & Entfernen aus dem Semester'}).click();
 await expect(dialog).toContainText('das fehlende Lehrangebot allein ist keine Bestätigung');
 await expect(dialog.getByRole('button',{name:'Aus aktuellem Semester entfernen'})).toBeDisabled();
});

test('FWPM drag explains both required decisions before it can enter the semester',async({page})=>{
 const m={...failed,id:'wi.req.fwpm1',title:'Fachbezogenes Wahlpflichtmodul 1',short_title:'FWPM 1',grade:null,status:'unknown',open_exam_count:0,exam_history:[],requires_course_selection:true,completion_rule:'catalog',course_options:[{id:'security',title:'Applied Security',short_title:'DASE',course:{offered:true}}],details:{completion_rule:'catalog'}};
 await show(page,m,'open');
 await page.getByRole('button',{name:'Fachbezogenes Wahlpflichtmodul 1: Offen',exact:true}).dragTo(page.getByLabel('Module in aktuelles Semester ziehen'));
 const dialog=page.getByRole('dialog');
 await expect(dialog).toContainText('Wähle zuerst deine Disziplin aus und bestätige deinen Platz.');
 const add=dialog.getByRole('button',{name:'Zum aktuellen Semester hinzufügen'});
 await expect(add).toBeDisabled();
 await dialog.getByLabel('FWPM-Disziplin auswählen').selectOption('security');
 await expect(add).toBeDisabled();
 await dialog.getByLabel('Ich habe für diese Disziplin einen Platz / eine Teilnahmebestätigung.').check();
 await expect(add).toBeEnabled();
});

test('AW parts can be planned across semesters; ECTS and removal track the chosen part',async({page})=>{
 const m={...failed,id:'wi.req.aw2',title:'AW 2',short_title:'AW 2',required_ects:4,grade:null,status:'unknown',open_exam_count:0,exam_history:[],semester_offered:false,details:{grade_weight:'2',completion_rule:'all',aw_components:[{title:'AW-Modul 2',ects:2,kind:'elective'},{title:'AW-Modul 3',ects:2,kind:'elective'}]},completion_rule:'all'};
 await show(page,m,'open');
 const target=page.getByLabel('Module in aktuelles Semester ziehen');
 await page.getByRole('button',{name:'AW 2: Offen',exact:true}).dragTo(target);
 const dialog=page.getByRole('dialog'),first=dialog.getByRole('button',{name:'AW-Teilmodul 1 hinzufügen'});
 await expect(dialog).toContainText('unterschiedlichen Semestern');
 await expect(first).toBeDisabled();
 await dialog.getByLabel('AW-Kurs 1',{exact:true}).fill('Spanisch A1');await dialog.getByLabel('Platz für AW-Kurs 1 bestätigt').check();
 await expect(first).toBeEnabled();await first.click();
 await expect(page.getByTestId('semester-ects')).toHaveText('2 ECTS');
 await dialog.getByLabel('AW-Kurs 2',{exact:true}).fill('Spanisch A1');await dialog.getByLabel('Platz für AW-Kurs 2 bestätigt').check();
 await expect(dialog.getByRole('button',{name:'AW-Teilmodul 2 hinzufügen'})).toBeDisabled();
 await dialog.getByLabel('AW-Kurs 2',{exact:true}).fill('Französisch A1');await dialog.getByLabel('Platz für AW-Kurs 2 bestätigt').check();
 await dialog.getByRole('button',{name:'AW-Teilmodul 2 hinzufügen'}).click();
 await page.getByRole('button',{name:'Details schließen'}).click();
 await expect(target.getByRole('button',{name:/^Spanisch A1 2 ECTS/})).toBeVisible();
 await expect(target.getByRole('button',{name:/^Französisch A1 2 ECTS/})).toBeVisible();
 await expect(page.getByTestId('semester-ects')).toHaveText('4 ECTS');
 await target.getByRole('button',{name:'Spanisch A1 aus Semester entfernen',exact:true}).click();
 await expect(target.getByRole('button',{name:/^Spanisch A1 2 ECTS/})).toHaveCount(0);
 await expect(page.getByTestId('semester-ects')).toHaveText('2 ECTS');
 await page.reload();
 await expect(target.getByRole('button',{name:/^Französisch A1 2 ECTS/})).toBeVisible();
 await target.getByRole('button',{name:/^Französisch A1 2 ECTS/}).click();
 await expect(dialog.getByRole('heading',{name:'Französisch A1',exact:true})).toBeVisible();
 await expect(dialog).toContainText('Gewicht des Gesamtmoduls');
 await dialog.getByLabel('Notizen',{exact:true}).fill('Nur für diesen Kurs');
 await dialog.getByRole('button',{name:'Kursangaben speichern'}).click();
 await page.getByRole('button',{name:'Details schließen'}).click();
 await page.getByRole('button',{name:'AW 2: Offen',exact:true}).click();
 await expect(dialog.getByLabel('AW-Kurs 1',{exact:true})).toHaveValue('Spanisch A1');
 await expect(dialog.getByLabel('Platz für AW-Kurs 2 bestätigt')).toBeChecked();
 await expect(page.getByTestId('official-credits')).toHaveText('60 / 210');
});

test('a closed stage explains prerequisites before checking seasonal course availability',async({page})=>{
 await show(page,{...failed,status:'unknown',grade:null,exam_history:[],open_exam_count:0,semester_offered:false,admission:{status:'unknown',reason:'Abschnitt 2 benötigt 30 ECTS aus Abschnitt 1. Bestätigt: 15 ECTS. Es fehlen noch 15 ECTS.'}},'first');
 await page.getByRole('button',{name:'Statistik: Offen',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Es fehlen noch 15 ECTS');
 await expect(page.getByRole('dialog')).not.toContainText('Kein bestätigtes Semesterangebot');
});

test('approved deferral does not carry to another attempt or another semester and never mutates results',async({page})=>{
 let attempt=1;
 await show(page,failed);
 await page.route('**/api/programs/wi/examples/*',r=>r.fulfill({json:{import_id:null,program:'Wirtschaftsinformatik',supported:true,official_grade:2.7,official_credits:60,curriculum_edition:'wi_bsc_2023',example_scenario:'repeat-first',unmatched_groups:[],stages:[{id:'abschnitt_2',title:'Abschnitt 2',modules:[{...failed,exam_history:[{...exam,attempt,released_on:'01.02.2026'}]}]}]}}));
 await page.reload();
 const target=page.getByLabel('Module in aktuelles Semester ziehen'),card=target.getByRole('button',{name:/^Statistik Prüfungswiederholung/});
 async function approveAndRemove(){
  await card.click();
  await page.getByRole('dialog').locator('summary').filter({hasText:'Verschiebung & Entfernen aus dem Semester'}).click();
  await page.getByLabel('Ich habe die Bestätigung erhalten',{exact:false}).check();
  await page.getByRole('button',{name:'Aus aktuellem Semester entfernen',exact:true}).click();
  await expect(card).toHaveCount(0);
 }
 await approveAndRemove();
 attempt=2;await page.reload();
 await expect(card).toBeVisible();
 await expect(target.getByRole('button',{name:'Statistik aus Semester entfernen',exact:true})).toBeDisabled();
 await approveAndRemove();
 await page.clock.setFixedTime(new Date('2027-04-01T10:00:00Z'));await page.reload();
 await expect(card).toBeVisible();
 await expect(target.getByRole('button',{name:'Statistik aus Semester entfernen',exact:true})).toBeDisabled();
 await expect(page.getByTestId('official-credits')).toHaveText('60 / 210');
});


test('statistics returns immediately and after reload when an exemption is revoked from Abschnitt',async({page})=>{
 await show(page,failed);
 const target=page.getByLabel('Module in aktuelles Semester ziehen');
 const overview=page.getByRole('button',{name:'Statistik: Nicht bestanden',exact:true});
 await overview.click();
 const dialog=page.getByRole('dialog');
 const summary=dialog.locator('summary').filter({hasText:'Verschiebung & Entfernen aus dem Semester'});
 await summary.click();
 await dialog.getByLabel('Ich habe die Bestätigung erhalten',{exact:false}).check();
 await page.getByRole('button',{name:'Details schließen'}).click();
 await target.getByRole('button',{name:'Statistik aus Semester entfernen',exact:true}).click();
 await page.reload();
 await expect(target.getByRole('button',{name:/^Statistik Prüfungswiederholung/})).toHaveCount(0);
 await overview.click();await summary.click();
 await dialog.getByLabel('Ich habe die Bestätigung erhalten',{exact:false}).uncheck();
 await expect(dialog.getByRole('status').filter({hasText:'wieder im aktuellen Semester eingeplant'})).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Zum aktuellen Semester hinzufügen',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Details schließen'}).click();
 await expect(target.getByRole('button',{name:/^Statistik Prüfungswiederholung/})).toBeVisible();
 await expect(target.getByRole('button',{name:'Statistik aus Semester entfernen',exact:true})).toBeDisabled();
 await expect(target).toContainText('Pflichtwiederholung wieder im aktuellen Semester eingeplant.');
 await expect(target).not.toContainText('Aus dem Semesterplan entfernt.');
 await page.reload();
 await expect(target.getByRole('button',{name:/^Statistik Prüfungswiederholung/})).toBeVisible();
});

test('approved postponement keeps an open-module action both before and after voluntary planning',async({page})=>{
 await show(page,failed);const dialog=page.getByRole('dialog');
 await page.getByLabel('Module in aktuelles Semester ziehen').getByRole('button',{name:/^Statistik Prüfungswiederholung/}).click();
 await dialog.locator('summary').filter({hasText:'Verschiebung & Entfernen aus dem Semester'}).click();await dialog.getByLabel('Ich habe die Bestätigung erhalten',{exact:false}).check();await dialog.getByRole('button',{name:'Aus aktuellem Semester entfernen',exact:true}).click();
 const note=page.getByText('Bestätigte Verschiebung für dieses Semester hinterlegt.',{exact:true}).locator('..');
 await note.getByRole('button',{name:'Modul ansehen',exact:true}).click();await expect(dialog.getByRole('heading',{name:'Statistik',exact:true})).toBeVisible();
 await dialog.getByRole('button',{name:'Zum aktuellen Semester hinzufügen',exact:true}).click();await page.getByRole('button',{name:'Details schließen'}).click();
 const voluntary=page.getByText('Bestätigte Verschiebung für dieses Semester hinterlegt. Das Modul ist trotzdem freiwillig eingeplant.',{exact:true});await expect(voluntary).toBeVisible();
 await voluntary.locator('..').getByRole('button',{name:'Modul ansehen',exact:true}).click();await expect(dialog.getByRole('heading',{name:'Statistik',exact:true})).toBeVisible();
});
