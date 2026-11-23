import {test,expect} from './fixtures';

const notice = {
  ready:true,retention_days:60,controller:'Synthetic Project Operator',
  address:'Example Street 1\n12345 Example City',contact:'operator@example.test',
  hosting_provider:'Synthetic EU host',hosting_country:'Deutschland',
  supervisory_authority:'Configured supervisory authority',
  log_policy:'Synthetic operational logs: deleted after 7 days.',
  backup_policy:'Synthetic encrypted backups: deleted after 14 days.',
  mail_provider:'Synthetic SMTP provider',mail_retention:'Synthetic delivery logs: deleted after 3 days.',
};

test('imprint is directly reachable without authentication and identifies the private operator',async({page})=>{
  const privateRequests:string[]=[];
  page.on('request',r=>{if(/\/api\/(auth|imports|admin)/.test(r.url()))privateRequests.push(r.url());});
  await page.route('**/api/privacy',r=>r.fulfill({json:notice}));
  await page.goto('/impressum?demo=first');
  await expect(page.getByRole('heading',{name:'Impressum',exact:true})).toBeVisible();
  await expect(page.getByRole('main')).toContainText(notice.controller);
  await expect(page.getByRole('main')).toContainText(notice.contact);
  await expect(page.getByRole('main')).toContainText('nicht Betreiber dieses Dienstes');
  await expect(page.getByRole('main')).not.toContainText('noch zu ergänzen');
  expect(privateRequests).toEqual([]);
});

test('privacy page distinguishes log and backup policies and is linked from the login footer',async({page})=>{
  await page.route('**/api/auth/me',r=>r.fulfill({status:401,json:{detail:'Bitte anmelden.'}}));
  await page.route('**/api/privacy',r=>r.fulfill({json:notice}));
  await page.goto('/');
  await page.getByRole('link',{name:'Datenschutz & Projektinformation',exact:true}).click();
  await expect(page).toHaveURL(/\/datenschutz$/);
  const main=page.getByRole('main');
  for(const text of [notice.hosting_provider,notice.log_policy,notice.backup_policy,notice.mail_provider,notice.mail_retention])await expect(main).toContainText(text);
  await expect(main).toContainText('keine anonymen Daten');
  await expect(main).toContainText('nur in diesem Browser');
});

test('incomplete operator details and failed legal notice requests are not presented as complete',async({page})=>{
  await page.route('**/api/privacy',r=>r.fulfill({json:{ready:false,retention_days:90}}));
  await page.goto('/impressum');
  await expect(page.getByRole('main')).toContainText('Betreiberangaben müssen');
  await expect(page.getByRole('main')).toContainText('Postanschrift noch zu ergänzen');
  await page.route('**/api/privacy',r=>r.fulfill({status:503,json:{detail:'Unavailable'}}));
  await page.goto('/datenschutz');
  await expect(page.getByRole('alert')).toContainText('konnten nicht geladen werden');
  await expect(page.getByRole('main')).not.toContainText('90 Tagen');
});
