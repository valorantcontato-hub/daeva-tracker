// Ícones: classes (SVG próprio), e emblemas gerados para skills, monstros e chefes.
// Imagens reais podem ser registradas em icons/index.json (veja README) ou vir no
// próprio dado (campo "icon"); se a imagem falhar, o emblema gerado aparece no lugar.
import { esc } from './util.js';
import { classInfo } from './data/classes.js';

const CLASS_PATHS = {
  gladiator: 'M20 4 10 14M20 4v5M20 4h-5M7 11l6 6M9.5 14.5 4 20',
  templar: 'M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6Z',
  assassin: 'M5 4l10 10M19 4 9 14M7 16l-3 3M17 16l3 3',
  ranger: 'M6 3c8 3 8 15 0 18M6 3v18M3 12h15M15 9l3 3-3 3',
  sorcerer: 'M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 3-6 0 2 1 3 2 3 0-3 0-5 1-8Z',
  spiritmaster: 'M12 4a8 8 0 1 0 0 16 8 8 0 1 0 0-16ZM12 4a4 4 0 0 1 0 8 4 4 0 0 0 0 8',
  cleric: 'M12 3v18M6 9h12',
  chanter: 'M6 20 14 10M15 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7ZM4 8h4M6 6v4',
};

let manifest = { skills: {}, monsters: {}, bosses: {}, classes: {} };

export async function loadIconManifest() {
  try {
    const res = await fetch('icons/index.json', { cache: 'no-cache' });
    if (res.ok) manifest = { ...manifest, ...(await res.json()) };
  } catch { /* sem manifesto: usa só os ícones gerados */ }
}

const resolve = (group, key, explicit) => {
  const p = explicit || manifest[group]?.[key];
  return p ? (/^(https?:|data:|\/)/.test(p) ? p : 'icons/' + p) : '';
};

function hue(str) {
  let h = 0;
  for (const ch of String(str)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h % 360;
}

const SKIP = new Set(['de', 'do', 'da', 'dos', 'das', 'of', 'the']);
function initials(name) {
  const words = String(name).replace(/\(.*?\)/g, '').split(/[\s:·-]+/).filter(w => w && !SKIP.has(w.toLowerCase()));
  return ((words[0]?.[0] || '?') + (words[1]?.[0] || '')).toUpperCase();
}

const img = src => src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.remove()">` : '';

// Emblemas oficiais das classes (os mesmos do site aion2.plaync.com). O SVG fica por baixo como fallback.
const officialClassIcon = key => CLASS_PATHS[key]
  ? `https://assets.playnccdn.com/static-aion2/characters/img/daevanion/board_icon_start_${key === 'spiritmaster' ? 'elementalist' : key}.png`
  : '';

export function classIcon(key, size = 24) {
  const c = classInfo(key);
  const src = resolve('classes', key) || officialClassIcon(key);
  const path = CLASS_PATHS[key];
  return `<span class="ico cls-ico" style="--c:${c.color};--s:${size}px" title="${esc(c.name)}">${
    path ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>` : `<b>${esc(initials(c.name))}</b>`}${img(src)}</span>`;
}

/** kind: 'skill' | 'monster' | 'boss' */
export function entityIcon(kind, name, { size = 28, icon, color } = {}) {
  const group = kind === 'skill' ? 'skills' : kind === 'boss' ? 'bosses' : 'monsters';
  const h = hue(name);
  const tint = color || `hsl(${h} 55% 55%)`;
  return `<span class="ico ent-ico ${kind}" style="--c:${tint};--s:${size}px" aria-hidden="true"><b>${esc(initials(name))}</b>${img(resolve(group, name, icon))}</span>`;
}
