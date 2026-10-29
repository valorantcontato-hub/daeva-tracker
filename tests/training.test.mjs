import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TrainingRun, compareTrainingRuns } from '../js/training-model.js';
import { isBossEncounter, isTrainingDummy } from '../js/combat-types.js';
const start=1700000000000;
const plan={id:'run',name:'Teste',timeLimit:30,playerName:'Me'};
const snapshot=(time,damage,extras={})=>({id:'enc',isDummy:true,boss:'Dummy',startedAt:new Date(start).toISOString(),capturedAt:time,
 players:[{name:'Other',skills:[{id:1,damage:100000,hits:99}]},{name:'Me',isLocal:true,skills:[{id:1,name:'Fire',damage,hits:damage/100,crits:damage/200}]}],...extras});
test('5s de preparação não contam; mede deltas locais, ignora repetições e encerra no prazo',()=>{
 const run=new TrainingRun(plan,start);
 assert.equal(run.phase(start+4999),'countdown'); assert.equal(run.phase(start+5000),'running');
 run.observe(snapshot(start+4000,1000),start+4000);
 run.observe(snapshot(start+6000,1600),start+6000);
 run.observe(snapshot(start+6000,1600),start+6500);
 run.observe(snapshot(start+5900,1500),start+7000);
 run.observe(snapshot(start+34000,2000),start+34000);
 run.observe(snapshot(start+35000,2500),start+35000);
 run.finish('completed',start+36500);
 const result=run.result(start+36500);
 assert.equal(result.damage,1000); assert.equal(result.hits,10);assert.equal(result.crits,5);
 assert.equal(result.duration,30); assert.equal(result.dps,1000/30);
});
test('uma luta anterior sem baseline não é somada; luta nova e reset acumulado são contados',()=>{
 const run=new TrainingRun(plan,start);
 run.observe(snapshot(start+6000,5000),start+6000);assert.equal(run.result(start+6000).damage,0);
 run.observe(snapshot(start+7000,5200),start+7000);
 run.observe(snapshot(start+8000,100),start+8000);
 run.observe(snapshot(start+9000,300,{id:'new',startedAt:new Date(start+8500).toISOString()}),start+9000);
 assert.equal(run.result(start+9000).damage,600);
});
test('boss, dano da party, jogador ambíguo e outro boneco não entram no treino',()=>{
 const run=new TrainingRun(plan,start), time=start+6000;
 run.observe(snapshot(time,500,{isDummy:false,boss:'Boss',isBoss:true}),time);
 run.observe(snapshot(time,500,{players:[{name:'Other',isLocal:true,skills:[{id:1,damage:900}]}]}),time);
 assert.equal(run.result(time).damage,0);
 run.observe(snapshot(time,500,{startedAt:new Date(time).toISOString(),npcCode:10}),time);
 run.observe(snapshot(time+1000,900,{id:'second',npcCode:11,startedAt:new Date(time+1000).toISOString()}),time+1000);
 assert.equal(run.result(time+1000).damage,500);
 assert.equal(isTrainingDummy({boss:'Training Scarecrow'}),true);
 assert.equal(isBossEncounter({isBoss:true,isDummy:true}),false);
 assert.equal(isBossEncounter({isBoss:true,boss:'Boss'}),true);
});
test('comparativo usa a duração de cada tentativa e inclui skills exclusivas',()=>{
 const a={duration:10,damage:1000,skills:[{id:1,name:'A',damage:1000,hits:10,crits:5}]};
 const b={duration:20,damage:3000,skills:[{id:1,name:'A',damage:2000,hits:20,crits:10},{id:2,name:'B',damage:1000,hits:10,crits:0}]};
 const rows=compareTrainingRuns(a,b);assert.equal(rows.find(r=>r.skill.id===1).delta,0);assert.equal(rows.find(r=>r.skill.id===2).delta,50);
});
