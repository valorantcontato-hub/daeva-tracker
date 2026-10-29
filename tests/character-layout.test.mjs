import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appearanceItems, combatStats } from '../js/character-layout.js';
test('aparência mostra a asa visual e omite a asa base duplicada',()=>{
 const skin={name:'Visual',slot:'WingSkin'},base={name:'Asa base',slot:'Wings'},helmet={name:'Elmo',slot:'Helmet'};
 assert.deepEqual(appearanceItems({skins:[helmet,base,skin],wings:base,wingSkin:skin}),[helmet,skin]);
 assert.deepEqual(appearanceItems({skins:[helmet],wings:base}),[helmet,base]);
});
test('atributos de combate não confundem AGI/STR ou bônus percentuais com totais',()=>{
 const values=combatStats({stats:[{type:'STR',value:15},{type:'AGI',value:22},{type:'Attack',value:1896}]});
 assert.equal(values.find(s=>s.key==='attack').value,1896);
 assert.equal(values.find(s=>s.key==='accuracy').value,null);
 assert.equal(values.find(s=>s.key==='hp').value,null);
});
test('totais existentes pertencem somente ao perfil que os forneceu',()=>{
 assert.equal(combatStats({combatStats:{hp:16591,accuracy:779}}).find(s=>s.key==='accuracy').value,779);
 assert.equal(combatStats({}).find(s=>s.key==='accuracy').value,null);
});
