// Bestiário = a coleção de pets do jogo, em cartões de retrato como na tela do jogo:
// foto grande, selo com o nível (1–3), progresso de almas ou "MÁX." e "Farmando" nos favoritos.
import { esc, toast } from '../util.js';
import { load } from '../store.js';
import { mergeMonsterCatalog } from '../monster-catalog.js';
import { getMe } from '../profiles.js';
import { readBestiary, writeBestiary, imageUrl, bestiaryKey, MAX_FARMING } from '../bestiary-state.js';
import { getPetCatalog, readCollection } from '../collection.js';
import { petProgress } from '../collection-state.js';
import { PET_FAMILIES, petStone, matchesPetStatus } from '../pet-families.js';

// Tipos de mascote (campo "family" do catálogo), com as pedras do jogo como ícone.
const FAMILIES = Object.entries(PET_FAMILIES).map(([key, f]) => [key, f.label, petStone(key)]);
const STATUSES = [['all', 'Todos'], ['farming', '★ Farmando'], ['missing', 'Faltando'], ['complete', 'Completos']];
const PAGE_SIZE = 60;

export function renderBestiary(root) {
  root.className = 'page bestiary-page';
  const me = getMe();
  let pets, state, collection;
  const ui = { q: '', page: 0, family: '', status: 'all', mode: 'pets', region: '' };
  let monsters = [];

  root.innerHTML = `
    <nav class="pet-status-tabs mode-tabs" aria-label="O que farmar"><button class="chip" data-mode="pets">Mascotes</button><button class="chip" data-mode="monsters">Monstros e regiões</button></nav>
    <nav class="pet-status-tabs" aria-label="Progresso dos mascotes">${STATUSES.map(([key, label]) => `<button class="chip" data-status="${key}" aria-pressed="${key === 'all'}">${label} <span></span></button>`).join('')}</nav>
    <div class="toolbar">
      <input type="search" id="q" placeholder="Buscar monstro…" aria-label="Buscar">
      <select id="region" aria-label="Região" hidden></select>
      <div class="chips" aria-label="Tipo de mascote">${FAMILIES.map(([k, l, icon]) => `<button class="chip fam-chip t-${k.toLowerCase()}" data-filter="${k}" aria-pressed="false">${icon}${l}</button>`).join('')}</div>
    </div>
    <div class="small muted" id="bestiary-summary"></div>
    <div id="list" class="pet2-grid"></div>
    <div class="bestiary-pagination"><button class="btn sm" data-page="-1">Anterior</button><span class="small muted" id="bestiary-page-count"></span><button class="btn sm" data-page="1">Próxima</button></div>`;
  const $ = selector => root.querySelector(selector);

  const initials = name => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const typeBadge = key => { const f = FAMILIES.find(x => x[0] === key); return f ? `<span class="pet2-type t-${key.toLowerCase()}" title="${f[1]}">${f[2]}${f[1]}</span>` : ''; };

  function card(m) {
    const p = petProgress(collection, m.petId);
    const focused = state.focus.includes(m.id);
    const photo = imageUrl(m.icon);
    const locked = p.known && p.level === 0;
    const left = p.known && !p.complete ? p.goal - p.points : 0;
    const badge = !p.known ? '<span class="pet2-badge">Sem dados</span>' : p.complete ? '<span class="pet2-badge max">Lv 3 MAX</span>'
      : locked ? '<span class="pet2-badge">Bloqueado</span>' : `<span class="pet2-badge lv">Lv ${p.level}</span>`;
    const detail = !p.known ? '' : p.complete ? '' : `${p.points}/${p.goal} · faltam ${left}`;
    const pct = p.complete ? 100 : p.known && p.goal ? (p.points / p.goal) * 100 : 0;
    const tip = `${m.name}\n${!p.known ? 'Não sincronizado' : p.complete ? 'Completo · Lv 3' : `Nv. ${p.level} · ${p.points}/${p.goal} almas`}${m.note ? '\n' + m.note : ''}`;
    return `
      <button class="pet2 t-${String(m.region || "").toLowerCase()} ${p.complete ? 'maxed' : ''} ${focused ? 'focused' : ''}" data-favorite="${esc(m.id)}" aria-pressed="${focused}" data-tip="${esc(tip)}">
        <span class="pet2-ico">${photo ? `<img src="${esc(photo)}" alt="" loading="lazy" draggable="false" onerror="this.remove()">` : `<b>${esc(initials(m.name))}</b>`}</span>
        <span class="pet2-body">
          <span class="pet2-title"><b class="pet2-name">${esc(m.name)}</b>${typeBadge(m.region)}</span>
          <span class="pet2-bar"><i style="width:${pct}%"></i></span>
          ${m.maps?.length ? `<span class="pet2-region">📍 ${esc(m.maps.slice(0, 3).join(', '))}${m.maps.length > 3 ? '…' : ''}</span>` : ''}
          <span class="pet2-info">${badge}<span class="pet2-count">${detail}</span></span>
        </span>
        ${focused ? '<span class="pet2-flag">★</span>' : ''}
      </button>`;
  }

  /** Cartão de um monstro comum do catálogo: região, nível e quantos você já abateu. */
  function monsterCard(m) {
    const focused = state.focus.includes(m.id);
    const photo = imageUrl(m.icon);
    const kills = state.kills?.[m.id] || 0;
    const place = [m.region, ...(m.maps || []).filter(x => x !== m.region)].filter(Boolean).join(', ') || 'Sem região';
    return `
      <button class="pet2 ${focused ? 'focused' : ''}" data-favorite="${esc(m.id)}" aria-pressed="${focused}" data-tip="${esc(m.name + '\n' + place + (m.note ? '\n' + m.note : ''))}">
        <span class="pet2-ico">${photo ? `<img src="${esc(photo)}" alt="" loading="lazy" draggable="false" onerror="this.remove()">` : `<b>${esc(initials(m.name))}</b>`}</span>
        <span class="pet2-body">
          <span class="pet2-title"><b class="pet2-name">${esc(m.name)}</b></span>
          <span class="pet2-region">📍 ${esc(place)}</span>
          <span class="pet2-info"><span class="pet2-badge">${m.level ? 'Nv ' + m.level : '—'}</span><span class="pet2-count">${kills} abates${m.isBoss ? ' · chefe' : ''}</span></span>
        </span>
        ${focused ? '<span class="pet2-flag">★</span>' : ''}
      </button>`;
  }

  function renderMonsters() {
    const q = ui.q.trim().toLowerCase();
    const visible = monsters.filter(m => (!ui.region || (m.region || 'Sem região') === ui.region)
      && (!q || `${m.name} ${m.region || ''} ${(m.maps || []).join(' ')} ${m.note || ''}`.toLowerCase().includes(q)));
    const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    ui.page = Math.min(ui.page, pages - 1);
    const first = ui.page * PAGE_SIZE;
    $('#bestiary-page-count').textContent = `${visible.length ? first + 1 : 0}–${Math.min(first + PAGE_SIZE, visible.length)} / ${visible.length}`;
    $('[data-page="-1"]').disabled = ui.page === 0;
    $('[data-page="1"]').disabled = ui.page + 1 >= pages;
    $('#bestiary-summary').textContent = `${monsters.length} monstros · ${state.focus.length} farmando (até ${MAX_FARMING})`;
    $('#list').innerHTML = visible.slice(first, first + PAGE_SIZE).map(monsterCard).join('') || '<p class="muted small">Nenhum monstro corresponde à busca.</p>';
  }

  function applyMode() {
    const monstersMode = ui.mode === 'monsters';
    root.querySelectorAll('[data-mode]').forEach(el => { el.classList.toggle('active', el.dataset.mode === ui.mode); el.setAttribute('aria-pressed', el.dataset.mode === ui.mode); });
    root.querySelector('.pet-status-tabs:not(.mode-tabs)').hidden = monstersMode;
    root.querySelector('.chips').hidden = monstersMode;
    const select = $('#region');
    select.hidden = !monstersMode;
    if (monstersMode) {
      const regions = [...new Set(monsters.map(m => m.region || 'Sem região'))].sort((a, b) => a.localeCompare(b));
      select.innerHTML = '<option value="">Todas as regiões</option>' + regions.map(r => `<option value="${esc(r)}" ${r === ui.region ? 'selected' : ''}>${esc(r)}</option>`).join('');
    }
    $('#q').placeholder = monstersMode ? 'Buscar monstro ou região…' : 'Buscar monstro…';
  }

  function renderList() {
    if (ui.mode === 'monsters') return renderMonsters();
    const q = ui.q.trim().toLowerCase();
    const visible = pets.filter(m => {
      const p = petProgress(collection, m.petId);
      return (!ui.family || m.region === ui.family)
        && matchesPetStatus(p, state.focus.includes(m.id), ui.status)
        && (!q || `${m.name} ${m.note} ${m.maps?.join(' ')}`.toLowerCase().includes(q));
    });
    const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    ui.page = Math.min(ui.page, pages - 1);
    const first = ui.page * PAGE_SIZE;
    $('#bestiary-page-count').textContent = `${visible.length ? first + 1 : 0}–${Math.min(first + PAGE_SIZE, visible.length)} / ${visible.length}`;
    $('[data-page="-1"]').disabled = ui.page === 0;
    $('[data-page="1"]').disabled = ui.page + 1 >= pages;
    root.querySelectorAll('[data-filter]').forEach(el => {
      const on = el.dataset.filter === ui.family;
      el.classList.toggle('active', on);
      el.setAttribute('aria-pressed', on);
    });
    root.querySelectorAll('[data-status]').forEach(el => {
      const status = el.dataset.status;
      const on = status === ui.status;
      el.classList.toggle('active', on);
      el.setAttribute('aria-pressed', on);
      el.querySelector('span').textContent = pets.filter(m => matchesPetStatus(petProgress(collection, m.petId), state.focus.includes(m.id), status)).length;
    });
    $('#bestiary-summary').textContent = `${pets.filter(m => petProgress(collection, m.petId).complete).length} / ${pets.length} completos · ${state.focus.length} farmando`;
    $('#list').innerHTML = visible.slice(first, first + PAGE_SIZE).map(card).join('') || '<p class="muted small">Nenhum monstro corresponde aos filtros.</p>';
  }

  function refresh() {
    if (!root.isConnected) { removeEventListener('storage', refresh); removeEventListener('a2t:changed', refresh); return; }
    if (bestiaryKey(me) !== bestiaryKey()) return dispatchEvent(new HashChangeEvent('hashchange'));
    state = readBestiary(me);
    collection = readCollection(me);
    monsters = mergeMonsterCatalog(load('monsters', [])).filter(m => m.name);
    pets = getPetCatalog().map(p => ({
      id: 'pet-' + p.id, petId: p.id, name: p.name, icon: p.icon, region: p.family,
      maps: [...new Set(p.mobs.flatMap(m => m.maps))], note: p.mobs.map(m => m.name).join(', '),
    }));
    applyMode();
    renderList();
  }

  root.addEventListener('click', e => {
    const mode = e.target.closest('[data-mode]');
    if (mode) { ui.mode = mode.dataset.mode; ui.page = 0; applyMode(); renderList(); return; }
    const star = e.target.closest('[data-favorite]'), filter = e.target.closest('[data-filter]'), page = e.target.closest('[data-page]');
    const status = e.target.closest('[data-status]');
    if (status) { ui.status = status.dataset.status; ui.page = 0; renderList(); }
    if (star) {
      const fresh = readBestiary(me), favorites = new Set(fresh.focus);
      if (!favorites.has(star.dataset.favorite) && favorites.size >= MAX_FARMING) { toast('Você pode acompanhar até ' + MAX_FARMING + '. Desmarque um para trocar.'); return; }
      favorites.has(star.dataset.favorite) ? favorites.delete(star.dataset.favorite) : favorites.add(star.dataset.favorite);
      writeBestiary({ ...fresh, focus: favorites }, me);
      state = readBestiary(me);
      renderList();
    }
    if (filter) { ui.family = ui.family === filter.dataset.filter ? '' : filter.dataset.filter; ui.page = 0; renderList(); }
    if (page) { ui.page = Math.max(0, ui.page + Number(page.dataset.page)); renderList(); $('.toolbar').scrollIntoView({ block: 'start' }); }
  });
  $('#region').addEventListener('change', e => { ui.region = e.target.value; ui.page = 0; renderList(); });
  $('#q').addEventListener('input', e => { ui.q = e.target.value; ui.page = 0; renderList(); });
  addEventListener('storage', refresh);
  addEventListener('a2t:changed', refresh);
  refresh();
}
