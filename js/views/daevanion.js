// Tabuleiros de Daevanion do seu personagem: casas abertas em destaque, as fechadas apagadas.
import { load, save } from '../store.js';
import { getMe } from '../profiles.js';
import { esc, int } from '../util.js';

import { getLang } from '../lang.js';

const boardCache = new Map();

async function fetchBoard(me, board) {
  const key = `${getLang()}:${me.characterId}:${board.id}`;
  if (boardCache.has(key)) return boardCache.get(key);
  const params = new URLSearchParams({ region: me.region, serverId: me.serverId, characterId: me.characterId, boardId: board.id, lang: getLang() });
  const res = await fetch('/api/plaync/daevanion?' + params);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Erro ${res.status}`);
  const data = await res.json();
  boardCache.set(key, data);
  setTimeout(() => boardCache.delete(key), 60e3);
  return data;
}

// Casa de skill: o ícone é o da própria skill (o nome vem no efeito, ex.: "Wind Vigor +2").
const nodeIcon = (n, icons) => {
  const skill = n.type === 'SkillLevel' && n.effects[0] ? n.effects[0].replace(/\s*\+\d+\s*$/, '').trim().toLowerCase() : '';
  const src = icons.get(skill);
  return src ? `<img src="${esc(src)}" alt="" draggable="false" loading="lazy">` : '';
};

const tipOf = n => [n.name || 'Casa', ...n.effects, n.open ? '✔ Aberta' : '✖ Fechada'].join('\n');

function boardHtml(data, skillIcons) {
  const shown = data.nodes.filter(n => n.type !== 'None');
  if (!shown.length) return '<p class="muted">Tabuleiro vazio.</p>';
  const r0 = Math.min(...shown.map(n => n.row)), r1 = Math.max(...shown.map(n => n.row));
  const c0 = Math.min(...shown.map(n => n.col)), c1 = Math.max(...shown.map(n => n.col));
  const cells = shown.map(n => `
    <div class="node ${n.open ? 'on' : 'off'} t-${n.type.toLowerCase()} g-${n.grade.toLowerCase()}"
      style="grid-row:${n.row - r0 + 1};grid-column:${n.col - c0 + 1}" data-tip="${esc(tipOf(n))}">
      ${nodeIcon(n, skillIcons)}
    </div>`).join('');
  return `<div class="dv-board" style="--cols:${c1 - c0 + 1};--rows:${r1 - r0 + 1}">${cells}</div>`;
}

const list = (title, items) => items.length ? `
  <div class="card">
    <div class="card-head"><h3>${title}</h3><span class="muted small">${items.length}</span></div>
    <ul class="effects">${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
  </div>` : '';

export function renderDaevanion(root, _params, profile) {
  root.className = 'page dv-page';
  const me = profile || getMe();
  const boards = me?.daevanion || [];

  if (!me || !boards.length || !boards[0].id) {
    root.innerHTML = `<div class="card empty"><h1>Daevanion</h1>
      <p class="muted">${me ? 'Atualize o perfil do personagem para carregar os tabuleiros.' : 'Vincule o seu personagem para ver os tabuleiros.'}</p>
      <div class="head-actions"><a class="btn primary" href="#/conta">${me ? 'Abrir minha conta' : 'Buscar meu personagem'}</a></div></div>`;
    return;
  }

  const skillIcons = new Map((me.skills || []).filter(s => s.icon).map(s => [s.name.toLowerCase(), s.icon]));
  let current = boards.find(b => b.id === load('dvBoard', 0)) || boards[0];
  const totalOpen = boards.reduce((a, b) => a + b.open, 0), total = boards.reduce((a, b) => a + b.total, 0);

  root.innerHTML = `
    <div class="page-head">
      <div><h1>Daevanion</h1><p class="muted">${esc(me.name)} · ${int(totalOpen)} de ${int(total)} casas abertas</p></div>
    </div>
    <div class="card">
      <div class="card-head"><h2>Pontos do tabuleiro</h2></div>
      <div class="dv-tabs" role="tablist">
        ${boards.map(b => `<button class="dv-tab" role="tab" data-board="${b.id}">${esc(b.name)} <span>${b.open} / ${b.total}</span></button>`).join('')}
      </div>
    </div>
    <div class="dv-layout">
      <div class="card dv-main"><div class="card-head"><h2 id="dv-title"></h2><span class="muted small" id="dv-count"></span></div><div id="dv-body"></div></div>
      <div class="dv-side" id="dv-side"></div>
    </div>`;

  async function show() {
    root.querySelectorAll('.dv-tab').forEach(t => {
      const on = +t.dataset.board === current.id;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on);
    });
    root.querySelector('#dv-title').textContent = current.name;
    root.querySelector('#dv-count').textContent = `${current.open} / ${current.total} casas`;
    const body = root.querySelector('#dv-body'), side = root.querySelector('#dv-side');
    body.innerHTML = '<p class="muted">Carregando…</p>';
    side.innerHTML = '';
    const asked = current;
    try {
      const data = await fetchBoard(me, current);
      if (asked !== current || !root.isConnected) return;
      body.innerHTML = boardHtml(data, skillIcons);
      side.innerHTML = list('Efeitos de habilidade', data.skillEffects) + list('Efeitos de atributo', data.statEffects);
    } catch (e) {
      if (asked === current) body.innerHTML = `<p class="small" style="color:var(--danger)">${esc(e.message)}</p>`;
    }
  }

  root.addEventListener('click', e => {
    const tab = e.target.closest('[data-board]');
    if (!tab) return;
    current = boards.find(b => b.id === +tab.dataset.board) || current;
    save('dvBoard', current.id);
    show();
  });
  show();
}
