// Modelo de encontro (luta contra chefe) e agregação de eventos de dano.
//
// Um log pode vir em dois formatos (veja README.md):
//  - "events": lista crua de hits { t, source, skill, damage, crit } — é o que um parser/sniffer produz
//  - "players": já agregado por jogador/skill, com timeline de dano por segundo
import { uid } from './util.js';

export function aggregateEvents(events, roster = []) {
  const classOf = new Map(roster.map(p => [p.name, p.class]));
  const byPlayer = new Map();
  for (const e of events) {
    const dmg = Number(e.damage) || 0;
    if (!e.source || dmg <= 0) continue;
    let p = byPlayer.get(e.source);
    if (!p) {
      p = { name: String(e.source), class: classOf.get(e.source) || e.class || '', skills: new Map(), timeline: [] };
      byPlayer.set(e.source, p);
    }
    const skillName = String(e.skill || (e.skillId ? '#' + e.skillId : 'Desconhecida'));
    let s = p.skills.get(skillName);
    if (!s) p.skills.set(skillName, s = { id: Number(e.skillId) || 0, name: skillName, hits: 0, crits: 0, damage: 0, max: 0 });
    s.hits++;
    if (e.crit) s.crits++;
    s.damage += dmg;
    if (dmg > s.max) s.max = dmg;
    const sec = Math.max(0, Math.floor(Number(e.t) || 0));
    p.timeline[sec] = (p.timeline[sec] || 0) + dmg;
  }
  return [...byPlayer.values()].map(p => ({
    ...p,
    skills: [...p.skills.values()],
    timeline: Array.from(p.timeline, v => v || 0),
  }));
}

export function normalizeEncounter(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('JSON inválido');
  let players;
  if (Array.isArray(raw.events)) {
    players = aggregateEvents(raw.events, raw.players || []);
  } else if (Array.isArray(raw.players)) {
    players = raw.players.map(p => ({
      name: String(p.name ?? '?'),
      class: p.class || '',
      isLocal: !!p.isLocal,
      skills: (p.skills || []).map(s => ({
        id: Number(s.id) || 0,
        name: String(s.name || (s.id ? '#' + s.id : '?')),
        hits: +s.hits || 0, crits: +s.crits || 0, damage: +s.damage || 0, max: +s.max || 0,
      })),
      timeline: Array.isArray(p.timeline) ? p.timeline.map(v => +v || 0) : [],
    }));
  } else {
    throw new Error('O log precisa de "events" ou "players"');
  }
  if (!players.length) throw new Error('Nenhum dano encontrado no log');
  const longest = Math.max(...players.map(p => p.timeline.length));
  return {
    id: raw.id ? String(raw.id) : uid(),
    boss: String(raw.boss || 'Chefe desconhecido'),
    dungeon: String(raw.dungeon || ''),
    dungeonId: Number(raw.dungeonId) || 0,
    bossIcon: raw.bossIcon ? String(raw.bossIcon) : '',
    startedAt: raw.startedAt || new Date().toISOString(),
    duration: Number(raw.duration) || longest || 1,
    result: raw.result === 'wipe' ? 'wipe' : 'kill',
    isBoss: raw.isBoss !== false,
    isDummy: raw.isDummy === true,
    npcCode: Number(raw.npcCode) || 0,
    bossHp: raw.bossHp?.max ? { max: +raw.bossHp.max, current: +raw.bossHp.current || 0 } : null,
    targets: Array.isArray(raw.targets) ? raw.targets.map(t => ({
      npcCode: +t.npcCode || 0, name: String(t.name || ''), isBoss: !!t.isBoss, killed: !!t.killed, damage: +t.damage || 0,
    })) : [],
    players,
  };
}

/** Tempo mínimo (s) usado no DPS de quem bateu só um instante: evita um golpe isolado virar um DPS enorme. */
const MIN_ACTIVE_SECONDS = 5;

/** Pausas de até 2 s entre golpes (animação, macro) contam como tempo batendo; pausas maiores não. */
const MAX_BRIDGED_GAP = 2;

/**
 * Tempo em que o jogador esteve batendo: os segundos com dano dele mais as pausas curtas entre eles. Pausas longas
 * (esperar o boneco de treino renascer, andar até outro monstro) e o tempo antes de ele entrar na luta não contam, para
 * o DPS refletir a taxa em que ele realmente bate, e não quanto tempo a luta ficou aberta.
 */
export function activeSeconds(timeline, fallback) {
  let seconds = 0, last = -1;
  for (let i = 0; i < (timeline || []).length; i++) {
    if (!(timeline[i] > 0)) continue;
    if (last >= 0 && i - last - 1 <= MAX_BRIDGED_GAP) seconds += i - last - 1;
    seconds += 1;
    last = i;
  }
  if (seconds === 0) return fallback;
  return Math.min(fallback, Math.max(MIN_ACTIVE_SECONDS, seconds));
}

/** Pico: o melhor momento de 'window' segundos seguidos (DPS médio dessa janela). */
export function peakDps(timeline, window = 10) {
  const t = timeline || [];
  if (!t.length) return 0;
  const w = Math.min(window, t.length);
  let sum = 0, best = 0;
  for (let i = 0; i < t.length; i++) {
    sum += t[i] || 0;
    if (i >= w) sum -= t[i - w] || 0;
    if (i >= w - 1) best = Math.max(best, sum);
  }
  return best / w;
}

/** Totais derivados: dano, DPS, crit e participação por jogador (ordenado por dano). */
export function summarize(enc) {
  const dur = Math.max(1, enc.duration);
  const players = enc.players.map(p => {
    let damage = 0, hits = 0, crits = 0;
    for (const s of p.skills) { damage += s.damage; hits += s.hits; crits += s.crits; }
    // dps: dano / duração da luta, o mesmo critério do Questlog (confere com ele até a 0,1K). activeDps: só o tempo em que o jogador
    // bateu (mostra a taxa real quando ele entrou tarde ou houve pausas). peak: melhor momento de 10 s, nunca abaixo do ativo.
    const activeDps = damage / activeSeconds(p.timeline, dur);
    return { ...p, damage, hits, crits, critRate: hits ? crits / hits : 0, dps: damage / dur, activeDps, peak: Math.max(peakDps(p.timeline), activeDps) };
  }).sort((a, b) => b.damage - a.damage);
  const total = players.reduce((a, p) => a + p.damage, 0);
  for (const p of players) p.share = total ? p.damage / total : 0;
  return { ...enc, players, total, dps: total / dur };
}

/** DPS por segundo suavizado com média móvel. */
export function smooth(timeline, length, window = 5) {
  const out = new Array(length).fill(0);
  let acc = 0;
  for (let i = 0; i < length; i++) {
    acc += timeline[i] || 0;
    if (i >= window) acc -= timeline[i - window] || 0;
    out[i] = acc / Math.min(window, i + 1);
  }
  return out;
}
