// Início: o seu personagem — visual, equipamentos, aparência e atributos, com um menu do personagem
// (Personagem · Skills · Daevanion). Atualiza sozinho.
import { classInfo } from '../data/classes.js';
import { classIcon } from '../icons.js';
import { getMe, getParty, refreshProfile, removePartyMember, REGIONS, searchCharacters, fetchProfile, getFavorites, addFavorite, removeFavorite } from '../profiles.js';
import { load, save } from '../store.js';
import { setTooltipContext } from '../tooltip.js';
import { BASE_STATS, STAT_COLORS, statIcon } from '../stat-icons.js';
import { renderSkills } from './skills.js';
import { renderDaevanion } from './daevanion.js';
import { esc, int, toast } from '../util.js';
import { portraitUrl } from '../portrait.js';
import { appearanceItems } from '../character-layout.js';
import { accountResourcesHtml, wireAccountResources } from './account-resources.js';

const REFRESH_MS = 60e3;

// Mesma disposição da janela de equipamentos do jogo (pares lado a lado).
const GEAR = [
  ['MainHand', 'SubHand'], ['Helmet', 'Shoulder'], ['Torso', 'Pants'], ['Gloves', 'Boots'],
  ['Cape', 'Belt'], ['Necklace', 'Amulet'], ['Earring1', 'Earring2'], ['Ring1', 'Ring2'],
  ['Bracelet1', 'Bracelet2'], ['Rune1', 'Rune2'],
];
const ARCANA = ['Arcana1', 'Arcana2', 'Arcana3', 'Arcana4', 'Arcana5'];
// Aparência: só o que o personagem está usando.
const TABS = [['', 'Personagem'], ['skills', 'Skills'], ['daevanion', 'Daevanion']];
const gradeClass = g => 'g-' + String(g || 'common').toLowerCase();

/** Casa de item. Itens equipados (com slotPos numérico) mostram o detalhe real ao passar o mouse. */
function tile(item, { skin = false } = {}) {
  if (!item) return '<div class="slot blank"></div>';
  const detail = !skin && item.id && Number.isInteger(item.slotPos) ? `${item.id}|${item.enchant || 0}|${item.slotPos}` : `${item.id || 0}|0|x`;
  return `
    <div class="slot ${gradeClass(item.grade)}" data-item="${esc(detail)}" data-name="${esc(item.name)}" data-grade="${esc(item.grade || '')}" data-icon="${esc(item.icon || '')}">
      ${item.icon ? `<img src="${esc(item.icon)}" alt="" draggable="false">` : ''}
      ${item.enchant ? `<b class="enchant">+${item.enchant}</b>` : ''}
      ${item.exceed ? `<b class="exceed">★${item.exceed}</b>` : ''}
      ${skin ? '<i class="skin-mark">E</i>' : ''}
    </div>`;
}

/** Cabeçalho do personagem. "extra" é HTML opcional (botões) ao lado dos números; "tabs" é o menu do personagem. */
function heroHtml(me, extra = '', tabs = '') {
  const c = classInfo(me.class);
  return `
    <section class="hero card" style="--c:${c.color}">
      <div class="portrait">
        ${me.image ? `<img src="${esc(portraitUrl(me))}" alt="" draggable="false">` : classIcon(me.class, 120)}
      </div>
      <div class="hero-info">
        <div class="eyebrow hero-top"><span>${esc(me.serverName)}</span><span class="hero-sep">·</span><div class="meta hero-class">${classIcon(me.class, 22)}<b style="color:${c.color}">${esc(c.name)}</b><span>Nível ${me.level}</span></div></div>
        <div class="hero-name-row">
          <h1 class="hero-name">${esc(me.name)}</h1>
        </div>
        ${me.title ? `<div class="hero-title">${esc(me.title)}</div>` : ''}
        <div class="hero-stats">
          <div><span>Combat Power</span><b>${int(me.combatPower || 0)}</b></div>
          <div><span>Item Level</span><b>${me.itemLevel != null ? int(me.itemLevel) : '—'}</b></div>
          ${extra}
        </div>
      </div>
      ${tabs}
    </section>`;
}

/**
 * Ficha completa do personagem: cabeçalho, menu (Personagem · Skills · Daevanion) e a aba escolhida.
 * base = início do link das abas (ex.: "#/inicio" ou "#/conta/<id>").
 */
export function characterSheet(root, me, { tab = '', base = '#/inicio', extra = '', withParty = false, withAccount = false } = {}) {
  setTooltipContext(me);
  // O menu do personagem fica dentro do cabeçalho (mais compacto).
  const tabs = `<nav class="hero-tabs" aria-label="Menu do personagem">
      ${TABS.map(([k, l]) => `<a class="${k === tab ? 'active' : ''}" href="${base}${k ? '/' + k : ''}">${l}</a>`).join('')}
    </nav>`;
  root.innerHTML = heroHtml(me, extra, tabs) + '<div class="sub-body"></div>';
  const body = root.querySelector('.sub-body');
  if (tab === 'skills') renderSkills(body.appendChild(document.createElement('div')), [], me);
  else if (tab === 'daevanion') renderDaevanion(body.appendChild(document.createElement('div')), [], me);
  else body.innerHTML = characterMain(me, { withParty, withAccount });
}

/** Casas em grade que se esticam para preencher toda a largura do container. */
const grid = (cols, items) => `<div class="tile-grid" style="--cols:${cols};--rows:${Math.ceil(items.length / cols)}">${items.join('')}</div>`;

/** "Minha party": você e os membros já vinculados; clique abre a ficha, ✕ remove. */
function partyCard(me) {
  const members = [me, ...getParty().filter(m => m.characterId !== me.characterId)];
  const row = (p, isMe) => {
    const c = classInfo(p.class);
    return `
      <div class="member">
        <a href="#/conta/${encodeURIComponent(p.characterId)}" class="member-link">
          <span class="avatar" style="--s:30px;--c:${c.color}">${classIcon(p.class, 30)}${p.image ? `<img src="${esc(p.image)}" alt="" draggable="false" onerror="this.remove()">` : ''}</span>
          <span class="member-txt"><b>${esc(p.name)}${isMe ? ' <span class="badge">Eu</span>' : ''}</b><span class="small" style="color:${c.color}">${esc(c.name)} · Nv. ${p.level ?? '—'}</span></span>
          <span class="party-power">
            <span class="num small" title="Combat Power"><b>${p.combatPower != null ? int(p.combatPower) : '—'}</b><span class="muted">CP</span></span>
            <span class="num small" title="Item Level"><b>${p.itemLevel != null ? int(p.itemLevel) : '—'}</b><span class="muted">GS</span></span>
          </span>
        </a>
        ${isMe ? '' : `<button class="mini" data-act="party-remove" data-id="${esc(p.characterId)}" title="Remover da party" aria-label="Remover ${esc(p.name)}">✕</button>`}
      </div>`;
  };
  return `
    <section class="card party-card">
      <div class="card-head"><h2>Minha party</h2><span class="muted small">${members.length} membro(s)</span></div>
      <div class="party-list">${members.map((m, i) => row(m, i === 0)).join('')}</div>
      ${members.length < 2 ? '<p class="muted small" style="margin-top:6px">Os membros entram sozinhos nas lutas contra chefes, ou use a busca em Conta (+ Party).</p>' : ''}
    </section>`;
}

/** "Justice [Nezekan]" -> rótulo "Justice" (o tabuleiro de origem aparece no tooltip). */
function statTile(s) {
  const m = /^(.*?)\s*\[(.*)\]$/.exec(s.name);
  const label = m ? m[1] : s.name;
  return `
    <div class="stat-tile" style="--c:${STAT_COLORS[s.type] || 'var(--accent)'}" data-tip="${esc([s.name, ...(s.effects || [])].join('\n'))}">
      <span class="stat-ico">${statIcon(s.type)}</span>
      <span class="stat-name">${esc(label)}</span>
      <b>${int(s.value)}</b>
    </div>`;
}

// ---------- Favoritos: contas de outras pessoas, listadas como uma party; clicar abre a ficha ----------
const fav = { open: false, busy: false, results: null, error: '' };

export function favoritesHtml() {
  const list = getFavorites();
  const region = load('region', getMe()?.region || 'nae');
  const results = fav.results ? (fav.results.length ? fav.results.map((c, i) => `
      <div class="fav-row">
        <span class="fav-txt"><b>${esc(c.name)}</b><span class="muted">${esc(c.serverName)} · Nv. ${c.level}</span></span>
        <button class="btn sm" data-fav="add" data-i="${i}">+ Favoritar</button>
      </div>`).join('') : '<p class="muted small">Nenhum personagem encontrado.</p>') : '';
  return `
    <div class="card-head fav-head"><h3>Favoritos</h3><button class="btn sm" data-fav="toggle" aria-expanded="${fav.open}">${fav.open ? 'Fechar' : '+ Buscar'}</button></div>
    ${fav.open ? `<form class="fav-search" data-fav-form>
      <input type="text" name="name" placeholder="Nome do personagem" required minlength="2" maxlength="30" autocomplete="off" aria-label="Nome do personagem">
      <select name="region" aria-label="Região">${REGIONS.map(([k, l]) => `<option value="${k}" ${k === region ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <button class="btn primary sm" ${fav.busy ? 'disabled' : ''}>${fav.busy ? 'Buscando…' : 'Buscar'}</button>
    </form>${fav.error ? `<p class="small" style="color:var(--danger)">${esc(fav.error)}</p>` : ''}<div class="fav-results">${results}</div>` : ''}
    <div class="fav-list">${list.length ? list.map(p => {
      const c = classInfo(p.class);
      return `<a class="fav-row" href="#/favoritos/${encodeURIComponent(p.characterId)}" data-tip="${esc(p.name)} · ${esc(p.serverName)}">
        <span class="fav-avatar">${p.image ? `<img src="${esc(p.image)}" alt="" draggable="false" onerror="this.remove()">` : ''}</span>
        <span class="fav-txt"><b>${esc(p.name)}</b><span class="muted"><i style="color:${c.color};font-style:normal">${esc(c.name)}</i> · Nv. ${p.level}</span></span>
        <span class="fav-stats"><b>CP ${int(p.combatPower || 0)}</b><span>GS ${p.itemLevel != null ? int(p.itemLevel) : '—'}</span></span>
        <button class="fav-x" data-fav="remove" data-id="${esc(p.characterId)}" aria-label="Remover dos favoritos" title="Remover">×</button>
      </a>`; }).join('') : (fav.open ? '' : '<p class="muted small">Busque e favorite contas para acompanhá-las aqui, como uma party.</p>')}</div>`;
}

/** Eventos do bloco de favoritos (delegados na raiz da página; só redesenha o bloco). */
export function wireFavorites(root) {
  const redraw = () => { const el = root.querySelector('.fav-block'); if (el) el.innerHTML = favoritesHtml(); };
  // Tempo real: reconsulta a PlayNC a cada minuto (um favorito por vez) e redesenha só a lista.
  let syncing = false;
  const sync = async () => {
    if (!root.isConnected) return clearInterval(timer);
    if (syncing || document.hidden) return;
    syncing = true;
    try {
      for (const p of getFavorites()) {
        if (!root.isConnected) break;
        try { await refreshProfile(p); if (!fav.busy && !fav.open) redraw(); } catch { /* mantém o último valor */ }
      }
    } finally { syncing = false; }
  };
  const timer = setInterval(sync, 60e3);
  setTimeout(sync, 800);
  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-fav]');
    if (!b) return;
    e.preventDefault();
    const act = b.dataset.fav;
    if (act === 'toggle') {
      fav.open = !fav.open;
      if (!fav.open) { fav.results = null; fav.error = ''; }
      redraw();
      root.querySelector('.fav-search input')?.focus();
    } else if (act === 'remove') {
      removeFavorite(b.dataset.id);
      redraw();
    } else if (act === 'add') {
      const ref = fav.results?.[+b.dataset.i];
      if (!ref) return;
      b.disabled = true;
      b.textContent = 'Adicionando…';
      try { addFavorite(await fetchProfile(ref)); fav.open = false; fav.results = null; toast(`${ref.name} adicionado aos favoritos`); } catch (err) { toast(err.message); }
      redraw();
    }
  });
  root.addEventListener('submit', async e => {
    const form = e.target.closest('[data-fav-form]');
    if (!form) return;
    e.preventDefault();
    const f = form.elements;
    save('region', f.region.value);
    fav.busy = true; fav.error = ''; fav.results = null; redraw();
    try { fav.results = await searchCharacters(f.name.value, f.region.value); } catch (err) { fav.error = err.message; }
    fav.busy = false;
    redraw();
  });
}

function characterMain(me, { withParty = false, withAccount = false } = {}) {
  const bySlot = Object.fromEntries((me.equipment || []).map(e => [e.slot, e]));
  const look = appearanceItems(me);
  const base = BASE_STATS.map(t => (me.stats || []).find(s => s.type === t)).filter(Boolean);
  const board = (me.stats || []).filter(s => !BASE_STATS.includes(s.type));
  // Equipamentos em 4 colunas (dois pares por linha, como a janela do jogo).
  const gear = [];
  for (let i = 0; i < GEAR.length; i += 2) gear.push(...GEAR[i], ...(GEAR[i + 1] || []));

  return `
    <div class="home-main">
      <section class="card gear-card">
        <div class="equipment-and-look">
        <div class="gear-block" style="--block-rows:5">
          <div class="card-head"><h2>Equipamentos</h2></div>
          ${grid(4, gear.map(s => tile(bySlot[s])))}
        </div>
        <div class="gear-block" style="--block-rows:${Math.max(1,Math.ceil(look.length/4))}">
          <div class="card-head"><h2>Aparência</h2></div>
          ${look.length ? grid(4, look.map(i => tile(i, { skin: true }))) : '<p class="muted small">Sem itens de aparência.</p>'}
        </div>
        </div>
        <div class="gear-block arcana-block">
          <div class="card-head"><h3>Arcanas</h3></div>
          ${grid(5, ARCANA.map(s => tile(bySlot[s])))}
        </div>
      </section>

      <div class="side-col">
        <section class="card stats-card">
          <div class="card-head"><h2>Atributos</h2></div>
          <div class="stat-grid" style="--stat-rows:${Math.ceil(base.length / 2) || 1}">${base.map(statTile).join('')}</div>
          ${board.length ? `<div class="card-head" style="margin-top:12px"><h3>Daevanion</h3></div><div class="stat-grid compact" style="--stat-rows:${Math.ceil(board.length / 2) || 1}">${board.map(statTile).join('')}</div>` : ''}
          ${withAccount ? `<div class="account-resources">${accountResourcesHtml(me)}</div>` : ''}
        </section>
        ${withParty ? partyCard(me) : ''}
      </div>
    </div>`;
}

export function renderHome(root, [tab = ''] = []) {
  root.className = 'page home-page';
  if (!TABS.some(([k]) => k === tab)) tab = '';
  let me = getMe(), refreshing = false;

  if (!me) {
    root.innerHTML = `
      <div class="card empty">
        <h1>Seu personagem aparece aqui</h1>
        <p class="muted">O jogo só informa o nome do personagem ao teleportar ou entrar numa DG. Faça um desses com o app aberto e o
        Lotus Tracker carrega o visual e os equipamentos sozinho — nas próximas vezes ele já lembra de você.<br>
        Ou vincule agora pela busca.</p>
        <div class="head-actions"><a class="btn primary" href="#/favoritos/vincular">Buscar meu personagem</a></div>
      </div>`;
    return;
  }

  function render() {
    characterSheet(root, me, { tab, base: '#/inicio', withAccount: true });
  }

  // Atualiza em silêncio a cada minuto (troca de equipamento no jogo aparece sozinha). Nas abas de
  // Skills e Daevanion só atualiza os dados, sem redesenhar o que você está olhando.
  async function refresh() {
    if (!root.isConnected) return clearInterval(timer);
    if (refreshing) return;
    refreshing = true;
    try {
      me = await refreshProfile(me);
      if (!root.isConnected) return;
      setTooltipContext(me);
      if (tab === '') render();
    } catch { /* sem internet ou PlayNC fora do ar: mantém o que já está na tela */ }
    finally { refreshing = false; }
  }

  root.addEventListener('click', e => {
    const btn = e.target.closest('[data-act="party-remove"]');
    if (!btn) return;
    removePartyMember(btn.dataset.id);
    render();
  });

  wireAccountResources(root, () => me);
  const onFocus = () => { if (root.isConnected) refresh(); else removeEventListener('focus', onFocus); };
  addEventListener('focus', onFocus);
  const timer = setInterval(refresh, REFRESH_MS);
  render();
  refresh();
}
