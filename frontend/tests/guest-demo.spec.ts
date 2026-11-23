import {test, expect} from './fixtures';

const profile = {name:'Personal profile',program:'Wirtschaftsinformatik (B.Sc.)',startTerm:'SoSe 2022',referenceTerm:'WiSe 2026/27'};
const module = {id:'pg2',title:'Programmieren 2',short_title:'PG2',required_ects:8,actual_ects:null,grade:null,status:'unknown',source:null,admission:{status:'available',reason:'Verfügbar'},semester_offered:true};
const example = (scenario:string) => ({demo:true,import_id:null,program:'Wirtschaftsinformatik',supported:true,official_credits:0,official_grade:null,spo_version:'SPO 2026',curriculum_edition:'wi_bsc_2026',example_scenario:scenario,example_start_term:'WiSe 2026/27',example_term:'WiSe 2026/27',unmatched_groups:[],stages:[{id:'abschnitt_1',title:'Abschnitt 1',modules:[module]}]});

test.beforeEach(async({page}) => {
  await page.route('**/api/demo/wi/examples/*',route => route.fulfill({json:example(new URL(route.request().url()).pathname.split('/').at(-1)!)}));
});

test('login offers five anonymous scenarios without requesting accounts, imports or an upload',async({page}) => {
  await page.route('**/api/auth/me',route => route.fulfill({status:401,json:{detail:'Bitte anmelden.'}}));
  const optionsLoaded=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/auth/options');
  await page.goto('/');
  await optionsLoaded;
  await expect(page.getByRole('link',{name:'Demo ohne Anmeldung ansehen'})).toBeVisible();
  const calls:string[]=[];
  page.on('request',r => {if(r.url().includes('/api/')) calls.push(new URL(r.url()).pathname);});
  await page.getByRole('link',{name:'Demo ohne Anmeldung ansehen'}).click();
  await expect(page.getByTestId('official-credits')).toHaveText('0 / 210');
  await expect(page.getByLabel('Demonstration · Beispiel auswählen').locator('option')).toHaveCount(5);
  await expect(page.getByRole('region',{name:'Demonstrationshinweis'})).toContainText('Keine persönlichen Leistungsdaten');
  await expect(page.locator('input[type=file]')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Studienangaben bearbeiten',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Datenschutz & Daten',exact:true})).toHaveCount(0);
  expect(calls).toEqual(['/api/demo/wi/examples/first']);
});

test('guest planning is isolated per scenario and reset preserves all personal browser data',async({page}) => {
  await page.addInitScript(value => {
    if(!localStorage.getItem('stage-gate.profile:1')){
      localStorage.setItem('stage-gate.profile:1',JSON.stringify(value));
      localStorage.setItem('stage-gate.selection:1','7');
      localStorage.setItem('stage-gate.module:1:wi:WiSe 2026/27:pg2',JSON.stringify({notes:'Personal note'}));
    }
  },profile);
  await page.goto('/?demo=first');
  await page.getByRole('button',{name:'Programmieren 2: Offen',exact:true}).click();
  await page.getByRole('button',{name:'Zum aktuellen Semester hinzufügen',exact:true}).click();
  await page.getByRole('button',{name:'Details schließen',exact:true}).click();
  const planned=page.locator('[data-planned-module="pg2"]');
  await expect(planned).toHaveCount(1);
  await page.reload();await expect(planned).toHaveCount(1);
  await page.getByLabel('Demonstration · Beispiel auswählen').selectOption('open');
  await expect(page).toHaveURL(/demo=open/);await expect(page.getByTestId('official-credits')).toBeVisible();
  await expect(planned).toHaveCount(0);
  await page.getByLabel('Demonstration · Beispiel auswählen').selectOption('first');await expect(planned).toHaveCount(1);
  await page.getByRole('button',{name:'Beispiel zurücksetzen',exact:true}).click();await expect(planned).toHaveCount(0);
  const own=await page.evaluate(() => ({profile:JSON.parse(localStorage.getItem('stage-gate.profile:1')!),selection:localStorage.getItem('stage-gate.selection:1'),notes:JSON.parse(localStorage.getItem('stage-gate.module:1:wi:WiSe 2026/27:pg2')!).notes}));
  expect(own).toEqual({profile,selection:'7',notes:'Personal note'});
});

test('personal report uses the registered name and replaces an old saved example with the own plan',async({page}) => {
  await page.addInitScript(value => {localStorage.setItem('stage-gate.profile:1',JSON.stringify(value));localStorage.setItem('stage-gate.selection:1','example:practice');},profile);
  await page.route('**/api/imports',r => r.fulfill({json:[]}));
  await page.route('**/api/programs/wi/dashboard?*',r => r.fulfill({json:{...example('first'),demo:false,example_scenario:undefined,official_credits:null}}));
  const calls:string[]=[];page.on('request',r => calls.push(r.url()));
  await page.goto('/');
  await expect(page.getByTestId('personal-report-owner')).toHaveText('Sergii · Mein Studienstand');
  await expect(page.getByTestId('official-credits')).toHaveText('— / 210');
  await expect(page.locator('#import-select option[value^="example:"]')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Beispiel ansehen',exact:true})).toHaveCount(0);
  expect(calls.some(url=>url.includes('/examples/'))).toBe(false);
});

test('leaving the demo returns to a real account without transferring a scenario or profile',async({page}) => {
  await page.route('**/api/imports',r => r.fulfill({json:[]}));
  await page.goto('/?demo=thesis');
  await expect(page.getByTestId('official-credits')).toBeVisible();
  await page.getByRole('link',{name:'Eigene Leistungen ansehen',exact:true}).click();
  await expect(page.getByTestId('personal-report-owner')).toContainText('Sergii');
  await expect(page.getByRole('heading',{name:'Füge dein Studium hinzu',exact:true})).toBeVisible();
  await expect(page.locator('#import-select option[value^="example:"]')).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('stage-gate.profile:1'))).toBeNull();
});
