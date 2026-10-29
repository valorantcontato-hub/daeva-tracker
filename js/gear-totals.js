// Totais de combate calculados: soma dos atributos dos itens equipados (principais, adicionais e
// pedras mágicas), mais os bônus percentuais dos atributos básicos do perfil (ex.: Poder → Ataque +6,7%).
// Não inclui o valor base da classe/nível, que o perfil público não informa.
const IDS = {
  attack: ['WeaponFixingDamage', 'Attack'], defense: ['ArmorDefense', 'Defense'],
  accuracy: ['WeaponAccuracy', 'Accuracy', 'ArmorAccuracy'], evasion: ['ArmorEvasion', 'Evasion'],
  critical: ['Critical', 'WeaponCritical'], criticalResist: ['CriticalResist', 'CriticalDefense', 'ArmorCriticalResist'],
  hp: ['HPMax'], mp: ['MPMax'],
};
const KEY_BY_ID = Object.fromEntries(Object.entries(IDS).flatMap(([k, ids]) => ids.map(id => [id, k])));

// Texto do bônus percentual → estatística (PT e EN). "Resistência a Acerto Crítico" vem antes de "Acerto Crítico".
const EFFECT_RULES = [
  ['criticalResist', /(resist[eê]ncia a (acerto )?cr[ií]tico|critical (hit )?resist)/i],
  ['critical', /(acerto cr[ií]tico|critical hit)/i],
  ['accuracy', /(precis[aã]o|accuracy)/i], ['evasion', /(evas[aã]o|evasion)/i],
  ['defense', /(defesa|defense)/i], ['attack', /(ataque|attack)/i],
  ['hp', /(\bPV\b|\bHP\b)/], ['mp', /(\bPM\b|\bMP\b)/],
  ['combatSpeed', /(velocidade de combate|combat speed)/i], ['moveSpeed', /(velocidade de movimento|movement speed|move speed)/i],
];

const num = v => { const n = parseFloat(String(v ?? '').replace(/[^\d.,-]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };

/** Bônus fixos/percentuais dos tabuleiros de Daevanion abertos ("PV +500", "Velocidade de Combate +3%"). */
export function daevanionBonus(lines) {
  const flat = {}, pct = {};
  for (const text of lines) {
    const m = /\+\s*([\d.,]+)\s*(%?)/.exec(text);
    if (!m || /(recarga|cooldown|consumo|consumption)/i.test(text)) continue;
    const rule = EFFECT_RULES.find(([, re]) => re.test(text));
    if (!rule) continue;
    (m[2] ? pct : flat)[rule[0]] = ((m[2] ? pct : flat)[rule[0]] || 0) + num(m[1]);
  }
  return { flat, pct };
}

/** @param details lista de detalhes de itens (resposta de /api/plaync/item); @param extra bônus de Daevanion */
export function gearTotals(profile, details, extra = { flat: {}, pct: {} }) {
  const flat = { ...extra.flat }, pct = { ...extra.pct };
  const add = (id, value) => { const k = KEY_BY_ID[id]; if (k) flat[k] = (flat[k] || 0) + num(value); };
  for (const d of details) {
    for (const s of d.mainStats || []) add(s.id, s.value);
    for (const s of d.subStats || []) add(s.id, s.value);
    for (const s of d.magicStoneStat || []) add(s.id, s.value);
  }
  for (const st of profile.stats || []) for (const text of st.effects || []) {
    const m = /\+\s*([\d.,]+)\s*%/.exec(text);
    if (!m || /(recarga|cooldown|consumo|consumption)/i.test(text)) continue;
    const rule = EFFECT_RULES.find(([, re]) => re.test(text));
    if (rule) pct[rule[0]] = (pct[rule[0]] || 0) + num(m[1]);
  }
  const out = {};
  for (const k of Object.keys(IDS)) out[k] = Math.round((flat[k] || 0) * (1 + (pct[k] || 0) / 100));
  out.combatSpeed = pct.combatSpeed || 0;
  out.moveSpeed = pct.moveSpeed || 0;
  return out;
}

// ---------- Tabuleiros de Daevanion (buscados em segundo plano, guardados por personagem) ----------
const KEY = 'daevstats';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const inflight = new Set();

export function daevanionLines(profile) {
  const hit = read()[profile?.characterId];
  return hit ? hit.lines : [];
}

export async function prefetchDaevanion(profile) {
  const id = profile?.characterId, boards = (profile?.daevanion || []).filter(b => b.open > 0);
  if (!id || !boards.length || inflight.has(id)) return;
  const sig = boards.map(b => b.id + ':' + b.open).join(',');
  const hit = read()[id];
  if (hit && hit.sig === sig) return;
  inflight.add(id);
  try {
    const lines = [];
    for (const b of boards) {
      const q = new URLSearchParams({ region: profile.region, serverId: profile.serverId, characterId: id, boardId: b.id });
      const res = await fetch('/api/plaync/daevanion?' + q);
      if (res.ok) lines.push(...((await res.json()).statEffects || []));
    }
    try { localStorage.setItem(KEY, JSON.stringify({ ...read(), [id]: { sig, lines } })); } catch { /* sem armazenamento */ }
    dispatchEvent(new Event('a2t:items'));
  } catch { /* PlayNC fora do ar: mantém o último valor */ } finally { inflight.delete(id); }
}
