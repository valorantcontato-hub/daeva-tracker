// Souls are not kills. A complete server snapshot makes omitted pets level 0;
// without that snapshot their progress is unknown, never assumed incomplete.
export const SOUL_REQUIREMENTS = [5, 25, 75];
export const collectionIdentity = self => Number(self?.serverId) > 0 && String(self?.name || '').trim()
  ? JSON.stringify([String(self.serverId), String(self.name).normalize('NFKC').trim().toLowerCase()]) : null;
export const collectionStorageKey = self => 'collection:' + collectionIdentity(self);
export function normalizeCollection(input) {
  if (input?.type !== 'pet-state' || input.complete !== true || !collectionIdentity(input.self) ||
      !/^[a-zA-Z0-9-]{1,64}$/.test(input.flowId || '') || !Number.isSafeInteger(input.revision) || input.revision < 1 ||
      !Number.isFinite(Date.parse(input.capturedAt))) return null;
  const dictionaries = {};
  for (const [name, max] of [['levels',10],['points',1000000]]) {
    const map = input[name];
    if (!map || Array.isArray(map) || typeof map !== 'object' || Object.keys(map).length > 1024) return null;
    dictionaries[name] = {};
    for (const [id,value] of Object.entries(map)) {
      if (!/^[1-9]\d{0,7}$/.test(id) || !Number.isSafeInteger(value) || value < 0 || value > max) return null;
      dictionaries[name][id] = value;
    }
  }
  return { type: 'pet-state', complete:true, self:{name:String(input.self.name).trim().slice(0,60),serverId:Number(input.self.serverId)},
    flowId:input.flowId, revision:input.revision, capturedAt:input.capturedAt, ...dictionaries };
}
export function petProgress(collection, id) {
  if (!collection?.complete) return { known:false, level:0, points:0, remaining:null, total:null, percent:0 };
  const level = Math.min(3, collection.levels[id] || 0);
  const goal = SOUL_REQUIREMENTS[level] || 0;
  const points = level === 3 ? 0 : Math.min(goal, collection.points[id] || 0);
  const total = SOUL_REQUIREMENTS.slice(0, level).reduce((n,x)=>n+x,0) + points;
  return { known:true, level, points, goal, complete:level===3, total, remaining:105-total, percent:total/105*100 };
}
