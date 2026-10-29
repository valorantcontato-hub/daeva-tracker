// Encontros de EXEMPLO gerados de forma determinística, só para demonstrar a interface.
// Nomes de chefes, DGs e skills são fictícios — os dados reais virão do importador de logs.
import { normalizeEncounter } from '../encounter.js';

// [nome, dano base, peso de uso]
const SKILLS = {
  gladiator:    [['Golpe Devastador', 14000, 3], ['Corte Sísmico', 9000, 4], ['Investida Brutal', 22000, 1], ['Lâmina Giratória', 6500, 5], ['Fúria do Berserker', 30000, .6], ['Ataque Básico', 2600, 9]],
  templar:      [['Golpe do Escudo', 6000, 4], ['Julgamento', 11000, 2], ['Lâmina Punitiva', 8000, 3], ['Provocação Divina', 1500, 2], ['Ataque Básico', 2200, 9]],
  assassin:     [['Lâmina Sombria', 12000, 4], ['Golpe Venenoso', 5000, 5], ['Emboscada', 26000, 1], ['Dança das Facas', 8500, 3], ['Marca da Morte', 34000, .5], ['Veneno (DoT)', 1800, 7], ['Ataque Básico', 2400, 8]],
  ranger:       [['Flecha Perfurante', 13000, 4], ['Chuva de Flechas', 7000, 3], ['Tiro Explosivo', 21000, 1.2], ['Flecha Rápida', 5000, 6], ['Disparo Mirado', 28000, .7], ['Ataque Básico', 2500, 8]],
  sorcerer:     [['Bola de Fogo', 15000, 4], ['Lança de Gelo', 11000, 4], ['Tempestade Arcana', 9000, 2], ['Explosão de Chamas', 24000, 1], ['Meteoro', 42000, .4], ['Ataque Básico', 2000, 5]],
  spiritmaster: [['Espírito de Fogo (invocação)', 4500, 9], ['Maldição Erosiva', 2500, 6], ['Explosão Espiritual', 18000, 1.5], ['Comando: Ataque', 9000, 3], ['Ataque Básico', 1900, 4]],
  cleric:       [['Raio Divino', 7000, 3], ['Punição Sagrada', 9000, 1.5], ['Corrente de Luz', 3000, 4], ['Ataque Básico', 1800, 4]],
  chanter:      [['Golpe do Mantra', 8000, 4], ['Onda de Choque', 6500, 3], ['Bastão Celestial', 12000, 1.5], ['Martelo Retumbante', 15000, 1], ['Ataque Básico', 2300, 8]],
};

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function simulate({ seed, duration, party }) {
  const r = rng(seed);
  const events = [];
  // Fase de invulnerabilidade do chefe (sem dano) no meio da luta.
  const immuneFrom = Math.floor(duration * .48), immuneTo = immuneFrom + 7;
  for (const p of party) {
    const skills = SKILLS[p.class];
    const totalW = skills.reduce((a, s) => a + s[2], 0);
    const phase = r() * 10;
    for (let t = 0; t < duration; t++) {
      if (t >= immuneFrom && t < immuneTo) continue;
      const burst = t % 60 < 12 ? 1.45 : 1;
      const wave = 1 + .22 * Math.sin(t / 13 + phase);
      const casts = 1 + (r() < .55 ? 1 : 0) + (r() < .15 ? 1 : 0);
      for (let c = 0; c < casts; c++) {
        let pick = r() * totalW, s = skills[0];
        for (const sk of skills) { if ((pick -= sk[2]) <= 0) { s = sk; break; } }
        const crit = r() < p.crit;
        const damage = Math.round(s[1] * p.power * burst * wave * (.85 + r() * .3) * (crit ? 1.75 : 1));
        events.push({ t: t + r(), source: p.name, skill: s[0], damage, crit });
      }
    }
  }
  return events;
}

const DAY = 864e5;
export const PRESETS = [
  {
    seed: 11, boss: 'Guardião Ignar', dungeon: 'Santuário de Cinzas', duration: 214, result: 'kill', ago: .1,
    party: [
      { name: 'Kaelen', class: 'gladiator', power: 1.05, crit: .32 },
      { name: 'Lyra', class: 'sorcerer', power: 1.12, crit: .28 },
      { name: 'Thorne', class: 'templar', power: .9, crit: .2 },
      { name: 'Mirae', class: 'cleric', power: .8, crit: .18 },
    ],
  },
  {
    seed: 23, boss: 'Rainha Vespa Nyx', dungeon: 'Colmeia Profunda', duration: 176, result: 'kill', ago: .6,
    party: [
      { name: 'Vex', class: 'assassin', power: 1.1, crit: .41 },
      { name: 'Sorin', class: 'ranger', power: 1.02, crit: .35 },
      { name: 'Aria', class: 'chanter', power: .95, crit: .24 },
      { name: 'Doran', class: 'spiritmaster', power: 1, crit: .22 },
    ],
  },
  {
    seed: 37, boss: 'Arauto do Abismo', dungeon: 'Torre do Abismo · Raide', duration: 342, result: 'kill', ago: 1.4,
    party: [
      { name: 'Kaelen', class: 'gladiator', power: 1.08, crit: .33 },
      { name: 'Lyra', class: 'sorcerer', power: 1.15, crit: .3 },
      { name: 'Vex', class: 'assassin', power: 1.1, crit: .4 },
      { name: 'Sorin', class: 'ranger', power: 1, crit: .34 },
      { name: 'Doran', class: 'spiritmaster', power: .98, crit: .21 },
      { name: 'Thorne', class: 'templar', power: .9, crit: .2 },
      { name: 'Aria', class: 'chanter', power: .93, crit: .25 },
      { name: 'Mirae', class: 'cleric', power: .78, crit: .17 },
    ],
  },
  {
    seed: 41, boss: 'Guardião Ignar', dungeon: 'Santuário de Cinzas', duration: 128, result: 'wipe', ago: 2.2,
    party: [
      { name: 'Kaelen', class: 'gladiator', power: .98, crit: .3 },
      { name: 'Lyra', class: 'sorcerer', power: 1.04, crit: .27 },
      { name: 'Thorne', class: 'templar', power: .88, crit: .2 },
      { name: 'Mirae', class: 'cleric', power: .8, crit: .18 },
    ],
  },
];

export function sampleEncounters() {
  const now = Date.now();
  return PRESETS.map(p => ({
    ...normalizeEncounter({
      id: 'sample-' + p.seed,
      boss: p.boss, dungeon: p.dungeon, duration: p.duration, result: p.result,
      startedAt: new Date(now - p.ago * DAY).toISOString(),
      players: p.party.map(({ name, class: c }) => ({ name, class: c })),
      events: simulate(p),
    }),
    sample: true,
  }));
}
