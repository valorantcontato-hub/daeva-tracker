import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeOffer, sortOffers, discountOf } from '../js/shop.js';

const offer = (item, original, price) => ({ item, original, price, tier: 0 });
const pets = [
  { id: 1040, name: 'Aullaeu Shaman', mobs: [{ name: 'Aullaeu Apprentice Shaman' }] },
  { id: 1133, name: 'Forest Dionae', mobs: [] },
  { id: 1083, name: 'Spider', mobs: [{ name: 'Abyss Odyle Mutated Insectoid' }] },
  { id: 1500, name: 'Boss Pet', mobs: [{ name: 'Big Boss' }] },
];
const ctx = { pets, isBossMob: n => n === 'Big Boss', owned: id => id === 1133, progress: id => id === 1500 ? { known: true, complete: true } : null };

test('nome, categoria e desconto vêm do id do item e dos preços', () => {
  const o = describeOffer(offer(534760039, 100000, 50000), ctx);
  assert.equal(o.name, 'Pet: Aullaeu Shaman');
  assert.equal(o.category, 'Pet');
  assert.equal(o.discount, 50);
  assert.equal(discountOf(offer(1, 240000, 168000)), 30);
});

test('mascote só da loja ou de chefe vale comprar; comum e completo não', () => {
  assert.equal(describeOffer(offer(534760164, 100000, 70000), ctx).reason, 'shop'); // Forest Dionae: sem monstro
  assert.equal(describeOffer(offer(534760164, 100000, 70000), ctx).worth, true);
  const common = describeOffer(offer(534760082, 100000, 90000), ctx); // Spider: cai de monstro comum
  assert.equal(common.worth, false);
  const boss = describeOffer(offer(534760039, 100000, 50000), { ...ctx, isBossMob: () => true }); // mesmo mascote, agora de chefe
  assert.equal(boss.reason, 'boss');
  assert.equal(boss.worth, true);
  const done = describeOffer(offer(534760164, 100000, 70000), { ...ctx, progress: () => ({ known: true, complete: true }) });
  assert.equal(done.done, true);
  assert.equal(done.worth, false);
});

test('já tem vem da coleção de mascotes', () => {
  assert.equal(describeOffer(offer(534760164, 100000, 70000), ctx).owned, true); // Forest Dionae
  assert.equal(describeOffer(offer(534760082, 100000, 90000), ctx).owned, false); // Spider
});

test('item sem nome conhecido aparece pelo número e a lista põe o que vale primeiro', () => {
  const unknown = describeOffer(offer(999999999, 100, 90), ctx);
  assert.equal(unknown.name, 'Item 999999999');
  const list = sortOffers([unknown, describeOffer(offer(534760164, 100000, 70000), ctx), describeOffer(offer(535710014, 240000, 192000), ctx)]);
  assert.equal(list[0].worth, true);
});
