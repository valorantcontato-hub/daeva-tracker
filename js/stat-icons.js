// Ícones dos atributos (traço simples, herdam a cor do texto). A chave é o "type" que a PlayNC envia.
const P = {
  STR: 'M5 19 19 5M15 5h4v4M7 14l3 3',                                               // espada
  DEX: 'M13 2 4 14h7l-1 8 9-12h-7z',                                                 // raio
  INT: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',                                         // brilho
  CON: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.5-7 10-7 10z',            // coração
  AGI: 'M12 4a8 8 0 1 0 0 16 8 8 0 1 0 0-16zM12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6z',    // alvo
  WIS: 'M12 3c2 4 6 5 6 10a6 6 0 0 1-12 0c0-3 2-4 3-6 0 2 1 3 2 3 0-3 0-5 1-7z',     // chama
  Justice: 'M12 4v16M6 8h12M6 8l-3 6a3 3 0 0 0 6 0zM18 8l-3 6a3 3 0 0 0 6 0z',        // balança
  Freedom: 'M3 14c4-1 6-4 9-9 1 5 4 8 9 9-4 1-7 3-9 6-2-3-5-5-9-6z',                 // asa
  Illusion: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6z', // olho
  Life: 'M5 19c0-9 6-14 15-14 0 9-5 15-14 15zM5 19l8-8',                              // folha
  Time: 'M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9',          // ampulheta
  Destruction: 'M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z',          // explosão
  Death: 'M12 3a7 7 0 0 0-7 7c0 2.5 1.2 4 3 5v4h8v-4c1.8-1 3-2.5 3-5a7 7 0 0 0-7-7zM9.5 11h.01M14.5 11h.01', // caveira
  Wisdom: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z', // lâmpada
  Destiny: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',  // estrela
  Space: 'M12 7a5 5 0 1 0 0 10 5 5 0 1 0 0-10zM3 17c3 2 12-1 18-8',                   // planeta
};

export const STAT_COLORS = {
  STR: '#ef4444', DEX: '#22c55e', INT: '#3b82f6', CON: '#f97316', AGI: '#eab308', WIS: '#a855f7',
  Justice: '#f59e0b', Freedom: '#38bdf8', Illusion: '#c084fc', Life: '#4ade80', Time: '#2dd4bf',
  Destruction: '#fb7185', Death: '#94a3b8', Wisdom: '#facc15', Destiny: '#818cf8', Space: '#22d3ee',
};

export const BASE_STATS = ['STR', 'DEX', 'INT', 'CON', 'AGI', 'WIS'];

// Ícones oficiais do jogo (os mesmos da ficha em aion2.plaync.com); se não carregar, o traço acima aparece.
const CDN = 'https://assets.playnccdn.com/static-aion2/characters/img/info/stat_';
const FILE = { STR: 'str', DEX: 'dex', INT: 'int', CON: 'con', AGI: 'agi', WIS: 'wis' };

export function statIcon(type) {
  const d = P[type] || P.INT;
  const file = FILE[type] || (P[type] ? 'lords_' + type.toLowerCase() : '');
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>${file ? `<img src="${CDN}${file}.png" alt="" loading="lazy" draggable="false" onerror="this.remove()">` : ''}`;
}
