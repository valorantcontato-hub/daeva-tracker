import { isTrainingDummy } from './combat-types.js';

const norm = value => String(value || '').trim().toLowerCase();
export const trainingSkillKey = s => Number(s.id) ? 'id:' + Number(s.id) : 'name:' + norm(s.name);
const nonnegative = value => Math.max(0, Number(value) || 0);
const OPTIONAL = ['back', 'perfect', 'double', 'parry'];

export function localTrainingPlayer(snapshot, name = '') {
  const players = snapshot?.players || [];
  const marked = players.filter(p => p.isLocal);
  if (marked.length === 1) return !name || norm(marked[0].name) === norm(name) ? marked[0] : null;
  const wanted = snapshot?.self?.name || name;
  const matches = players.filter(p => wanted && norm(p.name) === norm(wanted) && (!name || norm(p.name) === norm(name)));
  return matches.length === 1 ? matches[0] : null;
}

/** Mede diferenças entre amostras acumuladas, sem incluir o aquecimento nem outros jogadores. */
export class TrainingRun {
  constructor(plan, now) {
    this.plan = { ...plan };
    this.startAt = now + 5000;
    this.endAt = this.startAt + plan.timeLimit * 1000;
    this.status = 'active';
    this.baselines = new Map();
    this.skills = new Map();
    this.timeline = [];
    this.target = '';
    this.actor = plan.playerName || '';
    this.warning = '';
  }

  phase(now) {
    if (this.status !== 'active') return this.status;
    return now < this.startAt ? 'countdown' : now < this.endAt ? 'running' : 'finalizing';
  }

  observe(snapshot, receivedAt) {
    if (this.status !== 'active' || !isTrainingDummy(snapshot)) return;
    const player = localTrainingPlayer(snapshot, this.plan.playerName);
    if (!player) { this.warning = 'Jogador local não identificado na captura.'; return; }
    const parsed = typeof snapshot.capturedAt === 'number' ? snapshot.capturedAt : Date.parse(snapshot.capturedAt);
    const at = Number.isFinite(parsed) && parsed <= receivedAt + 1000 ? parsed : receivedAt;
    const encounter = String(snapshot.id || snapshot.startedAt || snapshot.npcCode) + ':' + norm(player.name);
    const previous = this.baselines.get(encounter);
    if (previous && at <= previous.at) return;
    const current = new Map((player.skills || []).map(s => [trainingSkillKey(s), s]));
    this.baselines.set(encounter, { at, skills: current });
    if (at < this.startAt || at >= this.endAt) return;
    const began = Date.parse(snapshot.startedAt);
    // Uma luta anterior sem amostra de referência não pode ser somada inteira ao treino.
    if (!previous && (!Number.isFinite(began) || began < this.startAt)) return;
    const target = Number(snapshot.npcCode) ? 'npc:' + Number(snapshot.npcCode) : 'name:' + norm(snapshot.boss);
    if (this.target && this.target !== target) { this.warning = 'Dano em outro boneco foi ignorado.'; return; }
    let added = 0;
    for (const [key, skill] of current) {
      const before = previous?.skills.get(key);
      const reset = before && (nonnegative(skill.damage) < nonnegative(before.damage) || nonnegative(skill.hits) < nonnegative(before.hits));
      const baseline = reset ? null : before;
      const damage = Math.max(0, nonnegative(skill.damage) - nonnegative(baseline?.damage));
      if (!damage) continue;
      const hits = Math.max(0, nonnegative(skill.hits) - nonnegative(baseline?.hits));
      const crits = Math.min(hits, Math.max(0, nonnegative(skill.crits) - nonnegative(baseline?.crits)));
      const row = this.skills.get(key) || { id: Number(skill.id) || 0, name: String(skill.name || '?'), damage: 0, hits: 0, crits: 0, dot: !!skill.dot, summon: !!skill.summon };
      row.damage += damage; row.hits += hits; row.crits += crits;
      for (const field of OPTIONAL) {
        if (typeof skill[field] === 'number' && (!baseline || typeof baseline[field] === 'number'))
          row[field] = (row[field] || 0) + Math.max(0, skill[field] - (baseline?.[field] || 0));
      }
      this.skills.set(key, row);
      added += damage;
    }
    if (added) {
      this.target = target; this.targetName = snapshot.boss; this.actor = player.name; this.actorClass = player.class;
      const second = Math.min(this.plan.timeLimit - 1, Math.max(0, Math.floor((at - this.startAt) / 1000)));
      this.timeline[second] = (this.timeline[second] || 0) + added;
    }
  }

  finish(status, now) { this.status = status; this.finishedAt = now; }

  result(now) {
    const elapsed = this.status === 'completed' ? this.plan.timeLimit : Math.max(0, Math.min(this.plan.timeLimit, ((this.finishedAt || now) - this.startAt) / 1000));
    const skills = [...this.skills.values()].map(s => ({ ...s })).sort((a, b) => b.damage - a.damage);
    const damage = skills.reduce((n, s) => n + s.damage, 0);
    const hits = skills.reduce((n, s) => n + s.hits, 0);
    const crits = skills.reduce((n, s) => n + s.crits, 0);
    return { ...this.plan, status: this.status, playerName: this.actor, class: this.actorClass || this.plan.class,
      startedAt: new Date(this.startAt).toISOString(), endedAt: this.finishedAt ? new Date(this.finishedAt).toISOString() : null,
      target: this.target, targetName: this.targetName || '', duration: elapsed, damage, hits, crits,
      critRate: hits ? crits / hits : 0, dps: elapsed ? damage / elapsed : 0,
      skills, timeline: Array.from(this.timeline, n => n || 0), warning: this.warning };
  }
}

export function compareTrainingRuns(a, b) {
  const rows = new Map();
  for (const [side, run] of [['a', a], ['b', b]]) for (const skill of run.skills || []) {
    const key = trainingSkillKey(skill);
    const row = rows.get(key) || { key, skill };
    row[side] = { ...skill, dps: run.duration ? skill.damage / run.duration : 0, share: run.damage ? skill.damage / run.damage : 0,
      critRate: skill.hits ? skill.crits / skill.hits : 0, average: skill.hits ? skill.damage / skill.hits : 0 };
    rows.set(key, row);
  }
  return [...rows.values()].map(row => ({ ...row, delta: (row.b?.dps || 0) - (row.a?.dps || 0) }))
    .sort((x, y) => (y.b?.dps || y.a?.dps || 0) - (x.b?.dps || x.a?.dps || 0));
}
