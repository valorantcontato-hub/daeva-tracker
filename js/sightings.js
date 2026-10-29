// Avistamentos compartilhados: cada app envia, de forma anônima, em que célula de 25 m viu cada mob; os outros apps baixam essas
// células e mostram no Mini mapa onde há mobs para farmar, mesmo longe (o jogo só informa mobs a uns 120 m de você).
// Só vão nome do mob e célula (nada de nome de jogador). Dá para desligar em Widgets > Mini mapa.
import { load, save } from './store.js';
import { SIGHTINGS_URL } from './sightings-config.js';

export const CELL = 2500; // 25 m; a unidade do jogo é 1 cm
export const cellOf = v => Math.round(v / CELL);
const FLUSH_MS = 30_000, FETCH_MS = 5 * 60_000, MAX_SENT = 20_000, BATCH = 50;

export const sightingsAvailable = () => !!SIGHTINGS_URL;
export const sightingsEnabled = () => sightingsAvailable() && load('shareSightings', true) !== false;

function reporterId() {
  let id = load('reporterId', '');
  if (!/^[0-9a-f]{16}$/.test(id)) {
    id = [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, '0')).join('');
    save('reporterId', id);
  }
  return id;
}

/** Células novas (ainda não enviadas) a partir dos mobs de uma leitura de posições. */
export function newCells(mobs, sent) {
  const out = [];
  for (const m of mobs || []) {
    const name = String(m?.name || '').trim();
    if (!name || !Number.isFinite(m.x) || !Number.isFinite(m.y)) continue;
    const cx = cellOf(m.x), cy = cellOf(m.y), key = name + '|' + cx + '|' + cy;
    if (sent.has(key)) continue;
    sent.add(key);
    out.push({ key, n: name, x: cx, y: cy });
  }
  return out;
}

/** Das células baixadas, as que ficam a até maxM metros de você, com a distância e o deslocamento (metros). */
export function nearbySpawns(spawns, self, maxM = 2000) {
  const out = [];
  for (const [name, cells] of Object.entries(spawns || {})) {
    for (const [cx, cy] of cells) {
      const dx = (cx * CELL - self.x) * 0.01, dy = (cy * CELL - self.y) * 0.01, d = Math.hypot(dx, dy);
      if (d <= maxM) out.push({ name, x: cx * CELL, y: cy * CELL, dx, dy, d });
    }
  }
  return out.sort((a, b) => a.d - b.d);
}

let sentKeys = new Set(load('sightingsSent', []));
let queue = [], shared = load('sharedSpawns', { at: 0, spawns: {} });
let started = false;

/** Nomes que o Mini mapa quer ver (os mobs dos que você está farmando); a janela principal baixa os spawns deles. */
export function wantSpawns(names) {
  const now = load('sightingsWanted', []), merged = [...new Set([...names, ...now])].slice(0, 12);
  if (merged.length !== now.length || merged.some((n, i) => n !== now[i])) save('sightingsWanted', merged);
}
export const sharedSpawns = () => shared.spawns || {};

export function collectSightings(mobs) {
  if (!sightingsEnabled()) return;
  const fresh = newCells(mobs, sentKeys);
  if (fresh.length) queue.push(...fresh);
  if (sentKeys.size > MAX_SENT) sentKeys = new Set([...sentKeys].slice(-MAX_SENT / 2));
}

async function flush() {
  if (!sightingsEnabled() || !queue.length) return;
  const batch = queue.splice(0, BATCH);
  try {
    const res = await fetch(SIGHTINGS_URL + '/avistamentos', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ v: 1, r: reporterId(), mobs: batch.map(b => ({ n: b.n, x: b.x, y: b.y })) }) });
    if (!res.ok) throw new Error(res.status);
    save('sightingsSent', [...sentKeys].slice(-MAX_SENT));
  } catch {
    for (const b of batch) sentKeys.delete(b.key); // tenta de novo na próxima leitura
  }
}

async function download() {
  const names = load('sightingsWanted', []);
  if (!sightingsEnabled() || !names.length) return;
  try {
    const res = await fetch(SIGHTINGS_URL + '/spawns?names=' + encodeURIComponent(names.join('|')));
    if (!res.ok) return;
    shared = { at: Date.now(), spawns: { ...shared.spawns, ...(await res.json()) } };
    save('sharedSpawns', shared);
    dispatchEvent(new Event('a2t:changed'));
  } catch { /* sem internet ou servidor fora: segue com o que já tem */ }
}

export function startSightings(onPositions) {
  if (started || !sightingsAvailable()) return;
  started = true;
  onPositions(P => collectSightings(P?.mobs));
  setInterval(flush, FLUSH_MS);
  setInterval(download, FETCH_MS);
  setTimeout(download, 5000);
  addEventListener('storage', e => { if (e.key === 'a2t:sightingsWanted') download(); });
}
