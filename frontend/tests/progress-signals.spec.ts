import {test,expect} from './fixtures';
const passed={id:'wi.req.pg1',title:'Programmieren 1',short_title:'PG1',required_ects:8,actual_ects:8,grade:'2.3',status:'passed',source:null};
const locked={id:'wi.req.statistik',title:'Statistik',short_title:'ST',required_ects:5,actual_ects:null,grade:null,status:'unknown',source:null,semester_offered:false,admission:{status:'unknown',reason:'Abschnitt 2 benötigt 30 ECTS. Es fehlen noch 22 ECTS.'}};
const pending={id:'wi.req.praktikum',title:'Praktikum',short_title:'PRAX',required_ects:24,actual_ects:24,grade:null,status:'unknown',result_status:'passed',completion_pending:true,credited_ects:0,credit_hold_reason:'Nachweis vorhanden. Praxisseminar fehlt; Block-ECTS werden noch nicht angesetzt.',source:null,planning:{status:'completed',kind:'practice',reason:'Nachweis vorhanden.',registration_note:'',steps:[],info_url:'',source:'SPO2023'}};
const data={import_id:null,program:'Wirtschaftsinformatik',supported:true,official_grade:2.5,official_credits:110,curriculum_edition:'wi_bsc_2023',example_scenario:'first',example_label:'Test',unmatched_groups:[],progress:{confirmed_ects:110,milestones:[{id:'abschnitt_1',title:'Abschnitt 1',available:true,completed:true,reason:'Alle Module abgeschlossen.'},{id:'abschnitt_2',title:'Abschnitt 2',available:false,completed:false,reason:locked.admission.reason},{id:'practice',title:'Praxis',available:true,completed:false,reason:'Seminar fehlt.'}]},stages:[{id:'abschnitt_1',title:'Abschnitt 1',access:{status:'available',reason:'Alle Module abgeschlossen.'},modules:[passed]},{id:'abschnitt_2',title:'Abschnitt 2',access:{status:'blocked',reason:locked.admission.reason},modules:[locked]},{id:'praxissemester',title:'Praxissemester',modules:[pending]}]};
async function load(page:any){
 await page.clock.setFixedTime(new Date('2026-11-11T10:00:00Z'));
 await page.addInitScript(()=>localStorage.setItem('stage-gate.profile:1',JSON.stringify({name:'Test',program:'Wirtschaftsinformatik (B.Sc.)',startTerm:'SoSe 2025',referenceTerm:'WiSe 2026/27'})));
 await page.route('**/api/imports',(r:any)=>r.fulfill({json:[]}));
 await page.route('**/api/programs/wi/examples/*',(r:any)=>r.fulfill({json:data}));
 await page.goto('/?example=first');
 await expect(page.getByTestId('official-credits')).toHaveText('110 / 210');
}
test('milestones distinguish availability from completion and a locked section explains the missing credits on hover',async({page})=>{
 await load(page);
 const table=page.getByRole('table',{name:'Studienfortschritt nach Etappen'});
 await expect(table.getByLabel('Abschnitt 1: abgeschlossen',{exact:true})).toBeVisible();
 await expect(table.getByLabel('Praxis: noch offen',{exact:true})).toBeVisible();
 await expect(page.getByTestId('study-stage-abschnitt_1')).toHaveClass(/bg-green-50/);
 const stage=page.getByTestId('study-stage-abschnitt_2');
 await stage.getByText('Abschnitt gesperrt',{exact:false}).hover();
 await expect(stage.getByRole('tooltip')).toContainText('Es fehlen noch 22 ECTS');
 await page.getByRole('button',{name:'Praktikum: Offen',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Praxisseminar fehlt');
 await expect(page.getByRole('dialog').getByRole('button',{name:'Zum aktuellen Semester hinzufügen'})).toHaveCount(0);
});
test('pace and semester totals share header size and reveal their explanation on hover and focus',async({page})=>{
 await load(page);
 const dot=page.getByLabel('ECTS-Tempo: green',{exact:true});
 await expect(dot).toHaveClass(/w-6 h-6/);
 await expect(page.getByRole('group',{name:'Studientempo'})).toHaveCount(0);
 await dot.hover();
 const tooltip=page.getByRole('tooltip').filter({hasText:'110 ECTS ÷ 3 abgeschlossene Semester'});
 await expect(tooltip).toBeVisible();
 await expect(tooltip).toContainText('36,7 ECTS pro Semester');
 await page.screenshot({path:'test-results/pace-hover.png',fullPage:true});
 await page.getByRole('heading',{name:'Mein Status',exact:true}).hover();
 await expect(tooltip).not.toBeVisible();
 const total=page.getByTestId('semester-ects');
 await expect(total).toHaveClass(/text-xl/);
 const header=page.getByRole('heading',{name:'Aktuelles Semester',exact:true});
 const a=await total.boundingBox(),b=await header.boundingBox();expect(Math.abs(a!.y-b!.y)).toBeLessThan(5);
 await total.locator('..').focus();
 await expect(page.getByRole('tooltip').filter({hasText:'Planungsumfang nach ECTS'})).toBeVisible();
});
