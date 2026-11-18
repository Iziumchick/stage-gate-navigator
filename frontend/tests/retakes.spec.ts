import {test,expect} from '@playwright/test';
import {calculateRetake,resultSemester,openRepeats,canRemoveRepeat} from '../src/app/retakes';
import type {ExamAttempt,DashboardModule} from '../src/app/api';
const exam=(attempt:number,date:string|null='01.08.2026'):ExamAttempt=>({code:'4710020',short_code:'DB',title:'Datenbanken',attempt,grade:5,ects:0,status:'NB',released_on:date});
test('publication semester determines the first or second repeat planning semester without a personal deadline',()=>{
 expect(calculateRetake(exam(1),'WiSe 2026/27')).toMatchObject({sourceTerm:'SoSe 2026',targetTerm:'WiSe 2026/27',automatic:true,state:'due'});
 expect(calculateRetake(exam(2),'WiSe 2026/27')).toMatchObject({targetTerm:'SoSe 2027',automatic:false,state:'later'});
 expect(calculateRetake(exam(2),'SoSe 2027')).toMatchObject({automatic:true,state:'due'});
 expect(calculateRetake(exam(2,'01.02.2026'),'WiSe 2026/27')).toMatchObject({automatic:true,state:'due'});
 expect(calculateRetake(exam(1,'12.11.2026'),'WiSe 2026/27')).toMatchObject({targetTerm:'SoSe 2027',automatic:false});
 expect(calculateRetake(exam(1),'WiSe 2026/27')).not.toHaveProperty('deadline');
});
test('publication uses OTH semester boundaries and accepts PDF dates with time',()=>{
 expect(resultSemester('14.03.2027')).toBe('WiSe 2026/27');
 expect(resultSemester('15.03.2027 09:01:22')).toBe('SoSe 2027');
 expect(resultSemester('2027-09-30')).toBe('SoSe 2027');
 expect(resultSemester('2027-10-01')).toBe('WiSe 2027/28');
 expect(resultSemester('31.02.2027')).toBeUndefined();
});
test('missing publication or a third negative attempt does not fabricate automatic admission or dates',()=>{
 expect(calculateRetake(exam(1,null),'WiSe 2026/27')).toMatchObject({state:'unknown',automatic:false});
 expect(calculateRetake(exam(3),'WiSe 2026/27')).toMatchObject({state:'review',automatic:false});
});
test('each automatically planned exam needs its own approved deferral before removal',()=>{
 const p={automatic:true,deferralApproved:false} as any;
 expect(canRemoveRepeat([p])).toBe(false);
 expect(canRemoveRepeat([{...p,deferralApproved:true}])).toBe(true);
 expect(canRemoveRepeat([{...p,deferralApproved:true},p])).toBe(false);
 expect(canRemoveRepeat([{...p,automatic:false}])).toBe(true);
});
test('only latest negative exam results in unfinished ordinary modules are eligible',()=>{
 const m={id:'db',status:'unknown',exam_history:[exam(1),{...exam(2),status:'BE',grade:2.7}]} as DashboardModule;
 expect(openRepeats(m)).toHaveLength(0);
 expect(openRepeats({...m,exam_history:[exam(1)]})).toHaveLength(1);
 expect(openRepeats({...m,status:'passed',exam_history:[exam(1)]})).toHaveLength(0);
 expect(openRepeats({...m,planning:{kind:'thesis'} as any,exam_history:[exam(1)]})).toHaveLength(0);
});
