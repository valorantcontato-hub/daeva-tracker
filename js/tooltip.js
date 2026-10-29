// Tooltip ao passar o mouse (ou tocar) num item: nome, grau e os atributos do item do SEU personagem,
// vindos do site oficial (PlayNC). Marque um elemento com data-item="<id>|<enchant>|<slotPos>" e
// chame setTooltipContext(perfil) para dizer de quem são os itens.
import { esc } from './util.js';
import { load, save } from './store.js';
import { getLang } from './lang.js';

const GRADE = { Common: '#9aa3b2', Superior: '#4ade80', Rare: '#4ade80', Heroic: '#60a5fa', Legend: '#60a5fa', Legendary: '#60a5fa', Unique: '#fbbf24', Epic: '#fb923c', Mythic: '#f87171', Special: '#2dd4bf' };
const gradeColor = g => GRADE[g] || '#cbd5e1';

let ctx = null;
let tip, current = null, hideTimer;

export function hideTooltip() { current = null; if (tip) tip.hidden = true; }

// ---------- Detalhes dos itens: instantâneos ----------
// Todos os itens equipados são buscados em segundo plano assim que o personagem aparece e ficam
// guardados em disco (localStorage). Ao passar o mouse, o tooltip já tem tudo e abre na hora.
// Entradas com mais de STALE_MS são mostradas na hora e atualizadas por baixo dos panos.
const STORE = 'itemcache';
const MAX_ENTRIES = 400;
const STALE_MS = 30 * 60e3;
const mem = new Map();       // chave -> { t, d }
const inflight = new Map();  // chave -> Promise
try { for (const [k, v] of Object.entries(load(STORE, {}))) mem.set(k, v); } catch { /* sem cache salvo */ }

let persistTimer;
function persistSoon() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    while (mem.size > MAX_ENTRIES) mem.delete(mem.keys().next().value);
    save(STORE, Object.fromEntries(mem));
  }, 800);
}

const keyOf = (profile, id, enchant, slotPos) => `${getLang()}|${profile.characterId}|${id}|${enchant || 0}|${slotPos}`;

function fetchItem(profile, id, enchant, slotPos) {
  const key = keyOf(profile, id, enchant, slotPos);
  if (inflight.has(key)) return inflight.get(key);
  const params = new URLSearchParams({ region: profile.region, serverId: profile.serverId, characterId: profile.characterId, id, enchantLevel: enchant || 0, slotPos, lang: getLang() });
  const p = fetch('/api/plaync/item?' + params)
    .then(r => r.ok ? r.json() : Promise.reject(new Error(r.status)))
    .then(d => { mem.set(key, { t: Date.now(), d }); persistSoon(); return d; })
    .catch(() => null)
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Busca em segundo plano os itens equipados (2 por vez, para não sobrecarregar o site oficial). */
let prefetchFor = '';
export function prefetchItems(profile) {
  const items = (profile?.equipment || []).filter(e => e.id && Number.isInteger(e.slotPos));
  const sig = getLang() + profile.characterId + items.map(e => e.id + ':' + (e.enchant || 0)).join(',');
  if (sig === prefetchFor) return;
  prefetchFor = sig;
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const e = items[i++];
      const hit = mem.get(keyOf(profile, e.id, e.enchant, e.slotPos));
      if (hit && Date.now() - hit.t < STALE_MS) continue;
      await fetchItem(profile, e.id, e.enchant, e.slotPos);
    }
  };
  setTimeout(() => { worker(); worker(); }, 150);
}

export const setTooltipContext = profile => { ctx = profile; if (profile) prefetchItems(profile); };

const line = (label, value, extra) => `<div class="tt-row"><span>${esc(label)}</span><b>${esc(value)}${extra && +extra ? ` <i>(+${esc(extra)})</i>` : ''}</b></div>`;
const section = (title, rows) => rows ? `<div class="tt-sec"><div class="tt-h">${title}</div>${rows}</div>` : '';

function render(d, base) {
  const name = d?.name || base.name;
  const grade = d?.gradeName || d?.grade || base.grade;
  const ench = d?.enchantLevel ?? base.enchant;
  const head = `
    <div class="tt-head">
      ${(d?.icon || base.icon) ? `<img src="${esc(d?.icon || base.icon)}" alt="" draggable="false">` : ''}
      <div>
        <b style="color:${gradeColor(d?.grade || base.grade)}">${esc(name)}${ench ? ` +${ench}` : ''}</b>
        <div class="tt-sub">${[grade, d?.categoryName, d?.equipLevel ? 'Nv. ' + d.equipLevel : ''].filter(Boolean).map(esc).join(' · ')}</div>
      </div>
    </div>`;
  if (!d) return head + '<div class="tt-sub">Detalhes indisponíveis.</div>';

  const main = (d.mainStats || []).map(s => line(s.name, s.value, s.extra)).join('');
  const sub = (d.subStats || []).map(s => line(s.name, '+' + s.value)).join('');
  const stones = (d.magicStoneStat || []).map(s => line(s.name, s.value)).join('');
  const god = (d.godStoneStat || []).map(s => `<div class="tt-god"><b style="color:${gradeColor(s.grade)}">${esc(s.name)}</b><div>${esc(s.desc || '').replace(/\n/g, '<br>')}</div></div>`).join('');
  const skills = (d.subSkills || []).map(s => line(s.name, '+' + s.level)).join('');
  return head
    + section('Atributos principais', main)
    + section('Atributos adicionais', sub)
    + section('Habilidades', skills)
    + section('Pedras mágicas', stones)
    + section('Theostone', god)
    + (d.soulBindRate ? `<div class="tt-sub" style="margin-top:6px">Vínculo da alma: ${esc(d.soulBindRate)}%</div>` : '');
}

function place(x, y) {
  const m = 14, w = tip.offsetWidth, h = tip.offsetHeight;
  let left = x + m, top = y + m;
  if (left + w > innerWidth - 8) left = Math.max(8, x - w - m);
  if (top + h > innerHeight - 8) top = Math.max(8, innerHeight - h - 8);
  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
}

/** Dica simples: data-tip="Título\nlinha\nlinha". */
function showText(el, x, y) {
  clearTimeout(hideTimer);
  current = el;
  const [title, ...rest] = el.dataset.tip.split('\n');
  tip.innerHTML = `<b>${esc(title)}</b>${rest.map(l => `<div class="tt-sub">${esc(l)}</div>`).join('')}`;
  tip.hidden = false;
  place(x, y);
}

async function show(el, x, y) {
  if (el.dataset.tip) return showText(el, x, y);
  clearTimeout(hideTimer);
  current = el;
  const [id, enchant, slotPos, name, grade, icon] = (el.dataset.item || '').split('|');
  const base = { name: el.dataset.name || name || '', grade: el.dataset.grade || grade || '', enchant: +enchant || 0, icon: el.dataset.icon || icon || '' };
  tip.innerHTML = render(null, base).replace('Detalhes indisponíveis.', '<div class="tt-sub">Carregando…</div>');
  tip.hidden = false;
  place(x, y);
  if (!ctx || !id || !/^\d+$/.test(slotPos || '')) {
    tip.innerHTML = render(null, base);
    return place(x, y);
  }
  const key = keyOf(ctx, id, +enchant, slotPos);
  const hit = mem.get(key);
  if (hit) {
    // Já está guardado: abre sem esperar (e atualiza em segundo plano se for antigo).
    tip.innerHTML = render(hit.d, base);
    place(x, y);
    if (Date.now() - hit.t > STALE_MS) fetchItem(ctx, id, +enchant, slotPos);
    return;
  }
  const data = await fetchItem(ctx, id, +enchant, slotPos);
  if (current !== el) return;
  tip.innerHTML = render(data, base);
  place(x, y);
}

function hide() {
  current = null;
  hideTimer = setTimeout(() => { if (tip) tip.hidden = true; }, 60);
}

export function initTooltips() {
  if (tip) return;
  tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.hidden = true;
  tip.setAttribute('role', 'tooltip');
  document.body.append(tip);

  document.addEventListener('pointerover', e => {
    const el = e.target instanceof Element && e.target.closest('[data-item],[data-tip]');
    if (el && el !== current) show(el, e.clientX, e.clientY);
  });
  document.addEventListener('pointermove', e => {
    if (current && !current.isConnected) return hideTooltip(); // a tela foi redesenhada sob o mouse
    if (current && !tip.hidden) place(e.clientX, e.clientY);
  });
  document.addEventListener('pointerout', e => {
    const el = e.target instanceof Element && e.target.closest('[data-item],[data-tip]');
    if (el && el === current && !el.contains(e.relatedTarget)) hide();
  });
  // Toque na tela (celular): some ao tocar fora.
  document.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch' && !(e.target instanceof Element && e.target.closest('[data-item],[data-tip]'))) hide();
  });
}
