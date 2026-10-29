import test from 'node:test';
import assert from 'node:assert/strict';
import { isInstancedBossFight } from '../js/combat-types.js';

test('chefe em DG instanciada aparece nos overlays', () => {
  assert.equal(isInstancedBossFight({ isBoss: true, boss: 'Ultimate Berk', dungeonId: 12, dungeon: 'Krao Cave' }), true);
  assert.equal(isInstancedBossFight({ isBoss: true, boss: 'Ultimate Berk', dungeon: 'Krao Cave' }), true);
});

test('chefe de mundo aberto, mob comum e boneco ficam de fora', () => {
  assert.equal(isInstancedBossFight({ isBoss: true, boss: 'Furious Saursus', dungeonId: 0, dungeon: '' }), false);
  assert.equal(isInstancedBossFight({ isBoss: false, boss: 'Klaw', dungeonId: 12, dungeon: 'Krao Cave' }), false);
  assert.equal(isInstancedBossFight({ isBoss: true, isDummy: true, dungeonId: 12, dungeon: 'Treino' }), false);
  assert.equal(isInstancedBossFight(null), false);
});

test('sem a DG informada, o código do NPC identifica o chefe instanciado', () => {
  assert.equal(isInstancedBossFight({ isBoss: true, boss: 'Ferocious Horn Nuakum', npcCode: 2300910, dungeonId: 0, dungeon: '' }), true);
  assert.equal(isInstancedBossFight({ isBoss: true, boss: 'Vakron', npcCode: 2300582, dungeonId: 0, dungeon: '' }), false);
});
