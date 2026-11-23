import {test,expect} from './fixtures';

const user={id:1,name:'Participant',email:'participant@st.oth-regensburg.de',role:'student',privacy_version:'2026-11-21'};
const profile={name:'Participant',program:'Wirtschaftsinformatik (B.Sc.)',startTerm:'SoSe 2021',referenceTerm:'WiSe 2026/27'};
const old={id:7,status:'success',created_at:'2024-06-01T08:00:00',uploaded_at:'2024-06-01T08:00:00'};
const latest={id:9,status:'success',created_at:'2026-11-23T10:00:00',uploaded_at:'2026-11-23T10:00:00'};
const newer={id:10,status:'success',created_at:'2026-11-24T12:00:00Z',uploaded_at:'2026-11-24T12:00:00Z'};
const report=(id:number,credits=195)=>({import_id:id,program:'Wirtschaftsinformatik',supported:true,official_grade:2.5,official_credits:credits,spo_version:'Test SPO',stages:[],unmatched_groups:[]});
const pdf={name:'Leistungen.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic')};

async function setup(page:any,accepted=true){
 await page.route('**/api/auth/me',(r:any)=>r.fulfill({json:{...user,privacy_version:accepted?user.privacy_version:null}}));
 await page.addInitScript((value:any)=>{localStorage.setItem('stage-gate.profile:1',JSON.stringify(value));localStorage.setItem('stage-gate.selection:1','7');},profile);
 await page.route('**/api/privacy',(r:any)=>r.fulfill({json:{ready:true,controller:'Synthetic operator',retention_days:90}}));
}

test('personal dashboard always opens the latest upload and shows its time without offering old versions',async({page})=>{
 await setup(page);const calls:number[]=[];
 await page.route('**/api/imports',r=>r.fulfill({json:[latest,old]}));
 await page.route('**/api/imports/*/dashboard*',r=>{const id=Number(new URL(r.request().url()).pathname.split('/')[3]);calls.push(id);return r.fulfill({json:report(id)});});
 await page.goto('/');await expect(page.getByTestId('official-credits')).toHaveText('195 / 210');
 await expect(page.getByTestId('personal-report-owner')).toHaveText('Participant · Mein Studienstand');
 await expect(page.getByTestId('personal-report-version')).toHaveText('PDF hochgeladen am 23.11.2026, 11:00');
 await expect(page.getByRole('combobox')).toHaveCount(0);expect(calls).toEqual([9]);
 await page.screenshot({path:'test-results/personal-current-report.png',fullPage:true});
 await page.reload();await expect(page.getByTestId('official-credits')).toHaveText('195 / 210');expect(calls).toEqual([9,9]);
});

test('a successful update replaces the displayed report while a failed PDF leaves it intact',async({page})=>{
 await setup(page);let uploaded=false;
 await page.route('**/api/imports',r=>r.fulfill({json:uploaded?[newer,latest,old]:[latest,old]}));
 await page.route('**/api/imports/*/dashboard*',r=>{const id=Number(new URL(r.request().url()).pathname.split('/')[3]);return r.fulfill({json:report(id,id===10?200:195)});});
 await page.route('**/api/imports/upload',r=>{uploaded=true;return r.fulfill({json:{import_id:10}});});
 await page.goto('/');await expect(page.getByTestId('official-credits')).toHaveText('195 / 210');
 await page.getByLabel('Leistungen PDF aktualisieren').setInputFiles(pdf);
 await expect(page.getByTestId('official-credits')).toHaveText('200 / 210');
 await expect(page.getByTestId('personal-report-version')).toHaveText('PDF hochgeladen am 24.11.2026, 13:00');
 await page.route('**/api/imports/upload',r=>r.fulfill({status:422,json:{detail:'PDF unvollständig'}}));
 await page.getByLabel('Leistungen PDF aktualisieren').setInputFiles(pdf);
 await expect(page.getByRole('alert')).toContainText('PDF unvollständig');
 await expect(page.getByTestId('official-credits')).toHaveText('200 / 210');
 await expect(page.getByTestId('personal-report-version')).toContainText('24.11.2026');
});

test('upload consent is centered beside the upload action, with no PDF sent before a successful explicit confirmation',async({page})=>{
 await setup(page,false);let sent=0,accepted=false,fail=true;
 await page.route('**/api/imports',r=>r.fulfill({json:sent?[newer,latest]:[latest]}));
 await page.route('**/api/imports/*/dashboard*',r=>r.fulfill({json:report(9)}));
 await page.route('**/api/account/consent',r=>{if(fail)return r.fulfill({status:503,json:{detail:'Bitte erneut versuchen.'}});accepted=true;return r.fulfill({json:user});});
 await page.route('**/api/imports/upload',r=>{expect(accepted).toBe(true);sent++;return r.fulfill({json:{import_id:10}});});
 await page.goto('/');await expect(page.getByTestId('official-credits')).toBeVisible();
 await expect(page.getByRole('region',{name:'Datenschutzbestätigung'})).toHaveCount(0);
 await page.getByLabel('Leistungen PDF aktualisieren').setInputFiles(pdf);
 const dialog=page.getByRole('dialog',{name:'Datenschutz vor dem PDF-Upload',exact:true});
 await expect(dialog).toBeVisible();expect(sent).toBe(0);
 await expect(dialog).toContainText('Leistungen.pdf');
 const box=await dialog.boundingBox();expect(box).not.toBeNull();expect(Math.abs(box!.x+box!.width/2-960)).toBeLessThan(3);
 await page.screenshot({path:'test-results/upload-consent-centered.png',fullPage:true});
 const submit=dialog.getByRole('button',{name:'Bestätigen und PDF hochladen',exact:true});
 await expect(submit).toBeDisabled();await dialog.getByRole('checkbox').check();await submit.click();
 await expect(dialog.getByRole('alert')).toContainText('erneut');expect(sent).toBe(0);
 fail=false;await submit.click();await expect(dialog).toHaveCount(0);expect(sent).toBe(1);
 await expect(page.getByTestId('personal-report-version')).toContainText('24.11.2026');
});

test('cancelling consent keeps the selected report and allows choosing the same file again',async({page})=>{
 await setup(page,false);let sent=0;
 await page.route('**/api/imports',r=>r.fulfill({json:[latest]}));
 await page.route('**/api/imports/9/dashboard*',r=>r.fulfill({json:report(9)}));
 await page.route('**/api/imports/upload',r=>{sent++;return r.fulfill({json:{import_id:10}});});
 await page.goto('/');await expect(page.getByTestId('official-credits')).toBeVisible();
 await page.getByLabel('Leistungen PDF aktualisieren').setInputFiles(pdf);
 const dialog=page.getByRole('dialog',{name:'Datenschutz vor dem PDF-Upload',exact:true});
 await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Abbrechen',exact:true}).click();
 await expect(dialog).toHaveCount(0);expect(sent).toBe(0);await expect(page.getByTestId('official-credits')).toHaveText('195 / 210');
 await page.getByLabel('Leistungen PDF aktualisieren').setInputFiles(pdf);
 await expect(dialog).toBeVisible();await expect(dialog.getByRole('checkbox')).not.toBeChecked();
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);expect(sent).toBe(0);
});

test('first-time study setup asks for consent in context and continues the chosen PDF automatically',async({page})=>{
 await page.route('**/api/auth/me',r=>r.fulfill({json:{...user,privacy_version:null}}));
 let sent=0;
 await page.route('**/api/imports',r=>r.fulfill({json:sent?[latest]:[]}));
 await page.route('**/api/imports/upload',r=>{sent++;return r.fulfill({json:{import_id:9}});});
 await page.route('**/api/imports/9/dashboard*',r=>r.fulfill({json:report(9)}));
 await page.route('**/api/account/consent',r=>r.fulfill({json:user}));
 await page.goto('/');await page.getByLabel('Studiengang',{exact:true}).selectOption(profile.program);await page.getByLabel('Studienbeginn',{exact:true}).selectOption(profile.startTerm);
 await page.getByLabel('Leistungen PDF',{exact:true}).setInputFiles(pdf);await page.getByRole('button',{name:'Mein Dashboard anzeigen',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Datenschutz vor dem PDF-Upload',exact:true});
 await expect(dialog).toBeVisible();expect(sent).toBe(0);
 await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Bestätigen und PDF hochladen',exact:true}).click();
 await expect(page.getByTestId('official-credits')).toHaveText('195 / 210');expect(sent).toBe(1);
 await expect(page.getByRole('heading',{name:'Füge dein Studium hinzu',exact:true})).toHaveCount(0);
});

test('server-side expired consent can be confirmed and the same upload retried',async({page})=>{
 await setup(page);let attempts=0;
 await page.route('**/api/imports',r=>r.fulfill({json:[latest]}));
 await page.route('**/api/imports/9/dashboard*',r=>r.fulfill({json:report(9)}));
 await page.route('**/api/imports/upload',r=>{attempts++;return attempts===1?r.fulfill({status:428,json:{detail:'Bitte Datenschutz bestätigen.'}}):r.fulfill({json:{import_id:9}});});
 await page.route('**/api/account/consent',r=>r.fulfill({json:user}));
 await page.goto('/');await expect(page.getByTestId('official-credits')).toBeVisible();await page.getByLabel('Leistungen PDF aktualisieren').setInputFiles(pdf);
 const dialog=page.getByRole('dialog',{name:'Datenschutz vor dem PDF-Upload',exact:true});
 await expect(dialog).toBeVisible();await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Bestätigen und PDF hochladen',exact:true}).click();
 await expect(dialog).toHaveCount(0);await expect(page.getByTestId('official-credits')).toHaveText('195 / 210');expect(attempts).toBe(2);
});
