import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('monstros com mascote próprio não ficam associados a outro pela foto compartilhada', () => {
  const { pets } = JSON.parse(readFileSync(new URL('../js/data/pet-catalog.json', import.meta.url)));
  for (const name of ['Thin Agrint', 'Pino Worker', 'Tamed Karnif', 'Dratona Tinkerer', 'Drana Mutant']) {
    const owners = pets.filter(p => p.mobs.some(m => m.name === name));
    assert.deepEqual(owners.map(p => p.name), [name]);
  }
});
