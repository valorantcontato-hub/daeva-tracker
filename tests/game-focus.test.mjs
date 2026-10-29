import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameFocusAllows } from '../electron/game-focus.mjs';

test('Alt+Tab oculta; arrastar overlay mantém o contexto do jogo e voltar ao jogo restaura', () => {
  const handles = ['100', '200'];
  assert.equal(gameFocusAllows({ game: false, handle: '999' }, handles, true), false);
  assert.equal(gameFocusAllows({ game: true, handle: '300' }, handles, false), true);
  assert.equal(gameFocusAllows({ game: false, handle: '100' }, handles, true), true);
  assert.equal(gameFocusAllows({ game: false, handle: '100' }, handles, false), false);
  assert.equal(gameFocusAllows({ game: false, handle: '999' }, handles, false), false);
});
