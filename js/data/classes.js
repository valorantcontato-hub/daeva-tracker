export const CLASSES = {
  gladiator:    { name: 'Gladiador',      color: '#ef4444' },
  templar:      { name: 'Templário',      color: '#94a3b8' },
  assassin:     { name: 'Assassino',      color: '#a855f7' },
  ranger:       { name: 'Caçador',        color: '#22c55e' },
  sorcerer:     { name: 'Feiticeiro',     color: '#3b82f6' },
  spiritmaster: { name: 'Espiritualista', color: '#ec4899' },
  cleric:       { name: 'Clérigo',        color: '#eab308' },
  chanter:      { name: 'Cantor',         color: '#f97316' },
};

const UNKNOWN = { name: '—', color: '#8a93a6' };
export const classInfo = key => CLASSES[key] || { ...UNKNOWN, name: key || UNKNOWN.name };

/** "Spiritmaster" / "Spirit Master" (nome em inglês vindo da PlayNC) -> chave interna. */
export function classKey(name) {
  const k = String(name || '').toLowerCase().replace(/[^a-z]/g, '');
  return CLASSES[k] ? k : (k === 'elementalist' ? 'spiritmaster' : '');
}
