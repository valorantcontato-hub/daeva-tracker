/** Only fresh, increasing damage keeps a combat overlay visible. */
export function createWidgetActivity(idleMs = 15000) {
  let fightId, previous = 0, lastHit = 0;
  return (fight, damage, now = Date.now()) => {
    if (!fight?.live) { fightId = undefined; previous = 0; lastHit = 0; return 0; }
    const captured = Date.parse(fight.capturedAt);
    const fresh = Number.isFinite(captured) && captured <= now + 1000 && now - captured < idleMs;
    const total = Number.isFinite(damage) ? Math.max(0, damage) : 0;
    if (fight.id !== fightId) { fightId = fight.id; previous = 0; lastHit = 0; }
    if (total > previous && fresh) lastHit = Math.min(now, captured);
    previous = total;
    return lastHit ? Math.max(0, idleMs - (now - lastHit)) : 0;
  };
}
