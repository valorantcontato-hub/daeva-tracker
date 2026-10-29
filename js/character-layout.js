const SLOTS = ['Helmet','Shoulder','Torso','Pants','Gloves','Boots','Cape'];
export function appearanceItems(profile) {
  const skins = Object.fromEntries((profile.skins || []).map(item => [item.slot,item]));
  const wing = skins.WingSkin || profile.wingSkin || skins.Wings || profile.wings;
  return [...SLOTS.map(slot=>skins[slot]),wing,profile.pet || skins.Pet].filter(Boolean);
}
// These are combat totals, not the six primary attributes or their percentage bonuses.
export const COMBAT_STATS = [
  ['attack','Ataque',['Attack','Atk']],['defense','Defesa',['Defense','Defence']],
  ['accuracy','Precisão',['Accuracy','Hit']],['evasion','Evasão',['Evasion','Dodge']],
  ['critical','Acerto Crítico',['CriticalHit','Critical','Crit']],['criticalResist','Resistência a Crítico',['CriticalHitResist','CriticalResist']],
  ['hp','PV',['MaxHP','HP']],['mp','PM',['MaxMP','MP']],
  ['combatSpeed','Velocidade de Combate',['CombatSpeed']],['moveSpeed','Velocidade de Movimento',['MoveSpeed','MovementSpeed']],
];
export function combatStats(profile) {
  return COMBAT_STATS.map(([key,label,types]) => {
    const entry = (profile.stats || []).find(s=>types.includes(s.type));
    const raw = profile.combatStats?.[key] ?? entry?.value;
    const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
    return {key,label,value,percent:key.endsWith('Speed')};
  });
}
