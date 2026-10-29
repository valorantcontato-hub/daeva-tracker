import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCollection,petProgress,collectionIdentity,collectionStorageKey } from '../js/collection-state.js';
import { createPetFeed } from '../pet-feed.mjs';
const state={type:'pet-state',complete:true,flowId:'test-flow',revision:1,capturedAt:'2026-10-29T00:00:00Z',self:{name:'Me',serverId:2401},levels:{1001:3,1002:1},points:{1002:2}};
test('coleção desconhecida não vira zero; coleção completa identifica níveis, almas e ausentes',()=>{
 assert.equal(petProgress(null,1001).known,false);
 const value=normalizeCollection(state);
 assert.equal(petProgress(value,1001).complete,true);assert.equal(petProgress(value,1001).remaining,0);
 assert.equal(petProgress(value,1002).remaining,98);assert.equal(petProgress(value,1002).goal,25);
 assert.equal(petProgress(value,1003).remaining,105);assert.equal(petProgress(value,1003).known,true);
});
test('mesmo nome em outros servidores e outros personagens nunca compartilham coleção',()=>{
 assert.notEqual(collectionStorageKey(state.self),collectionStorageKey({...state.self,serverId:2402}));
 assert.notEqual(collectionStorageKey(state.self),collectionStorageKey({...state.self,name:'Other'}));
 assert.equal(collectionIdentity(state.self),collectionIdentity({...state.self,name:' ME '}));
 assert.equal(collectionIdentity({name:'Me',serverId:0}),null);
});
test('feed rejeita payload inválido, ignora repetição e reenvia o último snapshot por personagem',()=>{
 const feed=createPetFeed(), writes=[];
 feed.ingest(state);feed.ingest({...state,revision:2,points:{1002:3}});feed.ingest(state);
 feed.ingest({...state,self:{...state.self,name:'Other'}});
 feed.subscribe({on(){}},{writeHead(){},write:s=>writes.push(s)});
 const data=JSON.parse(writes[0].slice(6));
 assert.equal(data.length,2);assert.equal(data[0].points[1002],3);
 assert.throws(()=>feed.ingest({...state,levels:{1001:-1}}));assert.equal(normalizeCollection({...state,complete:false}),null);
});
