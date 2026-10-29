import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isFinalDungeonBoss } from '../js/combat-types.js';
import { portraitUrl } from '../js/portrait.js';
test('Boss aceita o chefe final e exclui intermediários, totens e bonecos', () => {
  const fight = npcCode => ({isBoss:true,npcCode});
  assert.equal(isFinalDungeonBoss(fight(2300910)),true); // Nuakum
  for (const code of [2300907,2300908,2300909,2300229]) assert.equal(isFinalDungeonBoss(fight(code)),false);
  assert.equal(isFinalDungeonBoss(fight(2320601)),true); // Atiel, not Gelcos/Nazmun
  assert.equal(isFinalDungeonBoss(fight(2320616)),false);
  assert.equal(isFinalDungeonBoss({...fight(2300910),isDummy:true}),false);
});
test('não promove boss desconhecido ou cópia de outro modo; histórico antigo exige DG correspondente',()=>{
  assert.equal(isFinalDungeonBoss({isBoss:true,boss:'Vakron',npcCode:2920367,dungeon:'Vakron Sky Island'}),false);
  assert.equal(isFinalDungeonBoss({isBoss:true,boss:'Vakron',dungeon:'Vakron Sky Island'}),true);
  assert.equal(isFinalDungeonBoss({isBoss:true,boss:'Vakron',dungeon:'Mundo aberto'}),false);
  assert.equal(isFinalDungeonBoss({isBoss:true,boss:'Unknown boss',dungeon:'Krao Cave'}),false);
});
test('revisões de retrato trocam a URL sem perder os parâmetros oficiais',()=>{
  const profile={image:'https://profileimg.plaync.com/images?charKey=123&gameServerKey=2401',portraitVersion:1};
  const a=new URL(portraitUrl(profile)),b=new URL(portraitUrl({...profile,portraitVersion:2}));
  assert.notEqual(a.href,b.href);assert.equal(b.searchParams.get('charKey'),'123');
  assert.equal(b.searchParams.get('gameServerKey'),'2401');assert.equal(b.searchParams.get('_lotus'),'2');
});
