import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWidgetActivity } from '../js/widget-activity.js';

const fight = (time, extra = {}) => ({ id: 'fight', live: true, capturedAt: new Date(time).toISOString(), ...extra });

test('overlay aparece com dano novo e desaparece após 15s; repetições não prolongam', () => {
  const active = createWidgetActivity();
  assert.equal(active(null, 0, 10000), 0);
  assert.equal(active(fight(10000), 100, 10000), 15000);
  assert.equal(active(fight(12000), 100, 12000), 13000);
  assert.equal(active(fight(25001), 100, 25001), 0);
  assert.equal(active(fight(25500), 110, 25500), 15000);
  assert.equal(active(fight(25500, { live: false }), 110, 25501), 0);
});

test('histórico, reconexão antiga e luta sem dano ficam ocultos; skills acompanham dano próprio', () => {
  const party = createWidgetActivity(), skills = createWidgetActivity();
  assert.equal(party(fight(1000), 100, 20000), 0);
  assert.equal(party(fight(10000, { id: 'new' }), 0, 10000), 0);
  assert.equal(skills(fight(10000), 0, 10000), 0);
  assert.equal(party(fight(11000), 1000, 11000), 15000);
  assert.equal(skills(fight(11000), 200, 11000), 15000);
  assert.equal(party(fight(14001), 2000, 14001), 15000);
  assert.equal(skills(fight(26001), 200, 26001), 0);
});
