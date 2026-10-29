// Bestiário = a coleção de pets do jogo, em cartões de retrato como na tela do jogo:
// foto grande, selo com o nível (1–3), progresso de almas ou "MÁX." e "Farmando" nos favoritos.
import { esc } from '../util.js';
import { getMe } from '../profiles.js';
import { readBestiary, writeBestiary, imageUrl, bestiaryKey } from '../bestiary-state.js';
import { getPetCatalog, readCollection } from '../collection.js';
import { petProgress } from '../collection-state.js';

// Tipos de mascote (campo "family" do catálogo). Ícones próprios em traço, no estilo do app.
const ICON = d => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>';
const FAMILIES = [
  ['Cogni', 'Intelectual', ICON('M12 4a5 5 0 0 0-5 5c0 1.6.7 2.4 1.5 3.3.6.7 1 1.4 1 2.2h5c0-.8.4-1.5 1-2.2.8-.9 1.5-1.7 1.5-3.3a5 5 0 0 0-5-5zM9.5 18.5h5M10.5 21h3')],
  ['Fera', 'Feral', ICON('M5 6c1.5 4 2 8 2 13M10 4c1 4 1.4 9 1.2 15M15 4c.5 4 .3 9-.8 15M20 7c-1.5 4-2 8-1.8 12')],
  ['Natura', 'Natural', ICON('M5 19c0-9 6-14 15-14 0 9-5 15-14 15zM5 19l8-8')],
  ['Varian', 'Variante', ICON('M12 3l8 5v8l-8 5-8-5V8zM12 3v18M4 8l8 5 8-5')],
  ['Special', 'Especial', ICON('M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z')],
];
const PAGE_SIZE = 60;

export function renderBestiary(root) {
  root.className = 'page bestiary-page';
  const me = getMe();
  let pets, state, collection;
  const ui = { q: '', page: 0, family: '' };

  root.innerHTML = `
    <div class="page-head"><div><h1>Mascotes</h1><p class="muted small">${esc(me?.name || 'Sem personagem vinculado')}</p></div></div>
    <p class="note small" id="collection-status"></p>
    <div class="toolbar">
      <input type="search" id="q" placeholder="Buscar monstro…" aria-label="Buscar">
      <div class="chips" role="tablist" aria-label="Filtro">${FAMILIES.map(([k, l, icon]) => `<button class="chip fam-chip" data-filter="${k}" aria-pressed="false">${icon}${l}</button>`).join('')}</div>
    </div>
    <div class="small muted" id="bestiary-summary"></div>
    <div id="list" class="pet2-grid"></div>
    <p class="img-credit">Imagens dos monstros: <a href="https://metabot.gg/en/aion-2" target="_blank" rel="noopener">MetaBot.gg</a></p>
    <div class="bestiary-pagination"><button class="btn sm" data-page="-1">Anterior</button><span class="small muted" id="bestiary-page-count"></span><button class="btn sm" data-page="1">Próxima</button></div>`;
  const $ = selector => root.querySelector(selector);

  const initials = name => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

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
      <button class="pet2 ${p.complete ? 'maxed' : ''} ${focused ? 'focused' : ''}" data-favorite="${esc(m.id)}" aria-pressed="${focused}" data-tip="${esc(tip)}">
        <span class="pet2-ico">${photo ? `<img src="${esc(photo)}" alt="" loading="lazy" draggable="false" onerror="this.remove()">` : `<b>${esc(initials(m.name))}</b>`}</span>
        <span class="pet2-body">
          <b class="pet2-name">${esc(m.name)}</b>
          <span class="pet2-bar"><i style="width:${pct}%"></i></span>
          <span class="pet2-info">${badge}<span class="pet2-count">${detail}</span></span>
        </span>
        ${focused ? '<span class="pet2-flag">★</span>' : ''}
      </button>`;
  }

  function renderList() {
    const q = ui.q.trim().toLowerCase();
    const visible = pets.filter(m => {
      const p = petProgress(collection, m.petId);
      return (!ui.family || m.region === ui.family)
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
    $('#bestiary-summary').textContent = `${pets.filter(m => petProgress(collection, m.petId).complete).length} / ${pets.length} completos · ${state.focus.length} farmando`;
    $('#collection-status').textContent = collection
      ? `Coleção recebida do jogo em ${new Date(collection.capturedAt).toLocaleString()}. O último estado fica salvo para este personagem.`
      : 'Aguardando a coleção do jogo. Com a captura atualizada e ligada, volte à seleção de personagens e entre novamente. Até receber a lista, o progresso fica desconhecido.';
    $('#list').innerHTML = visible.slice(first, first + PAGE_SIZE).map(card).join('') || '<p class="muted small">Nenhum monstro corresponde aos filtros.</p>';
  }

  function refresh() {
    if (!root.isConnected) { removeEventListener('storage', refresh); removeEventListener('a2t:changed', refresh); return; }
    if (bestiaryKey(me) !== bestiaryKey()) return dispatchEvent(new HashChangeEvent('hashchange'));
    state = readBestiary(me);
    collection = readCollection(me);
    pets = getPetCatalog().map(p => ({
      id: 'pet-' + p.id, petId: p.id, name: p.name, icon: p.icon, region: p.family,
      maps: [...new Set(p.mobs.flatMap(m => m.maps))], note: p.mobs.map(m => m.name).join(', '),
    }));
    renderList();
  }

  root.addEventListener('click', e => {
    const star = e.target.closest('[data-favorite]'), filter = e.target.closest('[data-filter]'), page = e.target.closest('[data-page]');
    if (star) {
      const fresh = readBestiary(me), favorites = new Set(fresh.focus);
      favorites.has(star.dataset.favorite) ? favorites.delete(star.dataset.favorite) : favorites.add(star.dataset.favorite);
      writeBestiary({ ...fresh, focus: favorites }, me);
      state = readBestiary(me);
      renderList();
    }
    if (filter) { ui.family = ui.family === filter.dataset.filter ? '' : filter.dataset.filter; ui.page = 0; renderList(); }
    if (page) { ui.page = Math.max(0, ui.page + Number(page.dataset.page)); renderList(); $('.toolbar').scrollIntoView({ block: 'start' }); }
  });
  $('#q').addEventListener('input', e => { ui.q = e.target.value; ui.page = 0; renderList(); });
  addEventListener('storage', refresh);
  addEventListener('a2t:changed', refresh);
  refresh();
}
