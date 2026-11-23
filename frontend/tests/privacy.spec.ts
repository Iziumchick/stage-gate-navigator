import {test,expect} from './fixtures';
import {readFileSync} from 'node:fs';
async function open(page:any){
 await page.route('**/api/imports',(r:any)=>r.fulfill({json:[{id:7,status:'success',created_at:'2026-11-16T10:00:00Z'}]}));
 await page.route('**/api/privacy',(r:any)=>r.fulfill({json:{ready:false,retention_days:90}}));
 await page.addInitScript(()=>{localStorage.setItem('stage-gate.profile:1',JSON.stringify({name:'Own',program:'Wirtschaftsinformatik (B.Sc.)',startTerm:'SoSe 2021',referenceTerm:'WiSe 2026/27'}));localStorage.setItem('stage-gate.module:1:wi:test','own-plan');localStorage.setItem('stage-gate.module:11:wi:test','other-plan');});
 await page.goto('/?preview=welcome');await page.getByRole('button',{name:'Datenschutz & Daten',exact:true}).click();
}
test('privacy notice distinguishes transient PDFs from retained personal results and identifies the prototype',async({page})=>{
 await open(page);await page.getByRole('dialog').getByRole('button',{name:'Datenschutzinformation lesen',exact:true}).click();
 const notice=page.getByRole('dialog').last();await expect(notice).toContainText('nicht Betreiberin oder Verantwortliche');await expect(notice).toContainText('strukturierten Ergebnisse');await expect(notice).toContainText('keine anonymen Daten');await expect(notice).toContainText('noch nicht für öffentliche Tests konfiguriert');
});
test('JSON export contains this account and this browser only; deleting browser data preserves another account',async({page},info)=>{
 await page.route('**/api/account/export',r=>r.fulfill({json:{account:{email:'own@example.test'},imports:[{id:7,ects:90}]}}));
 await open(page);const dialog=page.getByRole('dialog');const event=page.waitForEvent('download');await dialog.getByRole('button',{name:'Meine Daten herunterladen (JSON)',exact:true}).click();const file=await event,path=info.outputPath('own-data.json');await file.saveAs(path);const text=readFileSync(path,'utf8');expect(text).toContain('own-plan');expect(text).not.toContain('other-plan');expect(text).not.toContain('password_hash');
 await dialog.getByRole('button',{name:'Nur Browserdaten löschen',exact:true}).click();await expect(dialog.getByRole('button',{name:'Endgültig löschen',exact:true})).toBeDisabled();await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Endgültig löschen',exact:true}).click();
 const values=await page.evaluate(()=>({own:localStorage.getItem('stage-gate.module:1:wi:test'),other:localStorage.getItem('stage-gate.module:11:wi:test')}));expect(values).toEqual({own:null,other:'other-plan'});
});
test('account deletion requires a password and an explicit confirmation before clearing local data',async({page})=>{
 let called=0;await page.route('**/api/account/delete',r=>{called++;expect(JSON.parse(r.request().postData()!).password).toBe('my-current-password');return r.fulfill({json:{deleted:true}});});
 await open(page);const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Konto und zugehörige Daten löschen',exact:true}).click();const remove=dialog.getByRole('button',{name:'Endgültig löschen',exact:true});await expect(remove).toBeDisabled();await dialog.getByRole('checkbox').check();await expect(remove).toBeDisabled();await dialog.getByLabel('Aktuelles Passwort',{exact:true}).fill('my-current-password');await remove.click();await expect(page.getByRole('button',{name:'Einloggen',exact:true})).toBeVisible();expect(called).toBe(1);expect(await page.evaluate(()=>localStorage.getItem('stage-gate.profile:1'))).toBeNull();
});
test('an existing account confirms the current notice in the upload dialog before any PDF is sent',async({page})=>{
 const user={id:1,name:'Student',email:'student@example.test',role:'student',privacy_version:null};
 let sent=0;
 await page.route('**/api/auth/me',r=>r.fulfill({json:user}));
 await page.route('**/api/imports',r=>r.fulfill({json:sent?[{id:8,status:'success'}]:[]}));
 await page.route('**/api/account/consent',r=>r.fulfill({json:{...user,privacy_version:'2026-11-21'}}));
 await page.route('**/api/imports/upload',r=>{sent++;return r.fulfill({json:{import_id:8}});});
 await page.route('**/api/imports/8/dashboard*',r=>r.fulfill({json:{import_id:8,program:'Wirtschaftsinformatik',supported:true,official_grade:2,official_credits:30,spo_version:'Test',stages:[],unmatched_groups:[]}}));
 await page.goto('/?preview=dashboard');
 await expect(page.getByRole('region',{name:'Datenschutzbestätigung',exact:true})).toHaveCount(0);
 await page.getByLabel('Leistungen PDF aktualisieren').setInputFiles({name:'Leistungen.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 test')});
 const dialog=page.getByRole('dialog',{name:'Datenschutz vor dem PDF-Upload',exact:true});
 await expect(dialog).toBeVisible();expect(sent).toBe(0);
 const confirm=dialog.getByRole('button',{name:'Bestätigen und PDF hochladen',exact:true});
 await expect(confirm).toBeDisabled();await dialog.getByRole('checkbox').check();await confirm.click();
 await expect(dialog).toHaveCount(0);await expect(page.getByTestId('official-credits')).toHaveText('30 / 210');expect(sent).toBe(1);
});
