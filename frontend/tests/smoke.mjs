// Checks the running application. Changes only a transient administrator session.
import { chromium } from '@playwright/test';
const baseURL = process.env.SMOKE_URL || 'http://localhost:5173';
if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) throw new Error('Administrator credentials must be supplied through the environment');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseURL);
  await page.getByRole('heading', { name: 'Willkommen zurück' }).waitFor();
  if ((await page.request.get(`${baseURL}/api/imports`)).status() !== 401) throw new Error('Unauthenticated imports are accessible');
  await page.screenshot({ path: 'test-results/local-login.png', fullPage: true });
  await page.getByLabel('E-Mail-Adresse').fill(process.env.ADMIN_EMAIL);
  await page.getByLabel('Passwort', { exact: true }).fill(process.env.ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Einloggen' }).click();
  await page.getByRole('heading', { name: 'Semesterübersicht', exact: true }).waitFor();
  if (await page.getByLabel('ELO-Kurslink').count()) throw new Error('Admin ELO editing is exposed');
  const response = await page.request.get(`${baseURL}/api/programs/wi/catalog`);
  if (!response.ok()) throw new Error(`Catalog: ${response.status()}`);
  const value = await response.json();
  if (Object.values(value.modules).filter(module => module.kind === 'requirement').length !== 35 || Object.values(value.modules).filter(module => module.kind === 'elective').length !== 42) throw new Error('Unexpected program catalog');
  if (await page.getByLabel('Administratorschlüssel').count()) throw new Error('Old token editor is still exposed');
  if ((await page.request.get(`${baseURL}/api/imports`)).status() !== 403) throw new Error('Admin can read student imports');
  await page.screenshot({ path: 'test-results/local-catalog-editor.png', fullPage: true });
  await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
  await page.getByRole('heading', { name: 'Willkommen zurück' }).waitFor();
  if ((await page.request.get(`${baseURL}/api/auth/me`)).status() !== 401) throw new Error('Logout did not revoke the session');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('PASS: production login, server role routing, admin catalog, protected imports, logout, no browser errors.');
} finally { await browser.close(); }
