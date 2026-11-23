// Read-only local QA plus browser-only planning in an isolated test context.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const studentEmail=process.env.SMOKE_STUDENT_EMAIL,studentPassword=process.env.SMOKE_STUDENT_PASSWORD;
if(!studentEmail||!studentPassword)throw new Error('Set SMOKE_STUDENT_EMAIL and SMOKE_STUDENT_PASSWORD for an explicitly authorized test account.');
const base=process.env.SMOKE_URL || 'http://host.docker.internal:5173';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1200}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(base);
 await page.getByLabel('E-Mail-Adresse').fill(studentEmail);
 await page.getByLabel('Passwort',{exact:true}).fill(studentPassword);
 await page.getByRole('button',{name:'Einloggen',exact:true}).click();
 await page.getByRole('heading',{name:'Füge dein Studium hinzu',exact:true}).waitFor();
 const user=await (await page.request.get(`${base}/api/auth/me`)).json();
 const importsBefore=await (await page.request.get(`${base}/api/imports`)).json();
 const catalogBefore=await (await page.request.get(`${base}/api/programs/wi/catalog`)).json();
 for (const scenario of ['open','practice','thesis']) {
  await page.goto(`${base}/?example=${scenario}`);
  await page.getByRole('heading',{name:'Mein Status',exact:true}).waitFor();
  assert.equal(await page.getByTestId('study-stage-praxissemester').count(),0);
  assert.equal(await page.getByTestId('study-stage-abschnitt_2').getByRole('button',{name:'Praktikum: Bestanden',exact:true}).count(),scenario==='thesis'?1:0);
  assert.equal(await page.getByRole('region',{name:'Importprüfung'}).count(),0);
  assert.equal(await page.getByText('Zuordnung prüfen',{exact:true}).count(),0);
  assert.equal(await page.evaluate(id=>localStorage.getItem(`stage-gate.profile:${id}`),user.id),null);
  await page.screenshot({path:`test-results/student-example-${scenario}.png`,fullPage:true});
  if(scenario==='practice' || scenario==='thesis') {
   const groupName=scenario==='practice'?'Praktikum & Praxisseminar':'Bachelorarbeit & Seminar';
   const group=page.getByRole('region',{name:groupName,exact:true});
   assert.equal(await group.getAttribute('draggable'),'true');
   const target=page.getByLabel('Module in aktuelles Semester ziehen');
   const main=scenario==='practice'?'Praktikum':'Bachelorarbeit';await page.getByRole('button',{name:`${main}: Offen`,exact:true}).click();await page.getByRole('dialog').getByRole('checkbox').check();await page.getByRole('button',{name:'Details schließen'}).click();
   await group.dragTo(target);
   assert.equal(await target.locator('button:not([title="Aus Semester entfernen"])').count(),2);
   await target.locator('button:not([title="Aus Semester entfernen"])').first().click();
   assert.equal(await page.getByRole('dialog').getByRole('button',{name:'Aus aktuellem Semester entfernen'}).count(),1);
   await page.screenshot({path:`test-results/student-example-${scenario}-card.png`,fullPage:true});
   await page.keyboard.press('Escape');
  }
 }
 await page.goto(base);
 await page.getByLabel('Studiengang',{exact:true}).selectOption('Wirtschaftsinformatik (B.Sc.)');
 await page.getByLabel('Studienbeginn',{exact:true}).selectOption('SoSe 2021');
 await page.getByRole('button',{name:'Studienplan ohne PDF öffnen',exact:true}).click();
 await page.getByRole('heading',{name:'Mein Status',exact:true}).waitFor();
 assert.ok(importsBefore.length,'Sample account should retain its existing PDF import');
 assert.equal(importsBefore.find(i=>i.status==='success')?.overall_credits,195,'Use a sample account whose latest upload has 195 ECTS');
 await page.getByTestId('official-credits').waitFor();
 assert.equal(await page.getByTestId('official-credits').innerText(),'195 / 210');
 assert.equal(await page.getByTestId('official-grade').innerText(),'2,52');
 await page.screenshot({path:'test-results/student-actual-simplified.png',fullPage:true});
 await page.getByRole('button',{name:'Programmieren 1: Bestanden',exact:true}).click();
 assert.equal(await page.getByRole('dialog').getByText('Angeboten im:',{exact:false}).count(),0);
 assert.equal(await page.getByRole('dialog').getByRole('link').count(),0);
 assert.equal(await page.getByRole('region',{name:'Prüfungsversuche'}).isVisible(),false);
 await page.screenshot({path:'test-results/student-passed-card.png',fullPage:true});
 await page.getByRole('dialog').locator('summary').filter({hasText:'Details aus HISinOne'}).click();
 assert.equal(await page.getByRole('region',{name:'Prüfungsversuche'}).getByRole('row').count(),3);
 await page.keyboard.press('Escape');
 const target=page.getByLabel('Module in aktuelles Semester ziehen');
 const ba=page.getByRole('button',{name:'Bachelorarbeit: Offen',exact:true});
 assert.equal(await ba.getAttribute('draggable'),'true');
 await ba.dragTo(target);
 assert.equal(await target.locator('button:not([title="Aus Semester entfernen"])').count(),1);
 await page.getByRole('button',{name:'Bachelorseminar: Offen',exact:true}).dragTo(target);
 assert.equal(await target.locator('button:not([title="Aus Semester entfernen"])').count(),2);
 assert.equal(await page.getByTestId('official-credits').innerText(),'195 / 210');
 await page.screenshot({path:'test-results/student-actual-thesis-planned.png',fullPage:true});
 const importsAfter=await (await page.request.get(`${base}/api/imports`)).json();
 const catalogAfter=await (await page.request.get(`${base}/api/programs/wi/catalog`)).json();
 assert.deepEqual(importsAfter,importsBefore);assert.equal(catalogAfter.revision,catalogBefore.revision);
 assert.deepEqual(errors,[]);
 console.log('PASS: 3 fictional scenarios; individual/pair drag, compact completed card, practice in Abschnitt 2, actual 195 ECTS / 2.52, no import or catalog writes, no browser errors.');
} finally { await browser.close(); }
