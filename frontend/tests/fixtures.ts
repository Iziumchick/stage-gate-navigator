import { test as base, expect } from '@playwright/test';
export const test = base.extend({
  page: async ({ page }, use) => {
    const user = { id: 1, name: 'Sergii', email: 'sergii@example.org', role: 'student',privacy_version:'2026-11-16' };
    await page.route('**/api/auth/me', route => route.fulfill({ json: user }));
    await page.route('**/api/auth/register', route => route.fulfill({ json: user }));
    await page.route('**/api/auth/logout', route => route.fulfill({ json: { ok: true } }));
    await page.addInitScript(() => {
      if (location.search.includes('preview=dashboard') && !localStorage.getItem('stage-gate.profile:1')) localStorage.setItem('stage-gate.profile:1', JSON.stringify({ name: 'Sergii', program: 'Wirtschaftsinformatik (B.Sc.)', startTerm: 'WiSe 2023/24', referenceTerm: 'WiSe 2026/27', fachsemester: 2 }));
    });
    await use(page);
  },
});
export { expect };
