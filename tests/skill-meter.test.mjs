import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupSkillVariants } from '../js/skill-meter.js';

test('variantes da mesma habilidade somam dano e acertos para calcular crítico ponderado', () => {
  const input = [
    { id: 101, name: 'Debuff I', damage: 19600, hits: 10, crits: 5, max: 4000 },
    { id: 102, name: 'Debuff II', damage: 10100, hits: 20, crits: 10, max: 8000 },
    { id: 201, name: 'Outro', damage: 20000, hits: 10, crits: 1, max: 5000 },
  ];
  const rows = groupSkillVariants(input, s => s.id < 200 ? 'Marca da Debilitação' : s.name);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, 'Marca da Debilitação');
  assert.equal(rows[0].damage, 29700);
  assert.equal(rows[0].hits, 30);
  assert.equal(rows[0].crits / rows[0].hits, .5);
  assert.equal(rows[0].max, 8000);
  assert.equal(input[0].damage, 19600);
});
