import {test,expect} from '@playwright/test';
import {forecastProgress,studyRecommendations} from '../src/app/recommendations';
import type {DashboardData,DashboardModule} from '../src/app/api';
const m=(id:string,ects=5,extra:any={}):DashboardModule=>({id,title:id,short_title:id,required_ects:ects,actual_ects:null,grade:null,status:'unknown',source:null,completion_rule:'single',admission:{status:'available',reason:'OK'},semester_offered:true,...extra});
const d=(modules:DashboardModule[],gates:any[]=[]):DashboardData=>({import_id:null,program:'WI',supported:true,official_grade:null,official_credits:0,spo_version:'test',unmatched_groups:[],progress:{confirmed_ects:0,milestones:[],gates},stages:[{id:'abschnitt_1',title:'Abschnitt 1',modules}]});
const practice={id:'practice',minimum_ects:90,scope:'total',all_first:false};
const failed=m('ST',5,{status:'failed',exam_history:[{code:'ST',attempt:1,status:'NB',released_on:'01.08.2026',title:'Statistik',ects:0,grade:5}]});
test('a heavy plan protects retakes and suggests only a non-retake offered in both semesters',()=>{
 const data=d([failed,m('SE',8,{details:{offered_in:'Winter- und Sommersemester'}}),m('WINTER',5,{details:{offered_in:'Wintersemester'}})]);
 const hints=studyRecommendations(data,[{moduleId:'ST'},{moduleId:'SE'}],35,'WiSe 2026/27');
 expect(hints[0]).toMatchObject({id:'load',title:'Mögliche Entlastung bei Wiederholungen',moduleId:'SE'});
 expect(hints[0].text).toContain('nächste Semester');
 expect(hints[0].text).toContain('könntest du überlegen');
 expect(hints[0].text).not.toMatch(/Prüfe|plane ausreichend|musst|entferne/);
 expect(hints.find(h=>h.id==='load')?.moduleId).not.toBe('ST');
 expect(hints.find(h=>h.id==='season:WINTER')?.text).toContain('gegen die bereits gewählten Module abzuwägen');
});
test('practice forecast shows 35 missing now and 5 after a successful 30-ECTS plan',()=>{
 const data=d([m('completed',55,{status:'passed'}),...Array.from({length:6},(_,i)=>m(`c${i}`))],[practice]);
 const hints=studyRecommendations(data,Array.from({length:6},(_,i)=>({moduleId:`c${i}`})),30,'WiSe 2026/27');
 const hint=hints.find(h=>h.id==='gate:practice')!;
 expect(hint.text).toContain('fehlen 35 ECTS');expect(hint.text).toContain('fehlen danach noch 5 ECTS');
 expect(hint.text).toContain('unverbindlich');expect(hints.some(h=>h.id.startsWith('bridge:'))).toBe(false);
});
test('a small extra module is an option only when it closes the gate within 30 ECTS and without a retake',()=>{
 const modules=[m('completed',60,{status:'passed'}),...Array.from({length:6},(_,i)=>m(`c${i}`))];
 const choices=Array.from({length:5},(_,i)=>({moduleId:`c${i}`}));
 expect(studyRecommendations(d(modules,[practice]),choices,25,'WiSe 2026/27').find(h=>h.id==='bridge:practice')).toMatchObject({moduleId:'c5'});
 const data=d([...modules,failed],[practice]);
 expect(studyRecommendations(data,[...choices,{moduleId:'ST'}],30,'WiSe 2026/27').some(h=>h.id.startsWith('bridge:'))).toBe(false);
});
test('AW and compulsory parts count workload separately but unlock credits only as a complete module',()=>{
 const aw=m('AW',4,{details:{aw_components:[{ects:2},{ects:2}]}});
 const bw=m('BW',7,{completion_rule:'all',course_options:[{id:'a',title:'A'},{id:'b',title:'B'}]});
 const data=d([aw,bw]);
 expect(forecastProgress(data,[{moduleId:'AW',partId:'aw:0'},{moduleId:'BW',partId:'a'}]).ects).toBe(0);
 expect(forecastProgress(data,[{moduleId:'BW'}]).ects).toBe(7);
 expect(forecastProgress(data,[{moduleId:'AW',partId:'aw:0'},{moduleId:'AW',partId:'aw:1'},{moduleId:'BW',partId:'a'},{moduleId:'BW',partId:'b'}]).ects).toBe(11);
});
test('a held placement releases its whole block only together with the planned seminar',()=>{
 const data=d([m('wi.req.praktikum',24,{completion_pending:true}),m('wi.req.praxisseminar',2)]);
 expect(forecastProgress(data,[]).ects).toBe(0);
 expect(forecastProgress(data,[{moduleId:'wi.req.praxisseminar'}]).ects).toBe(26);
});
test('third stage still requires every first-stage module, even if the total credit threshold is met',()=>{
 const data=d([m('HW'),m('done',105,{status:'passed'})],[{id:'abschnitt_3',minimum_ects:100,scope:'total',all_first:true}]);
 const hint=studyRecommendations(data,[],0,'WiSe 2026/27').find(h=>h.id==='gate:abschnitt_3')!;
 expect(hint.text).toContain('ECTS-Schwelle');expect(hint.text).toContain('HW');expect(hint.title).not.toContain('Reichweite');
});
test('unknown frequency, closed stages and failed seasonal modules do not get add-now suggestions',()=>{
 const data=d([m('unknown'),m('closed',5,{admission:{status:'unknown'},details:{offered_in:'Wintersemester'}}),failed]);
 expect(studyRecommendations(data,[],0,'WiSe 2026/27').some(h=>h.id.startsWith('season:'))).toBe(false);
});

test('unknown course ECTS do not trigger a suggestion to increase the plan',()=>{
 const data=d([m('done',60,{status:'passed'}),m('a',25),m('b')],[practice]);
 expect(studyRecommendations(data,[{moduleId:'a'}],25,'WiSe 2026/27',false).some(h=>h.id.startsWith('bridge:'))).toBe(false);
});
test('a held practical block prioritizes its missing seminar',()=>{
 const data=d([m('wi.req.praktikum',24,{completion_pending:true}),m('wi.req.praxisseminar',2)]);
 expect(studyRecommendations(data,[],0,'WiSe 2026/27').find(h=>h.id==='finish:wi.req.praxisseminar')).toMatchObject({moduleId:'wi.req.praxisseminar'});
});

test('a known failed module without attempt history is never suggested for postponement or seasonal addition',()=>{
 const failedWithoutHistory=m('FAILED',5,{status:'failed',details:{offered_in:'Winter- und Sommersemester'}});
 const data=d([failedWithoutHistory,m('NEW',5,{details:{offered_in:'Winter- und Sommersemester'}})]);
 expect(studyRecommendations(data,[{moduleId:'FAILED'},{moduleId:'NEW'}],35,'WiSe 2026/27')[0]).toMatchObject({title:'Mögliche Entlastung bei Wiederholungen',moduleId:'NEW'});
 const seasonal=d([m('FAILED',5,{status:'failed',details:{offered_in:'Wintersemester'}})]);
 expect(studyRecommendations(seasonal,[],0,'WiSe 2026/27').some(h=>h.id.startsWith('season:'))).toBe(false);
});

test('one selected elective course never closes two different FWPM requirements in the forecast',()=>{
 const data=d([m('FWPM2',5,{requires_course_selection:true}),m('FWPM3',5,{requires_course_selection:true})]);
 const choices=[{moduleId:'FWPM2',courseId:'same-course'},{moduleId:'FWPM3',courseId:'same-course'}];
 expect(forecastProgress(data,choices).ects).toBe(5);
 expect(studyRecommendations(data,choices,10,'WiSe 2026/27').some(h=>h.id==='duplicate:FWPM3')).toBe(true);
});


test('practice preparation disappears once planned; an unplanned counterpart is suggested only until both are covered',()=>{
 const main=m('wi.req.praktikum',24,{planning:{kind:'practice',status:'available'}}),seminar=m('wi.req.praxisseminar',2,{planning:{kind:'practice_seminar',status:'available'}});
 const data=d([main,seminar]);
 expect(studyRecommendations(data,[],0,'WiSe 2026/27').some(h=>h.id==='practice-ready')).toBe(true);
 const one=studyRecommendations(data,[{moduleId:main.id}],24,'WiSe 2026/27');
 expect(one.some(h=>h.id==='practice-ready')).toBe(false);
 expect(one.find(h=>h.id===`pair:${seminar.id}`)?.text).toContain('26 ECTS');
 const both=studyRecommendations(data,[{moduleId:main.id},{moduleId:seminar.id}],26,'WiSe 2026/27');
 expect(both.some(h=>h.id==='practice-ready'||h.id.startsWith('pair:')||h.id.startsWith('finish:'))).toBe(false);
 const reverse=studyRecommendations(data,[{moduleId:seminar.id}],2,'WiSe 2026/27');
 expect(reverse.find(h=>h.id===`pair:${main.id}`)?.moduleId).toBe(main.id);
 main.completion_pending=true;
 expect(studyRecommendations(data,[{moduleId:seminar.id}],2,'WiSe 2026/27').some(h=>h.id.startsWith('finish:')||h.id==='practice-ready')).toBe(false);
});
