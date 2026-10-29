// Teste do app sem o jogo: envia snapshots no MESMO formato da ponte de captura
// (capture/daeva-capture.exe) para /api/live. Os números são simulados.
//   node tools/fake-capture.mjs --self "Nome" --server 2301 --skills "17010000:Earth's Retribution,..." [--url ...]
const arg = (name, def) => {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : def;
};
const url = arg('url', 'http://localhost:4173') + '/api/live';
const self = arg('self', 'Player_0001');
const serverId = Number(arg('server', 0));
const cls = arg('class', 'cleric');
const skills = arg('skills', '10000:Basic Attack').split(',').map(s => {
  const [id, ...name] = s.split(':');
  return { id: Number(id), name: name.join(':') };
});
const seconds = Number(arg('seconds', 12));
const post = body => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const id = Date.now().toString(16);
const startedAt = new Date().toISOString();
const stats = skills.map(s => ({ ...s, hits: 0, crits: 0, damage: 0, max: 0, dot: false, summon: false }));
const bossMax = 5_000_000;
let bossHp = bossMax;

function dto(type, t) {
  return {
    type, id, boss: arg('boss', 'Kromede'), npcCode: Number(arg('npc', 2100100)), isBoss: true, dungeon: arg('dungeon', 'Fire Temple'), dungeonId: 600021,
    startedAt, duration: t, result: type === 'end' ? 'kill' : 'wipe',
    bossHp: { max: bossMax, current: bossHp },
    self: { name: self, serverId, class: cls, level: 45 },
    players: [{ name: self, class: cls, isLocal: true, heal: 0, skills: stats }],
    targets: [
      { npcCode: 2100100, name: 'Kromede', isBoss: true, killed: type === 'end', damage: bossMax - bossHp, maxHp: bossMax },
      { npcCode: 2000004, name: 'Odyle Spider', isBoss: false, killed: true, damage: 12000, maxHp: 12000 },
      { npcCode: 2000004, name: 'Odyle Spider', isBoss: false, killed: true, damage: 12000, maxHp: 12000 },
    ],
  };
}

for (let t = 1; t <= seconds; t++) {
  for (const s of stats) {
    const hits = 1 + Math.floor(Math.random() * 3);
    for (let h = 0; h < hits; h++) {
      const crit = Math.random() < 0.3;
      const dmg = Math.round((4000 + Math.random() * 9000) * (crit ? 1.8 : 1));
      s.hits++; s.crits += crit; s.damage += dmg; s.max = Math.max(s.max, dmg);
      bossHp = Math.max(0, bossHp - dmg);
    }
  }
  await post(dto('snapshot', t));
  await new Promise(r => setTimeout(r, 1000));
}
await post(dto('end', seconds));
console.log('Luta simulada enviada.');
