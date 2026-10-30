// Catálogo estático: nenhuma consulta ao MetaBot para listar/paginar. Só as fotos visíveis são pedidas.
let monsters = [];
let byCode = new Map(), byName = new Map(), bySlug = new Map();
export const monsterNameKey = name => String(name || '').normalize('NFKC').replace(/[’‘]/g, "'").trim().toLowerCase().replace(/\s+/g, ' ');

export function setMonsterCatalog(list) {
  monsters = list;
  byCode = new Map(); byName = new Map(); bySlug = new Map();
  for (const m of monsters) {
    bySlug.set(m.sourceSlug, m);
    for (const code of m.npcCodes || []) byCode.set(String(code), m);
    const key = monsterNameKey(m.name);
    byName.set(key, [...(byName.get(key) || []), m]);
  }
}

export async function loadMonsterCatalog() {
  try {
    const res = await fetch('/js/data/monster-catalog.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.monsters)) setMonsterCatalog(data.monsters);
  } catch { /* Sem catálogo: os monstros já registrados continuam funcionando. */ }
}

export function findCatalogMonster(monster) {
  if (monster.sourceSlug && bySlug.has(monster.sourceSlug)) return bySlug.get(monster.sourceSlug);
  if (monster.id?.startsWith('metabot-') && bySlug.has(monster.id.slice(8))) return bySlug.get(monster.id.slice(8));
  if (monster.npcCode && byCode.has(String(monster.npcCode))) return byCode.get(String(monster.npcCode));
  const candidates = byName.get(monsterNameKey(monster.name));
  return candidates?.length === 1 ? candidates[0] : null;
}

/**
 * O jogo às vezes mostra o abate com o nome do MASCOTE que o monstro dá (ex.: "Cave Bat") e não com o nome do monstro nos dados
 * ("Drana Mutated Bat"). Se o nome é de um mascote cujo monstro é um só e está no catálogo, devolve esse monstro; se houver mais
 * de um (ambíguo), não chuta.
 */
export function catalogByPetName(name, pets) {
  const key = monsterNameKey(name);
  const pet = (pets || []).find(p => monsterNameKey(p.name) === key);
  if (!pet) return null;
  const hits = [...new Set((pet.mobs || []).map(m => monsterNameKey(m.name)))]
    .map(n => (byName.get(n) || []))
    .filter(list => list.length === 1).map(list => list[0]);
  const unique = [...new Set(hits)];
  return unique.length === 1 && (pet.mobs || []).length ? unique[0] : null;
}

export function monsterPicture(monster) {
  const exact = findCatalogMonster(monster);
  if (exact?.icon) return exact.icon;
  // Variantes podem compartilhar a foto, sem com isso juntar seus contadores de abate.
  const images = new Set((byName.get(monsterNameKey(monster.name)) || []).map(m => m.icon).filter(Boolean));
  return images.size === 1 ? [...images][0] : '';
}

export function mergeMonsterCatalog(saved) {
  const claimed = new Set();
  const enriched = saved.map(monster => {
    const source = findCatalogMonster(monster);
    if (source) claimed.add(source.id);
    return {
      ...source, ...monster,
      sourceSlug: source?.sourceSlug || monster.sourceSlug,
      icon: monster.icon || monsterPicture(monster),
      // Entradas existentes antes do catálogo permanecem salvas, com seus IDs e contadores.
      customized: monster.customized || !monster.sourceSlug,
    };
  });
  return [...enriched, ...monsters.filter(m => !m.isBoss && !claimed.has(m.id))];
}
