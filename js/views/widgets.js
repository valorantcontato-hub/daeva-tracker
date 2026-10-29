// Widgets compactos (#/w/<id>) para usar como janelas de overlay sobre o jogo,
// e a tela de gerenciamento (#/widgets).
import { load, save, notifyChange } from '../store.js';
import { readBestiary } from '../bestiary-state.js';
import { isBossEncounter } from '../combat-types.js';
import { classInfo } from '../data/classes.js';
import { getPetCatalog, readCollection } from '../collection.js';
import { petProgress } from '../collection-state.js';
import { mergeMonsterCatalog } from '../monster-catalog.js';
import { summarize } from '../encounter.js';
import { classIcon, entityIcon } from '../icons.js';
import { getMe, findSkill, findProfileByName } from '../profiles.js';
import { onLive, onPositions, lastPositions } from '../live.js';
import { getEncounters, playerClass, skillIconHtml, skillLabel, activeSkills } from './dps.js';
import { esc, compact, int, pct, duration } from '../util.js';

export const WIDGETS = {
  party: { title: 'DPS', icon: '⚔', width: 320, height: 270, desc: 'Ranking de DPS da party na luta atual, com classe e porcentagem do dano.' },
  skills: { title: 'Skills', icon: '✦', width: 340, height: 340, desc: 'Dano de cada skill do seu personagem. Mostra só as skills ativas — sem stigmas e passivas.' },
  farm: { title: 'Farm', icon: '🐾', width: 300, height: 300, desc: 'Favoritos do bestiário, com o progresso de almas lido do jogo.' },
  radar: { title: 'Mini mapa', icon: '◎', width: 280, height: 380, desc: 'Radar ao seu redor: mostra onde estão os monstros que você está farmando (os marcados com ★ nos Mascotes).' },
};

const overlay = () => window.overlay; // exposto pelo app desktop (electron/preload.cjs)
export const bossOnly = () => load('wgBossOnly', true);

/** Luta atual (ao vivo ou a última). Com "somente chefe", ignora pulls de mobs comuns. */
function currentFight() {
  const list = getEncounters();
  const enc = bossOnly() ? list.find(isBossEncounter) : list[0];
  if (!enc) return null;
  const S = summarize(enc);
  for (const p of S.players) p.class = playerClass(p);
  return S;
}

/** O seu personagem na luta: marcado pela captura como local, ou o vinculado em "Minha conta". */
function myPlayer(S) {
  const me = getMe();
  return S.players.find(p => p.isLocal) || S.players.find(p => me && p.name.toLowerCase() === me.name?.toLowerCase()) || null;
}

// ---------- Mini mapa ----------
// Posições vêm dos pacotes de movimento do jogo (captura). Unidade assumida: 1 unidade = 1 cm; ajuste
// RADAR_UNIT_M se, em campo, as distâncias não baterem com o jogo.
const RADAR_UNIT_M = 0.01;
const RADAR_RANGES = [50, 100, 200, 400];
const normName = s => String(s || '').normalize('NFKC').trim().toLowerCase();

/** Nomes (normalizados) dos monstros marcados com ★: pets do catálogo e monstros do catálogo geral. */
function farmingNames() {
  const { focus } = readBestiary();
  const names = new Set();
  for (const pet of getPetCatalog()) if (focus.includes('pet-' + pet.id)) for (const m of pet.mobs || []) names.add(normName(m.name));
  for (const m of mergeMonsterCatalog(load('monsters', []))) if (focus.includes(m.id)) names.add(normName(m.name));
  return names;
}

function radarBody() {
  const P = lastPositions();
  if (!P || Date.now() - Date.parse(P.capturedAt) > 10000) return '<div class="wg-empty">Sem posições do jogo. Com a captura ligada, entre no jogo e ande um pouco.</div>';
  if (!P.self) return `<div class="wg-empty">Lendo posições (${P.entities} entidades), mas ainda não achei a sua. Ande um pouco.</div>`;
  const range = RADAR_RANGES.includes(load('radarRange', 100)) ? load('radarRange', 100) : 100;
  const farming = farmingNames();
  const showAll = load('radarAll', false) || !farming.size;
  const mobs = P.mobs
    .filter(m => showAll || farming.has(normName(m.name)))
    .map(m => ({ ...m, dx: (m.x - P.self.x) * RADAR_UNIT_M, dy: (m.y - P.self.y) * RADAR_UNIT_M }))
    .map(m => ({ ...m, d: Math.hypot(m.dx, m.dy) }))
    .sort((a, b) => a.d - b.d);
  const R = 92, k = R / range;
  const dots = mobs.slice(0, 120).map(m => {
    const f = m.d > range ? range / m.d : 1;
    return `<circle cx="${100 + m.dx * f * k}" cy="${100 - m.dy * f * k}" r="${m.d > range ? 2 : 3.2}" class="rd-dot ${m.d > range ? 'far' : ''}"><title>${esc(m.name)} · ${Math.round(m.d)} m</title></circle>`;
  }).join('');
  const rows = mobs.slice(0, 6).map(m => `<div class="rd-row"><span class="rd-dot-i"></span><b>${esc(m.name || 'Monstro')}</b><span class="muted">${m.d >= 1000 ? (m.d / 1000).toFixed(1) + ' km' : Math.round(m.d) + ' m'}</span></div>`).join('');
  return `
    <svg class="radar" viewBox="0 0 200 200" aria-label="Mini mapa">
      <circle cx="100" cy="100" r="${R}" class="rd-ring"/><circle cx="100" cy="100" r="${R / 2}" class="rd-ring"/>
      <path d="M100 8v184M8 100h184" class="rd-axis"/>
      ${dots}
      <path d="M100 93l5 11h-10z" class="rd-me"/>
      <text x="196" y="196" class="rd-lbl" text-anchor="end">${range} m</text>
    </svg>
    <div class="rd-bar">
      <button class="mini" data-act="range" title="Alcance do radar">Alcance: ${range} m</button>
      <button class="mini ${showAll ? 'on' : ''}" data-act="all" title="Mostrar todos os monstros, não só os marcados com ★">${showAll ? 'Todos' : '★ Farmando'}</button>
    </div>
    ${rows || '<div class="wg-empty">Nenhum monstro desses por perto.</div>'}
    ${!farming.size ? '<div class="muted small" style="padding:4px 2px">Marque monstros com ★ nos Mascotes para filtrar.</div>' : ''}`;
}

// ---------- Corpo de cada widget ----------
const BODIES = {
  radar: radarBody,
  party() {
    const S = currentFight();
    if (!S) return `<div class="wg-empty">${bossOnly() ? 'Nenhuma luta contra chefe ainda.' : 'Sem lutas ainda.'}</div>`;
    const top = S.players[0]?.share || 1;
    const mine = myPlayer(S)?.name;
    return `
      <div class="wg-sub">
        <span style="display:flex;align-items:center;gap:6px;min-width:0">${S.live ? '<span class="live-dot"></span>' : ''}${entityIcon('boss', S.boss, { size: 18, icon: S.bossIcon })}<b style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(S.boss)}</b></span>
        <span>${S.bossHp?.max ? pct(S.bossHp.current / S.bossHp.max, 0) + ' · ' : ''}${duration(S.duration)} · ${compact(S.dps)}</span>
      </div>
      ${S.players.map(p => {
        const c = classInfo(p.class);
        return `<div class="wrow ${p.name === mine ? 'active' : ''}" style="--c:${c.color}">
          <span class="wfill" style="width:${(p.share / top) * 100}%"></span>
          ${classIcon(p.class, 20)}<b>${esc(p.name)}</b>
          <span class="num"><b>${compact(p.dps)}</b></span><span class="num muted">${pct(p.share, 0)}</span>
        </div>`;
      }).join('')}`;
  },

  skills() {
    const S = currentFight();
    const p = S && myPlayer(S);
    if (!p) return `<div class="wg-empty">${S ? 'Seu personagem ainda não foi identificado nesta luta.' : 'Sem lutas ainda.'}</div>`;
    const c = classInfo(p.class);
    const rows = activeSkills(p).sort((a, b) => b.damage - a.damage);
    const best = rows[0]?.damage || 1;
    return `
      <div class="wg-sub">
        <span style="display:flex;align-items:center;gap:6px">${classIcon(p.class, 18)}<b style="color:${c.color}">${esc(p.name)}</b></span>
        <span>${compact(p.dps)} DPS · crit ${pct(p.critRate, 0)}</span>
      </div>
      ${rows.map(s => `
        <div class="wrow skill" style="--c:${c.color}" title="${esc(s.name)} · ${int(s.hits)} hits · máx ${int(s.max)}">
          <span class="wfill" style="width:${(s.damage / best) * 100}%"></span>
          ${skillIconHtml(p, s, 22)}<b>${esc(skillLabel(p, s))}</b>
          <span class="num">${compact(s.damage)}</span>
          <span class="num muted">${pct(p.damage ? s.damage / p.damage : 0, 0)}</span>
          <span class="num muted">${s.hits ? pct(s.crits / s.hits, 0) : '—'}</span>
        </div>`).join('') || '<div class="wg-empty">Nenhuma skill ativa usada ainda.</div>'}`;
  },

  farm() {
    const { kills, focus } = readBestiary(), collection = readCollection();
    const pets = getPetCatalog().map(p=>({...p,id:'pet-'+p.id,petId:p.id}));
    const all = [...pets, ...mergeMonsterCatalog(load('monsters', []))];
    const list = all.filter(m=>focus.includes(m.id));
    if(!list.length) return '<div class="wg-empty">Marque monstros com ★ no Bestiário.</div>';
    return list.map(m=> {
      const p = petProgress(collection,m.petId);
      const label = m.petId ? !p.known ? 'Não sincronizado' : p.complete ? 'Completo · III' : 'Nv. '+p.level+' · '+p.points+'/'+p.goal+' almas' : int(kills[m.id]||0)+' abates no app';
      return '<div class="wfarm">'+entityIcon('monster',m.name,{size:26,icon:m.icon})+'<span style="min-width:0"><b>'+esc(m.name)+'</b><small class="muted" style="display:block">'+esc(label)+'</small></span><div class="segbar"><div class="seg"><div class="track"><i style="width:'+p.percent+'%"></i></div></div></div></div>';
    }).join('');
  },
};

// ---------- Widget isolado ----------
export function renderWidget(root, [id]) {
  const def = WIDGETS[id];
  if (!def) { root.innerHTML = '<div class="wg"><div class="wg-empty">Widget desconhecido.</div></div>'; return; }
  // Prévia dentro da página Widgets (data-preview): sem botões de janela e sem mexer no título.
  const preview = root.hasAttribute('data-preview');
  if (!preview) document.title = `${def.title} · Lotus Tracker`;
  root.innerHTML = `
    <div class="wg">
      <div class="wg-head">
        <h1><span>${def.icon}</span>${esc(def.title)}${id === 'party' && bossOnly() ? ' <span class="muted" style="font-weight:500">· chefe</span>' : ''}</h1>
        ${!preview && overlay() ? '<button class="mini" data-act="lock" title="Travar (o clique passa para o jogo). Destrave com Ctrl+Shift+L">🔒</button>' : ''}
        ${preview ? '' : '<button class="mini" data-act="close" title="Fechar widget" aria-label="Fechar">✕</button>'}
      </div>
      <div class="wg-body"></div>
    </div>`;
  const wg = root.querySelector('.wg'), body = root.querySelector('.wg-body');

  const paint = () => {
    if (!root.isConnected) return false;
    wg.style.setProperty('--wg-alpha', load('wgOpacity:' + id, 88) + '%');
    const scroll = body.scrollTop;
    body.innerHTML = BODIES[id]();
    body.scrollTop = scroll;
    return true;
  };

  const off = onLive(() => paint() || off());
  if (id === 'radar') { const offPos = onPositions(() => paint() || offPos()); }
  // Mudou algo (em outra janela: evento "storage"; nesta: "a2t:changed"): repinta o widget.
  let lastBossOnly = bossOnly();
  const onData = () => {
    if (!root.isConnected) { removeEventListener('storage', onData); removeEventListener('a2t:changed', onData); return; }
    // Opção "somente chefe" muda o título também: redesenha o widget inteiro.
    if (bossOnly() !== lastBossOnly) return renderWidget(root, [id]);
    paint();
  };
  addEventListener('storage', onData);
  addEventListener('a2t:changed', onData);

  root.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'close') overlay() ? overlay().closeSelf() : window.close();
    if (act === 'lock') overlay()?.set(id, { locked: true });
    if (act === 'range') { const i = RADAR_RANGES.indexOf(load('radarRange', 100)); save('radarRange', RADAR_RANGES[(i + 1) % RADAR_RANGES.length]); paint(); }
    if (act === 'all') { save('radarAll', !load('radarAll', false)); paint(); }
  });

  paint();
}

// ---------- Tela de gerenciamento ----------
const CORNERS = [['', 'Livre (arrastar)'], ['tl', '↖ Superior esquerdo'], ['tr', '↗ Superior direito'], ['bl', '↙ Inferior esquerdo'], ['br', '↘ Inferior direito']];

export async function renderWidgetsPage(root) {
  root.className = 'page widgets-page';
  const ov = overlay();
  const state = ov ? await ov.list() : {};

  const card = (id, w, extra = '') => {
    const s = state[id] || {};
    return `
      <section class="card widget-card" data-id="${id}">
        <div class="widget-top">
          <span class="widget-ico">${w.icon}</span>
          <div class="widget-txt"><h2>${esc(w.title)}</h2></div>
          ${ov ? `<label class="switch"><input type="checkbox" data-opt="visible" ${s.visible ? 'checked' : ''}> No jogo</label>`
               : `<button class="btn sm primary" data-act="popup">Abrir janela</button>`}
        </div>
        <p class="muted small widget-desc">${esc(w.desc)}</p>

        <div class="widget-opts">
          ${extra}
          ${ov ? `
            <label class="opt"><span>Posição</span><select data-opt="corner">${CORNERS.map(([k, l]) => `<option value="${k}" ${(s.corner || '') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
            <label class="switch"><input type="checkbox" data-opt="locked" ${s.locked ? 'checked' : ''}> Travar (clique passa para o jogo)</label>` : ''}
          <label class="opt"><span>Opacidade</span><input type="range" min="30" max="100" step="5" value="${load('wgOpacity:' + id, 88)}" data-opt="opacity"></label>
        </div>
      </section>`;
  };

  root.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Widgets</h1>
        <p class="muted">Cada widget é uma janela separada por cima do jogo. Arraste pela barra do título e redimensione pelas bordas.</p>
      </div>
    </div>
    ${ov ? `<div class="note"><kbd>Insert</kbd> mostra/esconde os widgets no jogo · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd> trava/destrava todos. Use o jogo em <b>Janela</b> ou <b>Tela cheia sem bordas</b>.</div>`
      : `<div class="note">No navegador os widgets abrem como janelas comuns. Para ficarem <b>por cima do jogo</b>, use o app desktop.</div>`}
    <div class="widget-list">
      ${card('party', WIDGETS.party, `<label class="switch"><input type="checkbox" data-opt="bossOnly" ${bossOnly() ? 'checked' : ''}> Somente chefe <span class="muted small">(ignora mobs comuns; conta só o dano no chefe)</span></label>`)}
      ${card('skills', WIDGETS.skills)}
      ${card('farm', WIDGETS.farm)}
    </div>
    ${ov ? '<section class="card rec-card"><h2>Gravar pacotes do jogo</h2><p class="muted small">Para estudar como o jogo envia a posição do personagem e dos monstros (distância dos mascotes). Grava 5 minutos de tráfego do jogo em um arquivo no seu computador; nada é enviado. Com a captura ligada e o jogo aberto, ande pelo mapa e olhe os monstros.</p><div class="rec-row"><button class="btn primary sm" data-act="record">Gravar 5 minutos</button><span class="small muted" id="rec-status"></span></div></section>' : ''}`;


  const recStatus = root.querySelector('#rec-status');
  let recTimer;
  async function pollRecording() {
    clearTimeout(recTimer);
    if (!root.isConnected || !recStatus) return;
    try {
      const st = await (await fetch('/api/capture/record')).json();
      if (st.state === 'recording') {
        const left = Math.max(0, Math.round((Date.parse(st.endsAt) - Date.now()) / 1000));
        recStatus.textContent = 'Gravando… faltam ' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
        recTimer = setTimeout(pollRecording, 2000);
      } else if (st.state === 'done') recStatus.textContent = 'Pronto. Arquivo: ' + st.file;
    } catch { /* servidor fora do ar */ }
  }
  pollRecording();
  root.addEventListener('click', async e => {
    if (e.target.closest('[data-act="record"]')) {
      recStatus.textContent = 'Pedindo à captura…';
      try {
        await fetch('/api/capture/record?seconds=300', { method: 'POST' });
        recStatus.textContent = 'Aguardando a captura iniciar (precisa estar ligada e com o jogo aberto)…';
        setTimeout(pollRecording, 2500);
      } catch { recStatus.textContent = 'Não consegui falar com a captura.'; }
      return;
    }
    const cardEl = e.target.closest('.widget-card');
    if (cardEl && e.target.closest('[data-act="popup"]')) {
      const w = WIDGETS[cardEl.dataset.id];
      window.open(`${location.pathname}#/w/${cardEl.dataset.id}`, 'daeva-' + cardEl.dataset.id, `popup,width=${w.width},height=${w.height}`);
    }
  });
  root.addEventListener('input', e => {
    const cardEl = e.target.closest('.widget-card');
    if (cardEl && e.target.dataset.opt === 'opacity') { save('wgOpacity:' + cardEl.dataset.id, +e.target.value); notifyChange(); }
  });
  root.addEventListener('change', e => {
    const opt = e.target.dataset.opt, cardEl = e.target.closest('.widget-card');
    if (!opt || !cardEl || opt === 'opacity') return;
    const id = cardEl.dataset.id;
    if (opt === 'bossOnly') { save('wgBossOnly', e.target.checked); return notifyChange(); }
    if (!ov) return;
    if (opt === 'visible') ov.toggle(id, e.target.checked);
    if (opt === 'locked') ov.set(id, { locked: e.target.checked });
    if (opt === 'corner') ov.set(id, { corner: e.target.value });
  });
  ov?.onState(s => {
    if (!root.isConnected) return;
    for (const [id, st] of Object.entries(s)) {
      const cardEl = root.querySelector(`.widget-card[data-id="${id}"]`);
      if (!cardEl) continue;
      cardEl.querySelector('[data-opt="visible"]').checked = !!st.visible;
      cardEl.querySelector('[data-opt="locked"]').checked = !!st.locked;
    }
  });
}
