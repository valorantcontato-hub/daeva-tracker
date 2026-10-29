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
 * ctx: { pets: catálogo de mascotes, isBossMob(nome) -> bool, progress(petId) -> {known, complete} | null }
 * Mascote vale a pena quando é difícil de conseguir de outro jeito (cai de chefe ou não cai de monstro nenhum, só na loja)
 * e ainda não está completo.
 */
export function describeOffer(offer, ctx = {}) {
  const info = SHOP_ITEMS[offer.item];
  const name = info?.[0] || 'Item ' + offer.item;
  const category = info?.[1] || '';
  const grade = info?.[2] || '';
  const out = { ...offer, name, category, grade, discount: discountOf(offer), known: !!info, pet: null, reason: '', worth: false, done: false };
  if (category !== 'Pet') return out;
  const petName = norm(name.replace(/^Pet:\s*/i, ''));
  const pet = (ctx.pets || []).find(p => norm(p.name) === petName);
  if (!pet) return out;
  out.pet = pet;
  const progress = ctx.progress?.(pet.id);
  out.done = !!(progress?.known && progress.complete);
  const mobs = pet.mobs || [];
  if (!mobs.length) out.reason = 'shop';
  else if (mobs.some(m => ctx.isBossMob?.(m.name))) out.reason = 'boss';
  out.worth = !!out.reason && !out.done;
  return out;
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
