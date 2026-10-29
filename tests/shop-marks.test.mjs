import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leftShop } from '../electron/shop-marks.mjs';

test('andar mais de 3 m desde a leitura da loja conta como ter saído dela', () => {
  const anchor = { x: 1000, y: 1000 };
  assert.equal(leftShop(anchor, { x: 1100, y: 1100 }), false); // ~1,4 m: ainda na loja
  assert.equal(leftShop(anchor, { x: 1400, y: 1000 }), true); // 4 m
  assert.equal(leftShop(null, { x: 9999, y: 9999 }), false); // sem ponto de referência, só vale o tempo
  assert.equal(leftShop(anchor, { x: NaN, y: 0 }), false);
});
