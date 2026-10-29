// Feed de combate ao vivo (SSE do servidor local).
// Na janela principal: lutas encerradas vão para o histórico, mobs mortos contam no bestiário
// e os perfis reais (você e a party) são vinculados automaticamente.
import { load, save, notifyChange } from './store.js';
import { normalizeEncounter } from './encounter.js';
import { MILESTONES } from './data/monsters.js';
import { autoLinkFromFight } from './profiles.js';
import { getMe } from './profiles.js';
import { readBestiary, writeBestiary, imageUrl } from './bestiary-state.js';
import { toast } from './util.js';

let current = null;
const subs = new Set();
const handled = new Set();
let linking = null;

// Widgets e prévias (iframes) só exibem; quem grava é a janela principal, para não contar em dobro.
const isPrimary = () => window.top === window && !document.documentElement.classList.contains('widget-mode');
const norm = s => String(s || '').trim().toLowerCase();

function archive(snap) {
  const enc = normalizeEncounter(snap);
  // Histórico de DPS: chefes e lutas mais longas; pulls rápidos de mob só contam abates.
  if (!snap.isDummy && (snap.isBoss !== false || enc.duration >= 20)) {
    const list = load('encounters', []);
    if (!list.some(e => e.id === enc.id)) save('encounters', [enc, ...list]);
  }
  countKills(snap);
  notifyChange();
}

function countKills(snap) {
  const me = getMe();
  // Um personagem recém-trocado ainda pode estar sendo vinculado: não grava no anterior.
  if (me && snap.self?.name && norm(snap.self.name) !== norm(me.name)) return;
  const killed = (snap.targets || []).filter(t => t.killed && !t.isBoss && t.name);
  if (!killed.length) return;
  const monsters = load('monsters', []);
  const state = readBestiary(me);
  const kills = state.kills;
  for (const t of killed) {
    let m = monsters.find(x => (t.npcCode && x.npcCode === t.npcCode) || norm(x.name) === norm(t.name));
    if (!m) {
      m = { id: 'npc-' + (t.npcCode || norm(t.name)), npcCode: t.npcCode || 0, name: t.name, region: snap.dungeon || 'Mundo aberto', level: null, note: 'Detectado pela captura' };
      monsters.push(m);
    }
    const before = kills[m.id] || 0;
    if (imageUrl(t.icon)) m.icon = imageUrl(t.icon);
    kills[m.id] = before + 1;
    const reached = MILESTONES.find(ms => before < ms && kills[m.id] >= ms);
    if (reached) toast(`${m.name}: marco de ${reached} abates alcançado!`);
  }
  save('monsters', monsters);
  writeBestiary(state, me);
}

export function startLive() {
  if (startLive.es || typeof EventSource === 'undefined') return;
  const es = startLive.es = new EventSource('/api/live/stream');
  es.onmessage = e => {
    const snap = JSON.parse(e.data);
    if (snap && isPrimary()) {
      if (!snap.live && snap.players?.length && !handled.has(snap.id)) {
        handled.add(snap.id);
        archive(snap);
      }
      if ((snap.self || snap.isBoss) && !linking) {
        linking = autoLinkFromFight(snap).then(notifyChange, () => {}).finally(() => { linking = null; });
      }
    }
    current = snap?.players?.length && snap.live ? snap : null;
    // Cópia: um handler pode re-renderizar a view e assinar de novo durante a iteração.
    [...subs].forEach(fn => fn(current));
  };
}

export const liveFight = () => current;
export function onLive(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
