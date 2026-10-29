// Bestiário = a coleção de pets do jogo, em cartões de retrato como na tela do jogo:
// foto grande, selo com o nível (1–3), progresso de almas ou "MÁX." e "Farmando" nos favoritos.
import { esc } from '../util.js';
import { getMe } from '../profiles.js';
import { readBestiary, writeBestiary, imageUrl, bestiaryKey } from '../bestiary-state.js';
import { getPetCatalog, readCollection } from '../collection.js';
import { petProgress } from '../collection-state.js';

const FILTERS = [['all', 'Todos'], ['focus', '★ Farmando'], ['progress', 'Em progresso'], ['done', 'Completos']];
const PAGE_SIZE = 60;

export function renderBestiary(root) {
  root.className = 'page bestiary-page';
  const me = getMe();
  let pets, state, collection;
  const ui = { q: '', region: '', page: 0, status: 'all' };

  root.innerHTML = `
    <div class="page-head"><div><h1>Mascotes</h1><p class="muted small">${esc(me?.name || 'Sem personagem vinculado')}</p></div></div>
    <p class="note small" id="collection-status"></p>
    <div class="toolbar">
      <input type="search" id="q" placeholder="Buscar monstro ou região…" aria-label="Buscar">
      <select id="region" aria-label="Região"></select>
      <div class="chips" role="tablist" aria-label="Filtro">${FILTERS.map(([k, l]) => `<button class="chip" data-filter="${k}" role="tab">${l}</button>`).join('')}</div>
    </div>
    <div class="small muted" id="bestiary-summary"></div>
    <div id="list" class="pet-grid"></div>
    <div class="bestiary-pagination"><button class="btn sm" data-page="-1">Anterior</button><span class="small muted" id="bestiary-page-count"></span><button class="btn sm" data-page="1">Próxima</button></div>`;
  const $ = selector => root.querySelector(selector);

  const initials = name => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  function card(m) {
    const p = petProgress(collection, m.petId);
    const focused = state.focus.includes(m.id);
    const photo = imageUrl(m.icon);
    const label = !p.known ? 'Não sincronizado' : p.complete ? 'Completo · III' : `Nv. ${p.level} · ${p.points}/${p.goal} almas`;
    const tip = `${m.name}\n${label}${p.known && !p.complete ? '\n' + p.remaining + ' almas até o nível III' : ''}${m.note ? '\n' + m.note : ''}`;
    const dim = !p.known || (p.level === 0 && p.points === 0);
    return `
      <button class="pet-card ${photo ? '' : 'nophoto'} ${dim ? 'dim' : ''} ${focused ? 'focused' : ''} ${p.complete ? 'maxed' : ''}" data-favorite="${esc(m.id)}" aria-pressed="${focused}" data-tip="${esc(tip)}">
        ${photo ? `<img src="${esc(photo)}" alt="" loading="lazy" draggable="false" onerror="this.parentElement.classList.add('nophoto');this.remove()">` : ''}
        <span class="pet-initials">${esc(initials(m.name))}</span>
        <span class="pet-name">${esc(m.name)}</span>
        ${focused ? '<span class="pet-flag">Farmando</span>' : ''}
        ${p.known && p.level > 0 ? `<span class="pet-badge">${p.level}</span>` : ''}
        ${p.complete ? '<b class="pet-max">MÁX.</b>'
          : p.known && p.points ? `<span class="pet-prog"><i style="width:${(p.points / p.goal) * 100}%"></i></span><b class="pet-count">${p.points}/${p.goal}</b>` : ''}
      </button>`;
  }

  function renderList() {
    const q = ui.q.trim().toLowerCase();
    const visible = pets.filter(m => {
      const p = petProgress(collection, m.petId);
      const matches = ui.status === 'focus' ? state.focus.includes(m.id)
        : ui.status === 'progress' ? p.known && !p.complete && p.total > 0
        : ui.status === 'done' ? p.complete : true;
      return matches && (!ui.region || m.maps?.includes(ui.region) || m.region === ui.region)
        && (!q || `${m.name} ${m.note} ${m.maps?.join(' ')}`.toLowerCase().includes(q));
    });
    const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    ui.page = Math.min(ui.page, pages - 1);
    const first = ui.page * PAGE_SIZE;
    $('#bestiary-page-count').textContent = `${visible.length ? first + 1 : 0}–${Math.min(first + PAGE_SIZE, visible.length)} / ${visible.length}`;
    $('[data-page="-1"]').disabled = ui.page === 0;
    $('[data-page="1"]').disabled = ui.page + 1 >= pages;
    root.querySelectorAll('[data-filter]').forEach(el => {
      const on = el.dataset.filter === ui.status;
      el.classList.toggle('active', on);
      el.setAttribute('aria-selected', on);
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
    const regions = [...new Set(pets.flatMap(m => [m.region, ...(m.maps || [])]).filter(Boolean))].sort();
    $('#region').innerHTML = '<option value="">Todas as regiões</option>' + regions.map(r => `<option value="${esc(r)}" ${r === ui.region ? 'selected' : ''}>${esc(r)}</option>`).join('');
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
    if (filter) { ui.status = filter.dataset.filter; ui.page = 0; renderList(); }
    if (page) { ui.page = Math.max(0, ui.page + Number(page.dataset.page)); renderList(); $('.toolbar').scrollIntoView({ block: 'start' }); }
  });
  $('#q').addEventListener('input', e => { ui.q = e.target.value; ui.page = 0; renderList(); });
  $('#region').addEventListener('change', e => { ui.region = e.target.value; ui.page = 0; renderList(); });
  addEventListener('storage', refresh);
  addEventListener('a2t:changed', refresh);
  refresh();
}
