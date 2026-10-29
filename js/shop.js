// Black Cloud Merchant: ofertas lidas do pacote da loja (captura) e a avaliação "vale comprar" de cada uma.
import { load, save } from './store.js';
import { SHOP_ITEMS } from './data/shop-items.js';

const TABS = ['special', 'pets', 'skins'];
const TAB_LABEL = { special: 'Special', pets: 'Pets', skins: 'Skins' };
const DISCOUNT = [10, 20, 30, 50]; // nível 0..3 do pacote
const SHOP_TTL_MS = 3600_000; // a lista da loja troca a cada hora
const norm = s => String(s || '').normalize('NFKC').trim().toLowerCase();

/** Desconto em % a partir dos dois preços (o nível do pacote só confere). */
export const discountOf = o => Math.round((1 - o.price / o.original) * 100);

/**
 * Nome, categoria e avaliação de uma oferta.
 * ctx: { pets: catálogo de mascotes, isBossMob(nome) -> bool, progress(petId) -> {known, complete} | null, owned(petId) -> bool }
 * "Já tem" vem da sua coleção de mascotes (a loja do jogo desenha o Owned, mas ele não vai no pacote da loja).
 * Mascote vale a pena quando é difícil de conseguir de outro jeito (cai de chefe ou não cai de monstro nenhum, só na loja)
 * e ainda não está completo.
 */
export function describeOffer(offer, ctx = {}) {
  const info = SHOP_ITEMS[offer.item];
  const name = info?.[0] || 'Item ' + offer.item;
  const category = info?.[1] || '';
  const grade = info?.[2] || '';
  const out = { ...offer, name, category, grade, discount: discountOf(offer), known: !!info, pet: null, reason: '', worth: false, done: false, owned: false };
  if (category !== 'Pet') return out;
  const petName = norm(name.replace(/^Pet:\s*/i, ''));
  const pet = (ctx.pets || []).find(p => norm(p.name) === petName);
  if (!pet) return out;
  out.pet = pet;
  const progress = ctx.progress?.(pet.id);
  out.progress = progress?.known ? progress : null;
  out.done = !!(progress?.known && progress.complete);
  out.owned = !!ctx.owned?.(pet.id);
  const mobs = pet.mobs || [];
  if (!mobs.length) out.reason = 'shop';
  else if (mobs.some(m => ctx.isBossMob?.(m.name))) out.reason = 'boss';
  out.worth = !!out.reason && !out.done;
  return out;
}

// Posição de cada cartão na tela da loja (1920x1080, em pixels): 6 em cima, da esquerda para a direita, e 4 embaixo
// (dois de cada lado do vendedor). A ordem do pacote (campo "order", do menor para o maior) segue essa sequência.
export const SHOP_SLOTS = [[420, 283], [636, 330], [852, 350], [1068, 350], [1284, 330], [1500, 283], [461, 553], [677, 592], [1241, 592], [1457, 553]];
export const SHOP_SCREEN = [1920, 1080];
const RARE_GRADES = new Set(['Unique', 'Heroic']);

/** Marcadores a desenhar sobre a loja: só as ofertas que valem comprar ou são raras, com a posição do cartão. */
const CARD_HEIGHT = 228; // altura de um cartão na tela da loja (1080p)

/** "Nv 2 · 14/75": nível e almas do mascote na sua coleção (MAX quando completo). */
export const petLevelText = p => p?.known ? (p.complete ? 'Nv 3 · MAX' : 'Nv ' + p.level + ' · ' + p.points + '/' + p.goal) : '';

export function shopMarks(tab, ctx = {}) {
  const offers = [...(tab?.offers || [])];
  if (offers.length !== SHOP_SLOTS.length || offers.some(o => !o.order)) return []; // sem a ordem completa, a posição seria um palpite
  offers.sort((a, b) => a.order - b.order);
  return offers.flatMap((o, i) => {
    const d = describeOffer(o, ctx);
    const [x, y] = SHOP_SLOTS[i];
    const kind = d.worth ? 'worth' : RARE_GRADES.has(d.grade) && d.category !== 'Pet' ? 'rare' : '';
    const marks = kind ? [{ kind, label: d.worth ? 'Vale comprar' : 'Raro', reason: d.reason, x, y, name: d.name }] : [];
    const level = petLevelText(d.progress);
    // Em todo mascote: o nível e as almas que você já tem dele, embaixo do cartão.
    if (level) marks.push({ kind: 'info', label: level, x, y: y + CARD_HEIGHT, name: d.name });
    return marks;
  });
}

/** Ordem da lista: o que vale comprar primeiro, depois maior desconto. */
export const sortOffers = list => [...list].sort((a, b) => (b.worth - a.worth) || (b.discount - a.discount) || a.name.localeCompare(b.name));

// ---------- Estado (última leitura boa, guardada para sobreviver a reinício) ----------
let state = load('shopOffers', {}) || {};
const subs = new Set();

export function receiveShop(msg) {
  if (msg?.type !== 'shop' || !Array.isArray(msg.offers) || !msg.tab) return;
  state = { ...state, [msg.tab]: { capturedAt: msg.capturedAt, offers: msg.offers } };
  try { save('shopOffers', state); } catch { /* sem armazenamento */ }
  [...subs].forEach(fn => fn(state));
}

/** Abas com ofertas e o quanto falta para trocar a lista (null = lista antiga, vale abrir a loja de novo). */
export function shopTabs(now = Date.now()) {
  return TABS.filter(t => state[t]?.offers?.length).map(t => {
    const age = now - Date.parse(state[t].capturedAt);
    return { tab: t, label: TAB_LABEL[t], offers: state[t].offers, capturedAt: state[t].capturedAt, ageMs: age, stale: !(age >= -5000 && age < SHOP_TTL_MS) };
  });
}

export function onShop(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
