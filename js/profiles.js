// Perfis reais (PlayNC) do jogador e da party, buscados pelo servidor local.
import { load, save } from './store.js';
import { classKey } from './data/classes.js';
import { getLang } from './lang.js';

export const REGIONS = [
  ['eu', 'Europa'], ['nae', 'NA Leste'], ['naw', 'NA Oeste'], ['la', 'América Latina'], ['as', 'Ásia/Oceania'],
];

async function api(path, params) {
  let res;
  try {
    res = await fetch(`${path}?${new URLSearchParams(params)}`);
  } catch {
    throw new Error('Servidor local offline. Rode "node server.mjs" ou abra o app desktop.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
  return data;
}

export const searchCharacters = (name, region, serverId) =>
  api('/api/plaync/search', { name, region, lang: getLang(), ...(serverId ? { serverId } : {}) });

export async function fetchProfile({ region, serverId, characterId }, { fresh = false } = {}) {
  const p = await api('/api/plaync/character', { region, serverId, characterId, lang: getLang(), ...(fresh ? { fresh: 1 } : {}) });
  p.class = p.class || classKey(p.className);
  rememberSkills(p);
  return p;
}

// Catálogo de skills (id -> nome, ícone, categoria) por idioma e classe. Todo perfil carregado alimenta o
// catálogo, então até quem ainda não tem perfil vinculado aparece com ícone e categoria certos.
function rememberSkills(p) {
  if (!p?.class || !p.skills?.length) return;
  const cat = load('skillcat', {});
  const bucket = ((cat[p.lang || getLang()] ||= {})[p.class] ||= {});
  for (const s of p.skills) bucket[s.id] = { id: s.id, name: s.name, icon: s.icon, category: s.category };
  save('skillcat', cat);
}

const catalogOf = cls => (load('skillcat', {})[getLang()] || {})[cls] || {};

export const getMe = () => load('me', null);
export const getParty = () => load('party', []);
const allProfiles = () => [getMe(), ...getParty()].filter(Boolean);

export function setMe(p) { save('me', p); }
export function upsertPartyMember(p) {
  const party = getParty().filter(x => x.characterId !== p.characterId);
  save('party', [...party, p]);
}
export function removePartyMember(id) { save('party', getParty().filter(x => x.characterId !== id)); }

/** Atualiza o perfil salvo (eu ou party) com os dados mais recentes da PlayNC. */
export async function refreshProfile(p) {
  const fresh = await fetchProfile(p, { fresh: true });
  // Só grava onde o personagem já está: se você o desvinculou durante a atualização, ele não volta sozinho.
  if (getMe()?.characterId === p.characterId) setMe(fresh);
  else if (getParty().some(x => x.characterId === p.characterId)) upsertPartyMember(fresh);
  return fresh;
}

const norm = s => String(s || '').trim().toLowerCase();
export const findProfileByName = name => allProfiles().find(p => norm(p.name) === norm(name)) || null;
export const findProfileById = id => allProfiles().find(p => p.characterId === id) || null;

/**
 * Ícone real da skill: procura pelo ID (o código que vem da captura) e depois pelo nome,
 * nas skills do perfil PlayNC do jogador ou de outro perfil da mesma classe.
 */
export function skillIcon(playerName, skillName, cls, skillId) {
  return findSkill(playerName, skillName, cls, skillId)?.icon || '';
}

/**
 * Skill do perfil PlayNC correspondente à da captura (por ID e depois por nome), no perfil do
 * próprio jogador ou de outro da mesma classe. Traz ícone e categoria (Active / Passive / Dp).
 */
export function findSkill(playerName, skillName, cls, skillId) {
  const key = norm(skillName);
  // O código do pacote pode trazer o nível/variação nos últimos dígitos.
  const ids = skillId ? [skillId, Math.floor(skillId / 100) * 100, Math.floor(skillId / 10000) * 10000] : [];
  const own = findProfileByName(playerName);
  const pools = (own ? [own, ...allProfiles()] : allProfiles())
    .filter(p => p === own || !cls || !p.class || p.class === cls);
  for (const id of ids) {
    for (const p of pools) {
      const s = p.skills?.find(x => x.id === id);
      if (s) return s;
    }
  }
  for (const p of pools) {
    const s = p.skills?.find(x => norm(x.name) === key);
    if (s) return s;
  }
  // Sem perfil dessa classe vinculado: usa o catálogo de skills da classe.
  if (cls) {
    const cat = catalogOf(cls);
    for (const id of ids) if (cat[id]) return cat[id];
    return Object.values(cat).find(x => norm(x.name) === key) || null;
  }
  return null;
}

// ---------- Vínculo automático a partir da captura ----------
// Cada nome só é procurado de novo depois de um intervalo (evita repetir buscas a cada segundo).
const cooldown = new Map();
const cooling = key => (cooldown.get(key) || 0) > Date.now();
const coolFor = (key, ms) => cooldown.set(key, Date.now() + ms);

/**
 * Acha o personagem local na PlayNC. O mesmo nome existe em vários servidores/regiões,
 * então filtra por servidor, classe e nível; se ainda sobrar mais de um, não chuta.
 */
async function findSelf(self, regions) {
  let found = [];
  for (const region of regions) {
    const list = await searchCharacters(self.name, region, self.serverId || undefined);
    found.push(...list.filter(c => norm(c.name) === norm(self.name)
      && (!self.serverId || c.serverId === self.serverId)
      && (!self.class || !c.class || c.class === self.class)));
  }
  if (found.length > 1 && self.level) found = found.filter(c => c.level === self.level);
  return found.length === 1 ? found[0] : null;
}

/**
 * Acha um membro da party (o nome se repete em vários servidores): filtra por classe e raça (a party é
 * sempre da mesma facção que você) e prefere o seu servidor. Se ainda houver dúvida, não chuta.
 */
async function findMember(player, me) {
  const ok = c => norm(c.name) === norm(player.name)
    && (!player.class || !c.class || c.class === player.class)
    && (!me.raceId || !c.race || c.race === me.raceId);
  let cands = (await searchCharacters(player.name, me.region, me.serverId)).filter(ok);
  if (!cands.length) cands = (await searchCharacters(player.name, me.region)).filter(ok);
  if (cands.length === 1) return cands[0];
  const sameServer = cands.filter(c => c.serverId === me.serverId);
  return sameServer.length === 1 ? sameServer[0] : null;
}

/**
 * Usa a luta capturada para vincular "Minha conta" (personagem local) e buscar o perfil
 * real de cada membro da party na PlayNC.
 */
export async function autoLinkFromFight(fight) {
  const self = fight.self;
  const current = getMe();
  const wrong = !current || norm(current.name) !== norm(self?.name) || (self?.serverId && String(current.serverId) !== String(self.serverId)) || (self?.class && current.class && current.class !== self.class);
  const myKey = 'me:' + (self?.serverId || '') + ':' + norm(self?.name);
  if (self?.name && wrong && !cooling(myKey)) {
    try {
      // Começa pela região salva da última busca manual, depois tenta as outras.
      const saved = load('region', '');
      const order = [saved, ...REGIONS.map(r => r[0])].filter((r, i, a) => r && a.indexOf(r) === i);
      const ref = await findSelf(self, order);
      if (ref) {
        removePartyMember(ref.characterId);
        setMe(await fetchProfile(ref));
      } else coolFor(myKey, 10 * 60e3);
    } catch { coolFor(myKey, 30e3); }
  }
  const me = getMe();
  // Party só em luta de chefe: no mapa aberto outros jogadores batem no mesmo mob.
  if (!me || !fight.isBoss) return;
  for (const player of fight.players || []) {
    const key = 'p:' + norm(player.name);
    if (!player.name || /^Player_/i.test(player.name) || norm(player.name) === norm(me.name) || findProfileByName(player.name) || cooling(key)) continue;
    try {
      const ref = await findMember(player, me);
      if (ref) upsertPartyMember(await fetchProfile(ref));
      else coolFor(key, 10 * 60e3); // não achou ou nome ambíguo: tenta de novo mais tarde
    } catch { coolFor(key, 30e3); } // erro de rede: tenta de novo em instantes, sem travar os outros
  }
}

/**
 * Troca o idioma dos perfis salvos (você e a party): refaz a busca de cada um no idioma novo para que
 * nomes de itens, skills, títulos e atributos venham com os nomes reais do jogo nesse idioma.
 */
const langOf = p => p.lang || 'en-US'; // perfis antigos foram buscados em inglês

export function needsRelocalization() {
  const lang = getLang();
  return [getMe(), ...getParty()].some(p => p && langOf(p) !== lang);
}

export async function relocalizeProfiles() {
  const lang = getLang();
  const me = getMe();
  if (me && langOf(me) !== lang) { try { setMe(await fetchProfile(me)); } catch { /* mantém o antigo */ } }
  const party = getParty();
  const next = [];
  for (const m of party) {
    if (langOf(m) === lang) { next.push(m); continue; }
    try { next.push(await fetchProfile(m)); } catch { next.push(m); }
  }
  save('party', next);
}
