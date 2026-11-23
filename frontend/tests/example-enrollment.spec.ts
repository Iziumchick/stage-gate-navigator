import {test,expect} from './fixtures';
const personal={name:'Student',program:'Wirtschaftsinformatik (B.Sc.)',startTerm:'SoSe 2022',referenceTerm:'WiSe 2026/27'};
const cases={
 first:{start:'WiSe 2026/27',edition:'wi_bsc_2026',credits:0,semesters:0,color:'neutral'},
 practice:{start:'WiSe 2024/25',edition:'wi_bsc_2023',credits:90,semesters:4,color:'yellow'},
 thesis:{start:'SoSe 2021',edition:'wi_bsc_2012',credits:195,semesters:11,color:'red'},
};
test('scenario enrollment drives the header, SPO and pace without changing the real study profile',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-11-16T10:00:00Z'));
 await page.addInitScript(value=>localStorage.setItem('stage-gate.profile:1',JSON.stringify(value)),personal);
 await page.route('**/api/imports',r=>r.fulfill({json:[]}));
 const requests:string[]=[];
 await page.route('**/api/programs/wi/examples/*',r=>{
  const url=new URL(r.request().url()),id=url.pathname.split('/').at(-1) as keyof typeof cases,c=cases[id];requests.push(url.search);
  return r.fulfill({json:{import_id:null,example_scenario:id,example_start_term:c.start,example_label:id,program:'Wirtschaftsinformatik',supported:true,official_credits:c.credits,official_grade:2.7,spo_version:c.edition,curriculum_edition:c.edition,unmatched_groups:[],stages:[]}});
 });
 await page.route('**/api/programs/wi/dashboard?*',r=>{
  expect(new URL(r.request().url()).searchParams.get('start_term')).toBe(personal.startTerm);
  return r.fulfill({json:{import_id:null,program:'Wirtschaftsinformatik',supported:true,official_credits:null,official_grade:null,spo_version:'Personal SPO',stages:[],unmatched_groups:[]}});
 });
 await page.goto('/?example=first');
 for(const [id,c] of Object.entries(cases)){
  await page.getByLabel('Testbeispiel auswählen',{exact:true}).selectOption(`example:${id}`);
  await expect(page.getByTestId('official-credits')).toHaveText(`${c.credits} / 210`);
  const study=page.getByRole('group',{name:'Studieninformationen',exact:true});
  await expect(study.locator('summary')).toContainText(`Start ${c.start}`);
  await study.locator('summary').click();await expect(study).toContainText(c.edition);await study.locator('summary').click();
  await page.getByLabel(`ECTS-Tempo: ${c.color}`,{exact:true}).hover();
  await expect(page.getByRole('tooltip').filter({hasText:c.semesters?`${c.semesters} abgeschlossene Semester`:'Im ersten laufenden Semester wird noch kein Durchschnitt bewertet.'})).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('stage-gate.profile:1')!))).toEqual(personal);
 }
 expect(requests.length).toBeGreaterThanOrEqual(3);expect(requests.every(q=>!new URLSearchParams(q).has('start_term'))).toBe(true);
 await page.getByLabel('Testbeispiel auswählen',{exact:true}).selectOption('catalog');
 await expect(page.getByTestId('official-credits')).toHaveText('— / 210');
 await expect(page.getByRole('group',{name:'Studieninformationen',exact:true}).locator('summary')).toContainText('Start SoSe 2022');
});
