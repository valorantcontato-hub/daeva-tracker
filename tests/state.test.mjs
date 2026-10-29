import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
const { load, save } = await import('../js/store.js');
const { readBestiary, writeBestiary, imageUrl } = await import('../js/bestiary-state.js');
const { fetchProfile, findSkill, autoLinkFromFight } = await import('../js/profiles.js');
const { activeSkills } = await import('../js/views/dps.js');
const me = { characterId: 'char-a', region: 'la', serverId: 2401, name: 'Maguinha', class: 'sorcerer', raceId: 1 };
beforeEach(() => storage.clear());

test('farmando limita três por personagem sem apagar progresso nem repetir favoritos', () => {
  writeBestiary({ kills: { mob: 75 }, focus: ['pet-1', 'pet-1', 'pet-2', 'pet-3', 'pet-4'] }, me);
  assert.deepEqual(readBestiary(me), { kills: { mob: 75 }, focus: ['pet-1', 'pet-2', 'pet-3'] });
  const other = { ...me, characterId: 'char-b' };
  writeBestiary({ kills: {}, focus: new Set(['pet-4']) }, other);
  assert.deepEqual(readBestiary(other).focus, ['pet-4']);
  assert.equal(readBestiary(me).kills.mob, 75);
});

test('migra o bestiário antigo uma vez e isola abates e favoritos de cada personagem', () => {
  save('me', me); save('kills', { mob: 24 }); save('focus', ['mob']);
  assert.equal(readBestiary().kills.mob, 24);
  const other = { ...me, characterId: 'char-b' };
  assert.deepEqual(readBestiary(other), { kills: {}, focus: [] });
  writeBestiary({ kills: { mob: 2 }, focus: [] }, other);
  assert.equal(readBestiary().kills.mob, 24);
  assert.equal(readBestiary(other).kills.mob, 2);
  assert.equal(load('kills', {}).mob, 24);
});

test('o mesmo ID em servidores diferentes não compartilha progresso e leituras não alteram o salvo', () => {
  writeBestiary({ kills: { mob: 75 }, focus: ['mob'] }, me);
  assert.deepEqual(readBestiary({ ...me, serverId: 2402 }).kills, {});
  const read = readBestiary(me); read.kills.mob = 0; read.focus.length = 0;
  assert.equal(readBestiary(me).kills.mob, 75);
  assert.deepEqual(readBestiary(me).focus, ['mob']);
});

test('o primeiro vínculo recupera abates anteriores sem repeti-los em outros personagens', () => {
  writeBestiary({ kills: { mob: 5 }, focus: [] }, null);
  readBestiary(null);
  assert.equal(readBestiary(me).kills.mob, 5);
  assert.deepEqual(readBestiary({ ...me, characterId: 'outro' }).kills, {});
});

test('fotos aceitam URLs web e rejeitam scripts ou arquivos locais', () => {
  assert.equal(imageUrl('https://example.com/mob.png'), 'https://example.com/mob.png');
  for (const value of ['javascript:alert(1)', 'file:///C:/image.png', 'data:image/png;base64,AA', '', null]) assert.equal(imageUrl(value), '');
});

test('skills do Arqueiro sem perfil próprio usam o catálogo, com ícone e somente ativas usadas', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ...me, class: 'ranger', lang: 'pt-BR', skills: [
    { id: 1010000, name: 'Tiro', icon: 'https://example.com/tiro.png', category: 'Active' },
    { id: 1020000, name: 'Passiva', category: 'Passive' },
  ] }) });
  try {
    await fetchProfile(me);
    const player = { name: 'OutroArqueiro', class: 'ranger', skills: [
      { id: 1010001, name: 'Shot', damage: 100 }, { id: 1020000, name: 'Passive', damage: 5 },
    ] };
    assert.equal(findSkill(player.name, 'Shot', 'ranger', 1010001).icon, 'https://example.com/tiro.png');
    assert.deepEqual(activeSkills(player).map(s => s.id), [1010001]);
  } finally { globalThis.fetch = original; }
});

test('vínculo da party desambigua nome por classe e facção', async () => {
  save('me', me);
  const original = globalThis.fetch;
  globalThis.fetch = async path => ({ ok: true, json: async () => String(path).startsWith('/api/plaync/search') ? [
    { name: 'PartyRanger', class: 'ranger', race: 2, serverId: 2401, characterId: 'wrong-race' },
    { name: 'PartyRanger', class: 'templar', race: 1, serverId: 2401, characterId: 'wrong-class' },
    { name: 'PartyRanger', class: 'ranger', race: 1, serverId: 2401, characterId: 'correct', region: 'la' },
  ] : { ...me, characterId: 'correct', name: 'PartyRanger', class: 'ranger', skills: [] } });
  try {
    await autoLinkFromFight({ self: { name: me.name }, isBoss: true, players: [{ name: 'PartyRanger', class: 'ranger' }] });
    assert.deepEqual(load('party', []).map(p => p.characterId), ['correct']);
  } finally { globalThis.fetch = original; }
});
