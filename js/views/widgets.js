// Widgets compactos (#/w/<id>) para usar como janelas de overlay sobre o jogo,
// e a tela de gerenciamento (#/widgets).
import { load, save, notifyChange } from '../store.js';
import { readBestiary, bestiaryKey } from '../bestiary-state.js';
import { isInstancedBossFight } from '../combat-types.js';
import { classInfo } from '../data/classes.js';
import { getPetCatalog, readCollection } from '../collection.js';
import { petProgress } from '../collection-state.js';
import { mergeMonsterCatalog } from '../monster-catalog.js';
import { summarize } from '../encounter.js';
import { classIcon, entityIcon } from '../icons.js';
import { getMe, findProfileByName } from '../profiles.js';
import { onLive, onPositions, lastPositions, liveFight } from '../live.js';
import { playerClass, skillIconHtml, skillLabel, activeSkills } from './dps.js';
import { createWidgetActivity } from '../widget-activity.js';
import { groupSkillVariants } from '../skill-meter.js';
import { esc, compact, int, pct, duration } from '../util.js';
import { PET_FAMILIES as PET_TYPES, petStone } from '../pet-families.js';
import { radarSelf, verifiedRadarOwner, readVerifiedRadar, radarHeading, radarOffset } from '../radar-state.js';

export const WIDGETS = {
  party: { title: 'DPS', icon: '⚔', width: 320, height: 270, desc: 'Ranking de DPS da party na luta atual, com classe e porcentagem do dano.' },
  skills: { title: 'Skills', icon: '✦', width: 340, height: 340, desc: 'DPS, participação, dano total e crítico de cada habilidade ativa do seu personagem.' },
  radar: { title: 'Mini mapa', icon: '◎', width: 300, height: 460, desc: 'Radar e os mascotes que você está farmando (★ em Mascotes): progresso de almas e distância até o mais próximo. As distâncias aguardam a identificação e a posição do seu personagem pelo jogo.' },
};

const overlay = () => window.overlay; // exposto pelo app desktop (electron/preload.cjs)

/** Combate ao vivo. O painel de DPS da party ("party") só aparece em chefe de DG instanciada; o de skills também em mobs e bonecos. */
const LINGER_MS = 15000; // painéis de combate ficam 15 s na tela depois que a luta (ou o dano) termina
const lingering = {};
function currentFight(id) {
  const enc = liveFight();
  if (!enc?.live || (id === 'party' && !isInstancedBossFight(enc))) {
    const last = lingering[id];
    if (last && Date.now() - last.at < LINGER_MS) return { ...last.S, live: false, lingerLeft: LINGER_MS - (Date.now() - last.at) };
    return null;
  }
  const S = summarize(enc);
  for (const p of S.players) p.class = playerClass(p);
  lingering[id] = { S, at: Date.now() };
  return S;
}

/** O seu personagem na luta: marcado pela captura como local, ou o vinculado em "Minha conta". */
function myPlayer(S) {
  const me = getMe();
  return S.players.find(p => p.isLocal) || S.players.find(p => me && p.name.toLowerCase() === me.name?.toLowerCase()) || null;
}

// ---------- Mini mapa (radar + mascotes que você está farmando) ----------
// Posições vêm dos pacotes de movimento do jogo (captura). Unidade assumida: 1 unidade = 1 cm; ajuste
// RADAR_UNIT_M se, em campo, as distâncias não baterem com o jogo. A identidade local precisa estar confirmada.
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

const RADAR_RANGES = [100, 250, 500, 1000, 2000];
const RADAR_MAX_M = RADAR_RANGES.at(-1);
const fmtDist = d => d >= 1000 ? (d / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(d) + ' m';

function radarSvg(self, mobs, range, rotation) {
  const R = 92, k = R / range;
  let clips = '';
  const dots = mobs.slice(0, 150).map((m, i) => {
    const far = m.d > range, f = far ? range / m.d : 1;
    const point = radarOffset(m.dx, m.dy, rotation);
    const cx = (100 + point.x * f * k).toFixed(1), cy = (100 + point.y * f * k).toFixed(1);
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
    + '<g transform="rotate(' + rotation + ' 100 100)"><text x="100" y="7" class="rd-n" text-anchor="middle">N</text></g>'
    + dots
    + '<path d="M100 91l6 13-6-3-6 3z" class="rd-me" transform="rotate(' + (self?.headingSource && self.headingSource !== 'unknown' ? radarHeading(self.heading || 0, rotation) : 0) + ' 100 100)"><title>' + (self?.headingSource === 'facing' ? 'Direção do personagem' : 'Última direção de movimento') + '</title></path>'
    + '</svg>';
}

function farmRow(e, near, rotation) {
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
    const deg = Math.round(radarHeading(Math.atan2(near.dx, near.dy) * 180 / Math.PI, rotation));
    dist = '<span class="mm-dist"><svg viewBox="0 0 24 24" style="transform:rotate(' + (deg + 180) + 'deg)"><path d="' + ARROWS + '"/></svg>' + fmtDist(near.d) + '</span>';
  }
  return '<div class="mm-row" style="--c:' + color + '"><span class="mm-ico">' + icon + '</span><div class="mm-txt"><b>' + esc(e.name) + '</b><div class="mm-sub">' + sub + '</div></div>' + dist + '</div>';
}

// Última leitura boa (sua posição + monstros): o widget continua mostrando isso enquanto não chegam dados novos.
let radarOwner = bestiaryKey();
let lastRadar = readVerifiedRadar(load('radarLast:' + radarOwner, null));
let lastRadarSaved = 0;
let previousOwnerPositions = null;

function radarBody() {
  const owner = bestiaryKey();
  if (owner !== radarOwner) {
    previousOwnerPositions = lastPositions();
    radarOwner = owner;
    lastRadar = readVerifiedRadar(load('radarLast:' + owner, null));
    lastRadarSaved = 0;
  }
  const P = lastPositions();
  const elapsed = P ? Date.now() - Date.parse(P.capturedAt) : Infinity;
  const fresh = P && P !== previousOwnerPositions && elapsed >= -1000 && elapsed <= 10000;
  const selfOk = fresh && verifiedRadarOwner(P, getMe()) && P.self && Number.isFinite(P.self.x) && Number.isFinite(P.self.y) && P.self.ageMs + Math.max(0, elapsed) <= 15000;
  const rotation = 0; // Orientação do jogo, sem calibração manual.
  const entries = farmingEntries();

  // Atualiza a última leitura boa só quando o jogo está mandando a sua posição (montado).
  if (selfOk) {
    lastRadar = { verifiedSelf: true, self: radarSelf(P.self, lastRadar?.self), mobs: P.mobs.slice(0, 200).map(m => ({ name: m.name, x: m.x, y: m.y })) };
    if (Date.now() - lastRadarSaved > 5000) { lastRadarSaved = Date.now(); save('radarLast:' + radarOwner, lastRadar); }
  }

  // Monstros com distância em metros e o tipo do mascote a que pertencem (a partir da última leitura boa).
  const typeOf = new Map();
  for (const e of entries) for (const n of e.names) if (!typeOf.has(n)) typeOf.set(n, e);
  let mobs = [];
  if (lastRadar) {
    mobs = lastRadar.mobs.map(m => ({ ...m, dx: (m.x - lastRadar.self.x) * RADAR_UNIT_M, dy: (m.y - lastRadar.self.y) * RADAR_UNIT_M, type: typeOf.get(normName(m.name))?.type, icon: typeOf.get(normName(m.name))?.icon }))
      .map(m => ({ ...m, d: Math.hypot(m.dx, m.dy) }))
      // Só os monstros selecionados para farmar, até 2 km (o jogo informa os que estão no alcance dele).
      .filter(m => typeOf.has(normName(m.name)) && m.d <= RADAR_MAX_M)
      .sort((a, b) => a.d - b.d);
  }
  // Zoom automático: o radar fecha em volta do mais próximo conforme você se aproxima (100 m, 250 m, 500 m, 1 km, 2 km).
  const range = mobs.length ? (RADAR_RANGES.find(r => r >= mobs[0].d) || RADAR_MAX_M) : RADAR_RANGES[0];
  const nearestOf = e => mobs.find(m => e.names.has(normName(m.name)));

  // Sempre o mesmo visual: sem posição nova, nada muda; ele atualiza sozinho quando os dados voltam.
  const top = radarSvg(lastRadar?.self, mobs, range, rotation);

  const rows = entries.map(e => ({ e, near: nearestOf(e) }))
    .sort((a, b) => (a.near ? a.near.d : 1e12) - (b.near ? b.near.d : 1e12) || a.e.name.localeCompare(b.e.name))
    .map(x => farmRow(x.e, x.near, rotation)).join('');

  return '<div class="radar-stage">' + top + '</div>'
    + (rows ? '<div class="mm-list">' + rows + '</div>' : '');
}

// ---------- Modo posicionar: exemplos para arrastar cada widget antes da luta ----------
const SAMPLE_ROWS = [['Jogador 1', 'cleric', '#e6c04a', 53.2, '1,4M', 35], ['Jogador 2', 'ranger', '#8bd16c', 47.4, '1,2M', 31], ['Você', 'sorcerer', '#78a8ff', 27.1, '0,7M', 18], ['Jogador 4', 'templar', '#c9c9c9', 22.7, '0,6M', 16]];
function positioningBody(id) {
  if (id === 'party') {
    return `
      <header class="combat-summary">
        <div class="combat-meta"><span>Combate <b>1:23</b></span><strong>150K <small>DPS</small></strong></div>
        <div class="combat-target"><b>Chefe de exemplo</b><span class="combat-total">party <b>9,8M</b> · você <b>0,7M</b></span></div>
        <div class="combat-hp"><i style="width:62%"></i><span>9.600.000 / 15.504.000 · 62%</span></div>
      </header>
      <div class="combat-ranking">${SAMPLE_ROWS.map(([name, cls, color, dps, dmg, share]) => `
        <div class="combat-player ${name === 'Você' ? 'is-me' : ''}" style="--c:${color};--share:${share * 2.8}%">
          ${classIcon(cls, 21)}<b class="combat-name">${name}</b>
          <strong class="combat-dps">${dps}K<small>/s</small></strong><span class="combat-dmg">${dmg}</span><strong class="combat-share">${share}%</strong>
        </div>`).join('')}</div>`;
  }
  return `
    <header class="combat-summary skills-summary" style="--c:#78a8ff">
      <div class="combat-meta"><span>${classIcon('sorcerer', 16)}<b>Você</b><time>1:23</time></span><strong><em class="dps-peak">pico 48K</em><em class="dps-active">ativo 30K</em>27K <small>DPS</small></strong></div>
    </header>
    <div class="skill-meter-labels"><span>Habilidade</span><span>DPS</span><span>Dano %</span><span>DMG</span><span>Crít.</span></div>
    <div class="skill-meters">${[['Skill de exemplo A', 38, '10K', '1,2M', '35%'], ['Skill de exemplo B', 33, '8K', '1,0M', '31%'], ['Skill de exemplo C', 29, '7K', '0,9M', '28%']].map(([name, share, dps, dmg, crit]) => `
      <div class="skill-meter" style="--c:#78a8ff;--share:${share * 2.6}%">
        <span class="skill-art"></span><div class="skill-meter-name"><b>${name}</b></div>
        <strong class="skill-dps">${dps}</strong><strong class="combat-share">${share}%</strong><span class="skill-damage">${dmg}</span><span class="skill-crit">${crit}</span>
      </div>`).join('')}</div>`;
}

// ---------- Corpo de cada widget ----------
const BODIES = {
  radar: radarBody,
  party() {
    const S = currentFight('party');
    if (!S) return '';
    const top = S.players[0]?.share || 1;
    const mine = myPlayer(S)?.name;
    const hp = S.bossHp?.max ? Math.max(0, Math.min(1, S.bossHp.current / S.bossHp.max)) : null;
    return `
      <header class="combat-summary">
        <div class="combat-meta"><span>Combate <b>${duration(S.duration)}</b> ${S.live ? '<i class="combat-live"></i>' : ''}</span><strong>${compact(S.dps)} <small>DPS</small></strong></div>
        <div class="combat-target">${entityIcon('boss', S.boss, { size: 18, icon: S.bossIcon })}<b>${esc(S.boss)}</b><span class="combat-total" title="Dano contado de toda a party no chefe, e o seu">party <b>${compact(S.total)}</b>${myPlayer(S) ? ` · você <b>${compact(myPlayer(S).damage)}</b>` : ''}</span></div>
        ${hp == null ? '' : `<div class="combat-hp"><i style="width:${hp * 100}%"></i><span>${int(S.bossHp.current)} / ${int(S.bossHp.max)} · ${pct(hp, 0)}</span></div>`}
      </header>
      <div class="combat-ranking">${S.players.map(p => {
        const c = classInfo(p.class);
        const profile = findProfileByName(p.name);
        return `<div class="combat-player ${p.name === mine ? 'is-me' : ''}" style="--c:${c.color};--share:${(p.share / top) * 100}%">
          ${classIcon(p.class, 21)}<b class="combat-name">${esc(p.name)}</b>
          ${profile?.combatPower ? `<span class="combat-cp" title="Combat Power">CP ${compact(profile.combatPower)}</span>` : ''}
          <span class="combat-peak" title="Pico: melhor momento de 10 s">pico ${compact(p.peak)}</span><strong class="combat-dps" title="DPS da luta (como no Questlog) · ativo ${compact(p.activeDps)} só o tempo batendo">${compact(p.dps)}<small>/s</small></strong><span class="combat-dmg" title="Dano total no chefe">${compact(p.damage)}</span><strong class="combat-share">${pct(p.share)}</strong>
        </div>`;
      }).join('')}</div>`;
  },

  skills() {
    const S = currentFight('skills');
    const p = S && myPlayer(S);
    if (!p) return `<div class="wg-empty">${S ? 'Seu personagem ainda não foi identificado nesta luta.' : 'Sem lutas ainda.'}</div>`;
    const c = classInfo(p.class);
    const rows = groupSkillVariants(activeSkills(p), skill => skillLabel(p, skill));
    const best = rows[0]?.damage || 1;
    return `
      <header class="combat-summary skills-summary" style="--c:${c.color}" title="${esc(S.boss)} · ${pct(p.critRate)} crítico">
        <div class="combat-meta"><span>${classIcon(p.class, 16)}<b>${esc(p.name)}</b><time>${duration(S.duration)}</time></span><strong><em class="dps-peak" title="Pico: melhor momento de 10 s">pico ${compact(p.peak)}</em><em class="dps-active" title="DPS só no tempo em que você bateu">ativo ${compact(p.activeDps)}</em>${compact(p.dps)} <small>DPS</small></strong></div>
      </header>
      <div class="skill-meter-labels"><span>Habilidade</span><span>DPS</span><span>Dano %</span><span>DMG</span><span>Crít.</span></div>
      <div class="skill-meters">${rows.map(s => `
        <div class="skill-meter" style="--c:${c.color};--share:${(s.damage / best) * 100}%" title="${esc(skillLabel(p, s))} · ${int(s.hits)} hits · maior acerto ${int(s.max)}">
          <span class="skill-art">${skillIconHtml(p, s, 16)}</span>
          <div class="skill-meter-name"><b>${esc(skillLabel(p, s))}</b></div>
          <strong class="skill-dps">${compact(s.damage / Math.max(1, S.duration))}</strong>
          <strong class="combat-share">${pct(p.damage ? s.damage / p.damage : 0)}</strong>
          <span class="skill-damage">${compact(s.damage)}</span>
          <span class="skill-crit">${s.hits ? pct(s.crits / s.hits, 0) : '—'}</span>
        </div>`).join('') || '<div class="wg-empty">Nenhuma skill ativa usada ainda.</div>'}</div>`;
  },
};

// ---------- Widget isolado ----------
export function renderWidget(root, [id]) {
  // #/w/all: os três widgets em uma só página (um único endereço para a fonte de navegador do OBS), lado a lado.
  if (id === 'all') {
    root.innerHTML = '<div class="wg-all">' + Object.keys(WIDGETS).map(w => '<div class="wg-all-cell" data-w="' + w + '" style="width:' + WIDGETS[w].width + 'px;height:' + WIDGETS[w].height + 'px"></div>').join('') + '</div>';
    root.querySelectorAll('.wg-all-cell').forEach(cell => renderWidget(cell, [cell.dataset.w]));
    document.title = 'Widgets · Lotus Tracker';
    return;
  }
  const def = WIDGETS[id];
  if (!def) { root.innerHTML = '<div class="wg"><div class="wg-empty">Widget desconhecido.</div></div>'; return; }
  // Prévia dentro da página Widgets (data-preview): sem botões de janela e sem mexer no título.
  const preview = root.hasAttribute('data-preview');
  if (!preview) document.title = `${def.title} · Lotus Tracker`;
  root.innerHTML = `
    <div class="wg ${id === 'radar' ? 'radar-widget' : 'combat-widget ' + id + '-widget'}">
      <div class="wg-body"></div>
    </div>`;
  const wg = root.querySelector('.wg'), body = root.querySelector('.wg-body');
  const applySize = state => {
    if (root.isConnected) wg.style.setProperty('--wg-scale', state[id]?.scale || 1);
  };
  const ov = overlay();
  if (ov && !preview) { ov.list().then(applySize); ov.onState(applySize); }
  const activity = createWidgetActivity();
  let idleTimer, wasVisible, positioningOn = false;

  const paint = () => {
    if (!root.isConnected) return false;
    wg.style.setProperty('--wg-opacity', Math.max(30, Math.min(100, Number(load('wgOpacity:' + id, 88)) || 88)) / 100);
    clearTimeout(idleTimer);
    wg.classList.toggle('wg-positioning', positioningOn);
    // Modo posicionar: exemplo fixo para arrastar o widget antes de entrar em combate.
    if (positioningOn && id !== 'radar') { wg.classList.remove('combat-idle'); body.innerHTML = positioningBody(id); return true; }
    let visible = true;
    if (id !== 'radar') {
      const fight = currentFight(id);
      const remaining = fight?.lingerLeft ?? activity(fight, id === 'skills' ? myPlayer(fight || { players: [] })?.damage : fight?.total);
      visible = remaining > 0;
      wg.classList.toggle('combat-idle', !visible);
      if (visible) idleTimer = setTimeout(paint, remaining + 10);
      if (visible !== wasVisible) { ov?.activity?.(id, visible); wasVisible = visible; }
    }
    const scroll = body.scrollTop;
    body.innerHTML = visible ? BODIES[id]() : '';
    body.scrollTop = scroll;
    return true;
  };

  const off = onLive(() => paint() || off());
  if (ov && !preview && ov.onPositioning) { ov.getPositioning().then(on => { positioningOn = on; paint(); }); ov.onPositioning(on => { positioningOn = on; paint(); }); }
  if (id === 'radar') { const offPos = onPositions(() => paint() || offPos()); }
  // Mudou algo (em outra janela: evento "storage"; nesta: "a2t:changed"): repinta o widget.
  const onData = () => {
    if (!root.isConnected) { removeEventListener('storage', onData); removeEventListener('a2t:changed', onData); return; }
    paint();
  };
  addEventListener('storage', onData);
  addEventListener('a2t:changed', onData);

  paint();
}

// ---------- Tela de gerenciamento ----------

export async function renderWidgetsPage(root) {
  root.className = 'page widgets-page';
  const ov = overlay();
  const state = ov ? await ov.list() : {};

  const card = (id, w) => {
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
          ${ov ? `
            <label class="switch"><input type="checkbox" data-opt="locked" ${s.locked ? 'checked' : ''}> Travar <span class="muted small">(cliques passam para o jogo; oculta ao passar o mouse)</span></label>` : ''}
          ${ov && s.scale != null ? `<label class="opt widget-size"><span>Tamanho</span><input aria-label="Tamanho de ${esc(w.title)}" type="range" min="75" max="150" step="5" value="${Math.round(s.scale * 100)}" data-opt="size"><output>${Math.round(s.scale * 100)}%</output><button class="btn sm" data-act="size-default" type="button">Padrão</button></label>` : ''}
          <label class="opt"><span>Opacidade</span><input type="range" min="30" max="100" step="5" value="${load('wgOpacity:' + id, 88)}" data-opt="opacity"></label>
        </div>
      </section>`;
  };

  root.innerHTML = `
    ${ov ? `<div class="note"><kbd>PgUp</kbd> mostra/oculta os widgets · <kbd>PgDown</kbd> trava/destrava todos.</div>`
      : `<div class="note">No navegador os widgets abrem como janelas comuns. Para ficarem <b>por cima do jogo</b>, use o app desktop.</div>`}
    ${ov ? `<section class="card position-card">
      <div class="widget-top"><span class="widget-ico">✥</span><div class="widget-txt"><h2>Posição dos widgets</h2></div>
        <button class="btn primary sm" data-act="position-toggle">Posicionar no jogo</button></div>
      <p class="muted small widget-desc">Mostra os widgets ligados com dados de exemplo, por cima de tudo, para você arrastar cada um para onde quiser <i>antes</i> de entrar em combate. Clique em "Concluir" quando terminar: a posição fica salva. Ligue "No jogo" nos que quiser ajustar.</p>
      <div class="widget-opts"><button class="btn sm" data-act="position-reset">Restaurar posições padrão</button></div>
    </section>` : ''}
    <div class="widget-list">
      ${card('party', WIDGETS.party)}
      ${card('skills', WIDGETS.skills)}
      ${card('radar', WIDGETS.radar)}
    </div>`;


  root.addEventListener('click', e => {
    const cardEl = e.target.closest('.widget-card');
    const toggle = e.target.closest('[data-act="position-toggle"]');
    if (toggle) { ov?.positioning(toggle.dataset.on !== '1'); return; }
    if (e.target.closest('[data-act="position-reset"]')) { ov?.resetPositions(); return; }
    if (cardEl && e.target.closest('[data-act="size-default"]')) {
      ov?.set(cardEl.dataset.id, { scale: 1 });
      return;
    }
    if (cardEl && e.target.closest('[data-act="popup"]')) {
      const w = WIDGETS[cardEl.dataset.id];
      window.open(`${location.pathname}#/w/${cardEl.dataset.id}`, 'daeva-' + cardEl.dataset.id, `popup,width=${w.width},height=${w.height}`);
    }
  });
  root.addEventListener('input', e => {
    const cardEl = e.target.closest('.widget-card');
    if (cardEl && e.target.dataset.opt === 'opacity') { save('wgOpacity:' + cardEl.dataset.id, +e.target.value); notifyChange(); }
    if (cardEl && e.target.dataset.opt === 'size') ov?.set(cardEl.dataset.id, { scale: +e.target.value / 100 });
  });
  root.addEventListener('change', e => {
    const opt = e.target.dataset.opt, cardEl = e.target.closest('.widget-card');
    if (!opt || !cardEl || opt === 'opacity') return;
    const id = cardEl.dataset.id;
    if (!ov) return;
    if (opt === 'visible') ov.toggle(id, e.target.checked);
    if (opt === 'locked') ov.set(id, { locked: e.target.checked });
  });
  const setToggle = on => {
    const b = root.querySelector('[data-act="position-toggle"]');
    if (b) { b.dataset.on = on ? '1' : '0'; b.textContent = on ? 'Concluir posicionamento' : 'Posicionar no jogo'; }
  };
  ov?.getPositioning?.().then(setToggle);
  ov?.onPositioning?.(on => { if (root.isConnected) setToggle(on); });
  ov?.onState(s => {
    if (!root.isConnected) return;
    for (const [id, st] of Object.entries(s)) {
      const cardEl = root.querySelector(`.widget-card[data-id="${id}"]`);
      if (!cardEl) continue;
      cardEl.querySelector('[data-opt="visible"]').checked = !!st.visible;
      cardEl.querySelector('[data-opt="locked"]').checked = !!st.locked;
      const size = cardEl.querySelector('[data-opt="size"]');
      if (size) { size.value = Math.round(st.scale * 100); size.nextElementSibling.value = `${Math.round(st.scale * 100)}%`; }
    }
  });
}
