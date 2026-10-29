// Importa um snapshot da tabela pública de monstros e, opcionalmente, nomes/códigos da captura.
// Uso: node tools/import-metabot.mjs snapshot.json [npcs.en.json]
import { readFile, writeFile } from 'node:fs/promises';

const [snapshot, npcFile] = process.argv.slice(2);
if (!snapshot) throw new Error('Informe o snapshot JSON da tabela de monstros.');
const input = JSON.parse((await readFile(snapshot, 'utf8')).replace(/^\uFEFF/, ''));
const key = name => String(name || '').normalize('NFKC').replace(/[’‘]/g, "'").trim().toLowerCase().replace(/\s+/g, ' ');
const monsters = input.monsters.map(row => {
  if (!/^[\w-]+$/.test(row.slug) || !row.name) throw new Error('Monstro sem identificação válida.');
  if (row.portrait && !/^\/web\/aion2\/npcs\/[\w/.-]+\.webp$/.test(row.portrait)) throw new Error('Imagem fora do catálogo de monstros.');
  return {
    id: 'metabot-' + row.slug, sourceSlug: row.slug, name: row.name,
    icon: row.portrait ? 'https://metabot.gg' + row.portrait : '',
    level: row.level, rank: row.rank, maps: row.maps || [],
    region: row.maps?.[0] || 'Sem região', elite: row.rank === 'elite' || row.rank === 'hero',
    isBoss: !!row.isBoss, note: [row.isBoss ? 'Chefe' : row.rank === 'hero' ? 'Nomeado' : row.rank === 'elite' ? 'Elite' : '', ...(row.maps || [])].filter(Boolean).join(' · '),
    npcCodes: [],
  };
});
if (new Set(monsters.map(m => m.id)).size !== monsters.length) throw new Error('IDs duplicados.');
if (npcFile) {
  const npcs = JSON.parse((await readFile(npcFile, 'utf8')).replace(/^\uFEFF/, ''));
  const names = new Map();
  for (const m of monsters) { const name = key(m.name); names.set(name, [...(names.get(name) || []), m]); }
  for (const [code, npc] of Object.entries(npcs)) {
    const matches = names.get(key(npc.name));
    // Nomes com variantes não estabelecem uma identidade de NPC inequívoca.
    if (!npc.isDummy && matches?.length === 1 && /^\d+$/.test(code)) matches[0].npcCodes.push(Number(code));
  }
}
const output = { source: 'https://metabot.gg/en/aion-2/monsters', fetchedAt: input.fetchedAt, monsters };
await writeFile(new URL('../js/data/monster-catalog.json', import.meta.url),
  `{\n"source":${JSON.stringify(output.source)},\n"fetchedAt":${JSON.stringify(output.fetchedAt)},\n"monsters":[\n${monsters.map(m => JSON.stringify(m)).join(',\n')}\n]}\n`);
console.log(`${monsters.length} monstros; ${monsters.filter(m => m.icon).length} com foto; ${monsters.reduce((n,m) => n + m.npcCodes.length,0)} códigos relacionados.`);
