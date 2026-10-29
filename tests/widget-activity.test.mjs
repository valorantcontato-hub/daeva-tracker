import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWidgetActivity } from '../js/widget-activity.js';

const fight = (time, extra = {}) => ({ id: 'fight', live: true, capturedAt: new Date(time).toISOString(), ...extra });

test('overlay aparece com dano novo e desaparece após 3s; repetições não prolongam', () => {
  const active = createWidgetActivity();
  assert.equal(active(null, 0, 10000), 0);
  assert.equal(active(fight(10000), 100, 10000), 3000);
  assert.equal(active(fight(12000), 100, 12000), 1000);
  assert.equal(active(fight(13001), 100, 13001), 0);
  assert.equal(active(fight(14000), 110, 14000), 3000);
  assert.equal(active(fight(14000, { live: false }), 110, 14001), 0);
});

test('histórico, reconexão antiga e luta sem dano ficam ocultos; skills acompanham dano próprio', () => {
  const party = createWidgetActivity(), skills = createWidgetActivity();
  assert.equal(party(fight(1000), 100, 10000), 0);
  assert.equal(party(fight(10000, { id: 'new' }), 0, 10000), 0);
  assert.equal(skills(fight(10000), 0, 10000), 0);
  assert.equal(party(fight(11000), 1000, 11000), 3000);
  assert.equal(skills(fight(11000), 200, 11000), 3000);
  assert.equal(party(fight(14001), 2000, 14001), 3000);
  assert.equal(skills(fight(14001), 200, 14001), 0);
});
