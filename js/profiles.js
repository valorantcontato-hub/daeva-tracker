// Perfis reais (PlayNC) do jogador e da party, buscados pelo servidor local.
import { load, save } from './store.js';
import { classKey } from './data/classes.js';

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
  api('/api/plaync/search', serverId ? { name, region, serverId } : { name, region });

export async function fetchProfile({ region, serverId, characterId }) {
  const p = await api('/api/plaync/character', { region, serverId, characterId });
  p.class = classKey(p.className);
  return p;
}

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
  const fresh = await fetchProfile(p);
  if (getMe()?.characterId === p.characterId) setMe(fresh);
  else upsertPartyMember(fresh);
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
  const key = norm(skillName);
  // O código do pacote pode trazer o nível/variação nos últimos dígitos.
  const ids = skillId ? [skillId, Math.floor(skillId / 100) * 100, Math.floor(skillId / 10000) * 10000] : [];
  const own = findProfileByName(playerName);
  const pools = (own ? [own, ...allProfiles()] : allProfiles())
    .filter(p => p === own || !cls || !p.class || p.class === cls);
  for (const id of ids) {
    for (const p of pools) {
      const s = p.skills?.find(x => x.id === id);
      if (s?.icon) return s.icon;
    }
  }
  for (const p of pools) {
    const s = p.skills?.find(x => norm(x.name) === key);
    if (s?.icon) return s.icon;
  }
  return '';
}

// ---------- Vínculo automático a partir da captura ----------
const tried = new Set();

async function findOnServer(name, serverId, regions = REGIONS.map(r => r[0])) {
  for (const region of regions) {
    const hit = (await searchCharacters(name, region, serverId)).find(c => norm(c.name) === norm(name) && (!serverId || c.serverId === serverId));
    if (hit) return hit;
  }
  return null;
}

/**
 * Usa a luta capturada para vincular "Minha conta" (personagem local) e buscar o perfil
 * real de cada membro da party na PlayNC. Cada nome é tentado uma vez por sessão.
 */
export async function autoLinkFromFight(fight) {
  const self = fight.self;
  if (self?.name && norm(getMe()?.name) !== norm(self.name) && !tried.has('me:' + self.name)) {
    tried.add('me:' + self.name);
    // Começa pela região salva da última busca manual, depois tenta as outras.
    const saved = load('region', '');
    const order = [saved, ...REGIONS.map(r => r[0])].filter((r, i, a) => r && a.indexOf(r) === i);
    const ref = await findOnServer(self.name, self.serverId, order);
    if (ref) {
      removePartyMember(ref.characterId);
      setMe(await fetchProfile(ref));
    }
  }
  const me = getMe();
  // Party só em luta de chefe: no mapa aberto outros jogadores batem no mesmo mob.
  if (!me || !fight.isBoss) return;
  for (const p of fight.players || []) {
    if (!p.name || /^Player_/i.test(p.name) || findProfileByName(p.name) || tried.has(p.name)) continue;
    tried.add(p.name);
    // Primeiro no servidor do jogador; se não achar, um nome único na região (party entre servidores).
    let exact = (await searchCharacters(p.name, me.region, me.serverId)).filter(c => norm(c.name) === norm(p.name));
    if (!exact.length) exact = (await searchCharacters(p.name, me.region)).filter(c => norm(c.name) === norm(p.name));
    const ref = exact.find(c => c.serverId === me.serverId) || (exact.length === 1 ? exact[0] : null);
    if (!ref) continue;
    const prof = await fetchProfile(ref);
    if (!p.class || !prof.class || prof.class === p.class) upsertPartyMember(prof);
  }
}
