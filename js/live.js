// Feed de combate ao vivo (SSE do servidor local).
// Na janela principal: lutas encerradas vão para o histórico, mobs mortos contam no bestiário
// e os perfis reais (você e a party) são vinculados automaticamente.
import { load, save, notifyChange } from './store.js';
import { normalizeEncounter } from './encounter.js';
import { autoLinkFromFight } from './profiles.js';
import { getMe } from './profiles.js';
import { readBestiary, writeBestiary, imageUrl } from './bestiary-state.js';
import { findCatalogMonster, monsterPicture } from './monster-catalog.js';
import { toast } from './util.js';
import { isTrainingDummy, isBossEncounter } from './combat-types.js';

let current = null;
const subs = new Set();
const snapshotSubs = new Set();
const handled = new Set();
let linking = null;

// Widgets e prévias (iframes) só exibem; quem grava é a janela principal, para não contar em dobro.
const isPrimary = () => window.top === window && !document.documentElement.classList.contains('widget-mode');
const norm = s => String(s || '').trim().toLowerCase();

function archive(snap) {
  const enc = normalizeEncounter(snap);
  // Histórico de DPS: chefes e lutas mais longas; pulls rápidos de mob só contam abates.
  if (isBossEncounter(snap)) {
    const list = load('encounters', []);
    if (!list.some(e => e.id === enc.id)) save('encounters', [enc, ...list]);
  }
  if (!isTrainingDummy(snap)) countKills(snap);
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
    const catalog = findCatalogMonster(t);
    let m = monsters.find(x => (t.npcCode && x.npcCode === t.npcCode) || (catalog && x.sourceSlug === catalog.sourceSlug) || norm(x.name) === norm(t.name));
    if (!m) {
      m = { ...catalog, id: catalog?.id || 'npc-' + (t.npcCode || norm(t.name)), npcCode: t.npcCode || 0, name: t.name, region: catalog?.region || snap.dungeon || 'Mundo aberto', level: catalog?.level || null, note: catalog?.note || 'Detectado pela captura', recorded: true };
      monsters.push(m);
    }
    const before = kills[m.id] || 0;
    if (imageUrl(t.icon)) m.icon = imageUrl(t.icon);
    else if (!m.icon) m.icon = monsterPicture(t);
    kills[m.id] = before + 1;
  }
  save('monsters', monsters);
  writeBestiary(state, me);
}

export function startLive() {
  if (startLive.es || typeof EventSource === 'undefined') return;
  const es = startLive.es = new EventSource('/api/live/stream');
  es.onmessage = e => {
    const snap = JSON.parse(e.data);
    if (snap?.type === 'positions') { lastPos = snap; [...posSubs].forEach(fn => fn(snap)); return; }
    // Identidade (teleporte/relogin): vincula o personagem sem esperar uma luta.
    if (snap?.type === 'identity') {
      if (isPrimary() && snap.self?.name && !linking) {
        linking = autoLinkFromFight({ self: snap.self, players: [] }).then(notifyChange, () => {}).finally(() => { linking = null; });
      }
      return;
    }
    for (const fn of [...snapshotSubs]) fn(snap);
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

let lastPos = null;
const posSubs = new Set();
/** Posições ao vivo (jogador e monstros) vindas da captura; chama já com a última recebida. */
export function onPositions(fn) {
  posSubs.add(fn);
  if (lastPos) fn(lastPos);
  return () => posSubs.delete(fn);
}
export const lastPositions = () => lastPos;

export const liveFight = () => current;
export function onSnapshot(fn) {
  snapshotSubs.add(fn);
  return () => snapshotSubs.delete(fn);
}
export function onLive(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
