// Servidor local sem dependências: arquivos do app + proxy PlayNC + feed de combate ao vivo.
//   node server.mjs            -> http://localhost:4173
// Também é usado pelo app desktop (electron/main.mjs) via start().
import { createServer } from 'node:http';
import { watch, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregateEvents } from './js/encounter.js';
import { createPetFeed } from './pet-feed.mjs';
const eventClients = new Set();
function publishEvent(channel, data) {
  const line = `event: ${channel}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const response of eventClients) response.write(line);
}
const pets = createPetFeed(state => publishEvent('pets', state));

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

// ---------- PlayNC (site oficial do AION 2 Global) ----------
// Endpoints não documentados usados pelo próprio aion2.plaync.com. Podem mudar sem aviso.
const SEARCH = 'https://api-search.plaync.com/aion2global/search/v2/character';
const SITE = 'https://aion2.plaync.com/api/character';
const REGIONS = new Set(['eu', 'nae', 'naw', 'la', 'as']);
const LANGS = new Set(['en-US', 'pt-BR']);
const langOf = q => (LANGS.has(q.get('lang')) ? q.get('lang') : 'en-US');
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',
  Accept: 'application/json',
  Referer: 'https://aion2.plaync.com/',
};
const cache = new Map();
let lastCall = 0;

async function plaync(url, maxAgeMs = 10 * 60e3) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.data;
  // Educado com o servidor da NC: no máximo ~4 req/s.
  const wait = lastCall + 250 - Date.now();
  lastCall = Date.now() + Math.max(0, wait);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15e3) });
  if (!res.ok) throw Object.assign(new Error(`PlayNC respondeu ${res.status}`), { status: 502 });
  const data = await res.json();
  cache.set(url, { at: Date.now(), data });
  return data;
}

async function searchCharacters(q) {
  const keyword = String(q.get('name') || '').trim();
  const region = q.get('region');
  if (!keyword || !REGIONS.has(region)) throw Object.assign(new Error('Informe nome e região'), { status: 400 });
  const params = new URLSearchParams({ keyword, page: 1, size: 30, region, localeInfo: langOf(q) });
  // Filtro por servidor: torna exata a busca de quem a captura identificou.
  if (/^\d+$/.test(q.get('serverId') || '')) params.set('serverId', q.get('serverId'));
  const data = await plaync(`${SEARCH}?${params}`);
  return (data.list || []).map(c => ({
    characterId: decodeURIComponent(c.characterId),
    name: String(c.name).replace(/<[^>]+>/g, ''),
    class: classOfPcId(c.pcId),
    level: c.level,
    race: c.race,
    serverId: c.serverId,
    serverName: c.serverName,
    region: c.region,
    image: c.profileImageUrl ? 'https://profileimg.plaync.com' + c.profileImageUrl : '',
  }));
}

// pcId (classe + gênero + raça) -> classe. Mesma faixa usada pelo jogo no roster da party.
const PC_CLASSES = [[5, 'gladiator'], [9, 'templar'], [13, 'ranger'], [17, 'assassin'], [21, 'spiritmaster'], [25, 'sorcerer'], [29, 'cleric'], [33, 'chanter']];
function classOfPcId(pcId) {
  const id = Number(pcId);
  const hit = PC_CLASSES.find(([start]) => id >= start && id < start + 4);
  return hit ? hit[1] : '';
}

const mapItem = e => ({ id: e.id, slotPos: e.slotPos, slot: e.slotPosName, name: e.name, grade: e.grade, icon: e.icon, enchant: e.enchantLevel, exceed: e.exceedLevel });

async function characterDetail(q) {
  const region = q.get('region'), serverId = q.get('serverId'), characterId = q.get('characterId');
  if (!REGIONS.has(region) || !/^\d+$/.test(serverId || '') || !characterId) throw Object.assign(new Error('Parâmetros inválidos'), { status: 400 });
  const params = new URLSearchParams({ lang: langOf(q), region, serverId, characterId });
  // Cache curto: a página inicial atualiza os itens do personagem com frequência.
  const fresh = q.get('fresh') === '1' ? 60e3 : 10 * 60e3;
  const [info, equip] = await Promise.all([plaync(`${SITE}/info?${params}`, fresh), plaync(`${SITE}/equipment?${params}`, fresh)]);
  const p = info.profile || {};
  const stats = info.stat?.statList || [];
  return {
    characterId: p.characterId || characterId,
    name: p.characterName,
    className: p.className,
    class: classOfPcId(p.pcId),
    lang: langOf(q),
    level: p.characterLevel,
    combatPower: p.combatPower,
    itemLevel: stats.find(s => s.type === 'ItemLevel')?.value ?? null,
    race: p.raceName,
    raceId: p.raceId,
    serverId: p.serverId,
    serverName: p.serverName,
    region,
    title: p.titleName,
    image: p.profileImage,
    stats: stats.filter(s => s.type !== 'ItemLevel').map(s => ({ type: s.type, name: s.name, value: s.value, effects: s.statSecondList || [] })),
    daevanion: (info.daevanion?.boardList || []).map(b => ({ id: b.id, name: b.name, icon: b.icon, percent: b.openPercent, open: b.openNodeCount, total: b.totalNodeCount })),
    equipment: (equip.equipment?.equipmentList || []).map(mapItem),
    skins: (equip.equipment?.skinList || []).map(mapItem),
    skills: (equip.skill?.skillList || []).filter(s => s.acquired).map(s => ({ id: s.id, name: s.name, icon: s.icon, level: s.skillLevel, category: s.category, equipped: !!s.equip })),
    wings: equip.petwing?.wing?.name ? { id: equip.petwing.wing.id, slotPos: 'wing', name: equip.petwing.wing.name, icon: equip.petwing.wing.icon, grade: equip.petwing.wing.grade, enchant: equip.petwing.wing.enchantLevel } : null,
    wingSkin: equip.petwing?.wingSkin?.name ? { name: equip.petwing.wingSkin.name, icon: equip.petwing.wingSkin.icon, grade: equip.petwing.wingSkin.grade } : null,
    pet: equip.petwing?.pet?.name ? { name: equip.petwing.pet.name, icon: equip.petwing.pet.icon, level: equip.petwing.pet.level } : null,
    fetchedAt: new Date().toISOString(),
  };
}

// Detalhe de um item equipado (atributos, pedras mágicas, Theostone...) e tabuleiro de Daevanion.
function charParams(q) {
  const region = q.get('region'), serverId = q.get('serverId'), characterId = q.get('characterId');
  if (!REGIONS.has(region) || !/^\d+$/.test(serverId || '') || !characterId) throw Object.assign(new Error('Parâmetros inválidos'), { status: 400 });
  return { lang: langOf(q), region, serverId, characterId };
}
const num = (q, k) => { const v = q.get(k); if (!/^\d+$/.test(v || '')) throw Object.assign(new Error('Parâmetro inválido: ' + k), { status: 400 }); return v; };

async function itemDetail(q) {
  const params = new URLSearchParams({ ...charParams(q), id: num(q, 'id'), enchantLevel: num(q, 'enchantLevel'), slotPos: num(q, 'slotPos') });
  return plaync(`${SITE}/equipment/item?${params}`, 30 * 60e3);
}

async function daevanionBoard(q) {
  const params = new URLSearchParams({ ...charParams(q), boardId: num(q, 'boardId') });
  const d = await plaync(`${SITE}/daevanion/detail?${params}`, q.get('fresh') === '1' ? 60e3 : 10 * 60e3);
  return {
    nodes: (d.nodeList || []).map(n => ({ id: n.nodeId, row: n.row, col: n.col, type: n.type, grade: n.grade, name: n.name, icon: n.icon, open: !!n.open, effects: (n.effectList || []).map(e => e.desc) })),
    skillEffects: (d.openSkillEffectList || []).map(e => e.desc),
    statEffects: (d.openStatEffectList || []).map(e => e.desc),
  };
}

// ---------- Combate ao vivo ----------
// O módulo de captura envia POST /api/live; o app/widgets ouvem por SSE.
// Formatos aceitos (um objeto ou uma lista):
//   Ponte de captura (capture/daeva-capture.exe) — estado agregado da luta, ~2x por segundo:
//   { type: "snapshot" | "end", id, boss, npcCode, isBoss, dungeon, duration, result, bossHp,
//     self, players: [{ name, class, skills: [{ id, name, hits, crits, damage, max }] }], targets }
//   Eventos crus (tools/replay.mjs ou outro sniffer):
//   { type: "start", boss, dungeon, bossIcon?, players?: [{ name, class }] }
//   { type: "hit", t?, source, skill, skillId?, damage, crit? }   (t = segundos desde o start)
//   { type: "end", result: "kill" | "wipe" }
const live = { fight: null, clients: new Set(), dirty: false };

function ingestSnapshot(ev) {
  let f = live.fight;
  const id = 'cap-' + ev.id;
  if (!f || f.id !== id) {
    f = live.fight = { id, mode: 'snapshot', startedAtMs: Date.parse(ev.startedAt) || Date.now(), timeline: {}, lastDamage: {}, endedAt: 0 };
  }
  // Timeline por segundo a partir da diferença de dano entre snapshots.
  const sec = Math.max(0, Math.floor(Number(ev.duration) || 0));
  for (const p of ev.players || []) {
    const total = (p.skills || []).reduce((a, s) => a + (Number(s.damage) || 0), 0);
    const delta = total - (f.lastDamage[p.name] || 0);
    f.lastDamage[p.name] = total;
    const tl = f.timeline[p.name] ||= [];
    if (delta > 0) tl[sec] = (tl[sec] || 0) + delta;
  }
  f.data = ev;
  f.receivedAt = Date.now();
  if (ev.type === 'end') {
    f.endedAt = Date.now();
    broadcast();
  } else {
    live.dirty = true;
  }
}

// Identidade do personagem local (teleporte/relogin), fora de qualquer luta.
let lastSelf = null;
function announceSelf(ev) {
  if (!ev?.self?.name) return;
  lastSelf = { type: 'identity', self: ev.self, capturedAt: ev.capturedAt || new Date().toISOString() };
  publishEvent('live', lastSelf);
  for (const client of live.clients) client.write(`data: ${JSON.stringify(lastSelf)}\n\n`);
}

// Posições ao vivo (você e monstros à vista) para o widget de mini mapa.
let lastPositions = null;
function announcePositions(ev) {
  if (!Array.isArray(ev?.mobs)) return;
  lastPositions = { type: 'positions', capturedAt: ev.capturedAt || new Date().toISOString(), selfId: ev.selfId ?? null,
    selfVerified: ev.selfVerified === true, selfProfile: ev.selfProfile || null,
    self: ev.self || null, entities: ev.entities || 0, mobs: ev.mobs.slice(0, 400) };
  const line = `data: ${JSON.stringify(lastPositions)}\n\n`;
  publishEvent('live', lastPositions);
  for (const client of live.clients) client.write(line);
}

function snapshot() {
  const f = live.fight;
  if (!f) return null;
  if (f.mode === 'snapshot') {
    const d = f.data;
    return {
      id: f.id, boss: d.boss || 'Combate', dungeon: d.dungeon || '', dungeonId: d.dungeonId, npcCode: d.npcCode, isBoss: !!d.isBoss,
      isDummy: d.isDummy === true, capturedAt: d.capturedAt || new Date(f.receivedAt).toISOString(),
      startedAt: d.startedAt, duration: Math.max(1, Number(d.duration) || 1), result: d.result, live: !f.endedAt,
      bossHp: d.bossHp || null, self: d.self || null, targets: d.targets || [],
      players: (d.players || []).map(p => ({
        name: p.name, class: p.class || '', isLocal: !!p.isLocal,
        skills: p.skills || [], timeline: Array.from(f.timeline[p.name] || [], v => v || 0),
      })),
    };
  }
  const duration = Math.max(1, ((f.endedAt || Date.now()) - f.startedAtMs) / 1000);
  return {
    id: f.id, boss: f.boss, dungeon: f.dungeon, bossIcon: f.bossIcon, startedAt: f.startedAt,
    duration, result: f.result || 'kill', live: !f.endedAt,
    isBoss: f.isBoss, isDummy: f.isDummy, npcCode: f.npcCode, capturedAt: new Date().toISOString(),
    players: aggregateEvents(f.events, f.roster),
  };
}

function broadcast() {
  publishEvent('live', snapshot());
  const msg = `data: ${JSON.stringify(snapshot())}\n\n`;
  for (const res of live.clients) res.write(msg);
  live.dirty = false;
}
setInterval(() => live.dirty && broadcast(), 1000).unref();

function ingest(ev) {
  if (!ev || typeof ev !== 'object') return;
  if (ev.type === 'snapshot' || (ev.type === 'end' && Array.isArray(ev.players))) return ingestSnapshot(ev);
  if (ev.type === 'start') {
    const now = Date.now();
    live.fight = {
      id: 'live-' + now.toString(36), boss: String(ev.boss || 'Chefe'), dungeon: String(ev.dungeon || ''),
      isBoss: ev.isBoss !== false, isDummy: ev.isDummy === true, npcCode: Number(ev.npcCode) || 0,
      bossIcon: ev.bossIcon || '', startedAt: new Date(now).toISOString(), startedAtMs: now,
      roster: Array.isArray(ev.players) ? ev.players : [], events: [], endedAt: 0,
    };
  } else if (ev.type === 'hit') {
    if (!live.fight || live.fight.endedAt) ingest({ type: 'start', boss: ev.boss });
    const f = live.fight;
    f.events.push({ t: ev.t ?? (Date.now() - f.startedAtMs) / 1000, source: ev.source, skill: ev.skill, skillId: ev.skillId, damage: ev.damage, crit: !!ev.crit, class: ev.class });
  } else if (ev.type === 'end' && live.fight && !live.fight.endedAt) {
    live.fight.endedAt = Date.now();
    live.fight.result = ev.result === 'wipe' ? 'wipe' : 'kill';
    broadcast();
    return;
  }
  live.dirty = true;
}

// ---------- HTTP ----------
function sendJson(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    if ((size += c.length) > 5e6) throw Object.assign(new Error('Payload grande demais'), { status: 413 });
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null');
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  try {
    if (path === '/api/plaync/search') return sendJson(res, 200, await searchCharacters(url.searchParams));
    if (path === '/api/plaync/character') return sendJson(res, 200, await characterDetail(url.searchParams));
    if (path === '/api/plaync/item') return sendJson(res, 200, await itemDetail(url.searchParams));
    if (path === '/api/plaync/daevanion') return sendJson(res, 200, await daevanionBoard(url.searchParams));
    // Gravação de pacotes (pesquisa de protocolo): o app escreve um arquivo-gatilho que a captura lê.
    if (path === '/api/capture/record') {
      const dir = join(process.env.APPDATA || homedir(), 'DaevaTracker');
      if (req.method === 'POST') {
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'record.start'), String(Math.min(900, Math.max(10, +url.searchParams.get('seconds') || 300))));
        return sendJson(res, 200, { ok: true, dir: join(dir, 'recordings') });
      }
      let status = { state: 'idle' };
      try { status = JSON.parse(readFileSync(join(dir, 'record.status'), 'utf8')); } catch { /* sem gravação ainda */ }
      return sendJson(res, 200, { ...status, dir: join(dir, 'recordings') });
    }
    if (path === '/api/live' && req.method === 'POST') {
      const body = await readBody(req);
      (Array.isArray(body) ? body : [body]).forEach(message => message?.type === 'game-focus' ? gameFocusStatus?.(message) : message?.type === 'pet-state' ? pets.ingest(message) : message?.type === 'identity' ? announceSelf(message) : message?.type === 'positions' ? announcePositions(message) : message?.type === 'movement-status' ? movementStatus?.(message) : ingest(message));
      return sendJson(res, 200, { ok: true });
    }
    if (path === '/api/live' && req.method === 'GET') return sendJson(res, 200, snapshot());
    if (path === '/api/events') return sendJson(res, 200, { version: 1 });
    if (path === '/api/events/stream') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      const initial = [['live', snapshot()], ['pets', pets.snapshot()]];
      if (lastSelf) initial.push(['live', lastSelf]);
      if (lastPositions && Date.now() - Date.parse(lastPositions.capturedAt) < 15000) initial.push(['live', lastPositions]);
      for (const [channel, data] of initial) res.write(`event: ${channel}\ndata: ${JSON.stringify(data)}\n\n`);
      eventClients.add(res);
      req.on('close', () => eventClients.delete(res));
      return;
    }
    if (path === '/api/pets/stream') return pets.subscribe(req, res);
    if (path === '/api/reload/stream') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      res.write(': ok\n\n');
      reloadClients.add(res);
      req.on('close', () => reloadClients.delete(res));
      return;
    }
    if (path === '/api/live/stream') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
      if (lastSelf) res.write(`data: ${JSON.stringify(lastSelf)}\n\n`);
      if (lastPositions && Date.now() - Date.parse(lastPositions.capturedAt) < 15000) res.write(`data: ${JSON.stringify(lastPositions)}\n\n`);
      live.clients.add(res);
      req.on('close', () => live.clients.delete(res));
      return;
    }
  } catch (e) {
    return sendJson(res, e.status || 500, { error: e.message });
  }

  const rel = path.endsWith('/') ? path + 'index.html' : path;
  // Arquivos de interface atualizados ao vivo (electron/live-ui.mjs) têm prioridade sobre os do pacote.
  for (const base of [overlayDir, ROOT]) {
    if (!base) continue;
    const file = normalize(join(base, rel));
    if (!file.startsWith(base.endsWith(sep) ? base : base + sep)) return res.writeHead(403).end();
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
      return res.end(body);
    } catch { /* tenta a próxima base */ }
  }
  res.writeHead(404, { 'content-type': 'text/plain' }).end('404');
}

// ---------- Recarregar janelas ----------
// Todas as páginas (app e widgets) ouvem /api/reload/stream e recarregam quando a interface muda.
const reloadClients = new Set();
let overlayDir = '';
let movementStatus = null;
let gameFocusStatus = null;

export function notifyReload() {
  publishEvent('reload', 'reload');
  for (const res of reloadClients) res.write('data: reload\n\n');
}

/** Modo dev: salvou um arquivo de interface, todas as janelas recarregam na hora. */
function watchForDev() {
  let timer;
  watch(ROOT, { recursive: true }, (_event, name) => {
    if (!name || !/^(index\.html|css[\\/]|js[\\/]|icons[\\/])/.test(name)) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log(`[dev] ${name} mudou — recarregando`);
      notifyReload();
    }, 120);
  });
}

/**
 * opts.overlay: pasta com arquivos de interface mais novos que os do pacote.
 * opts.dev: observa os arquivos do projeto e recarrega as janelas ao salvar.
 */
export function start(port = Number(process.env.PORT) || 4173, opts = {}) {
  overlayDir = opts.overlay || '';
  movementStatus = opts.onMovementStatus || null;
  gameFocusStatus = opts.onGameFocus || null;
  if (opts.dev) watchForDev();
  return new Promise((resolve, reject) => {
    const server = createServer(handle);
    server.once('error', reject);
    // Só escuta no próprio PC: o feed ao vivo não fica exposto na rede.
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const dev = process.argv.includes('--dev') || process.env.DAEVA_DEV === '1';
  start(undefined, { dev }).then(s => console.log(`Lotus Tracker em http://localhost:${s.address().port}${dev ? ' (dev: recarrega ao salvar)' : ''}`));
}
