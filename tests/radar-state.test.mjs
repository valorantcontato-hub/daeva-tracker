import { test } from 'node:test';
import assert from 'node:assert/strict';
import { radarSelf } from '../js/radar-state.js';
import { matchesPetStatus, PET_FAMILIES } from '../js/pet-families.js';

test('radar orienta nos quatro sentidos, mantém ao parar e ignora ruído e teleporte', () => {
  const prev = { x: 1000, y: 1000, heading: 42, headingSource: 'movement' };
  for (const [x,y,heading] of [[1000,2000,0],[2000,1000,90],[1000,0,180],[0,1000,270]])
    assert.equal(radarSelf({x,y},prev).heading, heading);
  for (const [x,y] of [[1000,1000],[1001,1000],[100000,100000]]) assert.equal(radarSelf({x,y},prev).heading,42);
  assert.equal(radarSelf({x:NaN,y:0},prev),null);
});

test('ângulo explícito tem prioridade sobre deslocamento e aceita zero', () => {
  assert.equal(radarSelf({x:1000,y:0,heading:0},{x:0,y:0,heading:120}).heading,0);
  assert.equal(radarSelf({x:0,y:0,heading:-90}).heading,270);
  assert.equal(radarSelf({x:0,y:0,heading:90}).headingSource,'facing');
});

test('filtros não tratam coleção desconhecida como faltando; favoritos independem do progresso', () => {
  const unknown={known:false,complete:false}, missing={known:true,complete:false}, complete={known:true,complete:true};
  assert.equal(matchesPetStatus(unknown,false,'missing'),false);
  assert.equal(matchesPetStatus(missing,false,'missing'),true);
  assert.equal(matchesPetStatus(complete,false,'complete'),true);
  assert.equal(matchesPetStatus(complete,false,'missing'),false);
  assert.equal(matchesPetStatus(unknown,true,'farming'),true);
  assert.equal(matchesPetStatus(complete,true,'farming'),true);
  assert.equal(new Set(Object.values(PET_FAMILIES).map(f=>f.color)).size,5);
});
