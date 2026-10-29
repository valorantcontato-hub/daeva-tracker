import { load, save } from '../store.js';
import { classInfo } from '../data/classes.js';
import { classIcon } from '../icons.js';
import {
  REGIONS, searchCharacters, fetchProfile, getMe, getParty, setMe, upsertPartyMember,
  removePartyMember, refreshProfile, findProfileById,
} from '../profiles.js';
import { esc, int, dateTime, toast } from '../util.js';

const GRADE = { Common: '#9aa3b2', Superior: '#22c55e', Rare: '#3b82f6', Heroic: '#3b82f6', Legend: '#f59e0b', Legendary: '#f59e0b', Unique: '#a855f7', Epic: '#f97316', Mythic: '#ef4444', Special: '#14b8a6' };
const gradeColor = g => GRADE[g] || '#8a93a6';
const RACE = { 1: 'Elyos', 2: 'Asmodian' };

export function renderAccount(root, [id]) {
  root.className = 'page account-page';
  const me = getMe();
  const viewing = id ? findProfileById(id) : me;
  const party = getParty();

  root.innerHTML = `
    <div class="page-head">
      <div>
        <h1>${id && viewing ? 'Membro da party' : 'Minha conta'}</h1>
        <p class="muted">Dados reais do site oficial do AION 2 (PlayNC) — personagem, equipamentos e skills.</p>
      </div>
    </div>

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
        <div class="card">
          <div class="card-head"><h2>Minha party</h2><span class="muted small">${party.length} membro(s)</span></div>
          <div class="party-list">
            ${me ? memberRow(me, true, id) : ''}
            ${party.map(p => memberRow(p, false, id)).join('')}
            ${!me && !party.length ? '<p class="muted small">Busque seu personagem e marque “Sou eu”. Depois adicione os membros da party — os nomes, classes e ícones de skills no medidor de DPS vêm daqui.</p>' : ''}
          </div>
        </div>
      </aside>
    </div>`;

  const profileEl = root.querySelector('#profile');
  const resultsEl = root.querySelector('#results');

  function memberRow(p, isMe, activeId) {
    const c = classInfo(p.class);
    const active = (activeId || getMe()?.characterId) === p.characterId;
    return `
      <div class="member ${active ? 'active' : ''}">
        <a href="#/conta${isMe ? '' : '/' + encodeURIComponent(p.characterId)}" class="member-link">
          ${avatar(p, 36)}
          <span class="member-txt"><b>${esc(p.name)}${isMe ? ' <span class="badge">Eu</span>' : ''}</b>
          <span class="small" style="color:${c.color}">${esc(c.name)} · Nv. ${p.level ?? '—'}</span></span>
          <span class="num small"><b>${int(p.combatPower || 0)}</b><br><span class="muted">CP</span></span>
        </a>
        ${isMe ? '' : `<button class="mini" data-act="remove" data-id="${esc(p.characterId)}" title="Remover da party" aria-label="Remover ${esc(p.name)}">✕</button>`}
      </div>`;
  }

  function avatar(p, size) {
    return `<span class="avatar" style="--s:${size}px;--c:${classInfo(p.class).color}">${classIcon(p.class, size)}${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>`;
  }

  function renderProfile(p) {
    if (!p) {
      profileEl.innerHTML = `<div class="card empty"><h2>Nenhum personagem vinculado</h2><p class="muted">Use a busca ao lado para encontrar seu personagem.</p></div>`;
      return;
    }
    const c = classInfo(p.class);
    const equipped = p.skills.filter(s => s.equipped);
    const others = p.skills.filter(s => !s.equipped);
    profileEl.innerHTML = `
      <div class="card profile-card" style="--c:${c.color}">
        <div class="profile-top">
          ${avatar(p, 84)}
          <div class="profile-id">
            <div class="eyebrow">${esc(p.serverName)} · ${esc(p.race)}${p.title ? ' · ' + esc(p.title) : ''}</div>
            <h2 class="pname-xl">${esc(p.name)}</h2>
            <div class="meta">${classIcon(p.class, 20)}<span style="color:${c.color};font-weight:600">${esc(c.name)}</span><span>Nível ${p.level}</span></div>
          </div>
          <div class="head-actions">
            <button class="btn sm" data-act="refresh">Atualizar</button>
          </div>
        </div>
        <div class="kpis kpis-3">
          <div class="kpi"><div class="l">Combat Power</div><div class="v">${int(p.combatPower || 0)}</div></div>
          <div class="kpi"><div class="l">Item Level</div><div class="v">${p.itemLevel != null ? int(p.itemLevel) : '—'}</div></div>
          <div class="kpi"><div class="l">Atualizado</div><div class="v small-v">${dateTime(p.fetchedAt)}</div></div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h2>Skills equipadas</h2><span class="muted small">${equipped.length}</span></div>
        <div class="skill-grid">${equipped.map(skillTile).join('') || '<p class="muted small">Nenhuma.</p>'}</div>
        ${others.length ? `<details class="more"><summary>Outras skills aprendidas (${others.length})</summary><div class="skill-grid">${others.map(skillTile).join('')}</div></details>` : ''}
      </div>

      <div class="card">
        <div class="card-head"><h2>Equipamentos</h2></div>
        <div class="equip-grid">${p.equipment.map(e => `
          <div class="equip" style="--g:${gradeColor(e.grade)}">
            <span class="equip-ico">${e.icon ? `<img src="${esc(e.icon)}" alt="" loading="lazy">` : ''}${e.enchant ? `<b>+${e.enchant}</b>` : ''}</span>
            <span class="equip-txt"><b title="${esc(e.name)}">${esc(e.name)}</b><span class="small muted">${esc(e.slot)} · <span style="color:var(--g)">${esc(e.grade)}</span></span></span>
          </div>`).join('')}
        </div>
      </div>

      <div class="two-col">
        <div class="card">
          <div class="card-head"><h2>Atributos</h2></div>
          <div class="stat-list">${p.stats.map(s => `
            <div class="stat-row" title="${esc(s.effects.join(' · '))}"><span>${esc(s.name)}</span><b>${int(s.value)}</b></div>`).join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h2>Daevanion</h2></div>
          <div class="stat-list">${p.daevanion.map(b => `
            <div class="dv-row">
              ${b.icon ? `<img src="${esc(b.icon)}" alt="" loading="lazy">` : ''}
              <span>${esc(b.name)}</span><span class="muted small">${b.open}/${b.total}</span>
              <div class="dv-bar"><i style="width:${b.percent}%"></i></div>
            </div>`).join('')}
          </div>
        </div>
      </div>`;
  }

  const skillTile = s => `
    <div class="skill-tile" title="${esc(s.name)} · ${esc(s.category)}">
      <span class="skill-ico">${s.icon ? `<img src="${esc(s.icon)}" alt="" loading="lazy">` : ''}<b>${s.level}</b></span>
      <span class="skill-name">${esc(s.name)}</span>
    </div>`;

  function renderResults(list) {
    const mineId = getMe()?.characterId;
    const partyIds = new Set(getParty().map(p => p.characterId));
    resultsEl.innerHTML = list.length ? list.map((c, i) => `
      <div class="result">
        <span class="avatar" style="--s:36px">${c.image ? `<img src="${esc(c.image)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>
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
    if (act === 'remove') {
      removePartyMember(btn.dataset.id);
      if (id === btn.dataset.id) location.hash = '#/conta';
      else dispatchEvent(new HashChangeEvent('hashchange'));
      return;
    }
    if (act === 'refresh' && viewing) {
      btn.disabled = true;
      btn.textContent = 'Atualizando…';
      try {
        renderProfile(await refreshProfile(viewing));
        toast('Perfil atualizado');
      } catch (err) {
        toast(err.message);
        btn.disabled = false;
        btn.textContent = 'Atualizar';
      }
    }
  });

  renderProfile(viewing);
}
