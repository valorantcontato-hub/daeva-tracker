import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { start, notifyReload } from '../server.mjs';

test('quatro janelas recebem combate, posição, mascotes e atualização na mesma conexão', async () => {
  const server = await start(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const abort = new AbortController();
  const readers = [];
  const readUntil = async (reader, value) => {
    let text = '';
    while (!text.includes(value)) {
      const chunk = await reader.read();
      assert.equal(chunk.done, false);
      text += new TextDecoder().decode(chunk.value);
    }
    return text;
  };
  try {
    assert.equal((await fetch(base + '/api/events')).status, 200);
    for (let i = 0; i < 4; i++) {
      const response = await fetch(base + '/api/events/stream', { signal: abort.signal });
      const reader = response.body.getReader();
      readers.push(reader);
      const initial = await readUntil(reader, 'event: pets');
      assert.match(initial, /event: live/);
    }
    const post = async body => assert.equal((await fetch(base + '/api/live', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })).status, 200);
    await post({ type: 'positions', selfVerified: true, self: { x: 10, y: 20 }, mobs: [], selfProfile: { name: 'Test', serverId: 2401 } });
    await Promise.all(readers.map(async reader => assert.match(await readUntil(reader, '"positions"'), /"x":10/)));
    await post({ type: 'snapshot', id: 'test', boss: 'Test boss', isBoss: true, duration: 30, players: [{ name: 'Test', skills: [{ name: 'Skill', damage: 90000 }] }] });
    await Promise.all(readers.map(async reader => assert.match(await readUntil(reader, 'Test boss'), /event: live/)));
    await post({ type: 'pet-state', complete: true, flowId: 'test', revision: 1, capturedAt: new Date().toISOString(), self: { name: 'Test', serverId: 2401 }, levels: { 1001: 2 }, points: {} });
    await Promise.all(readers.map(async reader => assert.match(await readUntil(reader, '"pet-state"'), /event: pets/)));
    notifyReload();
    await Promise.all(readers.map(async reader => assert.match(await readUntil(reader, 'event: reload'), /"reload"/)));
    // Reconnect restores the current fight and position without a new game packet.
    const response = await fetch(base + '/api/events/stream', { signal: abort.signal });
    const reader = response.body.getReader();
    readers.push(reader);
    assert.match(await readUntil(reader, '"positions"'), /Test boss/);
  } finally {
    abort.abort();
    await Promise.allSettled(readers.map(reader => reader.cancel()));
    server.closeAllConnections();
    server.close();
    await once(server, 'close');
  }
});
