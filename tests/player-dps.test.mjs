import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, activeSeconds, peakDps } from '../js/encounter.js';

const skills = damage => [{ id: 1, name: 'Skill', hits: 10, crits: 0, damage, max: 1 }];
const flat = (from, to, v, len) => Array.from({ length: len }, (_, i) => (i >= from && i <= to ? v : 0));

test('quem entra depois não tem o DPS diluído pelo tempo em que ainda não batia', () => {
  const enc = { duration: 40, players: [
    { name: 'A', class: '', skills: skills(40000), timeline: flat(0, 39, 1000, 40) },
    { name: 'B', class: '', skills: skills(20000), timeline: flat(20, 39, 1000, 40) },
  ] };
  const S = summarize(enc);
  assert.equal(S.players.find(p => p.name === 'A').activeDps, 1000);
  assert.equal(S.players.find(p => p.name === 'B').activeDps, 1000); // sem diluir pelos 20 s em que ainda não batia
  assert.equal(S.players.find(p => p.name === 'B').dps, 500); // DPS da luta: igual ao Questlog
  assert.equal(S.dps, 1500); // o DPS total da luta continua sobre a duração inteira
});

test('golpe isolado não vira DPS gigante e sem linha do tempo usa a duração', () => {
  assert.equal(activeSeconds([0, 0, 9000, 0], 4), 4);
  assert.equal(activeSeconds(flat(2, 2, 9000, 30), 30), 5);
  assert.equal(activeSeconds([], 12), 12);
  assert.equal(activeSeconds(undefined, 12), 12);
});

test('pausas longas (boneco renascendo) não entram no tempo batendo; pausas curtas entram', () => {
  // 10 s batendo, 28 s parado, 10 s batendo: 20 s ativos, não 48
  assert.equal(activeSeconds([...flat(0, 9, 1000, 10), ...Array(28).fill(0), ...flat(0, 9, 1000, 10)], 48), 20);
  // pausa de 2 s entre dois golpes conta como tempo batendo
  assert.equal(activeSeconds([1, 0, 0, 1, 1, 1, 1, 1, 1, 1], 10), 10);
});

test('pico é o melhor momento de 10 s; o DPS contínuo fica mais baixo quando há altos e baixos', () => {
  const tl = [...Array(10).fill(6000), ...Array(10).fill(2000)];
  assert.equal(peakDps(tl), 6000);
  assert.equal(peakDps([3000, 3000]), 3000); // luta curta: usa a janela inteira
  assert.equal(peakDps([]), 0);
  const S = summarize({ duration: 20, players: [{ name: 'A', class: '', skills: skills(80000), timeline: tl }] });
  assert.equal(S.players[0].peak, 6000);
  assert.equal(S.players[0].dps, 4000);
  assert.equal(S.players[0].activeDps, 4000);
});

test('em luta curta o pico não fica abaixo do DPS contínuo', () => {
  const S = summarize({ duration: 9, players: [{ name: 'A', class: '', skills: skills(540000), timeline: [0, ...Array(8).fill(67500)] }] });
  assert.ok(S.players[0].peak >= S.players[0].activeDps);
});
