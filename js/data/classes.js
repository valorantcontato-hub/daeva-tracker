import { isEn } from '../lang.js';

// Nomes oficiais do jogo (conferidos no site oficial da PlayNC, pt-BR e en-US).
const NAMES = {
  'pt-BR': { gladiator: 'Gladiador', templar: 'Templário', assassin: 'Assassino', ranger: 'Arqueiro', sorcerer: 'Mago', spiritmaster: 'Espiritualista', cleric: 'Clérigo', chanter: 'Encantador' },
  'en-US': { gladiator: 'Gladiator', templar: 'Templar', assassin: 'Assassin', ranger: 'Ranger', sorcerer: 'Sorcerer', spiritmaster: 'Spiritmaster', cleric: 'Cleric', chanter: 'Chanter' },
};
const COLORS = {
  gladiator: '#ef4444', templar: '#94a3b8', assassin: '#a855f7', ranger: '#22c55e',
  sorcerer: '#3b82f6', spiritmaster: '#ec4899', cleric: '#eab308', chanter: '#f97316',
};

const UNKNOWN = '#8a93a6';
export function classInfo(key) {
  const names = NAMES[isEn() ? 'en-US' : 'pt-BR'];
  return { name: names[key] || key || '—', color: COLORS[key] || UNKNOWN };
}

/** "Spiritmaster" / "Espiritualista"... (nome vindo da PlayNC, em qualquer idioma) -> chave interna. */
export function classKey(name) {
  const k = String(name || '').toLowerCase().replace(/[^a-zçãéí]/g, '');
  for (const names of Object.values(NAMES)) {
    for (const [key, n] of Object.entries(names)) if (n.toLowerCase() === k) return key;
  }
  return k === 'elementalist' ? 'spiritmaster' : '';
}
