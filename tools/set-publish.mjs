// Aponta o auto-update (build.publish) para o repositório GitHub informado.
//   node tools/set-publish.mjs <dono> <repositorio>
import { readFileSync, writeFileSync } from 'node:fs';

const [owner, repo] = process.argv.slice(2);
if (!owner || !repo) {
  console.error('Uso: node tools/set-publish.mjs <dono> <repositorio>');
  process.exit(1);
}
const file = new URL('../package.json', import.meta.url);
const pkg = JSON.parse(readFileSync(file, 'utf8'));
Object.assign(pkg.build.publish[0], { owner, repo });
pkg.daevaUpdates = { owner, repo };
writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
console.log(`Auto-update: github.com/${owner}/${repo}/releases`);
