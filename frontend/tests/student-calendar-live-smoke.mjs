// Real compiled app + public curriculum/schedule API. Synthetic login and empty
// imports only; no server writes. Proxy Docker's bridge to a trusted localhost
// browser origin so Web Crypto has the same capabilities as the user's app.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const bridge=process.env.SMOKE_URL||'http://host.docker.internal:5173',base='http://localhost:5173';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1920,height:1200}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route(`${base}/**`,async route=>{
 const url=route.request().url();
 if(url.endsWith('/api/auth/me'))return route.fulfill({json:{id:999991,name:'Calendar test',email:'calendar@example.test',role:'student'}});
 if(url.endsWith('/api/imports'))return route.fulfill({json:[]});
 assert.equal(route.request().method(),'GET');
 return route.fulfill({response:await route.fetch({url:url.replace(base,bridge)})});
});
try{
 await page.goto(`${base}/?example=open`);await page.getByRole('heading',{name:'Mein Status',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>isSecureContext),true);
 await page.getByRole('button',{name:'Betriebswirtschaftslehre 2: Offen',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Zum aktuellen Semester hinzufügen',exact:true}).click();await page.getByRole('button',{name:'Details schließen'}).click();
 assert.equal(await page.locator('[data-planned-module="wi.req.bwl2"]').count(),1);
 assert.equal(await page.getByTestId('semester-ects').innerText(),'7 ECTS');
 await page.getByLabel('Module in aktuelles Semester ziehen').getByRole('button',{name:'Betriebswirtschaftslehre 2 7 ECTS',exact:true}).click();
 const bw=page.getByRole('dialog');
 for(const variant of await bw.getByTestId('meeting-variant').all())await variant.locator('summary').click();
 assert.equal(await bw.getByRole('combobox').count(),0);
 const choose=bw.getByRole('button',{name:/: Zum Kalender hinzufügen$/});while(await choose.count())await choose.first().click();
 await bw.getByRole('group',{name:'Kalendereinstellungen'}).locator('summary').click();await bw.getByLabel('Zeitraum von',{exact:true}).fill('2026-10-01');await bw.getByLabel('Zeitraum bis',{exact:true}).fill('2026-10-31');
 const bwEvent=page.waitForEvent('download');await bw.getByRole('button',{name:'Für Outlook herunterladen (.ics)',exact:true}).click();
 const bwFile=await bwEvent,bwStream=await bwFile.createReadStream();let bwIcs='';for await(const chunk of bwStream)bwIcs+=chunk.toString();
 const zoomEvents=bwIcs.split('BEGIN:VEVENT').slice(1).filter(event=>event.includes('LOCATION:Zoom'));
 assert.equal(zoomEvents.length,1);assert.ok(zoomEvents[0].includes('DTSTART:20261001T080000Z'));assert.ok((bwIcs.match(/BEGIN:VEVENT/g)||[]).length>1);
 await page.getByRole('button',{name:'Details schließen'}).click();
 await page.getByRole('button',{name:'Betriebswirtschaftslehre 2 aus Semester entfernen',exact:true}).click();
 await page.getByRole('button',{name:'Software Engineering: Offen',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Zum aktuellen Semester hinzufügen',exact:true}).click();
 await page.getByRole('button',{name:'Details schließen'}).click();
 await page.getByLabel('Module in aktuelles Semester ziehen').getByRole('button',{name:/^Software Engineering .*ECTS/}).click();
 const dialog=page.getByRole('dialog');
 await dialog.getByRole('button',{name:'Eigene Variante hinzufügen'}).click();
 const form=dialog.getByRole('form',{name:'Eigene Terminvariante bearbeiten'});
 await form.getByLabel('Bezeichnung',{exact:true}).fill('Privater Kalender-Test');
 await form.getByLabel('Wochentag',{exact:true}).selectOption('2');
 await form.getByRole('button',{name:'Terminvariante speichern'}).click();
 await dialog.getByRole('button',{name:'Privater Kalender-Test: Zum Kalender hinzufügen',exact:true}).click();
 await dialog.getByRole('group',{name:'Kalendereinstellungen'}).locator('summary').click();
 await dialog.getByLabel('Zeitraum von',{exact:true}).fill('2026-11-16');await dialog.getByLabel('Zeitraum bis',{exact:true}).fill('2026-11-22');
 assert.equal(await dialog.getByLabel('Titel im Kalender',{exact:true}).inputValue(),'SE');
 const event=page.waitForEvent('download');await dialog.getByRole('button',{name:'Für Outlook herunterladen (.ics)',exact:true}).click();
 const file=await event;assert.equal(file.suggestedFilename(),'SE.ics');
 const stream=await file.createReadStream();let ics='';for await(const chunk of stream)ics+=chunk.toString();
 assert.ok(ics.includes('SUMMARY:SE'));assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,1);
 await page.screenshot({path:'test-results/live-calendar-private.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS: compiled app + real BWL2 and SE schedules; BWL2 dated Zoom intro exported once without a rhythm selector; private variant, selected .ics download, one event named SE, no browser errors or server writes.');
}finally{await browser.close();}
