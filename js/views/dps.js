import { load, save } from '../store.js';
import { classInfo } from '../data/classes.js';
import { sampleEncounters } from '../data/samples.js';
import { normalizeEncounter, summarize, smooth } from '../encounter.js';
import { dpsChart } from '../chart.js';
import { classIcon, entityIcon } from '../icons.js';
import { findProfileByName, skillIcon, findSkill } from '../profiles.js';
import { liveFight, onLive } from '../live.js';
import { esc, compact, int, pct, duration, dateTime, download, pickJson, toast } from '../util.js';

export function getEncounters() {
  const list = load('encounters', []) || [];
  list.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
  const live = liveFight();
  return live && !list.some(e => e.id === live.id) ? [live, ...list] : list;
}

/** Classe vinda do log ou, se faltar, do perfil PlayNC do jogador. */
export const playerClass = p => p.class || findProfileByName(p.name)?.class || '';

/** Nome da skill no idioma escolhido (do perfil oficial, pelo ID); sem perfil, o nome que veio da captura. */
export const skillLabel = (player, skill) => findSkill(player.name, skill.name, playerClass(player), skill.id)?.name || skill.name;

export function skillIconHtml(player, skill, size = 24) {
  const src = skill.icon || skillIcon(player.name, skill.name, playerClass(player), skill.id);
  return entityIcon('skill', skill.name, { size, icon: src, color: classInfo(playerClass(player)).color });
}

/** Só as skills ativas (sem passivas nem stigmas), pela categoria do perfil oficial. Sem perfil, mostra todas. */
export function activeSkills(p) {
  const known = p.skills.map(s => ({ s, ref: findSkill(p.name, s.name, playerClass(p), s.id) }));
  const hasProfile = !!findProfileByName(p.name) || known.some(k => k.ref);
  return hasProfile ? known.filter(k => k.ref?.category === 'Active').map(k => k.s) : p.skills;
}

let lastPlayer = null;

const encDps = e => {
  let t = 0;
  for (const p of e.players) for (const s of p.skills) t += s.damage;
  return t / Math.max(1, e.duration);
};

export function renderDps(root, [id]) {
  root.className = 'page dps-page';
  const list = getEncounters();
  const enc = list.find(e => e.id === id) || list[0];

  if (!enc) {
    root.className = 'page';
    root.innerHTML = `
      <div class="empty card">
        <h1>Nenhuma luta ainda</h1>
        <p class="muted">Abra o jogo com a captura ligada (<b>capture\\bin\\daeva-capture.exe</b>, veja o README).<br>A luta aparece aqui ao vivo, com os nomes, classes e skills reais da party.</p>
        <div class="head-actions">
          <button class="btn" data-act="samples">Ver demonstração</button>
        </div>
      </div>`;
    root.addEventListener('click', e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'samples') { save('encounters', sampleEncounters()); dispatchEvent(new HashChangeEvent('hashchange')); }
    });
    return;
  }

  const S = summarize(enc);
  for (const p of S.players) p.class = playerClass(p);
  const top = S.players[0];
  const state = { player: S.players.some(p => p.name === lastPlayer) ? lastPlayer : top.name, sort: 'damage', dir: -1 };

  // Luta ao vivo: re-renderiza a cada atualização enquanto ela estiver na tela.
  if (enc.live || !id) {
    const off = onLive(f => {
      if (!root.isConnected) return off();
      if (f && (f.id === enc.id || (!id && !enc.live))) dispatchEvent(new HashChangeEvent('hashchange'));
      else if (!f && enc.live) dispatchEvent(new HashChangeEvent('hashchange'));
    });
  }
  const maxShare = top.share || 1;

  root.innerHTML = `
    <aside class="enc-list" aria-label="Encontros">
      <div class="enc-list-head">
        <span class="muted small">Encontros (${list.length})</span>
      </div>
      ${list.map(e => `
        <a class="enc-item ${e.id === enc.id ? 'active' : ''}" href="#/dps/${encodeURIComponent(e.id)}">
          <div class="t">${e.live ? '<span class="live-dot" style="display:inline-block;margin-right:6px"></span>' : ''}${esc(e.boss)}</div>
          <div class="s"><span>${dateTime(e.startedAt)} · ${duration(e.duration)}</span><span class="d">${compact(encDps(e))}</span></div>
          <div class="s"><span>${esc(e.dungeon)}</span>${e.live ? '<span class="badge">Ao vivo</span>' : e.result === 'wipe' ? '<span class="badge wipe">Wipe</span>' : ''}</div>
        </a>`).join('')}
    </aside>

    <section class="enc-detail">
      <label class="mobile-select">
        <select data-act="pick" aria-label="Escolher encontro">
          ${list.map(e => `<option value="${esc(e.id)}" ${e.id === enc.id ? 'selected' : ''}>${esc(e.boss)} · ${dateTime(e.startedAt)}${e.result === 'wipe' ? ' · wipe' : ''}</option>`).join('')}
        </select>
      </label>

      <div class="enc-head">
        <div class="boss-id">
          ${entityIcon('boss', S.boss, { size: 52, icon: S.bossIcon })}
          <div>
          ${S.dungeon ? `<div class="eyebrow">${esc(S.dungeon)}</div>` : ''}
          <h1>${esc(S.boss)}</h1>
          <div class="meta">
            ${S.live ? '<span class="badge wipe"><span class="live-dot" style="display:inline-block;width:6px;height:6px;margin-right:4px"></span>Ao vivo</span>' : `<span class="badge ${S.result}">${S.result === 'wipe' ? 'Wipe' : 'Vitória'}</span>`}
            <span>${dateTime(S.startedAt)}</span>·<span>${S.players.length} jogadores</span>
            ${enc.sample ? '<span class="badge">Exemplo</span>' : ''}
          </div>
          </div>
        </div>
      </div>

      <div class="kpis">
        <div class="kpi"><div class="l">DPS da party</div><div class="v">${compact(S.dps)}</div></div>
        <div class="kpi"><div class="l">Dano total</div><div class="v">${compact(S.total)}</div></div>
        <div class="kpi"><div class="l">${S.isBoss === false ? 'Duração' : 'Tempo do boss'}</div><div class="v">${duration(S.duration)}</div></div>
        <div class="kpi"><div class="l">Maior DPS</div><div class="v top" style="color:${classInfo(top.class).color}"><span>${esc(top.name)}</span><small>${compact(top.dps)}</small></div></div>
      </div>

      <div class="card">
        <div class="card-head"><h2>Dano da party</h2><span class="muted small">Toque num jogador para ver as skills</span></div>
        <div class="party-head" aria-hidden="true">
          <span>#</span><span>Jogador</span><span class="hide-sm"></span>
          <span class="num c-dps">DPS</span><span class="num c-total hide-sm">Dano</span><span class="num c-crit hide-sm">Crit</span><span class="num c-share">%</span>
        </div>
        <div id="party">
          ${S.players.map((p, i) => {
            const c = classInfo(p.class);
            return `
            <button class="prow" data-player="${esc(p.name)}" style="--c:${c.color}">
              <span class="rank">${i + 1}</span>
              <span class="pname">${classIcon(p.class, 30)}<span class="pname-txt"><b>${esc(p.name)}</b><span class="cls">${esc(c.name)}</span></span></span>
              <span class="pbar"><i style="width:${(p.share / maxShare) * 100}%"></i></span>
              <span class="num c-dps">${compact(p.dps)}</span>
              <span class="num c-total hide-sm">${compact(p.damage)}</span>
              <span class="num c-crit hide-sm">${pct(p.critRate, 0)}</span>
              <span class="num c-share">${pct(p.share)}</span>
            </button>`;
          }).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h2>DPS ao longo do tempo</h2><span class="muted small">média móvel de 5s</span></div>
        <div class="chart" id="chart"></div>
        <div class="legend">${S.players.map(p => `<span style="--c:${classInfo(p.class).color}"><i class="dot"></i>${esc(p.name)}</span>`).join('')}</div>
      </div>

      <div class="card" id="skills"></div>
    </section>`;

  const len = Math.ceil(S.duration);
  const chart = dpsChart(root.querySelector('#chart'), S.players.map(p => ({
    name: p.name, color: classInfo(p.class).color, values: smooth(p.timeline, len),
  })), { highlight: state.player });

  const skillsEl = root.querySelector('#skills');
  const COLS = [
    ['name', 'Skill'], ['damage', 'Dano'], ['share', '%'], ['hits', 'Hits'], ['crit', 'Crit'],
    ['avg', 'Média', 'hide-sm'], ['max', 'Máx', 'hide-sm'], ['dps', 'DPS', 'hide-sm'],
  ];

  function renderSkills() {
    const p = S.players.find(x => x.name === state.player);
    const c = classInfo(p.class);
    const rows = activeSkills(p).map(s => ({
      ...s,
      share: p.damage ? s.damage / p.damage : 0,
      avg: s.hits ? s.damage / s.hits : 0,
      crit: s.hits ? s.crits / s.hits : 0,
      dps: s.damage / Math.max(1, S.duration),
    }));
    const k = state.sort;
    rows.sort((a, b) => (typeof a[k] === 'string' ? a[k].localeCompare(b[k]) : a[k] - b[k]) * state.dir);
    const best = Math.max(...rows.map(r => r.share)) || 1;

    skillsEl.style.setProperty('--c', c.color);
    skillsEl.innerHTML = `
      <div class="pchips" role="tablist" aria-label="Jogador">
        ${S.players.map(x => `<button class="pchip ${x.name === p.name ? 'active' : ''}" role="tab" aria-selected="${x.name === p.name}" data-player="${esc(x.name)}" style="--c:${classInfo(x.class).color}"><i class="dot"></i>${esc(x.name)}</button>`).join('')}
      </div>
      <div class="card-head">
        <h2>Skills de <span style="color:${c.color}">${esc(p.name)}</span> <span class="muted small">${esc(c.name)}</span></h2>
        <div class="pstats">
          <span>DPS <b>${compact(p.dps)}</b></span><span>Dano <b>${int(p.damage)}</b></span>
          <span>Hits <b>${int(p.hits)}</b></span><span>Crit <b>${pct(p.critRate)}</b></span>
        </div>
      </div>
      <div class="table-wrap">
        <table class="skills">
          <thead><tr>${COLS.map(([key, label, cls = '']) => `
            <th class="${cls} ${key === k ? 'sorted' : ''}" aria-sort="${key === k ? (state.dir < 0 ? 'descending' : 'ascending') : 'none'}">
              <button data-sort="${key}">${label}${key === k ? (state.dir < 0 ? ' ↓' : ' ↑') : ''}</button>
            </th>`).join('')}</tr></thead>
          <tbody>${rows.map(r => `
            <tr>
              <td class="sk"><span class="skbar" style="width:${(r.share / best) * 100}%"></span><span class="sk-in">${skillIconHtml(p, r, 26)}${esc(skillLabel(p, r))}</span></td>
              <td>${int(r.damage)}</td>
              <td class="share">${pct(r.share)}</td>
              <td>${int(r.hits)}</td>
              <td>${pct(r.crit, 0)}</td>
              <td class="hide-sm">${int(r.avg)}</td>
              <td class="hide-sm">${int(r.max)}</td>
              <td class="hide-sm">${compact(r.dps)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function selectPlayer(name) {
    state.player = lastPlayer = name;
    root.querySelectorAll('.prow').forEach(b => {
      const on = b.dataset.player === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on);
    });
    chart.setHighlight(name);
    renderSkills();
  }

  root.addEventListener('click', e => {
    const playerBtn = e.target.closest('[data-player]');
    if (playerBtn) return selectPlayer(playerBtn.dataset.player);

    const sortBtn = e.target.closest('[data-sort]');
    if (sortBtn) {
      const key = sortBtn.dataset.sort;
      state.dir = state.sort === key ? -state.dir : (key === 'name' ? 1 : -1);
      state.sort = key;
      return renderSkills();
    }

  });

  root.querySelector('[data-act="pick"]').addEventListener('change', e => {
    location.hash = '#/dps/' + encodeURIComponent(e.target.value);
  });

  selectPlayer(state.player);
}
