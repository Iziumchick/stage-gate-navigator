import {test,expect} from '@playwright/test';
import {paceSignal,workloadSignal} from '../src/app/progressMath';

test('average ECTS per completed semester uses the 24 and 18 boundaries',()=>{
 expect(paceSignal(72,'SoSe 2025','WiSe 2026/27')).toMatchObject({color:'green',average:24,completedSemesters:3});
 expect(paceSignal(71,'SoSe 2025','WiSe 2026/27').color).toBe('yellow');
 expect(paceSignal(54,'SoSe 2025','WiSe 2026/27')).toMatchObject({color:'yellow',average:18});
 expect(paceSignal(53,'SoSe 2025','WiSe 2026/27').color).toBe('red');
 expect(paceSignal(0,'SoSe 2025','WiSe 2026/27').color).toBe('red');
});
test('missing progress, the first semester and future enrollment never divide by zero',()=>{
 expect(paceSignal(null,'WiSe 2024/25','WiSe 2026/27').color).toBe('neutral');
 expect(paceSignal(0,'WiSe 2026/27','WiSe 2026/27')).toMatchObject({color:'neutral',average:null,completedSemesters:0});
 expect(paceSignal(5,'SoSe 2027','WiSe 2026/27').color).toBe('neutral');
 expect(paceSignal(210,'WiSe 2024/25','WiSe 2026/27')).toMatchObject({color:'green',average:52.5});
});
test('semester load uses only nominal ECTS, with unknown amounts kept visible',()=>{
 const courses=(n:number)=>Array.from({length:n},()=>({ects:5}));
 for(const [ects,color] of [[0,'red'],[15.9,'red'],[16,'yellow'],[23.9,'yellow'],[24,'green'],[32,'green'],[32.1,'yellow'],[39.9,'yellow'],[40,'red']] as const)expect(workloadSignal([{ects}]).color,`${ects} ECTS`).toBe(color);
 expect(workloadSignal(courses(6))).toMatchObject({ects:30,color:'green'});
 expect(workloadSignal(courses(7))).toMatchObject({ects:35,color:'yellow'});
 expect(workloadSignal(courses(9))).toMatchObject({ects:45,color:'red'});
 expect(workloadSignal([{ects:5},{ects:null}])).toMatchObject({ects:5,unknown:1,color:'neutral'});
 expect(workloadSignal([]).color).toBe('neutral');
});
