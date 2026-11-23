import { test, expect } from './fixtures';
const history = [
  { code:'4710050',short_code:'PG1',title:'Programmieren 1',attempt:1,grade:5,ects:0,status:'NB',released_on:null,page:1 },
  { code:'4710050',short_code:'PG1',title:'Programmieren 1',attempt:2,grade:3.7,ects:8,status:'BE',released_on:'12.02.2026',page:1 },
];
const module = { id:'wi.req.pg1',title:'Programmieren 1',short_title:'PG1',required_ects:8,actual_ects:8,grade:'3.7',status:'passed',source:{requirement_title:'Programmieren 1',requirement_meta:{ects:8,grade_val:'3.7'},subs:[]},details:{description:'Ausführliche Beschreibung des Lehrangebots. '.repeat(100)},exam_history:history,open_exam_count:0 };
const dashboard = { import_id:1,program:'Wirtschaftsinformatik',supported:true,official_grade:3.7,official_credits:8,spo_version:'Test SPO',stages:[{id:'abschnitt_1',title:'Abschnitt 1',modules:[module]}],unmatched_groups:[],import_report:{format:'hisinone_leistungen',module_count:1,attempt_count:2,open_exam_count:0,historical_failure_count:1,warnings:[]} };
async function openImport(page:any, data=dashboard) {
  await page.route('**/api/imports', (r:any)=>r.fulfill({json:[{id:1,status:'success'}]}));
  await page.route('**/api/imports/1/dashboard*',(r:any)=>r.fulfill({json:data}));
  await page.goto('/?preview=dashboard');
  await expect(page.getByTestId('official-credits')).toBeVisible();
}

test('passed module shows attempt history without an open retake recommendation',async({page})=>{
  await openImport(page);
  await expect(page.getByRole('region',{name:'Importprüfung'})).toHaveCount(0);
  await expect(page.getByText('Durchschnittsnote',{exact:true})).toBeVisible();
  await expect(page.getByText(/Offene negative Ergebnisse bei/)).toHaveCount(0);
  await page.getByRole('button',{name:'Programmieren 1: Bestanden',exact:true}).click();
  await page.getByRole('dialog').locator('summary').filter({hasText:'Details aus HISinOne'}).click();
  const attempts=page.getByRole('region',{name:'Prüfungsversuche'});
  await expect(attempts.getByRole('row')).toHaveCount(3);
  await expect(attempts).toBeInViewport();
  await expect(page.getByRole('dialog')).not.toContainText('Beschreibung aus dem Modulhandbuch');
  await expect(attempts).toContainText('Das Modul ist abgeschlossen');
  await expect(attempts).toContainText('Nicht bestanden');
  await expect(attempts).toContainText('12.02.2026');
  await expect(page.getByRole('dialog').getByRole('button',{name:'Zum aktuellen Semester hinzufügen'})).toHaveCount(0);
  await page.screenshot({path:'test-results/leistungen-attempt-history.png',fullPage:true});
});

test('invalid export leaves the current imported dashboard available',async({page})=>{
  await openImport(page);
  await page.route('**/api/imports/upload',r=>r.fulfill({status:422,json:{detail:{message:'Die ECTS-Summe stimmt nicht überein. Bitte Alle aufklappen und die PDF erneut drucken.',code:'incomplete_export'}}}));
  await page.getByLabel('Leistungen PDF aktualisieren').setInputFiles({name:'Leistungen.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 incomplete')});
  await expect(page.getByRole('alert')).toContainText('Bitte Alle aufklappen');
  await expect(page.getByTestId('official-credits')).toHaveText('8 / 210');
  await expect(page.getByRole('button',{name:'Programmieren 1: Bestanden',exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/leistungen-reexport.png',fullPage:true});
});

test('only a current negative result creates an action suggestion',async({page})=>{
  const current={...dashboard,official_grade:null,official_credits:0,stages:[{id:'abschnitt_1',title:'Abschnitt 1',modules:[{...module,status:'failed',grade:'5.0',actual_ects:0,open_exam_count:1,exam_history:[history[0]]}]}],import_report:{...dashboard.import_report,open_exam_count:1,attempt_count:1}};
  await openImport(page,current as any);
  await expect(page.getByText('Das Veröffentlichungsdatum fehlt. HISinOne kann hier helfen, den Wiederholungsstatus zu klären.',{exact:false})).toBeVisible();
  await expect(page.getByTestId('official-grade')).toHaveText('—');
  await page.getByRole('button',{name:'Programmieren 1: Nicht bestanden',exact:true}).click();
  await page.getByRole('dialog').locator('summary').filter({hasText:'Details aus HISinOne'}).click();
  await expect(page.getByRole('region',{name:'Prüfungsversuche'})).toContainText('Prüfungsanmeldung bitte in HISinOne prüfen');
});

for (const [instant,term] of [
  ['2027-03-14T22:59:00Z','WiSe 2026/27'],['2027-03-14T23:00:00Z','SoSe 2027'],
  ['2027-09-30T21:59:00Z','SoSe 2027'],['2027-09-30T22:00:00Z','WiSe 2027/28'],
]) test(`semester follows Berlin time at ${instant}`,async({page})=>{
  await page.clock.setFixedTime(new Date(instant));
  await page.route('**/api/imports',r=>r.fulfill({json:[]}));
  await page.goto('/?preview=welcome');
  await expect(page.getByTestId('current-semester')).toHaveText(term);
  await expect(page.getByLabel('Studienbeginn',{exact:true}).locator('option').nth(1)).toHaveText(term);
});
