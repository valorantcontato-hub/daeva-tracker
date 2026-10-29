// Conta: busca de personagens, a sua party e a ficha de cada um (mesmo visual do Início).
import { load, save } from '../store.js';
import { classInfo } from '../data/classes.js';
import { classIcon } from '../icons.js';
import {
  REGIONS, searchCharacters, fetchProfile, getMe, getParty, setMe, upsertPartyMember,
  removePartyMember, refreshProfile, findProfileById, isFavorite, removeFavorite,
} from '../profiles.js';
import { characterSheet, favoritesHtml, wireFavorites } from './home.js';
import { esc, int, toast } from '../util.js';

const RACE = { 1: 'Elyos', 2: 'Asmodian' };

export function renderAccount(root, [id, tab = ''] = []) {
  if (!id) {
    root.className = 'page favorites-page';
    root.innerHTML = `<section class="card fav-block favorites-page-card">${favoritesHtml()}</section>`;
    wireFavorites(root);
    return;
  }
  root.className = 'page account-page';
  const me = getMe();
  let viewing = id === 'vincular' ? me : findProfileById(id);

  root.innerHTML = `
    <div class="account-grid">
      <div class="account-main" id="profile"></div>
      <aside class="account-side">
        <div class="card">
          <div class="card-head"><h2>Buscar personagem</h2></div>
          <form class="search-form" id="search">
            <input type="text" name="name" placeholder="Nome do personagem" required minlength="2" maxlength="30" autocomplete="off" aria-label="Nome do personagem">
            <select name="region" aria-label="Região">${REGIONS.map(([k, l]) => `<option value="${k}" ${k === load('region', 'nae') ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <button class="btn primary">Buscar</button>
          </form>
          <div id="results" class="results"></div>
        </div>
      </aside>
    </div>`;

  const profileEl = root.querySelector('#profile');
  const resultsEl = root.querySelector('#results');

  function avatar(p, size) {
    return `<span class="avatar" style="--s:${size}px;--c:${classInfo(p.class).color}">${classIcon(p.class, size)}${p.image ? `<img src="${esc(p.image)}" alt="" draggable="false" onerror="this.remove()">` : ''}</span>`;
  }

  function renderProfile() {
    if (!viewing) {
      profileEl.innerHTML = `<div class="card empty"><h2>Nenhum personagem vinculado</h2><p class="muted">Use a busca ao lado para encontrar seu personagem.</p></div>`;
      return;
    }
    const isMe = me?.characterId === viewing.characterId;
    const extra = `<div class="head-actions">
      <button class="btn sm" data-act="refresh">Atualizar</button>
      ${isMe ? '' : isFavorite(viewing.characterId) ? '<button class="btn sm danger" data-act="remove-fav">Remover dos favoritos</button>' : '<button class="btn sm danger" data-act="remove-viewing">Remover da party</button>'}
    </div>`;
    characterSheet(profileEl, viewing, { tab, base: '#/favoritos/' + encodeURIComponent(viewing.characterId), extra });
  }

  function renderResults(list) {
    const mineId = getMe()?.characterId;
    const partyIds = new Set(getParty().map(p => p.characterId));
    resultsEl.innerHTML = list.length ? list.map((c, i) => `
      <div class="result">
        <span class="avatar" style="--s:36px">${c.image ? `<img src="${esc(c.image)}" alt="" draggable="false" onerror="this.remove()">` : ''}</span>
        <span class="member-txt"><b>${esc(c.name)}</b><span class="small muted">${esc(c.serverName)} · ${RACE[c.race] || ''} · Nv. ${c.level}</span></span>
        <span class="result-actions">
          ${c.characterId === mineId ? '<span class="badge">Eu</span>' : `<button class="btn sm" data-act="me" data-i="${i}">Sou eu</button>`}
          ${partyIds.has(c.characterId) ? '<span class="badge">Na party</span>' : `<button class="btn sm" data-act="party" data-i="${i}">+ Party</button>`}
        </span>
      </div>`).join('') : '<p class="muted small">Nenhum personagem encontrado.</p>';
    resultsEl._list = list;
  }

  async function addFromResult(i, asMe) {
    const ref = resultsEl._list?.[i];
    if (!ref) return;
    toast('Buscando perfil na PlayNC…');
    try {
      const p = await fetchProfile(ref);
      if (asMe) {
        removePartyMember(p.characterId);
        setMe(p);
      } else {
        upsertPartyMember(p);
      }
      toast(`${p.name} ${asMe ? 'vinculado como você' : 'adicionado à party'}`);
      dispatchEvent(new HashChangeEvent('hashchange'));
    } catch (e) {
      toast(e.message);
    }
  }

  root.querySelector('#search').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target.elements;
    save('region', f.region.value);
    resultsEl.innerHTML = '<p class="muted small">Buscando…</p>';
    try {
      renderResults(await searchCharacters(f.name.value, f.region.value));
    } catch (err) {
      resultsEl.innerHTML = `<p class="small" style="color:var(--danger)">${esc(err.message)}</p>`;
    }
  });

  root.addEventListener('click', async e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'me') return addFromResult(+btn.dataset.i, true);
    if (act === 'party') return addFromResult(+btn.dataset.i, false);
    if (act === 'remove-fav') {
      removeFavorite(viewing.characterId);
      location.hash = '#/favoritos';
      return;
    }
    if (act === 'remove-viewing') {
      removePartyMember(viewing.characterId);
      location.hash = '#/inicio';
      return;
    }
    if (act === 'refresh' && viewing) {
      btn.disabled = true;
      btn.textContent = 'Atualizando…';
      try {
        viewing = await refreshProfile(viewing);
        renderProfile();
        toast('Perfil atualizado');
      } catch (err) {
        toast(err.message);
        btn.disabled = false;
        btn.textContent = 'Atualizar';
      }
    }
  });

  renderProfile();
}
