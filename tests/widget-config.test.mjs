import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateWidgets, widgetBounds, widgetPointerOpacity, widgetScale } from '../electron/widget-config.mjs';

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
  assert.deepEqual(widgetBounds('skills', sizes.skills, dragged, area), { ...dragged, ...sizes.skills });
  assert.deepEqual(widgetBounds('radar', sizes.radar, { x: 9000, y: -9000, width: 300, height: 460 }, area), { x: 1604, y: 16, width: 300, height: 460 });
  const cfg = migrateWidgets({ radar: { corner: 'tl', bounds: dragged }, skills: { corner: 'br', visible: true } });
  assert.equal(cfg.radar.corner, undefined);
  assert.deepEqual(cfg.radar.bounds, dragged);
  assert.equal(cfg.skills.visible, true);
});

test('tamanho é definido pelo painel, conserva posição e limita escala e área útil', () => {
  const size = { width: 300, height: 460 }, area = { x: 0, y: 0, width: 1920, height: 1080 };
  const old = { x: 1604, y: 604, width: 700, height: 800 };
  assert.deepEqual(widgetBounds('radar', size, old, area), { x: 1604, y: 604, width: 300, height: 460 });
  assert.deepEqual(widgetBounds('radar', size, old, area, 1.5), { x: 1454, y: 374, width: 450, height: 690 });
  assert.deepEqual(widgetBounds('radar', size, { x: 50, y: 60 }, area, .75), { x: 50, y: 60, width: 225, height: 345 });
  assert.equal(widgetScale(NaN), 1);
  assert.equal(widgetScale('1.5'), 1);
  assert.equal(widgetScale(20), 1.5);
  assert.equal(widgetScale(-20), .75);
  assert.equal(widgetScale(1.224), 1.2);
});

test('Farm sozinho usa tamanho novo; oculto não reabre e radar aberto não muda', () => {
  assert.deepEqual(migrateWidgets({ farm: { visible: true, locked: true, bounds: { height: 300 } } }),
    { radar: { visible: true, locked: true, bounds: null } });
  assert.deepEqual(migrateWidgets({ farm: { visible: false } }), {});
  const radar = { visible: true, locked: true };
  assert.deepEqual(migrateWidgets({ farm: { visible: true }, radar }).radar, radar);
});
