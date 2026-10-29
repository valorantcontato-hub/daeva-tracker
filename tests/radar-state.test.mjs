import { test } from 'node:test';
import assert from 'node:assert/strict';
import { radarSelf, verifiedRadarOwner, readVerifiedRadar, radarHeading, radarOffset } from '../js/radar-state.js';
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

test('referencial do jogo mantém esquerda/direita e corrige cima/baixo em pontos e seta', () => {
  // No print: seta voltada para baixo/esquerda deve acompanhar o mapa original para cima/esquerda.
  assert.equal(radarHeading(225),315);
  assert.deepEqual(radarOffset(-20,-30),{x:-20,y:-30});
  for(const [dx,dy] of [[10,0],[-10,0],[0,10],[0,-10],[-10,-20]]) {
    const rawHeading=Math.atan2(dx,dy)*180/Math.PI;
    const h=radarHeading(rawHeading)*Math.PI/180;
    const point=radarOffset(dx,dy),distance=Math.hypot(dx,dy);
    assert.ok(Math.abs(Math.sin(h)-point.x/distance)<1e-10);
    assert.ok(Math.abs(-Math.cos(h)-point.y/distance)<1e-10);
    const rotated=radarOffset(dx,dy,90),rh=radarHeading(rawHeading,90)*Math.PI/180;
    assert.ok(Math.abs(Math.sin(rh)-rotated.x/distance)<1e-10);
    assert.ok(Math.abs(-Math.cos(rh)-rotated.y/distance)<1e-10);
  }
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

test('posição de outra pessoa, servidor diferente ou captura antiga não vira sua posição', () => {
  const me = { name: 'Maguinha', serverId: 2401 };
  const snapshot = { selfVerified: true, selfProfile: me };
  assert.equal(verifiedRadarOwner(snapshot, me),true);
  assert.equal(verifiedRadarOwner({ ...snapshot, selfProfile: { ...me, name: 'Other' } }, me),false);
  assert.equal(verifiedRadarOwner({ ...snapshot, selfProfile: { ...me, serverId: 2402 } }, me),false);
  assert.equal(verifiedRadarOwner({ ...snapshot, selfVerified: false }, me),false);
  assert.equal(verifiedRadarOwner({ selfId: 12817, self: { x: 1,y: 2 } },me),false);
  assert.equal(readVerifiedRadar({ self:{x:1,y:2},mobs:[] }),null);
  assert.ok(readVerifiedRadar({ verifiedSelf:true,self:{x:1,y:2},mobs:[] }));
});
