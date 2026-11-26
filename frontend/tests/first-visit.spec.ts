import { test, expect } from './fixtures';
test.beforeEach(async ({ page }) => {
  await page.route('**/api/imports', route => route.fulfill({ json: [] }));
  await page.route('**/api/programs/wi/dashboard*', route => route.fulfill({ json: { import_id: null, program: 'Wirtschaftsinformatik', supported: true, official_grade: null, official_credits: null, spo_version: 'Test', stages: [], unmatched_groups: [] } }));
});

test('first entry asks for programme, study start and one Leistungen PDF', async ({ page }) => {
  await page.goto('/?preview=welcome');
  await expect(page.getByRole('heading', { name:'Füge dein Studium hinzu' })).toBeVisible();
  await expect(page.getByLabel('Studiengang', { exact:true })).toBeVisible();
  await expect(page.getByLabel('Studienbeginn', { exact:true })).toBeVisible();
  await expect(page.getByLabel('Fachsemester', { exact:true })).toHaveCount(0);
  await expect(page.getByLabel('Aktuelles Semester', { exact:true })).toHaveCount(0);
  await expect(page.getByTestId('current-semester')).toHaveText('WiSe 2026/27');
  await expect(page.getByLabel('Leistungen PDF',{exact:true})).toBeVisible();
  await expect(page.locator('summary').filter({hasText:'PDF aus HISinOne erstellen'})).toBeVisible();
  await expect(page.locator('form').getByText('Hintergrund drucken einschalten',{exact:false})).toBeVisible();
  await page.screenshot({path:'test-results/first-visit-welcome.png',fullPage:true});
});

test('minimal profile persists and study start can be corrected through settings',async({page})=>{
  await page.goto('/?preview=welcome');
  await page.getByLabel('Studiengang',{exact:true}).selectOption('Wirtschaftsinformatik (B.Sc.)');
  await page.getByLabel('Studienbeginn',{exact:true}).selectOption('WiSe 2023/24');
  await page.getByRole('button',{name:'Studienplan ohne PDF öffnen'}).click();
  await expect(page.getByRole('heading',{name:'Mein Status',exact:true})).toBeVisible();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('stage-gate.profile:1')||'{}'));
  expect(saved.fachsemester).toBeUndefined();expect(saved.referenceTerm).toBe('WiSe 2026/27');
  await page.getByRole('button',{name:'Studienangaben bearbeiten',exact:true}).click();
  await page.getByRole('dialog').getByLabel('Studienbeginn',{exact:true}).selectOption('SoSe 2023');
  await page.getByRole('dialog').getByRole('button',{name:'Angaben speichern',exact:true}).click();
  await expect(page.getByText('Start SoSe 2023',{exact:false}).first()).toBeVisible();
});

test('one upload opens the dashboard without asking for Fachsemester',async({page})=>{
  let uploaded=false;
  await page.route('**/api/imports',r=>r.fulfill({json:uploaded?[{id:10,status:'success',created_at:'2026-11-23T12:00:00Z'}]:[]}));
  await page.route('**/api/imports/upload',r=>{uploaded=true;return r.fulfill({json:{import_id:10}});});
  await page.route('**/api/imports/10/dashboard*',r=>r.fulfill({json:{import_id:10,program:'Wirtschaftsinformatik',supported:true,official_grade:2.5,official_credits:30,spo_version:'Test',stages:[],unmatched_groups:[]}}));
  await page.goto('/?preview=welcome');
  await page.getByLabel('Studiengang',{exact:true}).selectOption('Wirtschaftsinformatik (B.Sc.)');
  await page.getByLabel('Studienbeginn',{exact:true}).selectOption('WiSe 2023/24');
  await page.getByLabel('Leistungen PDF',{exact:true}).setInputFiles({name:'Leistungen.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 test')});
  await page.getByRole('button',{name:'Mein Dashboard anzeigen'}).click();
  await expect(page.getByTestId('official-credits')).toHaveText('30 / 210');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByLabel('Fachsemester',{exact:true})).toHaveCount(0);
});

test('overview adds a module and the personal form retains ELO and notes without manual timetable fields', async ({ page }) => {
  await page.goto('/?preview=dashboard');
  await page.getByRole('button', { name: 'Programmierung 2', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Programmierung 2' })).toBeVisible();
  await expect(dialog.getByLabel('ELO-Kurslink')).toHaveCount(0);
  await expect(dialog).toContainText('WiSe & SoSe');
  await dialog.getByRole('button', { name: 'Zum aktuellen Semester hinzufügen' }).click();
  await dialog.getByRole('button', { name: 'Details schließen' }).click();
  await page.getByRole('button', { name: 'Kursdetails: Programmierung 2', exact: true }).click();
  await dialog.getByLabel('ELO-Kurslink').fill('https://elearning.hs-regensburg.de/course/view.php?id=123');
  await expect(dialog.getByLabel('WebUntis-Link')).toHaveCount(0);
  await expect(dialog.getByLabel('Vorlesungszeiten')).toHaveCount(0);
  await expect(dialog.getByLabel('Raum / Online-Ort')).toHaveCount(0);
  await dialog.getByLabel('Notizen').fill('Übungsgruppe am Dienstag');
  await dialog.getByRole('button', { name: 'Kursangaben speichern' }).click();
  await expect(dialog.getByRole('status')).toContainText('Gespeichert');
  await page.screenshot({ path: 'test-results/module-fields.png', fullPage: true });
  await page.reload();
  await page.getByRole('button', { name: 'Kursdetails: Programmierung 2', exact: true }).click();
  await expect(page.getByLabel('Notizen')).toHaveValue('Übungsgruppe am Dienstag');
  await expect(page.getByRole('link', { name: 'ELO-Kurs öffnen' })).toHaveAttribute('href', 'https://elearning.hs-regensburg.de/course/view.php?id=123');
});

test('personal semester plan survives import refresh and does not change passing status', async ({ page }) => {
  const modules = [{ id: 'pg2', title: 'Programmieren 2', short_title: 'PG2', required_ects: 8, actual_ects: null, grade: null, status: 'unknown', source: null, admission: { status: 'available', reason: 'Test rule' } }];
  await page.route('**/api/imports', route => route.fulfill({ json: [{ id: 1, status: 'success' }] }));
  await page.route('**/api/imports/1/dashboard*', route => route.fulfill({ json: { import_id: 1, program: 'Wirtschaftsinformatik', supported: true, official_grade: null, official_credits: 0, spo_version: 'Test', stages: [{ id: 'abschnitt_1', title: 'Abschnitt 1', modules }], unmatched_groups: [] } }));
  await page.goto('/?preview=dashboard');
  await expect(page.getByLabel('Datenquelle')).toHaveCount(0);
  await expect(page.getByTestId('official-credits')).toBeVisible();
  await page.getByRole('button', { name: 'Programmieren 2: Offen' }).click();
  await expect(page.getByLabel('ELO-Kurslink')).toHaveCount(0);
  await page.getByRole('button', { name: 'Zum aktuellen Semester hinzufügen' }).click();
  await page.getByRole('button', { name: 'Details schließen' }).click();
  await page.getByRole('button', { name: /^Programmieren 2 8 ECTS/ }).click();
  await page.getByLabel('ELO-Kurslink').fill('https://example.org/my-pg2');
  await page.getByRole('button', { name: 'Kursangaben speichern' }).click();
  await page.getByRole('button', { name: 'Details schließen' }).click();
  await expect(page.getByText('Dienstag, 08:00', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ansicht aktualisieren' }).click();
  await page.getByRole('button',{name:/^Programmieren 2 8 ECTS/}).click();
  await expect(page.getByLabel('ELO-Kurslink',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'ELO-Kurs öffnen'})).toHaveAttribute('href','https://example.org/my-pg2');
  await page.getByRole('button',{name:'ELO-Link bearbeiten'}).click();
  await expect(page.getByLabel('ELO-Kurslink',{exact:true})).toHaveValue('https://example.org/my-pg2');
  await page.getByRole('button',{name:'Details schließen'}).click();
  await expect(page.getByRole('button', { name: 'Programmieren 2: Offen' })).toBeVisible();
});


test('passed overview shows grade without planning or course inputs', async ({ page }) => {
  await page.goto('/?preview=dashboard');
  await page.getByRole('button', { name: 'Mathematik 1', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Note: 2,7');
  await expect(dialog).not.toContainText('Angeboten im:');
  await expect(dialog.getByLabel('ELO-Kurslink')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Zum aktuellen Semester hinzufügen' })).toHaveCount(0);
});

test('removing a planned course preserves notes and does not mark it passed', async ({ page }) => {
  await page.goto('/?preview=dashboard');
  await page.getByRole('button', { name: 'Programmierung 2', exact: true }).click();
  await page.getByRole('button', { name: 'Zum aktuellen Semester hinzufügen' }).click();
  await page.getByRole('button', { name: 'Details schließen' }).click();
  await page.getByRole('button', { name: 'Kursdetails: Programmierung 2', exact: true }).click();
  await page.getByLabel('Notizen').fill('Meine Übungsgruppe');
  await page.getByRole('button', { name: 'Kursangaben speichern' }).click();
  await page.getByRole('button', { name: 'Aus aktuellem Semester entfernen' }).click();
  await expect(page.getByRole('button', { name: 'Kursdetails: Programmierung 2', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Programmierung 2', exact: true }).click();
  await page.getByRole('button', { name: 'Zum aktuellen Semester hinzufügen' }).click();
  await page.getByRole('button', { name: 'Details schließen' }).click();
  await page.getByRole('button', { name: 'Kursdetails: Programmierung 2', exact: true }).click();
  await expect(page.getByLabel('Notizen')).toHaveValue('Meine Übungsgruppe');
});

test('locked demo module shows the reason without an add button', async ({ page }) => {
  await page.goto('/?preview=dashboard');
  await page.getByRole('button', { name: 'Vertiefungsmodul IN 1', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Noch nicht verfügbar');
  await expect(dialog.getByRole('button', { name: 'Zum aktuellen Semester hinzufügen' })).toHaveCount(0);
});

test('shared metadata, handbook pages and course coexist with personal data', async ({ page }) => {
  const modules = [{ id: 'pg2', title: 'Programmieren 2', short_title: 'PG2', required_ects: 8, actual_ects: null, grade: null, status: 'unknown', source: null,
    admission: { status: 'available', reason: 'Test rule' },
    details: { description: 'Beschreibung aus dem gemeinsamen Katalog', offered_in: 'WiSe und SoSe', grade_weight: '2-fach', handbook: { url: 'https://example.org/handbook.pdf', label: 'Modulhandbuch', pages: { start: 42, end: 43 } } },
    course: { elo: 'https://example.org/elo', schedule: 'Montag 10:00', room: 'D 201' } }];
  await page.route('**/api/imports', route => route.fulfill({ json: [{ id: 1, status: 'success' }] }));
  await page.route('**/api/imports/1/dashboard*', route => route.fulfill({ json: { import_id: 1, program: 'Wirtschaftsinformatik', supported: true, official_grade: null, official_credits: 0, spo_version: 'Test', stages: [{ id: 'abschnitt_1', title: 'Abschnitt 1', modules }], unmatched_groups: [] } }));
  await page.goto('/?preview=dashboard');
  await expect(page.getByTestId('official-credits')).toBeVisible();
  await page.getByRole('button', { name: 'Programmieren 2: Offen' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('summary').filter({hasText:'Kursbeschreibung'})).toHaveCount(0);
  await expect(dialog).toContainText('2-fach');
  await expect(dialog.getByRole('link', { name: 'Modulhandbuch' })).toHaveAttribute('href', 'https://example.org/handbook.pdf#page=42');
  await dialog.getByRole('button', { name: 'Zum aktuellen Semester hinzufügen' }).click();
  await dialog.getByRole('button', { name: 'Details schließen' }).click();
  await page.getByRole('button', { name: /^Programmieren 2 8 ECTS/ }).click();
  await expect(dialog).toContainText('Raum: D 201');
  await expect(dialog.getByRole('link', { name: 'ELO-Kurs öffnen' })).toHaveAttribute('href', 'https://example.org/elo');
  await expect(dialog.getByLabel('Raum / Online-Ort')).toHaveCount(0);
  await dialog.getByLabel('Notizen').fill('Meine Ergänzung');
  await dialog.getByRole('button', { name: 'Kursangaben speichern' }).click();
  await expect(dialog).toContainText('Raum: D 201');
});

test('unverified admissions cannot be added to the current semester', async ({ page }) => {
  const modules = [{ id: 'pg2', title: 'Programmieren 2', short_title: 'PG2', required_ects: 8, status: 'unknown', source: null, grade: null,
    admission: { status: 'unknown', reason: 'Regelquelle fehlt' } }];
  await page.route('**/api/programs/wi/dashboard*', route => route.fulfill({ json: { import_id: null, program: 'Wirtschaftsinformatik', supported: true, official_grade: null, official_credits: null, spo_version: 'Test', stages: [{ id: 'abschnitt_1', title: 'Abschnitt 1', modules }], unmatched_groups: [] } }));
  await page.addInitScript(()=>localStorage.setItem('stage-gate.profile:1',JSON.stringify({name:'Student',program:'Wirtschaftsinformatik (B.Sc.)',startTerm:'WiSe 2023/24',referenceTerm:'WiSe 2026/27'})));
  await page.goto('/');
  await page.getByRole('button', { name: 'Programmieren 2: Offen' }).click();
  await expect(page.getByRole('dialog')).toContainText('Regelquelle fehlt');
  await expect(page.getByRole('button', { name: 'Zum aktuellen Semester hinzufügen' })).toHaveCount(0);
});

test('study start is required and changing it reloads the curriculum', async ({ page }) => {
  await page.route('**/api/imports', route => route.fulfill({ json: [] }));
  const starts: string[] = [];
  await page.route('**/api/programs/wi/dashboard*', route => {
    const start = new URL(route.request().url()).searchParams.get('start_term') || '';
    starts.push(start);
    return route.fulfill({ json: { import_id: null, program: 'Wirtschaftsinformatik', supported: true, official_grade: null, official_credits: null, spo_version: start === 'WiSe 2026/27' ? 'SPO 2026' : 'SPO 2023', curriculum_edition: start === 'WiSe 2026/27' ? 'wi_bsc_2026' : 'wi_bsc_2023', stages: [], unmatched_groups: [] } });
  });
  await page.goto('/?preview=welcome');
  await page.getByLabel('Studiengang', { exact: true }).selectOption('Wirtschaftsinformatik (B.Sc.)');
  await page.getByRole('button', { name: 'Studienplan ohne PDF öffnen' }).click();
  await expect(page.getByRole('heading', { name: 'Füge dein Studium hinzu' })).toBeVisible();
  expect(starts).toEqual([]);
  await page.getByLabel('Studienbeginn', { exact: true }).selectOption('SoSe 2026');
  await page.getByRole('button', { name: 'Studienplan ohne PDF öffnen' }).click();
  await page.getByRole('group',{name:'Studieninformationen'}).locator('summary').first().click();
  await expect(page.getByText('SPO 2023', { exact: false })).toBeVisible();
  await page.getByRole('group',{name:'Studieninformationen'}).locator('summary').first().click();
  await page.getByRole('button', { name: 'Studienangaben bearbeiten', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Studienbeginn', { exact: true }).selectOption('WiSe 2026/27');
  await page.getByRole('dialog').getByRole('button', { name: 'Angaben speichern', exact: true }).click();
  await page.getByRole('group',{name:'Studieninformationen'}).locator('summary').first().click();
  await expect(page.getByText('SPO 2026', { exact: false })).toBeVisible();
  expect(starts).toEqual(['SoSe 2026', 'WiSe 2026/27']);
});
