// Widgets compactos (#/w/<id>) para usar como janelas de overlay sobre o jogo,
// e a tela de gerenciamento (#/widgets).
import { load, save, notifyChange } from '../store.js';
import { readBestiary, bestiaryKey } from '../bestiary-state.js';
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
import { PET_FAMILIES as PET_TYPES, petStone } from '../pet-families.js';
import { radarSelf } from '../radar-state.js';

export const WIDGETS = {
  party: { title: 'DPS', icon: '⚔', width: 320, height: 270, desc: 'Ranking de DPS da party na luta atual, com classe e porcentagem do dano.' },
  skills: { title: 'Skills', icon: '✦', width: 340, height: 340, desc: 'Dano de cada skill do seu personagem. Mostra só as skills ativas — sem stigmas e passivas.' },
  radar: { title: 'Mini mapa', icon: '◎', width: 300, height: 460, desc: 'Radar e os mascotes que você está farmando (★ em Mascotes): progresso de almas e distância até o mais próximo. O jogo só informa a sua posição montado.' },
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

// ---------- Mini mapa (radar + mascotes que você está farmando) ----------
// Posições vêm dos pacotes de movimento do jogo (captura). Unidade assumida: 1 unidade = 1 cm; ajuste
// RADAR_UNIT_M se, em campo, as distâncias não baterem com o jogo. A SUA posição só chega montado.
const RADAR_UNIT_M = 0.01;
const normName = s => String(s || '').normalize('NFKC').trim().toLowerCase();
const ARROWS = 'M12 4v14M6 12l6 6 6-6';

/** O que você está farmando (★ nos Mascotes): pets do catálogo e monstros do catálogo geral. */
function farmingEntries() {
  const { focus, kills } = readBestiary();
  const collection = readCollection();
  const out = [];
  for (const pet of getPetCatalog()) {
    if (!focus.includes('pet-' + pet.id)) continue;
    out.push({ kind: 'pet', name: pet.name, icon: pet.icon, type: pet.family, progress: petProgress(collection, pet.id),
      names: new Set([normName(pet.name), ...(pet.mobs || []).map(m => normName(m.name))]) });
  }
  for (const m of mergeMonsterCatalog(load('monsters', []))) {
    if (focus.includes(m.id)) out.push({ kind: 'monster', name: m.name, icon: m.icon, kills: kills[m.id] || 0, names: new Set([normName(m.name)]) });
  }
  return out;
}

const fmtDist = d => d >= 1000 ? (d / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(d) + ' m';

function radarSvg(self, mobs, range) {
  const R = 92, k = R / range;
  let clips = '';
  const dots = mobs.slice(0, 150).map((m, i) => {
    const far = m.d > range, f = far ? range / m.d : 1;
    const cx = (100 + m.dx * f * k).toFixed(1), cy = (100 - m.dy * f * k).toFixed(1);
    const color = PET_TYPES[m.type]?.color || '#e9b949';
    const tip = '<title>' + esc(m.name) + ' · ' + fmtDist(m.d) + '</title>';
    // Mascote em farm: a bolinha vira a foto dele, com anel na cor do tipo.
    if (m.icon) {
      const r = far ? 6 : 8.5;
      clips += '<clipPath id="rdc' + i + '"><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '"/></clipPath>';
      return '<g class="rd-pet' + (far ? ' far' : '') + '">'
        + '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r + 1.4) + '" style="fill:' + color + '"/>'
        + '<image href="' + esc(m.icon) + '" x="' + (cx - r) + '" y="' + (cy - r) + '" width="' + r * 2 + '" height="' + r * 2 + '" preserveAspectRatio="xMidYMid slice" clip-path="url(#rdc' + i + ')"/>'
        + tip + '</g>';
    }
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + (far ? 2 : 3.4) + '" style="fill:' + color + '" class="rd-dot' + (far ? ' far' : '') + '">' + tip + '</circle>';
  }).join('');
  const rings = [R, R * 2 / 3, R / 3].map(r => '<circle cx="100" cy="100" r="' + r.toFixed(1) + '" class="rd-ring"/>').join('');
  return '<svg class="radar" viewBox="0 0 200 200" aria-label="Mini mapa">'
    + '<defs>' + clips + '<radialGradient id="rdbg"><stop offset="0" stop-color="#1b2a3d" stop-opacity=".9"/><stop offset="1" stop-color="#0d1118" stop-opacity=".95"/></radialGradient></defs>'
    + '<circle cx="100" cy="100" r="' + (R + 4) + '" fill="url(#rdbg)" class="rd-disc"/>' + rings
    + '<path d="M100 8v184M8 100h184" class="rd-axis"/>'
    + '<text x="100" y="7" class="rd-n" text-anchor="middle">N</text>'
    + dots
    + '<path d="M100 91l6 13-6-3-6 3z" class="rd-me" transform="rotate(' + (self?.heading || 0) + ' 100 100)"><title>' + (self?.headingSource === 'facing' ? 'Direção do personagem' : 'Última direção de movimento') + '</title></path>'
    + '</svg>';
}

function farmRow(e, near) {
  const type = PET_TYPES[e.type];
  const color = type?.color || 'var(--accent)';
  const icon = entityIcon('monster', e.name, { size: 38, icon: e.icon });
  let sub;
  if (e.kind === 'pet') {
    const p = e.progress;
    const lv = p.known ? p.level : 0;
    const diamonds = [0, 1, 2].map(i => '<i class="mm-dia' + (i < lv ? ' on' : '') + '"></i>').join('');
    const txt = !p.known ? 'Sem dados' : p.complete ? 'MAX' : p.points + '/' + p.goal;
    sub = petStone(e.type, 'mm-stone') + diamonds + '<span>' + txt + '</span>';
  } else sub = '<span>' + int(e.kills) + ' abates</span>';
  let dist = '<span class="mm-dist off" title="Fora do alcance do jogo ou sem a sua posição">—</span>';
  if (near) {
    const deg = Math.round(Math.atan2(near.dx, near.dy) * 180 / Math.PI);
    dist = '<span class="mm-dist"><svg viewBox="0 0 24 24" style="transform:rotate(' + (deg + 180) + 'deg)"><path d="' + ARROWS + '"/></svg>' + fmtDist(near.d) + '</span>';
  }
  return '<div class="mm-row" style="--c:' + color + '"><span class="mm-ico">' + icon + '</span><div class="mm-txt"><b>' + esc(e.name) + '</b><div class="mm-sub">' + sub + '</div></div>' + dist + '</div>';
}

// Última leitura boa (sua posição + monstros): o widget continua mostrando isso enquanto não chegam dados novos.
let radarOwner = bestiaryKey();
let lastRadar = load('radarLast:' + radarOwner, null);
let lastRadarSaved = 0;
let previousOwnerPositions = null;

function radarBody() {
  const owner = bestiaryKey();
  if (owner !== radarOwner) {
    previousOwnerPositions = lastPositions();
    radarOwner = owner;
    lastRadar = load('radarLast:' + owner, null);
    lastRadarSaved = 0;
  }
  const P = lastPositions();
  const elapsed = P ? Date.now() - Date.parse(P.capturedAt) : Infinity;
  const fresh = P && P !== previousOwnerPositions && elapsed >= -1000 && elapsed <= 10000;
  const selfOk = fresh && P.self && Number.isFinite(P.self.x) && Number.isFinite(P.self.y) && P.self.ageMs + Math.max(0, elapsed) <= 15000;
  const range = 100;
  const entries = farmingEntries();
  const showAll = load('radarAll', false) || !entries.length;

  // Atualiza a última leitura boa só quando o jogo está mandando a sua posição (montado).
  if (selfOk) {
    lastRadar = { self: radarSelf(P.self, lastRadar?.self), mobs: P.mobs.slice(0, 200).map(m => ({ name: m.name, x: m.x, y: m.y })) };
    if (Date.now() - lastRadarSaved > 5000) { lastRadarSaved = Date.now(); save('radarLast:' + radarOwner, lastRadar); }
  }

  // Monstros com distância em metros e o tipo do mascote a que pertencem (a partir da última leitura boa).
  const typeOf = new Map();
  for (const e of entries) for (const n of e.names) if (!typeOf.has(n)) typeOf.set(n, e);
  let mobs = [];
  if (lastRadar) {
    mobs = lastRadar.mobs.map(m => ({ ...m, dx: (m.x - lastRadar.self.x) * RADAR_UNIT_M, dy: (m.y - lastRadar.self.y) * RADAR_UNIT_M, type: typeOf.get(normName(m.name))?.type, icon: typeOf.get(normName(m.name))?.icon }))
      .map(m => ({ ...m, d: Math.hypot(m.dx, m.dy) }))
      .filter(m => showAll || typeOf.has(normName(m.name)))
      .sort((a, b) => a.d - b.d);
  }
  const nearestOf = e => mobs.find(m => e.names.has(normName(m.name)));

  // Sempre o mesmo visual: sem posição nova, nada muda; ele atualiza sozinho quando os dados voltam.
  const top = radarSvg(lastRadar?.self, mobs, range);

  const rows = entries.map(e => ({ e, near: nearestOf(e) }))
    .sort((a, b) => (a.near ? a.near.d : 1e12) - (b.near ? b.near.d : 1e12) || a.e.name.localeCompare(b.e.name))
    .map(x => farmRow(x.e, x.near)).join('');

  return '<div class="radar-stage">' + top + '</div>'
    + '<div class="rd-bar">'
    + '<button class="mini' + (showAll ? ' on' : '') + '" data-act="all" title="Mostrar no radar todos os monstros, não só os marcados com ★">' + (showAll ? 'Todos' : '★ Farmando') + '</button>'
    + '</div>'
    + '<div class="mm-list">' + (rows || '<div class="wg-empty">Marque mascotes com ★ em Mascotes para acompanhá-los aqui.</div>') + '</div>';
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
};

// ---------- Widget isolado ----------
export function renderWidget(root, [id]) {
  const def = WIDGETS[id];
  if (!def) { root.innerHTML = '<div class="wg"><div class="wg-empty">Widget desconhecido.</div></div>'; return; }
  // Prévia dentro da página Widgets (data-preview): sem botões de janela e sem mexer no título.
  const preview = root.hasAttribute('data-preview');
  if (!preview) document.title = `${def.title} · Lotus Tracker`;
  root.innerHTML = `
    <div class="wg ${id === 'radar' ? 'radar-widget' : ''}">
      ${id === 'radar' ? '' : `<div class="wg-head">
        <h1><span>${def.icon}</span>${esc(def.title)}${id === 'party' && bossOnly() ? ' <span class="muted" style="font-weight:500">· chefe</span>' : ''}</h1>
      </div>`}
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
      ${card('radar', WIDGETS.radar)}
    </div>
    ${ov ? '<section class="card rec-card"><h2>Gravar pacotes do jogo</h2><p class="muted small">Para estudar como o jogo envia a posição do personagem e dos monstros (distância dos mascotes). Grava 2 minutos de tráfego do jogo em um arquivo no seu computador; nada é enviado. Com a captura ligada e o jogo aberto, ande pelo mapa e olhe os monstros.</p><div class="rec-row"><button class="btn primary sm" data-act="record">Gravar 2 minutos</button><span class="small muted" id="rec-status"></span></div></section>' : ''}`;


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
        await fetch('/api/capture/record?seconds=120', { method: 'POST' });
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
