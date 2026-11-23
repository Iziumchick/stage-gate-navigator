import {test,expect} from './fixtures';

const email='participant@st.oth-regensburg.de';
const challenge={reset_required:true,ticket:'r'.repeat(43),email,expires_in:600,resend_after:60,message:'Falls für diese Adresse ein freigegebenes Konto besteht, erhältst du einen Code. Bitte auch den Spam-Ordner prüfen.'};

async function open(page:any){
 await page.route('**/api/auth/me',(r:any)=>r.fulfill({status:401,json:{detail:'Bitte anmelden.'}}));
 await page.route('**/api/auth/options',(r:any)=>r.fulfill({json:{institutional_email_required:true,allowed_email_domains:['st.oth-regensburg.de','oth-regensburg.de']}}));
 await page.goto('/');
 await page.getByLabel('E-Mail-Adresse',{exact:true}).fill(email);
 await page.getByLabel('Passwort',{exact:true}).fill('old-wrong-password');
 await page.getByRole('button',{name:'Passwort vergessen?',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Passwort zurücksetzen',exact:true})).toBeVisible();
 await expect(page.getByLabel('E-Mail-Adresse',{exact:true})).toHaveValue(email);
}

async function requestCode(page:any){
 await page.route('**/api/auth/password/reset/request',(r:any)=>{expect(r.request().postDataJSON()).toEqual({email});return r.fulfill({json:challenge});});
 await page.getByRole('button',{name:'Code anfordern',exact:true}).click();
 await expect(page.getByLabel('Code aus der E-Mail',{exact:true})).toBeVisible();
}

async function fillNew(page:any){
 await page.getByLabel('Code aus der E-Mail',{exact:true}).fill('123456');
 await page.getByLabel('Neues Passwort',{exact:true}).fill('new-password-123');
 await page.getByLabel('Neues Passwort wiederholen',{exact:true}).fill('new-password-123');
}

test('recovery accepts a code and new password, then returns to login without automatic authentication',async({page})=>{
 let resets=0,logins=0;
 await page.route('**/api/auth/password/reset/confirm',r=>{expect(r.request().postDataJSON()).toEqual({ticket:challenge.ticket,code:'123456',new_password:'new-password-123'});resets++;return r.fulfill({json:{reset:true}});});
 await page.route('**/api/auth/login',r=>{logins++;return r.fulfill({status:401,json:{detail:'Test only'}});});
 await open(page);await page.screenshot({path:'test-results/password-reset-request.png',fullPage:true});
 await requestCode(page);await page.screenshot({path:'test-results/password-reset-confirm.png',fullPage:true});
 await fillNew(page);await page.getByRole('button',{name:'Neues Passwort speichern',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Passwort geändert',exact:true})).toBeVisible();
 expect(resets).toBe(1);expect(logins).toBe(0);
 await page.getByRole('button',{name:'Zur Anmeldung',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Willkommen zurück',exact:true})).toBeVisible();
 await expect(page.getByLabel('E-Mail-Adresse',{exact:true})).toHaveValue(email);
 await expect(page.getByLabel('Passwort',{exact:true})).toHaveValue('');
 await expect(page.getByRole('status')).toContainText('mit dem neuen Passwort anmelden');
 const storage=await page.evaluate(()=>JSON.stringify({local:localStorage,session:sessionStorage}));
 for(const secret of [challenge.ticket,'new-password-123','123456','old-wrong-password'])expect(storage).not.toContain(secret);
});

test('mismatching passwords stay local and an invalid or expired code can be corrected',async({page})=>{
 let requests=0;
 await page.route('**/api/auth/password/reset/confirm',r=>{requests++;return r.fulfill({status:400,json:{detail:'Der Code ist ungültig oder abgelaufen. Bitte einen neuen Code anfordern.'}});});
 await open(page);await requestCode(page);await fillNew(page);
 await page.getByLabel('Neues Passwort wiederholen',{exact:true}).fill('another-password-123');
 await page.getByRole('button',{name:'Neues Passwort speichern',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('stimmen nicht überein');expect(requests).toBe(0);
 await page.getByLabel('Neues Passwort wiederholen',{exact:true}).fill('new-password-123');
 await page.getByRole('button',{name:'Neues Passwort speichern',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('abgelaufen');expect(requests).toBe(1);
 await expect(page.getByLabel('Neues Passwort',{exact:true})).toBeVisible();
});

test('resending observes a cooldown and replaces the ticket and code without losing the new password',async({page})=>{
 await page.clock.install();await open(page);await requestCode(page);await fillNew(page);
 await expect(page.getByRole('button',{name:/Neuen Code senden/})).toBeDisabled();
 const newer={...challenge,ticket:'s'.repeat(43)};
 await page.route('**/api/auth/password/reset/request',r=>r.fulfill({json:newer}));
 await page.route('**/api/auth/password/reset/confirm',r=>{expect(r.request().postDataJSON().ticket).toBe(newer.ticket);return r.fulfill({json:{reset:true}});});
 await page.clock.fastForward(61000);await page.getByRole('button',{name:'Neuen Code senden',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('neuesten Code');
 await expect(page.getByLabel('Code aus der E-Mail',{exact:true})).toHaveValue('');
 await expect(page.getByLabel('Neues Passwort',{exact:true})).toHaveValue('new-password-123');
 await page.getByLabel('Code aus der E-Mail',{exact:true}).fill('654321');
 await page.getByRole('button',{name:'Neues Passwort speichern',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Passwort geändert',exact:true})).toBeVisible();
});

test('returning from recovery clears credentials and failed delivery stays retryable',async({page})=>{
 await open(page);
 await page.route('**/api/auth/password/reset/request',r=>r.fulfill({status:503,json:{detail:'Bitte später erneut versuchen.'}}));
 await page.getByRole('button',{name:'Code anfordern',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('später');
 await expect(page.getByRole('button',{name:'Code anfordern',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Zur Anmeldung',exact:true}).click();
 await expect(page.getByLabel('Passwort',{exact:true})).toHaveValue('');
 await page.getByRole('button',{name:'Passwort vergessen?',exact:true}).click();await requestCode(page);await fillNew(page);
 await page.getByRole('button',{name:'Zur Anmeldung',exact:true}).click();
 await page.getByRole('button',{name:'Passwort vergessen?',exact:true}).click();
 await expect(page.getByLabel('E-Mail-Adresse',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Code aus der E-Mail',{exact:true})).toHaveCount(0);
});

test('existing-account registration error offers recovery without repeating registration',async({page})=>{
 await open(page);await page.getByRole('button',{name:'Zur Anmeldung',exact:true}).click();
 await page.route('**/api/auth/register',r=>r.fulfill({status:409,json:{detail:'Das Konto konnte nicht angelegt werden. Bitte mit deinen Zugangsdaten anmelden.'}}));
 await page.getByRole('button',{name:'Registrieren',exact:true}).click();
 await page.getByLabel('Anzeigename (Pseudonym möglich)',{exact:true}).fill('Participant');
 await page.getByLabel('Passwort',{exact:true}).fill('synthetic-password-123');await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Konto erstellen',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('anmelden');
 await page.getByRole('button',{name:'Passwort vergessen?',exact:true}).click();
 await expect(page.getByLabel('E-Mail-Adresse',{exact:true})).toHaveValue(email);
});
