import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setMonsterCatalog, catalogByPetName, findCatalogMonster } from '../js/monster-catalog.js';

const bat = { id: 'metabot-drana-mutated-bat', sourceSlug: 'drana-mutated-bat', name: 'Drana Mutated Bat', npcCodes: [2100911] };
const wolf = { id: 'metabot-wolf-a', sourceSlug: 'wolf-a', name: 'Wolf A', npcCodes: [1] };
const wolfB = { id: 'metabot-wolf-b', sourceSlug: 'wolf-b', name: 'Wolf B', npcCodes: [2] };
setMonsterCatalog([bat, wolf, wolfB]);
const pets = [
  { id: 1041, name: 'Cave Bat', mobs: [{ name: 'Drana Mutated Bat' }] },
  { id: 1050, name: 'Pack Wolf', mobs: [{ name: 'Wolf A' }, { name: 'Wolf B' }] }, // dois monstros dão o mesmo mascote: ambíguo
  { id: 1060, name: 'Ghost', mobs: [] },
  { id: 1070, name: 'Lost', mobs: [{ name: 'Mob que não está no catálogo' }] },
];

test('abate com o nome do mascote vira o monstro que dá a alma', () => {
  assert.equal(findCatalogMonster({ name: 'Cave Bat' }), null); // pelo nome sozinho o catálogo não acha
  assert.equal(catalogByPetName('Cave Bat', pets)?.id, 'metabot-drana-mutated-bat');
  assert.equal(catalogByPetName(' cave  bat ', pets)?.id, 'metabot-drana-mutated-bat'); // ignora caixa e espaços
});

test('não chuta quando é ambíguo, sem monstro ou desconhecido', () => {
  assert.equal(catalogByPetName('Pack Wolf', pets), null);
  assert.equal(catalogByPetName('Ghost', pets), null);
  assert.equal(catalogByPetName('Lost', pets), null);
  assert.equal(catalogByPetName('Nada a ver', pets), null);
});
