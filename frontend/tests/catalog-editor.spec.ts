import { test, expect } from '@playwright/test';
const admin = { id: 2, name: 'Admin', email: 'admin@example.org', role: 'admin' };
const core = { digest: 'a'.repeat(64), url: '/api/programs/wi/handbooks/' + 'a'.repeat(64) + '.pdf', kind: 'core', edition_id: 'wi_bsc_2026', term: 'WiSe 2026/27', created_on: '05.10.2026', course_count: 30 };
const fwpm = { digest: 'b'.repeat(64), url: '/api/programs/wi/handbooks/' + 'b'.repeat(64) + '.pdf', kind: 'fwpm', edition_id: null, term: 'SoSe 2027', created_on: '01.03.2027', course_count: 12 };
const ad = { id: 'wi.course.algorithmen', title: 'Algorithmen und Datenstrukturen', short_title: 'AD', ects: 5, kind: 'course', frequency: 'summer', frequency_label: 'Sommersemester', pages: { start: 41, end: 42 }, document_url: core.url, slots: [] };
const date = { id: 'wi.fwpm.date', title: 'Data Engineering', short_title: 'DATE', ects: 5, kind: 'elective', frequency: 'irregular', frequency_label: 'Unregelmäßiges Angebot', pages: { start: 28, end: 29 }, document_url: fwpm.url, slots: ['wi.req.fwpm2', 'wi.req.fwpm3'], iw_mark: 'X' };
const course = { offered: true, elo: 'https://example.org/existing-elo', webuntis: '', schedule: 'Old copied time', room: 'Old copied room', meetings: [{ weekday: 1, start: '08:15', end: '09:45', room: 'Old copied room', group: '' }], handbook_pages: null };
const report = (status = 'ready', found = 1) => ({ status, found, fetched_at: '2026-10-19T12:00:00Z', warnings: [], source_urls: [], missing: [], unmatched: [] });
async function setup(page: any, overrides: any = {}, openEditor = true) {
  const value = { program_id: 'wi_bsc_2023', revision: 'initial', program: { name: 'Wirtschaftsinformatik B.Sc.', spo_version: 'SPO' }, documents: [core, fwpm], semesters: { 'SoSe 2027': { status: 'draft', handbook: { url: null, label: 'Modulhandbuch' }, modules: { [ad.id]: course } } }, semester_catalogs: {}, ...overrides };
  await page.route('**/api/auth/me', (route: any) => route.fulfill({ json: admin }));
  await page.route('**/api/programs/wi/catalog', (route: any) => route.fulfill({ json: value }));
  await page.route('**/api/admin/programs/wi/prepare', (route: any) => route.fulfill({ json: { term: 'SoSe 2027', catalog: { courses: { [ad.id]: ad, [date.id]: date }, module_groups:[{id:'wi.req.algorithmen',title:ad.title,short_title:'AD',stage_id:'abschnitt_2',completion_rule:'single',teilmodule_ids:[ad.id]},{id:'wi.req.fwpm23',title:'Fachbezogene Wahlpflichtmodule 2 / 3',short_title:'FWPM 2 / 3',stage_id:'abschnitt_3',completion_rule:'catalog',teilmodule_ids:[date.id]}], pending: [], warnings: [] }, modules: { [ad.id]: { offered: true, handbook_pages: ad.pages }, [date.id]: { offered: true, handbook_kind: 'fwpm', handbook_pages: date.pages } }, handbook: { url: null, label: 'Modulhandbuch' }, core_handbooks: { wi_bsc_2026: { url: core.url, label: 'Stand 05.10.2026' } }, fwpm_handbook: { url: fwpm.url, label: 'FWPM SoSe 2027' } } }));
  await page.route('**/api/admin/programs/wi/fwpm-proposal*', (route: any) => route.fulfill({ json:{term:'SoSe 2027',courses:[{...date,offered:true,confirmed:true,source_term:'SoSe 2027',source_url:fwpm.url,description:''}]} }));
  await page.goto('/');
  if (openEditor) await page.getByRole('button',{name:'SoSe 2027 bearbeiten',exact:true}).click();
  return value;
}
async function toCatalog(page: any) {
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await page.getByLabel('Dieses FWPM-Angebot für SoSe 2027 bestätigen.').check();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Termine & veröffentlichen', exact: true })).toBeVisible();
}

test('wizard prepares a source-owned seasonal catalog and publishes only after review', async ({ page }) => {
  await setup(page);
  let saved: any;
  await page.route('**/api/admin/programs/wi/catalog', route => { saved = route.request().postDataJSON(); return route.fulfill({ json: { revision: 'saved' } }); });
  await expect(page.getByRole('heading', { name: 'Semester vorbereiten' })).toBeVisible();
  await toCatalog(page);
  await expect(page.getByText('Old copied time')).toHaveCount(0);
  await expect(page.getByText('Old copied room')).toHaveCount(0);
  await expect(page.getByLabel('ELO-Kurslink')).toHaveCount(0);
  await expect(page.getByLabel('Semesterangebot')).toHaveCount(0);
  await expect(page.getByLabel('Modulhandbuch-SPO')).toHaveCount(0);
  await expect(page.getByLabel('PDF-Seite von')).toHaveCount(0);
  await expect(page.getByRole('navigation', {name:'Vorbereitungsschritte'}).locator(':scope > div')).toHaveCount(3);
  await page.route('**/api/admin/programs/wi/import/dates', route => route.fulfill({ json: { term: 'SoSe 2027', report: report(), calendar: { lectures: { label: 'Lehrveranstaltungen', start: '2027-03-15', end: '2027-07-09' }, breaks: [{ label: 'Pause', start: '2027-05-25', end: '2027-05-28' }] } } }));
  await page.route('**/api/admin/programs/wi/import/schedule', route => {
    expect(route.request().postDataJSON().preparation.core_documents).toEqual([core.digest]);
    return route.fulfill({ json: { term: 'SoSe 2027', report: report(), modules: { [ad.id]: { offered: true, meetings: [{ weekday: 2, start: '10:00', end: '11:30', room: 'K014', group: 'IW4', teachers: ['Test Professor'] }, { weekday: 4, start: '14:15', end: '15:45', room: 'D201', group: 'IW4 / Übung', teachers: ['Other Professor'] }] } } } });
  });
  await page.getByRole('button', { name: 'OTH-Termine abrufen' }).click();
  await expect(page.getByText('Lehrveranstaltungen: 2027-03-15 – 2027-07-09')).toBeVisible();
  await page.getByRole('button', { name: 'B.O.S.S.-Stundenplan abrufen' }).click();
  await page.getByText(ad.title, { exact: true }).click();
  await page.getByTestId('meeting-variant').filter({hasText:'Test Professor'}).locator(':scope > summary').click();
  await page.getByTestId('meeting-variant').filter({hasText:'Other Professor'}).locator(':scope > summary').click();
  await expect(page.getByText('Dienstag 10:00–11:30 · K014')).toBeVisible();
  await expect(page.getByText('IW4 · Test Professor')).toBeVisible();
  await expect(page.getByText('Donnerstag 14:15–15:45 · D201')).toBeVisible();
  await expect(page.getByText('Raum: K014; D201')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/wizard-sources.png', fullPage: true });
  const publish = page.getByRole('button', { name: 'Semester veröffentlichen' });
  await expect(publish).toBeDisabled();
  await page.getByLabel('Verfügbare Daten für SoSe 2027 veröffentlichen. Fehlende Quellen können später ergänzt werden.').check();
  await publish.click();
  await expect(page.getByRole('heading',{name:'Semesterübersicht',exact:true})).toBeVisible();
  await expect(page.getByRole('row').filter({hasText:'SoSe 2027'})).toContainText('Veröffentlicht');
  await expect(page.getByRole('status')).toContainText('SoSe 2027 veröffentlicht');
  expect(saved.semesters['SoSe 2027'].modules[ad.id].elo).toBe(course.elo);
  expect(saved.semesters['SoSe 2027'].modules[ad.id].room).toBe('K014; D201');
  expect(saved.semesters['SoSe 2027'].preparation.confirmed).toBe(true);
  expect(saved.semesters['SoSe 2027'].modules[ad.id].ects).toBeUndefined();
});

test('unavailable or wrong-semester sources do not overwrite already loaded current data', async ({ page }) => {
  await setup(page);
  await toCatalog(page);
  await page.route('**/api/admin/programs/wi/import/dates', route => route.fulfill({ json: { term: 'SoSe 2027', report: report(), calendar: { lectures: { label: 'Lehre', start: '2027-03-15', end: '2027-07-09' } } } }));
  await page.getByRole('button', { name: 'OTH-Termine abrufen' }).click();
  await page.route('**/api/admin/programs/wi/import/dates', route => route.fulfill({ json: { term: 'SoSe 2027', report: report('unavailable', 0), calendar: { lectures: { start: '2026-03-15', end: '2026-07-09' } } } }));
  await page.getByRole('button', { name: 'OTH-Termine abrufen' }).click();
  await expect(page.getByText('Keine aktuellen Daten verfügbar', { exact: false })).toBeVisible();
  await expect(page.getByText('Lehrveranstaltungen: 2027-03-15 – 2027-07-09')).toBeVisible();
  await page.route('**/api/admin/programs/wi/import/schedule', route => route.fulfill({ json: { term: 'SoSe 2026', report: report(), modules: { [ad.id]: { room: 'Old room' } } } }));
  await page.getByRole('button', { name: 'B.O.S.S.-Stundenplan abrufen' }).click();
  await expect(page.getByRole('status')).toContainText('anderen Semester');
  await expect(page.getByText('Old room')).toHaveCount(0);
});

test('FWPM PDF suggestions remain editable and one overall confirmation prepares them', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', {name:'Weiter',exact:true}).click();
  await page.getByRole('button',{name:'Liste bearbeiten'}).click();
  await page.route('**/api/admin/programs/wi/fwpm-pdf?*', route => route.fulfill({json:{term:'SoSe 2027',document:fwpm,courses:[{...date,title:'Updated Data Engineering',offered:true,confirmed:false,source_term:'SoSe 2027',source_url:fwpm.url,description:''}]}}));
  await page.getByText('Vorschläge aus FWPM-Modulhandbuch importieren').click();
  await page.getByLabel('FWPM-PDF',{exact:true}).setInputFiles({name:'fwpm.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-test')});
  await expect(page.getByText('Updated Data Engineering',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Änderungen übernehmen'}).click();
  await expect(page.getByRole('button',{name:'Weiter',exact:true})).toBeDisabled();
  await expect(page.getByLabel('FWPM Eintrag bestätigt')).toHaveCount(0);
  let selection:any;
  page.on('request',r=>{if(r.url().endsWith('/prepare'))selection=r.postDataJSON().preparation;});
  await page.getByLabel('Dieses FWPM-Angebot für SoSe 2027 bestätigen.').check();
  await page.getByRole('button',{name:'Weiter',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Termine & veröffentlichen',exact:true})).toBeVisible();
  expect(selection.fwpm_courses[0].confirmed).toBe(true);
  expect(selection.fwpm_document).toBe(fwpm.digest);
});

test('student role never opens the semester wizard', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 1, name: 'Student', role: 'student' } }));
  await page.route('**/api/imports', route => route.fulfill({ json: [] }));
  await page.goto('/?admin=true');
  await expect(page.getByRole('heading', { name: 'Semester vorbereiten' })).toHaveCount(0);
});

test('read-only curriculum and module pages are absent', async ({ page }) => {
  await setup(page, { documents: [{ ...core, digest: 'c'.repeat(64), edition_id: 'wi_bsc_2023', created_on: '09.10.2026' }, core, { ...core, digest: 'd'.repeat(64), edition_id: 'wi_bsc_2012' }, fwpm] });
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await expect(page.getByRole('heading',{name:'FWPM-Angebot',exact:true})).toBeVisible();
  await expect(page.getByRole('navigation')).not.toContainText('Studienprogramm');
  await expect(page.getByRole('navigation')).not.toContainText('Module & Teilmodule');
  await expect(page.getByLabel('Pflichtprogramm-PDF')).toHaveCount(0);
});


test('source meetings are collapsed by variant and teacher with shared module warning', async ({page})=>{
 await setup(page);await toCatalog(page);
 await page.route('**/api/admin/programs/wi/import/schedule',r=>r.fulfill({json:{term:'SoSe 2027',report:report(),modules:{[ad.id]:{meetings:[{weekday:1,start:'08:15',end:'09:45',room:'K001',group:'IW3',teachers:['Professor A'],source_code:'PM',source_color:'#ffffff',shared_with:['part1','part2']},{weekday:2,start:'10:00',end:'11:30',room:'K002',group:'IW4',teachers:['Professor B'],source_code:'PM',source_color:'#00ffff',shared_with:['part1','part2']}]}}}}));
 await page.getByRole('button',{name:'B.O.S.S.-Stundenplan abrufen'}).click();
 await page.getByText(ad.title,{exact:true}).click();
 await expect(page.getByText('BOSS führt diese Termine gemeinsam',{exact:false})).toBeVisible();
 await expect(page.getByText('Montag 08:15–09:45 · K001')).not.toBeVisible();
 await page.getByText('Variante 1 · Professor A · K001 · 1 Termin',{exact:true}).click();
 await expect(page.getByText('Montag 08:15–09:45 · K001')).toBeVisible();
 await expect(page.getByText('Dienstag 10:00–11:30 · K002')).not.toBeVisible();
 await page.screenshot({path:'test-results/schedule-groups.png',fullPage:true});
});

test('BOSS result groups modules in three Abschnitt columns without routine source comments', async ({page})=>{
 await setup(page);
 const foundation={...ad,id:'wi.course.bwl2_grundlagen',title:'2.1 Grundlagen der Betriebswirtschaftslehre 2'};
 const caseStudy={...ad,id:'wi.course.bwl2_fallstudie',title:'2.2 Fallstudie in der Betriebswirtschaftslehre'};
 const groups=[
  {id:'wi.req.bwl2',title:'Betriebswirtschaftslehre 2',short_title:'BWL2',stage_id:'abschnitt_1',completion_rule:'all',teilmodule_ids:[foundation.id,caseStudy.id]},
  {id:'wi.req.algorithmen',title:ad.title,short_title:'AD',stage_id:'abschnitt_2',completion_rule:'single',teilmodule_ids:[ad.id]},
  {id:'wi.req.fwpm1',title:'Fachbezogenes Wahlpflichtmodul 1',short_title:'FWPM 1',stage_id:'abschnitt_2',completion_rule:'catalog',teilmodule_ids:[date.id]},
  {id:'wi.req.fwpm23',title:'Fachbezogene Wahlpflichtmodule 2 / 3',short_title:'FWPM 2 / 3',stage_id:'abschnitt_3',completion_rule:'catalog',teilmodule_ids:[date.id]},
 ];
 const courses=Object.fromEntries([foundation,caseStudy,ad,date].map(c=>[c.id,c]));
 await page.route('**/api/admin/programs/wi/prepare',r=>r.fulfill({json:{term:'SoSe 2027',catalog:{courses,module_groups:groups,pending:[],warnings:[]},modules:Object.fromEntries(Object.keys(courses).map(id=>[id,{offered:true}])),handbook:{url:null,label:'Modulhandbuch'},core_handbooks:{},fwpm_handbook:{url:fwpm.url,label:'FWPM'}}}));
 await toCatalog(page);
 const warnings=['FWPM-Termine können aus dem anbietenden Studiengang stammen.','Gemeinsamer Stundenplan je Modul: BW2, PM.','AW und FWPM-Platzhalter haben keinen eigenen Stundenplan.','Blocktermine / wechselnde Wochen separat prüfen: BW 2.1'];
 const meeting={weekday:2,start:'10:00',end:'11:30',room:'K014',group:'IW2',teachers:['Test Professor']};
 await page.route('**/api/admin/programs/wi/import/schedule',r=>r.fulfill({json:{term:'SoSe 2027',report:{...report('ready',4),warnings},modules:Object.fromEntries(Object.keys(courses).map(id=>[id,{meetings:[meeting]}]))}}));
 await page.getByRole('button',{name:'B.O.S.S.-Stundenplan abrufen'}).click();
 await expect(page.getByText('4 Disziplinen gefunden',{exact:true})).toBeVisible();
 for(const warning of warnings)await expect(page.getByText(warning,{exact:true})).toHaveCount(0);
 const columns=[1,2,3].map(n=>page.getByRole('region',{name:`Stundenplan Abschnitt ${n}`,exact:true}));
 for(const col of columns)await expect(col).toBeVisible();
 const boxes=await Promise.all(columns.map(col=>col.boundingBox()));
 expect(boxes[0]!.x).toBeLessThan(boxes[1]!.x);expect(boxes[1]!.x).toBeLessThan(boxes[2]!.x);
 expect(boxes[0]!.y).toBe(boxes[2]!.y);
 const bw=page.getByTestId('schedule-module-wi.req.bwl2');
 await expect(bw.locator(':scope > summary')).toHaveText('Betriebswirtschaftslehre 2');
 await expect(bw.getByText(foundation.title,{exact:true})).not.toBeVisible();
 await bw.locator(':scope > summary').click();
 await bw.getByText(foundation.title,{exact:true}).click();
 await bw.getByTestId('meeting-variant').first().locator(':scope > summary').click();
 await expect(bw.getByText('Dienstag 10:00–11:30 · K014').first()).toBeVisible();
 await expect(bw.getByText(caseStudy.title,{exact:true})).toBeVisible();
 const pool=page.getByTestId('schedule-module-wi.req.fwpm1');
 await expect(pool.getByText(date.title,{exact:true})).not.toBeVisible();
 await pool.locator(':scope > summary').click();await pool.getByText(date.title,{exact:true}).click();
 await pool.getByTestId('meeting-variant').locator(':scope > summary').click();
 await expect(pool.getByText('Dienstag 10:00–11:30 · K014')).toBeVisible();
 await expect(page.getByRole('group',{name:'Stundenplan nach Studienabschnitt'}).getByRole('textbox')).toHaveCount(0);
 await page.screenshot({path:'test-results/schedule-abschnitte.png',fullPage:true});
});

test('saved timetable is hidden until explicitly opened or freshly imported',async({page})=>{
 const saved={status:'draft',handbook:{url:null,label:'Modulhandbuch'},imports:{schedule:report()},modules:{[ad.id]:{...course,source_term:'SoSe 2027'}}};
 await setup(page,{semesters:{'SoSe 2027':saved},semester_catalogs:{'SoSe 2027':{courses:{[ad.id]:ad},pending:[],warnings:[]}}});
 let calls=0;
 await page.route('**/api/admin/programs/wi/import/schedule',r=>{calls++;return r.fulfill({json:{term:'SoSe 2027',report:report(),modules:{[ad.id]:{meetings:[{weekday:3,start:'10:00',end:'11:30',room:'New room',group:'IW4'}]}}}});});
 await toCatalog(page);
 await expect(page.getByText('Gespeicherter Stundenplan vorhanden.',{exact:false})).toBeVisible();
 await expect(page.getByRole('group',{name:'Stundenplan nach Studienabschnitt'})).toHaveCount(0);
 await expect(page.getByText('1 Disziplinen gefunden',{exact:true})).toHaveCount(0);
 expect(calls).toBe(0);
 await page.getByRole('button',{name:'Gespeicherten Stundenplan anzeigen'}).click();
 await expect(page.getByRole('group',{name:'Stundenplan nach Studienabschnitt'})).toBeVisible();
 await expect(page.getByText('Gespeicherter Stundenplan · 1 Disziplinen',{exact:true})).toBeVisible();
 expect(calls).toBe(0);
 await page.getByRole('button',{name:'B.O.S.S.-Stundenplan abrufen'}).click();
 await expect(page.getByText('1 Disziplinen gefunden',{exact:true})).toBeVisible();expect(calls).toBe(1);
 await page.getByText(ad.title,{exact:true}).click();
 await expect(page.getByText('Mittwoch 10:00–11:30 · New room',{exact:true})).toBeVisible();
 await expect(page.getByText('Old copied room',{exact:true})).toHaveCount(0);
 await page.route('**/api/admin/programs/wi/import/schedule',r=>r.abort());
 await page.getByRole('button',{name:'B.O.S.S.-Stundenplan abrufen'}).click();
 await expect(page.getByRole('button',{name:'Gespeicherten Stundenplan anzeigen'})).toBeVisible();
 await expect(page.getByText('1 Disziplinen gefunden',{exact:true})).toHaveCount(0);
 await page.route('**/api/admin/programs/wi/import/schedule',r=>r.fulfill({json:{term:'SoSe 2027',report:report('unavailable',0)}}));
 await page.getByRole('button',{name:'B.O.S.S.-Stundenplan abrufen'}).click();
 await expect(page.getByText('Keine aktuellen Daten verfügbar',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Gespeicherten Stundenplan anzeigen'}).click();
 await expect(page.getByText('Mittwoch 10:00–11:30 · New room',{exact:true})).not.toBeVisible();
 await page.getByText(ad.title,{exact:true}).click();
 await expect(page.getByText('Mittwoch 10:00–11:30 · New room',{exact:true})).toBeVisible();
});

test('Vertiefungsmodul expands its Teilmodul with three independent neutral teacher variants',async({page})=>{
 await setup(page);
 const pj={...ad,id:'wi.course.pj',title:'Projektstudium',short_title:'PJ'};
 const groups=[{id:'wi.req.vertiefung_iw2',title:'Vertiefungsmodul IW 2',short_title:'IW 2',stage_id:'abschnitt_3',completion_rule:'single',teilmodule_ids:[pj.id]}];
 await page.route('**/api/admin/programs/wi/prepare',r=>r.fulfill({json:{term:'SoSe 2027',catalog:{courses:{[pj.id]:pj},module_groups:groups,pending:[],warnings:[]},modules:{[pj.id]:{offered:true}},handbook:{url:null,label:'Modulhandbuch'},core_handbooks:{},fwpm_handbook:{url:null,label:'FWPM'}}}));
 await toCatalog(page);
 const base={weekday:1,start:'10:00',end:'11:30',group:'IW6',source_code:'PJ'};
 const meetings=[
  {...base,room:'K018',teachers:['Thomas Wölfl'],source_group:'[1]',teaching_type:'exercise',type_source:'directory',source_color:'#ffffff'},
  {...base,room:'',teachers:['Frank Herrmann'],source_group:'[2]',teaching_type:'practical_or_seminar',type_source:'color',source_color:'#f09fe0',room_assignment:'unresolved',room_candidates:['P123','P125']},
  {...base,room:'',teachers:['Rudolf Hackenberg'],source_group:'[3]',teaching_type:'practical_or_seminar',type_source:'color',source_color:'#f09fe0',room_assignment:'unresolved',room_candidates:['P123','P125']},
 ];
 await page.route('**/api/admin/programs/wi/import/schedule',r=>r.fulfill({json:{term:'SoSe 2027',report:report(),modules:{[pj.id]:{meetings}}}}));
 await page.getByRole('button',{name:'B.O.S.S.-Stundenplan abrufen'}).click();
 const module=page.getByTestId('schedule-module-wi.req.vertiefung_iw2');
 await module.locator(':scope > summary').click();
 await expect(module.getByText('Projektstudium',{exact:true})).toBeVisible();
 await expect(module.getByTestId('meeting-variant').first()).not.toBeVisible();
 await module.getByText('Projektstudium',{exact:true}).click();
 await expect(module.getByTestId('meeting-variant')).toHaveCount(3);
 await expect(module.getByTestId('meeting-variant').nth(0).locator('summary')).not.toContainText('Übung');
 await expect(module.getByTestId('meeting-variant').nth(0).locator('summary')).toContainText('Variante 1 · Thomas Wölfl');
 await expect(module.getByTestId('meeting-variant').nth(1).locator('summary')).not.toContainText('Farbhinweis');
 await expect(module.getByTestId('meeting-variant').nth(1).locator('summary')).toContainText('Variante 2 · Frank Herrmann');
 await expect(module.getByTestId('meeting-variant').nth(2).locator('summary')).toContainText('Variante 3 · Rudolf Hackenberg');
 await module.getByTestId('meeting-variant').nth(1).locator('summary').click();
 await expect(module.getByTestId('meeting-variant').nth(1).getByText('BOSS nennt gemeinsam: P123 / P125. Raumzuordnung für diese Gruppe offen.')).toBeVisible();
 await page.screenshot({path:'test-results/project-three-groups.png',fullPage:true});
});

test('rooms remain separate even for the same teacher and source color',async({page})=>{
 await setup(page);await toCatalog(page);
 const meeting={weekday:1,start:'10:00',end:'11:30',group:'IW4',teachers:['Same teacher'],source_color:'#00ff80',teaching_type:'exercise',type_source:'directory'};
 await page.route('**/api/admin/programs/wi/import/schedule',r=>r.fulfill({json:{term:'SoSe 2027',report:report(),modules:{[ad.id]:{meetings:[{...meeting,room:'K001'},{...meeting,room:'K002'}]}}}}));
 await page.getByRole('button',{name:'B.O.S.S.-Stundenplan abrufen'}).click();await page.getByText(ad.title,{exact:true}).click();
 const variants=page.getByTestId('schedule-module-wi.req.algorithmen').getByTestId('meeting-variant');
 await expect(variants).toHaveCount(2);
 await expect(variants.nth(0).locator('summary')).toContainText('K001');
 await expect(variants.nth(1).locator('summary')).toContainText('K002');
});

test('admin starts on semesters grouped under the study program, in ascending semester order',async({page})=>{
 await setup(page,{semesters:{'SoSe 2028':{status:'draft',handbook:{url:null,label:''},modules:{}},'WiSe 2027/28':{status:'draft',handbook:{url:null,label:''},modules:{}},'SoSe 2027':{status:'draft',handbook:{url:null,label:''},modules:{}},'WiSe 2026/27':{status:'published',handbook:{url:null,label:''},modules:{}}}},false);
 await expect(page.getByRole('heading',{name:'Semesterübersicht',exact:true})).toBeVisible();
 const program=page.getByRole('region',{name:'Wirtschaftsinformatik B.Sc.',exact:true});
 await expect(program).toBeVisible();
 const rows=program.locator('tbody tr');await expect(rows).toHaveCount(4);
 await expect(rows.nth(0)).toContainText('WiSe 2026/27');await expect(rows.nth(0)).toContainText('Veröffentlicht');
 await expect(rows.nth(1)).toContainText('SoSe 2027');await expect(rows.nth(1)).toContainText('Entwurf');
 await expect(rows.nth(2)).toContainText('WiSe 2027/28');await expect(rows.nth(3)).toContainText('SoSe 2028');
 await expect(page.getByRole('navigation',{name:'Vorbereitungsschritte'})).toHaveCount(0);
 await page.screenshot({path:'test-results/semester-overview.png',fullPage:true});
 await program.getByRole('button',{name:'WiSe 2026/27 bearbeiten'}).click();
 await expect(page.getByRole('heading',{name:'Semester vorbereiten',exact:true})).toBeVisible();
 await expect(page.getByText('Semester bearbeiten: WiSe 2026/27.',{exact:false})).toBeVisible();
 await expect(page.getByLabel('Semester',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Zur Semesterübersicht',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Semesterübersicht',exact:true})).toBeVisible();
});

test('empty state creates one draft, returns to the list, and reopens the saved proposal',async({page})=>{
 await setup(page,{semesters:{},semester_catalogs:{}},false);
 await expect(page.getByText('Noch keine Semester angelegt.',{exact:true})).toBeVisible();
 await page.screenshot({path:'test-results/semester-empty.png',fullPage:true});
 await page.getByRole('button',{name:/Semester für .* erstellen/}).click();
 await page.getByLabel('Semester',{exact:true}).selectOption('SoSe 2027');
 await page.getByRole('button',{name:'Weiter',exact:true}).click();
 let saved:any;
 await page.route('**/api/admin/programs/wi/catalog',r=>{saved=r.request().postDataJSON();return r.fulfill({json:{revision:'after-save'}});});
 await page.getByRole('button',{name:'Entwurf speichern',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Semesterübersicht',exact:true})).toBeVisible();
 await expect(page.getByRole('row').filter({hasText:'SoSe 2027'})).toContainText('Entwurf');
 expect(Object.keys(saved.semesters)).toEqual(['SoSe 2027']);
 await page.getByRole('button',{name:'SoSe 2027 bearbeiten',exact:true}).click();
 await page.getByRole('button',{name:'Weiter',exact:true}).click();
 await expect(page.getByText('Data Engineering',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Zur Semesterübersicht',exact:true}).click();
 await page.getByRole('button',{name:/Semester für .* erstellen/}).click();
 await expect(page.getByLabel('Semester',{exact:true}).locator('option[value="SoSe 2027"]')).toHaveCount(0);
});

test('returning to the list can discard a new draft and failed saves stay in the editor',async({page})=>{
 await setup(page,{semesters:{}},false);
 await page.getByRole('button',{name:/Semester für .* erstellen/}).click();
 await page.getByLabel('Semester',{exact:true}).selectOption('SoSe 2027');await page.getByRole('button',{name:'Weiter',exact:true}).click();
 await page.route('**/api/admin/programs/wi/catalog',r=>r.fulfill({status:409,json:{detail:'Der Katalog wurde inzwischen geändert.'}}));
 await page.getByRole('button',{name:'Entwurf speichern',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Semester vorbereiten',exact:true})).toBeVisible();
 await expect(page.getByRole('status')).toContainText('inzwischen geändert');
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Zur Semesterübersicht',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Semester vorbereiten',exact:true})).toBeVisible();
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Zur Semesterübersicht',exact:true}).click();
 await expect(page.getByText('Noch keine Semester angelegt.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Semester für .* erstellen/}).click();
 await expect(page.getByLabel('Semester',{exact:true}).locator('option[value="SoSe 2027"]')).toHaveCount(1);
});


test('bottom Zurück returns from the first step and guards unsaved changes',async({page})=>{
 await setup(page,{semesters:{}},false);
 await page.getByRole('button',{name:/Semester für .* erstellen/}).click();
 const back=page.getByRole('button',{name:'Zurück',exact:true});
 await expect(back).toBeEnabled();await back.click();
 await expect(page.getByRole('heading',{name:'Semesterübersicht',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Semester für .* erstellen/}).click();
 await page.getByLabel('Semester',{exact:true}).selectOption('SoSe 2027');
 await page.getByRole('button',{name:'Weiter',exact:true}).click();
 await expect(page.getByText('Data Engineering',{exact:true})).toBeVisible();
 await back.click();
 page.once('dialog',d=>d.dismiss());await back.click();
 await expect(page.getByRole('heading',{name:'Semester vorbereiten',exact:true})).toBeVisible();
 page.once('dialog',d=>d.accept());await back.click();
 await expect(page.getByText('Noch keine Semester angelegt.',{exact:true})).toBeVisible();
});


test('Betriebssysteme separates four time options without invented lecture or exercise labels',async({page})=>{
 await setup(page);
 const os={...ad,id:'wi.course.betriebssysteme',title:'Betriebssysteme',short_title:'OS'};
 await page.route('**/api/admin/programs/wi/prepare',r=>r.fulfill({json:{term:'SoSe 2027',catalog:{courses:{[os.id]:os},module_groups:[{id:'wi.req.betriebssysteme',title:'Betriebssysteme',short_title:'OS',stage_id:'abschnitt_2',teilmodule_ids:[os.id]}],pending:[],warnings:[]},modules:{[os.id]:{offered:true}},handbook:{url:null,label:'Modulhandbuch'},core_handbooks:{},fwpm_handbook:{url:null,label:'FWPM'}}}));
 await toCatalog(page);
 const base={end:'15:30',teachers:['Georgios Raptis'],source_code:'OS',source_group:'',teaching_type:'exercise',type_source:'directory'};
 const slots=[{weekday:3,start:'14:00',room:'K220',source_color:'#ffff00'}, {weekday:3,start:'15:45',end:'17:15',room:'K220',source_color:'#ffff00'}, {weekday:4,start:'14:00',room:'K001',source_color:'#ffffff'}, {weekday:4,start:'15:45',end:'17:15',room:'K223',source_color:'#ffff00'}];
 const meetings=['IW3','IW4'].flatMap(group=>slots.map(slot=>({...base,group,...slot})));
 await page.route('**/api/admin/programs/wi/import/schedule',r=>r.fulfill({json:{term:'SoSe 2027',report:report(),modules:{[os.id]:{meetings}}}}));
 await page.getByRole('button',{name:'B.O.S.S.-Stundenplan abrufen'}).click();
 const module=page.getByTestId('schedule-module-wi.req.betriebssysteme');
 await module.locator(':scope > summary').click();
 const variants=module.getByTestId('meeting-variant');
 await expect(variants).toHaveCount(4);
 for(let i=0;i<4;i++){
  const title=variants.nth(i).locator('summary');
  await expect(title).toContainText(`Variante ${i+1}`);
  await expect(title).not.toContainText('Übung');await expect(title).not.toContainText('Vorlesung');
  await title.click();
 }
 await expect(variants.nth(0)).toContainText('Mittwoch 14:00');
 await expect(variants.nth(1)).toContainText('Mittwoch 15:45');
 await expect(variants.nth(2)).toContainText('Donnerstag 14:00');
 await expect(variants.nth(2)).toContainText('K001');
 await expect(variants.nth(3)).toContainText('Donnerstag 15:45');
 await module.screenshot({path:'test-results/os-four-neutral-options.png'});
});
