import { test, expect } from './fixtures';
const imported = [{ id: 1, status: 'success', created_at: '2026-09-27', degree_program_raw: 'Wirtschaftsinformatik' }];
const dashboard = {
  import_id: 1, program: 'Wirtschaftsinformatik', supported: true, official_grade: 2.97, official_credits: 52, spo_version: 'Test SPO', unmatched_groups: [],
  stages: [{ id: 'abschnitt_1', title: 'Abschnitt 1', modules: [
    { id: 'ma1', title: 'Mathematik 1', short_title: 'MA1', required_ects: 7, actual_ects: 7, grade: '2,7', status: 'passed', source: { requirement_title: 'Mathematik 1', requirement_meta: { ects: 7, grade_val: '2,7' }, subs: [] } },
  ] }],
};

test('design preview retains desktop layout', async ({ page }) => {
  await page.route('**/api/imports', route => route.fulfill({ json: [] }));
  await page.goto('/?preview=dashboard');
  await expect(page.getByText('Designvorschau mit fiktiven Daten.', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mein Status' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Abschnitt 3 / Abschluss' })).toBeVisible();
  await expect(page.getByRole('button',{name:'Leistungen aktualisieren',exact:true})).toBeVisible();
  await page.screenshot({ path: 'test-results/demo-dashboard.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1920);
});

test('import displays official values, unknown semester and source details', async ({ page }) => {
  await page.route('**/api/imports', route => route.fulfill({ json: imported }));
  await page.route('**/api/imports/1/dashboard*', route => route.fulfill({ json: dashboard }));
  await page.goto('/?preview=dashboard');
  await expect(page.getByLabel('Datenquelle')).toHaveCount(0);
  await expect(page.getByTestId('official-credits')).toBeVisible();
  await expect(page.getByTestId('official-grade')).toHaveText('2,97');
  await expect(page.getByTestId('official-credits')).toHaveText('52 / 210');
  await expect(page.getByText('Dein Semesterplan ist noch leer.')).toBeVisible();
  await expect(page.getByText('Sergii Puniegov', { exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: 'Mathematik 1: Bestanden', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('7 ECTS');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.screenshot({ path: 'test-results/live-dashboard.png', fullPage: true });
});

test('upload selects the new import without re-parsing', async ({ page }) => {
  let uploaded = false;
  await page.route('**/api/imports', route => route.fulfill({ json: uploaded ? imported : [] }));
  await page.route('**/api/imports/upload', route => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().headers()['content-type']).toContain('multipart/form-data');
    uploaded = true;
    return route.fulfill({ json: { import_id: 1 } });
  });
  await page.route('**/api/imports/1/dashboard*', route => route.fulfill({ json: dashboard }));
  await page.goto('/?preview=dashboard');
  await page.getByLabel('Leistungen PDF aktualisieren').setInputFiles({ name: 'transcript.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') });
  await expect(page.getByTestId('official-credits')).toHaveText('52 / 210');
  await expect(page.getByTestId('personal-report-version')).toContainText('PDF hochgeladen am');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('server and PDF validation errors are visible and recoverable', async ({ page }) => {
  await page.route('**/api/imports', route => route.fulfill({ status: 503, json: { detail: 'Server offline' } }));
  await page.goto('/?preview=dashboard');
  await expect(page.getByRole('alert')).toContainText('Server offline');
  await page.route('**/api/imports', route => route.fulfill({ json: [] }));
  await page.getByRole('button', { name: 'Erneut versuchen' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.route('**/api/imports/upload', route => route.fulfill({ status: 400, json: { detail: { message: 'Invalid PDF' } } }));
  await page.getByLabel('Leistungen PDF aktualisieren').setInputFiles({ name: 'invalid.pdf', mimeType: 'application/pdf', buffer: Buffer.from('invalid') });
  await expect(page.getByRole('alert')).toContainText('Invalid PDF');
  await expect(page.getByRole('button', { name: 'Leistungen aktualisieren' })).toBeEnabled();
});

test('failed latest report fetch does not fall back to older grades', async ({ page }) => {
  let latest=false;
  await page.route('**/api/imports', route => route.fulfill({ json: latest ? [{ ...imported[0], id: 2 }, ...imported] : imported }));
  await page.route('**/api/imports/1/dashboard*', route => route.fulfill({ json: dashboard }));
  await page.route('**/api/imports/2/dashboard*', route => route.fulfill({ status: 404, json: { detail: 'Import not found' } }));
  await page.goto('/?preview=dashboard');
  await expect(page.getByTestId('official-credits')).toHaveText('52 / 210');
  latest=true;
  await page.getByRole('button',{name:'Ansicht aktualisieren',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Import not found');
  await expect(page.getByTestId('official-credits')).toHaveCount(0);
});
