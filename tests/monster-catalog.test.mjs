import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setMonsterCatalog, mergeMonsterCatalog, findCatalogMonster, monsterPicture } from '../js/monster-catalog.js';

const a = { id: 'metabot-aranha', sourceSlug: 'aranha', name: 'Spider', icon: 'https://metabot.gg/web/aion2/npcs/r/spider.webp', npcCodes: [42], region: 'Altgard' };
const b = { id: 'metabot-urso-1', sourceSlug: 'urso-1', name: 'Bear', icon: 'https://metabot.gg/web/aion2/npcs/r/bear.webp', npcCodes: [], region: 'Verteron' };
const c = { ...b, id: 'metabot-urso-2', sourceSlug: 'urso-2' };
beforeEach(() => setMonsterCatalog([a, b, c]));

test('o código de NPC reconhece nomes localizados e preserva o ID com progresso anterior', () => {
  const saved = { id: 'npc-42', npcCode: 42, name: 'Aranha', region: 'Meu local' };
  const merged = mergeMonsterCatalog([saved]);
  assert.equal(merged.length, 3);
  assert.equal(merged[0].id, 'npc-42');
  assert.equal(merged[0].name, 'Aranha');
  assert.equal(merged[0].icon, a.icon);
  assert.equal(merged[0].region, 'Meu local');
  assert.ok(!merged.some(m => m.id === a.id));
});

test('nomes ambíguos podem compartilhar a foto, mas não a identidade nem os contadores', () => {
  assert.equal(findCatalogMonster({ name: 'Bear' }), null);
  assert.equal(monsterPicture({ name: 'Bear' }), b.icon);
  assert.equal(mergeMonsterCatalog([{ id: 'npc-99', name: 'Bear' }]).length, 4);
  setMonsterCatalog([b, { ...c, icon: a.icon }]);
  assert.equal(monsterPicture({ name: 'Bear' }), '');
});

test('ID do catálogo sobrevive a importações e dados manuais permanecem', () => {
  assert.equal(findCatalogMonster({ id: a.id, name: 'Nome editado' }).sourceSlug, a.sourceSlug);
  const merged = mergeMonsterCatalog([{ id: 'manual', name: 'Meu monstro', icon: a.icon }]);
  assert.equal(merged[0].id, 'manual');
  assert.equal(merged[0].icon, a.icon);
});

test('snapshot tem IDs únicos e fotos do domínio autorizado, sem juntar códigos de NPC', async () => {
  const data = JSON.parse(await readFile(new URL('../js/data/monster-catalog.json', import.meta.url), 'utf8'));
  assert.ok(data.monsters.length > 3000);
  assert.equal(new Set(data.monsters.map(m => m.id)).size, data.monsters.length);
  const codes = data.monsters.flatMap(m => m.npcCodes);
  assert.equal(new Set(codes).size, codes.length);
  for (const m of data.monsters) if (m.icon) {
    const url = new URL(m.icon);
    assert.equal(url.origin, 'https://metabot.gg');
    assert.ok(url.pathname.startsWith('/web/aion2/npcs/'));
  }
});
