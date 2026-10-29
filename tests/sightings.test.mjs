import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

// localStorage mínimo para importar o módulo do app em Node
globalThis.localStorage = { _d: new Map(), getItem(k) { return this._d.has(k) ? this._d.get(k) : null; }, setItem(k, v) { this._d.set(k, String(v)); }, removeItem(k) { this._d.delete(k); } };
const { newCells, nearbySpawns, cellOf, CELL } = await import('../js/sightings.js');
const { parseReport, parseNames } = await import('../cloudflare/avistamentos/validate.mjs');
const worker = (await import('../cloudflare/avistamentos/worker.mjs')).default;

test('cada mob só é reportado uma vez por célula de 25 m, com nome', () => {
  const sent = new Set();
  const first = newCells([{ name: 'Hungry Tog', x: 10000, y: 5000 }, { name: 'Hungry Tog', x: 10100, y: 5100 }, { name: '', x: 1, y: 1 }, { name: 'Papis', x: NaN, y: 1 }], sent);
  assert.equal(first.length, 1); // mesma célula; sem nome e sem coordenada são ignorados
  assert.deepEqual([first[0].n, first[0].x, first[0].y], ['Hungry Tog', cellOf(10000), cellOf(5000)]);
  assert.equal(newCells([{ name: 'Hungry Tog', x: 10000, y: 5000 }], sent).length, 0); // já enviado
  assert.equal(newCells([{ name: 'Hungry Tog', x: 10000 + CELL * 3, y: 5000 }], sent).length, 1); // outra célula
});

test('spawns compartilhados: só até 2 km, do mais perto ao mais longe, com distância em metros', () => {
  // célula de 25 m: [10,0] = 250 m; [60,0] = 1.500 m; [100,0] = 2.500 m (fora); [-4,3] = 125 m
  const near = nearbySpawns({ 'Hungry Tog': [[100, 0], [60, 0], [10, 0], [-4, 3]] }, { x: 0, y: 0 }, 2000);
  assert.deepEqual(near.map(s => Math.round(s.d)), [125, 250, 1500]);
  assert.equal(Math.round(near[1].dx), 250); // deslocamento em metros (leste)
  assert.equal(nearbySpawns({ A: [[10, 0]] }, { x: 25000, y: 0 }, 2000)[0].d, 0); // você em cima do ponto
});

test('validação do servidor: nome, id anônimo e células', () => {
  const ok = parseReport({ v: 1, r: 'abcdef0123456789', mobs: [{ n: 'Hungry Tog', x: 12, y: -30 }, { n: '<script>', x: 1, y: 1 }, { n: 'Papis', x: 1.5, y: 1 }, { n: 'Papis', x: 0, y: 0 }] });
  assert.equal(ok.mobs.length, 1);
  assert.equal(parseReport({ v: 1, r: 'curto', mobs: [{ n: 'A B', x: 1, y: 1 }] }), null);
  assert.equal(parseReport({ v: 2, r: 'abcdef0123456789', mobs: [] }), null);
  assert.deepEqual(parseNames('Hungry Tog|<x>|Papis|Papis'), ['Hungry Tog', 'Papis']);
});

// D1 de mentira em cima do SQLite real, para provar o SQL do Worker
function fakeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../cloudflare/avistamentos/schema.sql', import.meta.url), 'utf8'));
  const stmt = sql => { let args = []; const s = { bind: (...a) => { args = a; return s; }, run: () => db.prepare(sql).run(...args), all: () => ({ results: db.prepare(sql).all(...args) }) }; return s; };
  return { prepare: stmt, batch: async list => list.map(s => s.run()) };
}
const call = (env, path, init) => worker.fetch(new Request('https://x.test' + path, init), env);
const report = (r, mobs) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ v: 1, r, mobs }) });

test('Worker: guarda células, devolve só as pedidas e exige MIN_REPORTERS pessoas diferentes', async () => {
  const env = { DB: fakeD1(), MIN_REPORTERS: '2' };
  const a = 'a'.repeat(16), b = 'b'.repeat(16);
  assert.equal((await call(env, '/avistamentos', report(a, [{ n: 'Hungry Tog', x: 4, y: 7 }, { n: 'Papis', x: 9, y: 9 }]))).status, 200);
  assert.deepEqual(await (await call(env, '/spawns?names=Hungry%20Tog')).json(), {}); // só uma pessoa viu
  await call(env, '/avistamentos', report(a, [{ n: 'Hungry Tog', x: 4, y: 7 }])); // a mesma pessoa de novo não conta
  assert.deepEqual(await (await call(env, '/spawns?names=Hungry%20Tog')).json(), {});
  await call(env, '/avistamentos', report(b, [{ n: 'Hungry Tog', x: 4, y: 7 }]));
  assert.deepEqual(await (await call(env, '/spawns?names=Hungry%20Tog|Papis')).json(), { 'Hungry Tog': [[4, 7]] });
  assert.equal((await call(env, '/avistamentos', { method: 'POST', body: '{ruim' })).status, 400);
});

test('Worker com MIN_REPORTERS=1 mostra o que uma pessoa viu', async () => {
  const env = { DB: fakeD1(), MIN_REPORTERS: '1' };
  await call(env, '/avistamentos', report('c'.repeat(16), [{ n: 'Papis', x: 1, y: 2 }]));
  assert.deepEqual(await (await call(env, '/spawns?names=Papis')).json(), { Papis: [[1, 2]] });
});
