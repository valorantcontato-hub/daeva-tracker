import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { uiRepository } from '../electron/ui-source.mjs';

test('a origem da interface sobrevive ao package.json instalado, sem build', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  delete pkg.build; delete pkg.devDependencies;
  assert.deepEqual(uiRepository(pkg), { owner: 'valorantcontato-hub', repo: 'daeva-tracker' });
});

test('configuração do pacote tem prioridade e não aceita caminhos no lugar de repositórios', () => {
  assert.deepEqual(uiRepository({ daevaUpdates: { owner: 'outro', repo: 'tracker' }, build: { publish: [{ owner: 'antigo', repo: 'antigo' }] } }), { owner: 'outro', repo: 'tracker' });
  assert.equal(uiRepository({ daevaUpdates: { owner: '../segredo', repo: 'tracker' } }), null);
  assert.equal(uiRepository({ daevaUpdates: { owner: 'owner', repo: '../../tracker' } }), null);
  assert.equal(uiRepository({}), null);
});
