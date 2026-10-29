// Simula um módulo de captura enviando uma luta para o feed ao vivo (POST /api/live).
// Serve para testar o app/widgets sem o jogo e como referência de integração do sniffer.
//   node tools/replay.mjs [--speed 4] [--url http://localhost:4173]
import { simulate, PRESETS } from '../js/data/samples.js';

const arg = (name, def) => {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : def;
};
const speed = Number(arg('speed', 4));
const url = arg('url', 'http://localhost:4173') + '/api/live';
const preset = { ...PRESETS[0], seed: Date.now() % 1e6, duration: Number(arg('duration', 90)) };

const post = body => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const events = simulate(preset).sort((a, b) => a.t - b.t);
await post({ type: 'start', boss: preset.boss, dungeon: preset.dungeon, players: preset.party.map(p => ({ name: p.name, class: p.class })) });
console.log(`Luta "${preset.boss}" (${preset.duration}s, ${events.length} hits) a ${speed}x -> ${url}`);

const t0 = Date.now();
let i = 0;
while (i < events.length) {
  const now = ((Date.now() - t0) / 1000) * speed;
  const batch = [];
  while (i < events.length && events[i].t <= now) batch.push({ type: 'hit', ...events[i++] });
  if (batch.length) await post(batch);
  await new Promise(r => setTimeout(r, 250));
}
await post({ type: 'end', result: 'kill' });
console.log('Fim da luta.');
