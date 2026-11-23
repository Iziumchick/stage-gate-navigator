import {test,expect} from './fixtures';

const user={id:42,name:'Test participant',email:'participant@st.oth-regensburg.de',role:'student',privacy_version:'2026-11-21',email_verified:true};
const challenge={verification_required:true,ticket:'a'.repeat(43),email:user.email,expires_in:600,resend_after:60};

async function login(page:any){
 await page.route('**/api/auth/me',(r:any)=>r.fulfill({status:401,json:{detail:'Bitte anmelden.'}}));
 await page.route('**/api/auth/options',(r:any)=>r.fulfill({json:{institutional_email_required:true,allowed_email_domains:['st.oth-regensburg.de','oth-regensburg.de']}}));
 await page.route('**/api/auth/login',(r:any)=>r.fulfill({json:challenge}));
 await page.route('**/api/imports',(r:any)=>r.fulfill({json:[]}));
 await page.goto('/');await expect(page.getByText('Bitte ein eigenes Passwort für Study Navigator verwenden.',{exact:false})).toBeVisible();
 await page.getByLabel('E-Mail-Adresse',{exact:true}).fill(user.email);await page.getByLabel('Passwort',{exact:true}).fill('synthetic-password-123');
 await page.getByRole('button',{name:'Einloggen',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Hochschuladresse bestätigen',exact:true})).toBeVisible();
}

test('dashboard stays closed until a correct email code is submitted; failures can be corrected',async({page})=>{
 let requests=0;
 await page.route('**/api/auth/email/verify',r=>{
  const body=JSON.parse(r.request().postData()!);expect(body.ticket).toBe(challenge.ticket);expect(body.password).toBeUndefined();requests++;
  return body.code==='123456'?r.fulfill({json:user}):r.fulfill({status:400,json:{detail:'Der Code ist ungültig oder abgelaufen.'}});
 });
 await login(page);await expect(page.getByRole('heading',{name:'Füge dein Studium hinzu',exact:true})).toHaveCount(0);
 const confirm=page.getByRole('button',{name:'E-Mail bestätigen',exact:true});await expect(confirm).toBeDisabled();
 await page.getByLabel('Bestätigungscode',{exact:true}).fill('000000');await confirm.click();await expect(page.getByRole('alert')).toContainText('ungültig');
 await page.getByLabel('Bestätigungscode',{exact:true}).fill('123456');await confirm.click();
 await expect(page.getByRole('heading',{name:'Füge dein Studium hinzu',exact:true})).toBeVisible();expect(requests).toBe(2);
 expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain(challenge.ticket);
});

test('resend waits for the cooldown and uses a new ticket without losing the confirmation screen',async({page})=>{
 await page.clock.install();
 const newer={...challenge,ticket:'b'.repeat(43)};
 await page.route('**/api/auth/email/resend',r=>{expect(JSON.parse(r.request().postData()!).ticket).toBe(challenge.ticket);return r.fulfill({json:newer});});
 await page.route('**/api/auth/email/verify',r=>{expect(JSON.parse(r.request().postData()!).ticket).toBe(newer.ticket);return r.fulfill({json:user});});
 await login(page);await expect(page.getByRole('button',{name:/Neuen Code senden/})).toBeDisabled();
 await page.clock.fastForward(61000);await page.getByRole('button',{name:'Neuen Code senden',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Ein neuer Code wurde gesendet');
 await page.getByLabel('Bestätigungscode',{exact:true}).fill('123456');await page.getByRole('button',{name:'E-Mail bestätigen',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Füge dein Studium hinzu',exact:true})).toBeVisible();
});

test('registration shows confirmation rather than onboarding and allows returning safely to login',async({page})=>{
 await page.route('**/api/auth/me',r=>r.fulfill({status:401,json:{detail:'Bitte anmelden.'}}));
 await page.route('**/api/auth/register',r=>r.fulfill({json:challenge}));
 await page.goto('/');await page.getByRole('button',{name:'Registrieren',exact:true}).click();
 await page.getByLabel('Anzeigename (Pseudonym möglich)',{exact:true}).fill('Test participant');await page.getByLabel('E-Mail-Adresse',{exact:true}).fill(user.email);await page.getByLabel('Passwort',{exact:true}).fill('synthetic-password-123');await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Konto erstellen',exact:true}).click();await expect(page.getByRole('heading',{name:'Hochschuladresse bestätigen',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Zur Anmeldung',exact:true}).click();await expect(page.getByRole('heading',{name:'Willkommen zurück',exact:true})).toBeVisible();await expect(page.getByLabel('Passwort',{exact:true})).toHaveValue('');
});
