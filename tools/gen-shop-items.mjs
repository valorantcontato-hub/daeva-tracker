// Gera js/data/shop-items.js (nomes dos itens que o Black Cloud Merchant vende) a partir de raw/items.json do Aion2Data.
//   node tools/gen-shop-items.mjs caminho/para/items.json
// Fonte: https://aion2data.com (fã, não oficial; o uso pede link visível para o site).
import { readFileSync, writeFileSync } from 'node:fs';

const CATEGORIES = new Set(['Pet', 'Skin Reward Voucher', 'Theostone', 'Transformation', 'Arcana', 'Manastone', 'Reward Chest', 'Emote', 'Power Shard']);
const file = process.argv[2];
if (!file) { console.error('uso: node tools/gen-shop-items.mjs items.json'); process.exit(1); }
const { records, clientVersion } = JSON.parse(readFileSync(file, 'utf8'));
const items = records.filter(r => r.id >= 533000000 && CATEGORIES.has(r.category));
const lines = items.sort((a, b) => a.id - b.id).map(r => `${r.id}:${JSON.stringify([r.name.replace(/ \(Bound\)$/, ''), r.category, r.grade || ''])}`);
writeFileSync(new URL('../js/data/shop-items.js', import.meta.url), `// Nomes dos itens vendidos pelo Black Cloud Merchant (id do pacote da loja -> [nome, categoria, grau]).
// Fonte: Aion2Data (https://aion2data.com), cliente global ${clientVersion}. Gerado por tools/gen-shop-items.mjs.
export const SHOP_ITEMS = {
${lines.join(',\n')},
};
`);
console.log(items.length + ' itens');
