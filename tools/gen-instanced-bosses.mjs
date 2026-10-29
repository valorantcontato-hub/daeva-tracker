// Gera js/data/instanced-bosses.js a partir dos dados do motor de captura.
//   node tools/gen-instanced-bosses.mjs [pasta-data]
// Padrão: %LOCALAPPDATA%\DaevaTracker\engine\Aion2DPSMeter\data (npcs.en.json).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] || join(process.env.LOCALAPPDATA || '', 'DaevaTracker', 'engine', 'Aion2DPSMeter', 'data');
const npcs = JSON.parse(readFileSync(join(dir, 'npcs.en.json'), 'utf8').replace(/^﻿/, ''));
// Chefe de mundo aberto não tem categoria; conteúdo instanciado tem categoria e dungeonId.
const codes = Object.entries(npcs)
  .filter(([, v]) => v.isBoss && v.category && v.dungeonId > 0)
  .map(([code]) => Number(code))
  .sort((a, b) => a - b);
const lines = [];
for (let i = 0; i < codes.length; i += 10) lines.push(codes.slice(i, i + 10).join(','));
writeFileSync(new URL('../js/data/instanced-bosses.js', import.meta.url), `// Chefes de conteúdo instanciado (DG, raide, transcendência, provação, pesadelo), por código de NPC, a partir dos dados do motor
// de captura (npcs.en.json: categoria + dungeonId). O jogo só informa a DG se a captura viu a lista da party; sem isso este
// código identifica o chefe. Gerado por tools/gen-instanced-bosses.mjs.
export const INSTANCED_BOSS_CODES = new Set([
${lines.join(',\n')},
]);
`);
console.log(`${codes.length} chefes instanciados`);
