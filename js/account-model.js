export const accountIdentity = self => Number(self?.serverId) > 0 && String(self?.name || '').trim()
  ? JSON.stringify([String(self.serverId), String(self.name).normalize('NFKC').trim().toLowerCase()]) : null;
export const accountStorageKey = self => 'account-state:' + accountIdentity(self);
const count = value => Number.isSafeInteger(value) && value >= 0;

export function normalizeAccountState(input) {
  if (input?.type !== 'account-state' || !accountIdentity(input.self) || !/^[a-zA-Z0-9-]{1,64}$/.test(input.flowId || '') ||
      !Number.isSafeInteger(input.revision) || input.revision < 1 || !Number.isFinite(Date.parse(input.capturedAt))) return null;
  const state = { type: 'account-state', self: { name: String(input.self.name).trim().slice(0, 60), serverId: Number(input.self.serverId) },
    flowId: input.flowId, revision: input.revision, capturedAt: input.capturedAt, kinah: null, odEnergy: null, dutyMissions: null, craftOdyleEnergy: null };
  if (input.kinah != null) { if (!count(input.kinah)) return null; state.kinah = input.kinah; }
  if (input.odEnergy != null) {
    const e = input.odEnergy;
    if (!count(e.current) || !count(e.bonus) || (e.max != null && (!count(e.max) || e.max < 1))) return null;
    state.odEnergy = { current: e.current, bonus: e.bonus, max: e.max ?? null,
      nextRefillAt: Number.isFinite(Date.parse(e.nextRefillAt)) ? e.nextRefillAt : null,
      refillSeconds: count(e.refillSeconds) && e.refillSeconds > 0 ? e.refillSeconds : null };
  }
  for (const [key, field] of [['dutyMissions', 'completed'], ['craftOdyleEnergy', 'crafted']]) {
    const value = input[key];
    if (value == null) continue;
    if (!count(value[field]) || !count(value.max) || value.max < 1 || value[field] > value.max) return null;
    state[key] = { [field]: value[field], max: value.max, resetAt: Number.isFinite(Date.parse(value.resetAt)) ? value.resetAt : null };
  }
  return state;
}

/** Expired counters stay unknown until the game supplies the new period. */
export function currentAccountCounter(value, now = Date.now()) {
  return value && (!value.resetAt || Date.parse(value.resetAt) > now) ? value : null;
}
