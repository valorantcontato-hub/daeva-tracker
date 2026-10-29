import { addTraining, startTraining, cancelTraining, trainingState, onTraining } from '../training.js';
import { compareTrainingRuns } from '../training-model.js';
import { skillIconHtml, skillLabel } from './dps.js';
import { esc, int, compact, pct, duration, dateTime, toast } from '../util.js';

const labels = { ready: 'Pronto', active: 'Em andamento', completed: 'Concluído', cancelled: 'Cancelado', interrupted: 'Interrompido' };
const delta = (n, format = compact) => `<span class="training-delta ${n > 0 ? 'positive' : n < 0 ? 'negative' : ''}">${n > 0 ? '+' : ''}${format(n)}</span>`;
const change = (a, b) => a ? delta((b - a) / a, n => pct(n, 1)) : '<span class="muted">—</span>';
const actor = run => ({ name: run.playerName, class: run.class });
function graph(runs) {
  const seconds = Math.max(1, ...runs.map(r => Math.ceil(r.duration)));
  const peak = Math.max(1, ...runs.flatMap(r => r.timeline || []));
  return `<div class="training-graph"><svg viewBox="0 0 600 140" role="img" aria-label="Dano registrado por segundo">
    <path d="M10 5V125H590" fill="none" stroke="var(--border)"/>
    ${runs.map((run, i) => `<polyline fill="none" stroke="${i ? '#a78bfa' : '#22b8cf'}" stroke-width="2" points="${Array.from({length:seconds},(_,s) => `${10+s/Math.max(1,seconds-1)*580},${125-(run.timeline?.[s] || 0)/peak*115}`).join(' ')}"/>`).join('')}
    <text x="10" y="138">0:00</text><text x="550" y="138">${duration(seconds)}</text></svg>
    <div class="small muted">${runs.map((r,i) => `<span style="color:${i ? '#a78bfa' : '#22b8cf'}">${i ? 'B' : 'A'} · ${esc(r.name)}</span>`).join(' &nbsp; ')}</div></div>`;
}
function details(run) {
  const rows = run.skills || [];
  return `<section class="card"><div class="card-head"><h2>${esc(run.name)}</h2><span class="muted small">${esc(labels[run.status] || run.status)} · ${esc(run.playerName || 'Seu personagem')}</span></div>
    <div class="kpis"><div class="kpi"><div class="l">Dano</div><div class="v">${int(run.damage || 0)}</div></div><div class="kpi"><div class="l">DPS</div><div class="v">${compact(run.dps || 0)}</div></div><div class="kpi"><div class="l">Tempo medido</div><div class="v">${duration(run.duration || 0)}</div></div><div class="kpi"><div class="l">Crítico</div><div class="v">${pct(run.critRate || 0)}</div></div></div>
    ${run.targetName ? `<p class="small muted">${esc(run.targetName)}</p>` : ''}
    ${run.warning ? `<p class="note small">${esc(run.warning)}</p>` : ''}
    ${rows.length ? graph([run]) + `<div class="table-wrap"><table class="training-skills"><thead><tr><th>Skill</th><th>Dano</th><th>DPS</th><th>%</th><th>Hits</th><th>Crit</th><th>Média</th></tr></thead><tbody>${rows.map(s => `<tr><td><span class="sk-in">${skillIconHtml(actor(run),s,24)}${esc(skillLabel(actor(run),s))}${s.dot ? '<small class="muted">DoT</small>' : ''}</span></td><td>${int(s.damage)}</td><td>${compact(run.duration ? s.damage/run.duration : 0)}</td><td>${pct(run.damage ? s.damage/run.damage : 0)}</td><td>${int(s.hits)}</td><td>${pct(s.hits ? s.crits/s.hits : 0)}</td><td>${int(s.hits ? s.damage/s.hits : 0)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">Nenhum dano registrado no intervalo.</p>'}
  </section>`;
}
function comparison(a,b) {
  const rows = compareTrainingRuns(a,b);
  return `<section class="card training-comparison"><div class="card-head"><h2>Comparativo</h2><span class="small muted">B − A</span></div>
    <div class="training-compare-names"><b>A · ${esc(a.name)}</b><b>B · ${esc(b.name)}</b></div>
    <div class="kpis"><div class="kpi"><div class="l">DPS A → B</div><div class="v">${compact(a.dps)} → ${compact(b.dps)}</div>${change(a.dps,b.dps)}</div><div class="kpi"><div class="l">Dano A → B</div><div class="v">${compact(a.damage)} → ${compact(b.damage)}</div>${change(a.damage,b.damage)}</div><div class="kpi"><div class="l">Tempo A / B</div><div class="v">${duration(a.duration)} / ${duration(b.duration)}</div></div><div class="kpi"><div class="l">Crítico A → B</div><div class="v">${pct(a.critRate)} → ${pct(b.critRate)}</div></div></div>
    ${a.duration !== b.duration ? '<p class="note small">Os tempos são diferentes. Use o DPS para comparar a taxa de dano.</p>' : ''}
    ${a.target && b.target && a.target !== b.target ? '<p class="note small">As tentativas usaram bonecos diferentes.</p>' : ''}
    ${graph([a,b])}<p class="muted small">Deslize a tabela para ver todas as colunas.</p>
    <div class="table-wrap"><table class="training-skills"><thead><tr><th>Skill</th><th>DPS A</th><th>DPS B</th><th>Δ DPS</th><th>Dano A</th><th>Dano B</th><th>Hits A</th><th>Hits B</th><th>Crit A</th><th>Crit B</th></tr></thead><tbody>${rows.map(r => `<tr><td><span class="sk-in">${skillIconHtml(actor(b),r.skill,24)}${esc(skillLabel(actor(b),r.skill))}</span></td><td>${compact(r.a?.dps || 0)}</td><td>${compact(r.b?.dps || 0)}</td><td>${delta(r.delta)}</td><td>${int(r.a?.damage || 0)}</td><td>${int(r.b?.damage || 0)}</td><td>${int(r.a?.hits || 0)}</td><td>${int(r.b?.hits || 0)}</td><td>${pct(r.a?.critRate || 0)}</td><td>${pct(r.b?.critRate || 0)}</td></tr>`).join('')}</tbody></table></div></section>`;
}

export function renderTraining(root) {
  root.className = 'page training-page';
  let selected = [], focused = '', historyKey = '', detailKey = '';
  root.innerHTML = `<div class="page-head"><div><h1>Boneco de Treinamento</h1><p class="muted small">Tentativas cronometradas. Somente o seu dano no boneco é contado.</p></div></div>
    <section class="card training-controls"><div class="training-status" role="status" aria-live="polite"></div><form class="training-form"><label>Nome do treino<input type="text" name="name" value="Treino ${trainingState().runs.length+1}" required maxlength="60" autocomplete="off"></label>
      <fieldset class="training-time"><legend>Tempo limite</legend><div class="training-time-options">${[30,60,120,180,300].map(t=>`<button class="chip ${t===30?'active':''}" type="button" data-time="${t}" aria-pressed="${t===30}">${duration(t)}</button>`).join('')}<input aria-label="Tempo em segundos" type="number" name="seconds" value="30" min="5" max="1800" step="1" required></div></fieldset>
      <div class="head-actions"><button class="btn" type="submit" value="add">+ Adicionar</button><button class="btn primary" type="submit" value="start" id="training-add-start">Adicionar e iniciar</button></div></form>
      <button class="btn sm" data-cancel hidden>Cancelar treino</button><p class="small negative" role="alert" id="training-error"></p></section>
    <section class="card"><div class="card-head"><h2>Tentativas</h2><span class="muted small">Selecione duas concluídas para comparar.</span></div><div id="training-history"></div></section><div id="training-detail"></div>`;
  const form = root.querySelector('form');
  function paint() {
    const state = trainingState();
    selected = selected.filter(id => state.runs.some(r => r.id === id && r.status === 'completed'));
    const status = root.querySelector('.training-status');
    status.dataset.phase = state.phase;
    status.textContent = state.phase === 'countdown' ? `Prepare-se: ${state.remaining}` : state.phase === 'running' ? `Combe agora · ${duration(state.remaining)} restantes · ${compact(state.active.dps)} DPS` : state.phase === 'finalizing' ? 'Finalizando a medição…' : 'Adicione uma tentativa e inicie. A contagem começa após 5 segundos.';
    root.querySelector('[data-cancel]').hidden = !state.active;
    root.querySelector('#training-add-start').disabled = !!state.active;
    root.querySelector('#training-error').textContent = state.error;
    const key = JSON.stringify(state.runs.map(r => [r.id,r.status,r.name,r.timeLimit,selected.includes(r.id),focused===r.id]));
    if (key !== historyKey) {
      historyKey = key;
      root.querySelector('#training-history').innerHTML = state.runs.map((r,index) => `<div class="training-run-row ${selected.includes(r.id) ? 'selected' : ''}"><input type="checkbox" data-compare="${esc(r.id)}" aria-label="Comparar ${esc(r.name)}" ${selected.includes(r.id) ? 'checked' : ''} ${r.status !== 'completed' ? 'disabled' : ''}><span class="training-run-index muted">#${state.runs.length-index}</span><button class="training-run-name" data-detail="${esc(r.id)}" aria-expanded="${focused===r.id}" title="${esc(dateTime(r.createdAt))}"><b>${esc(r.name)}</b><small class="muted">${duration(r.timeLimit)}${r.status === 'completed' ? '' : ' · ' + esc(labels[r.status] || r.status)}</small></button><span class="num training-run-dps" data-run-dps="${esc(r.id)}">${compact(r.dps || 0)}</span>${r.status === 'ready' ? `<button class="btn sm" data-start="${esc(r.id)}" ${state.active ? 'disabled' : ''}>Iniciar</button>` : ''}</div>`).join('') || '<p class="muted small">Nenhuma tentativa ainda.</p>';
    }
    root.querySelectorAll('[data-start]').forEach(button => { button.disabled = !!state.active; });
    if (state.active) { const element = root.querySelector(`[data-run-dps="${CSS.escape(state.active.id)}"]`); if (element) element.textContent = compact(state.active.dps); }
    const runs = selected.length === 2 ? selected.map(id => state.runs.find(r => r.id === id)) : [state.runs.find(r => r.id === focused)].filter(Boolean);
    const stamp = JSON.stringify(runs.map(r => [r.id,r.damage,r.hits,r.status,Math.floor(r.duration),r.warning]));
    if (stamp !== detailKey) { detailKey = stamp; root.querySelector('#training-detail').innerHTML = runs.length === 2 ? comparison(...runs) : runs.length ? details(runs[0]) : ''; }
  }
  form.addEventListener('submit', e => {
    e.preventDefault();
    try {
      const id = addTraining(form.elements.name.value, form.elements.seconds.value);
      focused = '';
      if (e.submitter?.value === 'start') { selected = []; startTraining(id); }
      form.elements.name.value = `Treino ${trainingState().runs.length+1}`;
      paint();
    } catch (err) { toast(err.message); }
  });
  root.addEventListener('click', e => {
    const start = e.target.closest('[data-start]'), detail = e.target.closest('[data-detail]');
    if (start) { try { selected = []; focused = ''; startTraining(start.dataset.start); paint(); } catch (err) { toast(err.message); } }
    if (detail) { focused = focused === detail.dataset.detail ? '' : detail.dataset.detail; selected = []; paint(); }
    const time = e.target.closest('[data-time]');
    if (time) { form.elements.seconds.value = time.dataset.time; form.elements.seconds.dispatchEvent(new Event('input')); }
    if (e.target.closest('[data-cancel]')) cancelTraining();
  });
  form.elements.seconds.addEventListener('input', () => root.querySelectorAll('[data-time]').forEach(button => {
    const on = button.dataset.time === form.elements.seconds.value;
    button.classList.toggle('active', on); button.setAttribute('aria-pressed', on);
  }));
  root.addEventListener('change', e => {
    const id = e.target.dataset.compare;
    if (!id) return;
    if (e.target.checked && selected.length >= 2) { e.target.checked = false; return toast('Selecione no máximo duas tentativas.'); }
    selected = e.target.checked ? [...selected,id] : selected.filter(x => x !== id);
    focused = '';
    paint();
  });
  const off = onTraining(() => root.isConnected ? paint() : off());
  paint();
}
