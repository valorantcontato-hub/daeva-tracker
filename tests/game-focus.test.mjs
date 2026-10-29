import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameFocusAllows, overlayShouldShow } from '../electron/game-focus.mjs';

test('Alt+Tab oculta; arrastar overlay mantém o contexto do jogo e voltar ao jogo restaura', () => {
  const handles = ['100', '200'];
  assert.equal(gameFocusAllows({ game: false, handle: '999' }, handles, true), false);
  assert.equal(gameFocusAllows({ game: true, handle: '300' }, handles, false), true);
  assert.equal(gameFocusAllows({ game: false, handle: '100' }, handles, true), true);
  assert.equal(gameFocusAllows({ game: false, handle: '100' }, handles, false), false);
  assert.equal(gameFocusAllows({ game: false, handle: '999' }, handles, false), false);
});

test('overlay só aparece com o jogo em foco há um instante, sem ocultar manual e com atividade', () => {
  const base = { gameAllowed: true, since: 1000, now: 2000, manualHidden: false, active: true };
  assert.equal(overlayShouldShow(base), true);
  assert.equal(overlayShouldShow({ ...base, now: 1300 }), false); // acabou de voltar do alt-tab
  assert.equal(overlayShouldShow({ ...base, gameAllowed: false }), false);
  assert.equal(overlayShouldShow({ ...base, manualHidden: true }), false);
  assert.equal(overlayShouldShow({ ...base, active: false }), false);
  assert.equal(overlayShouldShow({ ...base, active: undefined }), true);
});
