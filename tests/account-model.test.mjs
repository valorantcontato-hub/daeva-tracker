import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountIdentity, normalizeAccountState, currentAccountCounter } from '../js/account-model.js';
import { createAccountFeed } from '../account-feed.mjs';
const state = { type: 'account-state', self: { name: 'Test', serverId: 1404 }, flowId: 'test', revision: 1, capturedAt: '2026-10-29T10:00:00Z', kinah: 36000,
  odEnergy: { current: 435, bonus: 125, max: 840 }, dutyMissions: { completed: 0, max: 5 }, craftOdyleEnergy: { crafted: 0, max: 20 } };

test('recursos preservam zero conhecido, energia bônus e capacidade individual', () => {
  const value = normalizeAccountState(state);
  assert.equal(value.kinah, 36000);
  assert.equal(value.odEnergy.bonus, 125);
  assert.equal(value.odEnergy.max, 840);
  assert.equal(value.dutyMissions.completed, 0);
  assert.equal(value.craftOdyleEnergy.crafted, 0);
  assert.equal(normalizeAccountState({ ...state, odEnergy: { current: 50, bonus: 0, max: 560 } }).odEnergy.max, 560);
  assert.equal(normalizeAccountState({ ...state, kinah: null, odEnergy: null }).kinah, null);
  assert.equal(normalizeAccountState({ ...state, dutyMissions: { completed: 6, max: 5 } }), null);
});

test('feed isola personagem e servidor, recusa repetições e nunca inventa zero após reset', () => {
  const sent = [], feed = createAccountFeed(value => sent.push(value));
  feed.ingest(state); feed.ingest(state);
  feed.ingest({ ...state, self: { name: 'Other', serverId: 1404 }, kinah: 10 });
  feed.ingest({ ...state, self: { name: 'Test', serverId: 2401 }, kinah: 20 });
  assert.equal(feed.snapshot().length, 3);
  assert.equal(sent.length, 3);
  assert.notEqual(accountIdentity(state.self), accountIdentity({ ...state.self, serverId: 2401 }));
  assert.equal(feed.snapshot()[0].kinah, 36000);
  assert.equal(currentAccountCounter({ completed: 5, max: 5, resetAt: '2026-10-29T07:00:00Z' }, Date.parse(state.capturedAt)), null);
});
