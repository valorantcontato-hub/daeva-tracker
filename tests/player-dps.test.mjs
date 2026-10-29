import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, activeSeconds } from '../js/encounter.js';

const skills = damage => [{ id: 1, name: 'Skill', hits: 10, crits: 0, damage, max: 1 }];
const flat = (from, to, v, len) => Array.from({ length: len }, (_, i) => (i >= from && i <= to ? v : 0));

test('quem entra depois não tem o DPS diluído pelo tempo em que ainda não batia', () => {
  const enc = { duration: 40, players: [
    { name: 'A', class: '', skills: skills(40000), timeline: flat(0, 39, 1000, 40) },
    { name: 'B', class: '', skills: skills(20000), timeline: flat(20, 39, 1000, 40) },
  ] };
  const S = summarize(enc);
  assert.equal(S.players.find(p => p.name === 'A').dps, 1000);
  assert.equal(S.players.find(p => p.name === 'B').dps, 1000); // antes: 500
  assert.equal(S.dps, 1500); // o DPS total da luta continua sobre a duração inteira
});

test('golpe isolado não vira DPS gigante e sem linha do tempo usa a duração', () => {
  assert.equal(activeSeconds([0, 0, 9000, 0], 4), 4);
  assert.equal(activeSeconds(flat(2, 2, 9000, 30), 30), 5);
  assert.equal(activeSeconds([], 12), 12);
  assert.equal(activeSeconds(undefined, 12), 12);
});
