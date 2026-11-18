import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true });
try {
  for (const [start, expected] of [['SoSe 2023', 'wi_bsc_2012'], ['SoSe 2026', 'wi_bsc_2023'], ['WiSe 2026/27', 'wi_bsc_2026']]) {
    // Synthetic account UI; real, public curriculum API; no account or PDF writes.
    const context = await browser.newContext({ viewport: { width: 1920, height: 1300 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 999999, name: 'Test', email: 'test@example.org', role: 'student' } }));
    await page.route('**/api/imports', route => route.fulfill({ json: [] }));
    await page.goto(process.env.SMOKE_URL || 'http://host.docker.internal:5173');
    await page.getByLabel('Studiengang', { exact: true }).selectOption('Wirtschaftsinformatik (B.Sc.)');
    await page.getByLabel('Studienbeginn', { exact: true }).selectOption(start);
    const response = page.waitForResponse(response => response.url().includes('/api/programs/wi/dashboard?'));
    await page.getByRole('button', { name: 'Studienplan ohne PDF öffnen' }).click();
    const data = await (await response).json();
    assert.equal(data.curriculum_edition, expected);
    assert.equal(data.stages.flatMap(s => s.modules).reduce((total, m) => total + m.required_ects, 0), 210);
    assert.equal(await page.getByRole('table',{name:'Studienfortschritt nach Etappen'}).count(),1);
    assert.equal(await page.getByTestId('semester-ects').innerText(),'0 ECTS');
    assert.equal(data.progress.confirmed_ects,0);
    if (expected === 'wi_bsc_2012') {
      await page.getByRole('button', { name: /^Allgemeinwissenschaftliches Wahlpflichtmodul 1:/ }).click();
      await page.getByText('Bestandteile des Moduls laut SPO', { exact: true }).waitFor();
      await page.getByText('Fachspezifisches Englisch · 3 ECTS',{exact:true}).waitFor();
      await page.screenshot({ path: 'test-results/live-edition-2012-aw.png', fullPage: true });
    } else if (expected === 'wi_bsc_2026') {
      await page.getByRole('button', { name: /^Enterprise Systems:/ }).waitFor();
      assert.equal(await page.getByRole('button', { name: /^Hardware-Grundlagen:/ }).count(), 0);
      await page.screenshot({ path: 'test-results/live-edition-2026.png', fullPage: true });
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('PASS: compiled student setup + real curriculum API selects all 3 editions, 210 ECTS each, old AW parts, new module replacements, neutral empty plans, milestone indicators and no browser errors.');
} finally { await browser.close(); }
