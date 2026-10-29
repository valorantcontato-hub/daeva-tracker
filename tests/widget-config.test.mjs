import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateWidgets } from '../electron/widget-config.mjs';

test('Farm aberto migra para Mini mapa e conserva as preferências do radar', () => {
  const bounds = { x: 10, y: 20, width: 300, height: 460 };
  const cfg = migrateWidgets({ farm: { visible: true, locked: true }, radar: { visible: false, locked: false, bounds } });
  assert.equal(cfg.farm, undefined);
  assert.equal(cfg.radar.visible, true);
  assert.equal(cfg.radar.locked, false);
  assert.deepEqual(cfg.radar.bounds, bounds);
  assert.deepEqual(migrateWidgets(cfg), cfg);
});

test('Farm sozinho usa tamanho novo; oculto não reabre e radar aberto não muda', () => {
  assert.deepEqual(migrateWidgets({ farm: { visible: true, locked: true, bounds: { height: 300 } } }),
    { radar: { visible: true, locked: true, bounds: null } });
  assert.deepEqual(migrateWidgets({ farm: { visible: false } }), {});
  const radar = { visible: true, locked: true };
  assert.deepEqual(migrateWidgets({ farm: { visible: true }, radar }).radar, radar);
});
