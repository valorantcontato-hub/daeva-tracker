import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateWidgets, widgetBounds, widgetPointerOpacity } from '../electron/widget-config.mjs';

test('Farm aberto migra para Mini mapa e conserva as preferências do radar', () => {
  const bounds = { x: 10, y: 20, width: 300, height: 460 };
  const cfg = migrateWidgets({ farm: { visible: true, locked: true }, radar: { visible: false, locked: false, bounds } });
  assert.equal(cfg.farm, undefined);
  assert.equal(cfg.radar.visible, true);
  assert.equal(cfg.radar.locked, false);
  assert.deepEqual(cfg.radar.bounds, bounds);
  assert.deepEqual(migrateWidgets(cfg), cfg);
});

test('travado fica invisível sob o mouse e volta ao sair ou destravar, inclusive em outro monitor', () => {
  const bounds = { x: -1200, y: 400, width: 340, height: 300 };
  assert.equal(widgetPointerOpacity(true, bounds, { x: -1100, y: 500 }), 0);
  assert.equal(widgetPointerOpacity(false, bounds, { x: -1100, y: 500 }), 1);
  assert.equal(widgetPointerOpacity(true, bounds, { x: -1200, y: 400 }), 0);
  assert.equal(widgetPointerOpacity(true, bounds, { x: -860, y: 500 }), 1);
  assert.equal(widgetPointerOpacity(true, bounds, { x: -1100, y: 700 }), 1);
  assert.equal(widgetPointerOpacity(true, bounds, { x: -1201, y: 500 }), 1);
});

test('três widgets têm cantos distintos e mantêm posições arrastadas dentro da tela', () => {
  const area = { x: 0, y: 0, width: 1920, height: 1080 };
  const sizes = { party: { width: 320, height: 270 }, skills: { width: 340, height: 340 }, radar: { width: 300, height: 460 } };
  const bounds = Object.fromEntries(Object.entries(sizes).map(([id, size]) => [id, widgetBounds(id, size, null, area)]));
  assert.equal(bounds.party.x, 16);
  assert.equal(bounds.party.y, 16);
  assert.equal(bounds.skills.x, 16);
  assert.equal(bounds.skills.y, 724);
  assert.equal(bounds.radar.x, 1604);
  assert.equal(bounds.radar.y, 604);
  assert.ok(bounds.party.y + bounds.party.height < bounds.skills.y);
  assert.ok(bounds.skills.x + bounds.skills.width < bounds.radar.x);
  const dragged = { x: 230, y: 315, width: 350, height: 400 };
  assert.deepEqual(widgetBounds('skills', sizes.skills, dragged, area), dragged);
  assert.deepEqual(widgetBounds('radar', sizes.radar, { x: 9000, y: -9000, width: 300, height: 460 }, area), { x: 1604, y: 16, width: 300, height: 460 });
  const cfg = migrateWidgets({ radar: { corner: 'tl', bounds: dragged }, skills: { corner: 'br', visible: true } });
  assert.equal(cfg.radar.corner, undefined);
  assert.deepEqual(cfg.radar.bounds, dragged);
  assert.equal(cfg.skills.visible, true);
});

test('Farm sozinho usa tamanho novo; oculto não reabre e radar aberto não muda', () => {
  assert.deepEqual(migrateWidgets({ farm: { visible: true, locked: true, bounds: { height: 300 } } }),
    { radar: { visible: true, locked: true, bounds: null } });
  assert.deepEqual(migrateWidgets({ farm: { visible: false } }), {});
  const radar = { visible: true, locked: true };
  assert.deepEqual(migrateWidgets({ farm: { visible: true }, radar }).radar, radar);
});
