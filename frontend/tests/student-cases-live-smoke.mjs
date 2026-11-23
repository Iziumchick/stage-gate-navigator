// Read-only deployed examples and real test-account data; planning stays in this browser context.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const studentEmail=process.env.SMOKE_STUDENT_EMAIL,studentPassword=process.env.SMOKE_STUDENT_PASSWORD;
if(!studentEmail||!studentPassword)throw new Error('Set SMOKE_STUDENT_EMAIL and SMOKE_STUDENT_PASSWORD for an explicitly authorized test account.');
const base=process.env.SMOKE_URL||'http://host.docker.internal:5173';
const browser=await chromium.launch({headless:true}), page=await browser.newPage({viewport:{width:1920,height:1200}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.clock.setFixedTime(new Date('2026-11-16T10:00:00Z'));
 await page.goto(base);await page.getByLabel('E-Mail-Adresse').fill(studentEmail);await page.getByLabel('Passwort',{exact:true}).fill(studentPassword);await page.getByRole('button',{name:'Einloggen',exact:true}).click();await page.getByRole('heading',{name:'Füge dein Studium hinzu',exact:true}).waitFor();
 const user=await(await page.request.get(`${base}/api/auth/me`)).json();
 const imports=await(await page.request.get(`${base}/api/imports`)).json(),catalog=await(await page.request.get(`${base}/api/programs/wi/catalog`)).json();
 const cases=['first','open','practice','third','practice-seminar','thesis','thesis-seminar','repeat-first','repeat-later','repeat-due','repeat-no-course','repeat-unknown','repeat-review'];
 for(const id of cases) {
  await page.goto(`${base}/?example=${id}`);await page.getByRole('heading',{name:'Mein Status',exact:true}).waitFor();
  const d=await(await page.request.get(`${base}/api/programs/wi/examples/${id}?term=WiSe%202026%2F27`)).json();
  assert.ok((await page.getByRole('group',{name:'Studieninformationen'}).innerText()).includes(`Start ${d.example_start_term}`));
  assert.equal(await page.getByTestId('official-credits').innerText(),`${d.official_credits} / 210`);
  assert.equal(await page.evaluate(uid=>localStorage.getItem(`stage-gate.profile:${uid}`),user.id),null);
  assert.equal(await page.getByRole('heading',{name:'Praxissemester',exact:true}).count(),0);
  const repeats=page.getByLabel('Module in aktuelles Semester ziehen').getByRole('button',{name:/Prüfungswiederholung/});
  assert.equal(await repeats.count(),['repeat-first','repeat-due','repeat-no-course'].includes(id)?1:0);
  if(['first','third','practice-seminar','thesis-seminar','repeat-first','repeat-later','repeat-no-course','repeat-unknown'].includes(id)) await page.screenshot({path:`test-results/case-${id}.png`,fullPage:true});
  if(id==='repeat-first') {
   const area=page.getByLabel('Module in aktuelles Semester ziehen');
   await repeats.click();
   const dialog=page.getByRole('dialog');
   await dialog.locator('summary').filter({hasText:'Verschiebung & Entfernen aus dem Semester'}).click();
   await dialog.getByLabel('Ich habe die Bestätigung erhalten',{exact:false}).check();
   await dialog.getByRole('button',{name:'Aus aktuellem Semester entfernen'}).click();
   assert.equal(await repeats.count(),0);
   await page.getByRole('button',{name:'Statistik: Nicht bestanden',exact:true}).click();
   await dialog.locator('summary').filter({hasText:'Verschiebung & Entfernen aus dem Semester'}).click();
   await dialog.getByLabel('Ich habe die Bestätigung erhalten',{exact:false}).uncheck();
   await dialog.getByRole('status').filter({hasText:'wieder im aktuellen Semester eingeplant'}).waitFor();
   await page.keyboard.press('Escape');
   assert.equal(await repeats.count(),1);
   assert.ok((await area.innerText()).includes('Pflichtwiederholung wieder im aktuellen Semester eingeplant.'));
   await page.reload();await page.getByRole('heading',{name:'Mein Status',exact:true}).waitFor();
   assert.equal(await repeats.count(),1);
  }
  if(id==='repeat-no-course') {
   await repeats.click();await page.getByRole('region',{name:'Wiederholungsplanung'}).waitFor();
   await page.getByRole('dialog').locator('summary').filter({hasText:'Verschiebung & Entfernen aus dem Semester'}).click();
   assert.ok((await page.getByRole('dialog').innerText()).includes('das fehlende Lehrangebot allein ist keine Bestätigung'));
   assert.equal(await page.getByRole('dialog').locator('input[type="date"]').count(),0);
   assert.equal(await page.getByRole('dialog').getByRole('button',{name:'Aus aktuellem Semester entfernen'}).isDisabled(),true);
   await page.screenshot({path:'test-results/case-retake-details.png',fullPage:true});await page.keyboard.press('Escape');
  }
  if(id==='third') assert.equal(await page.getByRole('button',{name:'Bachelorarbeit: Offen',exact:true}).getAttribute('draggable'),'false');
  if(id==='repeat-review') assert.equal(await page.locator('[data-module-id="wi.req.statistik"]').getAttribute('draggable'),'false');
  console.log(`PASS example ${id}: ${d.official_credits} ECTS`);
 }
 await page.goto(base);await page.getByLabel('Studiengang',{exact:true}).selectOption('Wirtschaftsinformatik (B.Sc.)');await page.getByLabel('Studienbeginn',{exact:true}).selectOption('SoSe 2021');await page.getByRole('button',{name:'Studienplan ohne PDF öffnen',exact:true}).click();await page.getByRole('heading',{name:'Mein Status',exact:true}).waitFor();
 const sample=imports.find(i=>i.status==='success');assert.equal(sample?.overall_credits,195,'Use a sample account whose latest upload has 195 ECTS');
 await page.getByTestId('official-credits').waitFor();assert.equal(await page.getByTestId('official-credits').innerText(),'195 / 210');assert.equal(await page.getByTestId('official-grade').innerText(),'2,52');
 const help=page.getByRole('group',{name:'PDF aus HISinOne erstellen'});await help.locator('summary').click();await page.getByRole('heading',{name:'PDF aus HISinOne erstellen'}).waitFor();await page.screenshot({path:'test-results/pdf-help-near-upload.png',fullPage:true});await page.getByRole('button',{name:'PDF aus HISinOne erstellen schließen'}).click();
 await page.getByRole('button',{name:'Bachelorarbeit: Offen',exact:true}).click();await page.getByRole('checkbox',{name:'Meine Bachelorarbeit ist offiziell angemeldet.',exact:false}).check();await page.getByRole('dialog').getByRole('button',{name:'Zum aktuellen Semester hinzufügen',exact:true}).click();await page.getByRole('button',{name:'Details schließen'}).click();await page.getByRole('button',{name:'Bachelorarbeit aus Semester entfernen',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),0);
 assert.deepEqual(await(await page.request.get(`${base}/api/imports`)).json(),imports);assert.equal((await(await page.request.get(`${base}/api/programs/wi/catalog`)).json()).revision,catalog.revision);assert.deepEqual(errors,[]);
 console.log('PASS: 13 scenarios, PDF help close, direct remove, actual results unchanged, revoked exemption restores the repeat after reload; no import/catalog writes or browser errors.');
}finally{await browser.close();}
