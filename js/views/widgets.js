// Widgets compactos (#/w/<id>) para usar como janelas de overlay sobre o jogo,
// e a tela de gerenciamento (#/widgets).
import { load, save } from '../store.js';
import { classInfo } from '../data/classes.js';
import { MILESTONES } from '../data/monsters.js';
import { summarize } from '../encounter.js';
import { classIcon, entityIcon } from '../icons.js';
import { getMe } from '../profiles.js';
import { onLive } from '../live.js';
import { getEncounters, playerClass, skillIconHtml } from './dps.js';
import { ROMAN, LAST, tierOf, isElite, clampKills } from './bestiary.js';
import { esc, compact, int, pct, duration } from '../util.js';

export const WIDGETS = {
  party: { title: 'DPS da party', icon: '⚔', width: 320, height: 270, desc: 'Ranking de DPS da party na luta atual, com classe e % do dano.' },
  skills: { title: 'Skills', icon: '✦', width: 340, height: 340, desc: 'Dano por skill do jogador escolhido (toque num nome no widget de DPS).' },
  farm: { title: 'Farm', icon: '🐾', width: 300, height: 300, desc: 'Monstros marcados como “Farmando agora”, com +1 rápido e marcos 5/25/75.' },
};

const overlay = () => window.overlay; // exposto pelo app desktop (electron/preload.cjs)

function currentFight() {
  const enc = getEncounters()[0];
  if (!enc) return null;
  const S = summarize(enc);
  for (const p of S.players) p.class = playerClass(p);
  return S;
}

function selectedPlayer(S) {
  const want = load('wgPlayer', null) || getMe()?.name;
  return S.players.find(p => p.name === want) || S.players[0];
}

// ---------- Corpo de cada widget ----------
const BODIES = {
  party() {
    const S = currentFight();
    if (!S) return '<div class="wg-empty">Sem lutas ainda.</div>';
    const top = S.players[0]?.share || 1;
    const sel = selectedPlayer(S)?.name;
    return `
      <div class="wg-sub">
        <span style="display:flex;align-items:center;gap:6px;min-width:0">${S.live ? '<span class="live-dot"></span>' : ''}${entityIcon('boss', S.boss, { size: 18, icon: S.bossIcon })}<b style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(S.boss)}</b></span>
        <span>${duration(S.duration)} · ${compact(S.dps)}</span>
      </div>
      ${S.players.map(p => {
        const c = classInfo(p.class);
        return `<button class="wrow ${p.name === sel ? 'active' : ''}" style="--c:${c.color}" data-player="${esc(p.name)}">
          <span class="wfill" style="width:${(p.share / top) * 100}%"></span>
          ${classIcon(p.class, 20)}<b>${esc(p.name)}</b>
          <span class="num"><b>${compact(p.dps)}</b></span><span class="num muted">${pct(p.share, 0)}</span>
        </button>`;
      }).join('')}`;
  },

  skills() {
    const S = currentFight();
    const p = S && selectedPlayer(S);
    if (!p) return '<div class="wg-empty">Sem lutas ainda.</div>';
    const c = classInfo(p.class);
    const rows = [...p.skills].sort((a, b) => b.damage - a.damage);
    const best = rows[0]?.damage || 1;
    return `
      <div class="wg-sub">
        <span style="display:flex;align-items:center;gap:6px">${classIcon(p.class, 18)}<b style="color:${c.color}">${esc(p.name)}</b></span>
        <span>${compact(p.dps)} DPS · crit ${pct(p.critRate, 0)}</span>
      </div>
      ${rows.map(s => `
        <div class="wrow skill" style="--c:${c.color}" title="${esc(s.name)} · ${int(s.hits)} hits · máx ${int(s.max)}">
          <span class="wfill" style="width:${(s.damage / best) * 100}%"></span>
          ${skillIconHtml(p, s, 22)}<b>${esc(s.name)}</b>
          <span class="num">${compact(s.damage)}</span>
          <span class="num muted">${pct(p.damage ? s.damage / p.damage : 0, 0)}</span>
          <span class="num muted">${s.hits ? pct(s.crits / s.hits, 0) : '—'}</span>
        </div>`).join('')}`;
  },

  farm() {
    const monsters = load('monsters', []) || [];
    const kills = load('kills', {});
    const focus = new Set(load('focus', []));
    let list = monsters.filter(m => focus.has(m.id));
    if (!list.length) list = monsters.filter(m => (kills[m.id] || 0) > 0 && (kills[m.id] || 0) < LAST).slice(0, 6);
    if (!list.length) return '<div class="wg-empty">Marque monstros com ★ no Bestiário.</div>';
    return list.map(m => {
      const c = kills[m.id] || 0;
      const next = MILESTONES.find(x => c < x);
      let lo = 0;
      const segs = MILESTONES.map(hi => {
        const f = Math.max(0, Math.min(1, (c - lo) / (hi - lo)));
        lo = hi;
        return `<div class="seg"><div class="track"><i style="width:${f * 100}%"></i></div></div>`;
      }).join('');
      const t = tierOf(c);
      return `
        <div class="wfarm">
          ${entityIcon(isElite(m) ? 'boss' : 'monster', m.name, { size: 26, icon: m.icon })}
          <span style="min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.name)}</b>
            <span class="muted">${int(c)}/${LAST} ${t ? `<span class="pip t${t}">${ROMAN[t]}</span>` : ''} ${next ? `· faltam ${next - c}` : '· completo'}</span></span>
          <button class="btn primary" data-kill="${esc(m.id)}">+1</button>
          <div class="segbar">${segs}</div>
        </div>`;
    }).join('');
  },
};

// ---------- Widget isolado ----------
export function renderWidget(root, [id]) {
  const def = WIDGETS[id];
  if (!def) { root.innerHTML = '<div class="wg"><div class="wg-empty">Widget desconhecido.</div></div>'; return; }
  document.title = `${def.title} · Daeva Tracker`;
  root.innerHTML = `
    <div class="wg" id="wg">
      <div class="wg-head">
        <h1><span>${def.icon}</span>${esc(def.title)}</h1>
        ${overlay() ? '<button class="mini" data-act="lock" title="Travar (o clique passa para o jogo). Destrave com Ctrl+Shift+L">🔒</button>' : ''}
        <button class="mini" data-act="close" title="Fechar widget" aria-label="Fechar">✕</button>
      </div>
      <div class="wg-body" id="body"></div>
    </div>`;
  const wg = root.querySelector('#wg'), body = root.querySelector('#body');

  const paint = () => {
    if (!root.isConnected) return false;
    wg.style.setProperty('--wg-alpha', load('wgOpacity:' + id, 88) + '%');
    const scroll = body.scrollTop;
    body.innerHTML = BODIES[id]();
    body.scrollTop = scroll;
    return true;
  };

  const off = onLive(() => paint() || off());
  addEventListener('storage', function onStorage() { if (!paint()) removeEventListener('storage', onStorage); });

  root.addEventListener('click', e => {
    const player = e.target.closest('[data-player]');
    if (player) { save('wgPlayer', player.dataset.player); return paint(); }
    const kill = e.target.closest('[data-kill]');
    if (kill) {
      const kills = load('kills', {});
      kills[kill.dataset.kill] = clampKills((kills[kill.dataset.kill] || 0) + 1);
      save('kills', kills);
      return paint();
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'close') overlay() ? overlay().closeSelf() : window.close();
    if (act === 'lock') overlay()?.set(id, { locked: true });
  });

  paint();
}

// ---------- Tela de gerenciamento ----------
const CORNERS = [['', 'Livre (arrastar)'], ['tl', '↖ Superior esquerdo'], ['tr', '↗ Superior direito'], ['bl', '↙ Inferior esquerdo'], ['br', '↘ Inferior direito']];

export async function renderWidgetsPage(root) {
  root.className = 'page bestiary-page';
  const ov = overlay();
  const state = ov ? await ov.list() : {};

  root.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Widgets</h1>
        <p class="muted">Cada widget é uma janela separada que fica por cima do jogo. Arraste pela barra do título e redimensione pelas bordas.</p>
      </div>
    </div>
    ${ov ? `<div class="note">Atalhos globais: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd> trava/destrava todos · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> mostra/oculta todos. Use o jogo em <b>Janela</b> ou <b>Tela cheia sem bordas</b> — em tela cheia exclusiva nenhum overlay aparece por cima.</div>`
      : `<div class="note">Você está no navegador: aqui os widgets abrem como janelas popup comuns. Para ficarem <b>sempre por cima do jogo</b>, travados e com clique atravessando, abra o <b>app desktop</b> (<kbd>npm start</kbd>, veja o README).</div>`}
    <div class="widget-cards">
      ${Object.entries(WIDGETS).map(([id, w]) => {
        const s = state[id] || {};
        return `
        <div class="card widget-card" data-id="${id}">
          <div class="card-head"><h2>${w.icon} ${esc(w.title)}</h2>
            ${ov ? `<label class="switch"><input type="checkbox" data-opt="visible" ${s.visible ? 'checked' : ''}> No jogo</label>` : `<button class="btn sm primary" data-act="popup">Abrir janela</button>`}
          </div>
          <p class="muted small">${esc(w.desc)}</p>
          <div class="widget-preview"><iframe src="#/w/${id}" title="Prévia ${esc(w.title)}" loading="lazy"></iframe></div>
          <div class="widget-opts">
            ${ov ? `
              <select data-opt="corner" aria-label="Posição">${CORNERS.map(([k, l]) => `<option value="${k}" ${(s.corner || '') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
              <label class="switch"><input type="checkbox" data-opt="locked" ${s.locked ? 'checked' : ''}> Travar</label>` : ''}
            <label class="switch small">Opacidade <input type="range" min="30" max="100" step="5" value="${load('wgOpacity:' + id, 88)}" data-opt="opacity" style="appearance:auto;width:110px;height:auto;background:none;border:0"></label>
          </div>
        </div>`;
      }).join('')}
    </div>`;

  root.addEventListener('click', e => {
    const card = e.target.closest('.widget-card');
    if (card && e.target.closest('[data-act="popup"]')) {
      const w = WIDGETS[card.dataset.id];
      window.open(`${location.pathname}#/w/${card.dataset.id}`, 'daeva-' + card.dataset.id, `popup,width=${w.width},height=${w.height}`);
    }
  });
  root.addEventListener('input', e => {
    const opt = e.target.dataset.opt, card = e.target.closest('.widget-card');
    if (!opt || !card) return;
    const id = card.dataset.id;
    if (opt === 'opacity') {
      save('wgOpacity:' + id, +e.target.value);
      card.querySelector('iframe').contentWindow?.dispatchEvent(new StorageEvent('storage'));
    }
  });
  root.addEventListener('change', e => {
    const opt = e.target.dataset.opt, card = e.target.closest('.widget-card');
    if (!ov || !opt || !card || opt === 'opacity') return;
    const id = card.dataset.id;
    if (opt === 'visible') ov.toggle(id, e.target.checked);
    if (opt === 'locked') ov.set(id, { locked: e.target.checked });
    if (opt === 'corner') ov.set(id, { corner: e.target.value });
  });
  ov?.onState(s => {
    if (!root.isConnected) return;
    for (const [id, st] of Object.entries(s)) {
      const card = root.querySelector(`.widget-card[data-id="${id}"]`);
      if (!card) continue;
      card.querySelector('[data-opt="visible"]').checked = !!st.visible;
      card.querySelector('[data-opt="locked"]').checked = !!st.locked;
    }
  });
}
