import { test, expect } from './fixtures';

test('FWPM selection requires a confirmed place and shows the real course in semester planning', async ({ page }) => {
  const options = [{ id: 'wi.fwpm.date', title: 'Data Engineering', short_title: 'DATE', catalog_status: 'semester_catalog', source_term: 'WiSe 2026/27', section_verified: true,
    course: { offered: true, elo: 'https://example.org/date-elo', schedule: 'Dienstag 10:00–11:30', room: 'K014', meetings: [{ weekday: 2, start: '10:00', end: '11:30', room: 'K014', group: 'IW6', teachers: ['Michael Colombo'] }] } },
    { id: 'wi.fwpm.zapp', title: 'App-Programmierung', short_title: 'ZAPP', catalog_status: 'previous_summer', source_term: 'SoSe 2026', section_verified: false, notice: 'Im Sommersemester zuvor angeboten; aktuelles Angebot und Platz selbst bestätigen.', course: {} }];
  await page.route('**/api/imports', route => route.fulfill({ json: [{ id: 1, status: 'success' }] }));
  await page.route('**/api/imports/1/dashboard*', route => route.fulfill({ json: { import_id: 1, program: 'Wirtschaftsinformatik', supported: true, official_grade: null, official_credits: 0, spo_version: 'Test', curriculum_edition: 'wi_bsc_2023', stages: [{ id: 'abschnitt_3', title: 'Abschnitt 3', modules: [{ id: 'wi.req.fwpm2', title: 'Fachbezogenes Wahlpflichtmodul 2', short_title: 'FWPM 2', required_ects: 5, status: 'unknown', grade: null, source: null, admission: { status: 'available', reason: 'Voraussetzungen erfüllt' }, requires_course_selection: true, course_options: options }] }], unmatched_groups: [] } }));
  await page.goto('/?preview=dashboard');
  await page.getByLabel('Datenquelle').selectOption('1');
  await page.getByRole('button', { name: 'Fachbezogenes Wahlpflichtmodul 2: Offen' }).click();
  const dialog = page.getByRole('dialog');
  const add = dialog.getByRole('button', { name: 'Zum aktuellen Semester hinzufügen' });
  await expect(add).toBeDisabled();
  await page.getByLabel('FWPM-Disziplin auswählen').selectOption('wi.fwpm.date');
  await expect(add).toBeDisabled();
  await page.getByLabel('Ich habe für diese Disziplin einen Platz / eine Teilnahmebestätigung.').check();
  await add.click();
  await page.getByRole('button', { name: 'Details schließen' }).click();
  await page.getByRole('button', { name: /^Data Engineering 5 ECTS/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Data Engineering' })).toBeVisible();
  await expect(dialog).toContainText('Michael Colombo');
  await expect(dialog).toContainText('K014');
  await expect(dialog.getByRole('link', { name: 'ELO-Kurs öffnen' })).toHaveAttribute('href', 'https://example.org/date-elo');
  await expect(page.getByTestId('official-credits')).toHaveText('0 / 210');
  await page.screenshot({ path: 'test-results/fwpm-course-details.png', fullPage: true });
  await page.reload();
  await page.getByLabel('Datenquelle').selectOption('1');
  await expect(page.getByRole('button', { name: /^Data Engineering 5 ECTS/ })).toBeVisible();
  await page.getByRole('button', { name: 'Fachbezogenes Wahlpflichtmodul 2: Offen' }).click();
  await page.getByLabel('FWPM-Disziplin auswählen').selectOption('wi.fwpm.zapp');
  await expect(dialog).toContainText('Im Sommersemester zuvor angeboten');
  await expect(add).toBeDisabled();
});
