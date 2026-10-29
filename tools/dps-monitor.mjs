// Confere o DPS do app com números objetivos do próprio jogo, sem depender de comparar na mão.
//   node tools/dps-monitor.mjs                    grava o combate ao vivo (de 1 em 1 s) em %APPDATA%\DaevaTracker\dps-monitor-*.jsonl
//   node tools/dps-monitor.mjs --report arquivo   resume cada luta e aponta divergências
//
// A verificação usa o que o jogo informa: a vida máxima/atual do alvo. Numa luta solo, o dano contado em um alvo morto
// deve ficar perto da vida máxima dele (um pouco acima, pelo excesso do último golpe); em um chefe, o dano contado
// de todos deve acompanhar a vida perdida. Fora disso, o app está perdendo ou contando golpes a mais.
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const arg = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const sum = a => a.reduce((x, y) => x + y, 0);
const fmt = n => Math.round(n).toLocaleString('pt-BR');

if (arg('--report')) {
  const rows = readFileSync(arg('--report'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  const fights = new Map();
  for (const r of rows) fights.set(r.id, r); // fica o último retrato de cada luta
  for (const f of fights.values()) {
    const mine = f.players.find(p => p.isLocal) || f.players[0];
    const total = sum(f.players.map(p => p.damage));
    const secs = f.players.flatMap(p => p.timeline.map((v, i) => (v > 0 ? i : -1))).filter(i => i >= 0);
    const active = secs.length ? Math.max(...secs) - Math.min(...secs) + 1 : 0;
    console.log(`\n== ${f.boss}${f.isDummy ? ' (boneco)' : f.isBoss ? ' (chefe)' : ''} · DG: ${f.dungeon || '— (mundo aberto)'} · ${f.result}`);
    console.log(`   duração do app ${f.duration.toFixed(1)} s | janela com dano ${active} s | jogadores ${f.players.length}`);
    console.log(`   dano contado: total ${fmt(total)} (você ${fmt(mine?.damage || 0)}) | DPS do app ${fmt(total / Math.max(1, f.duration))} | DPS pela janela com dano ${active ? fmt(total / active) : '-'}`);
    for (const t of f.targets) {
      if (!t.maxHp) { console.log(`   alvo ${t.name}: sem vida máxima informada (dano contado ${fmt(t.damage)})`); continue; }
      const ratio = t.damage / t.maxHp;
      const flag = t.killed ? (ratio < 0.9 ? '  << FALTA dano contado' : ratio > 1.5 ? '  << dano a MAIS' : '  ok') : '';
      console.log(`   alvo ${t.name}${t.killed ? ' (morto)' : ''}: dano contado ${fmt(t.damage)} / vida máx ${fmt(t.maxHp)} = ${(ratio * 100).toFixed(0)}%${flag}`);
    }
    if (f.bossHp?.max) {
      const lost = f.bossHp.max - f.bossHp.current;
      console.log(`   chefe: perdeu ${fmt(lost)} de ${fmt(f.bossHp.max)} | dano contado de todos ${fmt(total)} = ${lost ? ((total / lost) * 100).toFixed(0) : '-'}% da vida perdida`);
    }
  }
  process.exit(0);
}

const base = process.env.DAEVA_URL || 'http://localhost:47173';
const dir = join(process.env.APPDATA || homedir(), 'DaevaTracker');
mkdirSync(dir, { recursive: true });
const file = join(dir, `dps-monitor-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.jsonl`);
console.log('Gravando em', file, '— Ctrl+C para parar');
let last = '';
setInterval(async () => {
  try {
    const f = await (await fetch(base + '/api/live', { signal: AbortSignal.timeout(2500) })).json();
    if (!f) return;
    const row = {
      t: Date.now(), id: f.id, boss: f.boss, isBoss: f.isBoss, isDummy: f.isDummy, dungeon: f.dungeon, dungeonId: f.dungeonId, live: f.live,
      result: f.result, duration: f.duration, bossHp: f.bossHp, targets: f.targets,
      players: f.players.map(p => ({ name: p.name, isLocal: p.isLocal, damage: sum((p.skills || []).map(s => s.damage)), hits: sum((p.skills || []).map(s => s.hits)), timeline: p.timeline })),
    };
    const key = row.id + row.duration + row.live + sum(row.players.map(p => p.damage));
    if (key === last) return;
    last = key;
    appendFileSync(file, JSON.stringify(row) + '\n');
  } catch { /* app fechado ou sem luta */ }
}, 1000);
