// Explicit opt-in smoke against the local app; writes a PDF import to a test account.
// Credentials and sample paths are supplied externally, no personal PDFs in repository.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const base=process.env.SMOKE_URL || 'http://host.docker.internal:5173';
const accounts=JSON.parse(process.env.SMOKE_STUDENT_ACCOUNTS||'{}');
for(const key of ['Student2026','Student2023','Student2022']) {
 if(!accounts[key]?.email||!accounts[key]?.password)throw new Error(`SMOKE_STUDENT_ACCOUNTS must provide email and password for ${key}.`);
}
const browser=await chromium.launch({headless:true});
const errors=[];
try {
  for (const [account,start,edition,count] of [['Student2026','WiSe 2026/27','wi_bsc_2026',35],['Student2023','WiSe 2023/24','wi_bsc_2023',35],['Student2022','SoSe 2021','wi_bsc_2012',33]]) {
    const context=await browser.newContext({viewport:{width:1920,height:1200}});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);
    await page.getByLabel('E-Mail-Adresse').fill(accounts[account].email);
    await page.getByLabel('Passwort',{exact:true}).fill(accounts[account].password);
    await page.getByRole('button',{name:'Einloggen',exact:true}).click();
    await page.getByRole('heading',{name:'Füge dein Studium hinzu',exact:true}).waitFor();
    await page.getByLabel('Studiengang',{exact:true}).selectOption('Wirtschaftsinformatik (B.Sc.)');
    await page.getByLabel('Studienbeginn',{exact:true}).selectOption(start);
    assert.equal(await page.getByLabel('Fachsemester',{exact:true}).count(),0);
    if(account!=='Student2022') {
      await page.getByRole('button',{name:'Studienplan ohne PDF öffnen',exact:true}).click();
      await page.getByRole('heading',{name:'Mein Status',exact:true}).waitFor();
      const response=await page.request.get(`${base}/api/programs/wi/dashboard?start_term=${encodeURIComponent(start)}&term=WiSe%202026%2F27`);
      assert.equal(response.status(),200);const d=await response.json();
      assert.equal(d.curriculum_edition,edition);
      assert.equal(d.stages.flatMap(s=>s.modules).length,count);
      assert.ok(d.stages.flatMap(s=>s.modules).every(m=>m.status!=='passed'));
      await page.screenshot({path:`test-results/live-${account.toLowerCase()}-empty.png`,fullPage:true});
    } else {
      assert.ok(process.env.LEISTUNGEN_PDF,'Set LEISTUNGEN_PDF to the explicitly supplied sample');
      await page.getByLabel('Leistungen PDF',{exact:true}).setInputFiles(process.env.LEISTUNGEN_PDF);
      const upload=page.waitForResponse(r=>r.url().endsWith('/api/imports/upload'));
      await page.getByRole('button',{name:'Mein Dashboard anzeigen',exact:true}).click();
      const uploaded=await upload;assert.equal(uploaded.status(),200);const {import_id}=await uploaded.json();
      await page.getByTestId('official-credits').waitFor();
      assert.equal(await page.getByTestId('official-credits').innerText(),'195 / 210');
      assert.equal(await page.getByTestId('official-grade').innerText(),'2,52');
      const d=await (await page.request.get(`${base}/api/imports/${import_id}/dashboard?start_term=${encodeURIComponent(start)}&term=WiSe%202026%2F27`)).json();
      assert.equal(d.curriculum_edition,edition);
      const modules=d.stages.flatMap(s=>s.modules);
      assert.equal(modules.length,count);assert.equal(modules.filter(m=>m.status==='passed').length,31);
      assert.equal(d.unmatched_groups.length,0);
      assert.equal(d.import_report.attempt_count,41);assert.equal(d.import_report.open_exam_count,0);
      const pg1=modules.find(m=>m.id==='wi.req.pg1');assert.equal(pg1.exam_history.length,2);assert.equal(pg1.status,'passed');
      await page.screenshot({path:'test-results/live-leistungen-dashboard.png',fullPage:true});
      await page.getByRole('button',{name:`${pg1.title}: Bestanden`,exact:true}).click();
      await page.getByRole('dialog').locator('summary').filter({hasText:'Details aus HISinOne'}).click();
      await page.getByRole('region',{name:'Prüfungsversuche'}).waitFor();
      assert.equal(await page.getByRole('region',{name:'Prüfungsversuche'}).getByRole('row').count(),3);
      const bounds=await page.getByRole('region',{name:'Prüfungsversuche'}).boundingBox();
      const modal=await page.getByRole('dialog').boundingBox();
      assert.ok(bounds && modal && bounds.y>=modal.y && bounds.y+bounds.height<=modal.y+modal.height,'Attempt history should be visible after expanding HISinOne details');
      await page.screenshot({path:'test-results/live-leistungen-history.png',fullPage:true});
      await page.keyboard.press('Escape');
      if (process.env.OLD_NOTEN_PDF) {
        const invalid=await page.request.post(`${base}/api/imports/upload`,{headers:{'X-Requested-With':'StudyNavigator'},multipart:{file:{name:'Notenbestaetigung.pdf',mimeType:'application/pdf',buffer:await readFile(process.env.OLD_NOTEN_PDF)}}});
        assert.equal(invalid.status(),422);
        assert.equal(await page.getByTestId('official-credits').innerText(),'195 / 210');
      }
      console.log(`PASS: sample Leistungen persisted to ${account}; ${modules.filter(m=>m.status==='passed').length}/${count} passed, 41 records, 0 current negative results, totals 195 / 2.52.`);
    }
    console.log(`PASS: ${account} ${edition}, ${count} curriculum positions.`);
    await context.close();
  }
  assert.deepEqual(errors,[]);
} finally { await browser.close(); }
