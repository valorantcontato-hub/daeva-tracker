import { load, save } from '../store.js';
import { MILESTONES } from '../data/monsters.js';
import { esc, int, pct, uid, download, pickJson, toast } from '../util.js';
import { entityIcon } from '../icons.js';

export const ROMAN = ['', 'I', 'II', 'III'];
export const LAST = MILESTONES[MILESTONES.length - 1];
export const tierOf = c => MILESTONES.filter(m => c >= m).length;
export const isElite = m => !!m.elite || /\belite\b/i.test(m.note || '');
export const clampKills = v => Math.max(0, Math.min(99999, Math.floor(Number(v) || 0)));

const FILTERS = [
  ['all', 'Todos'], ['focus', '★ Farmando'], ['progress', 'Em progresso'], ['todo', 'Não iniciado'], ['done', 'Completo'],
];
const matches = {
  all: () => true,
  focus: (m, c, f) => f.has(m.id),
  progress: (m, c) => c > 0 && c < LAST,
  todo: (m, c) => c === 0,
  done: (m, c) => c >= LAST,
};

export function renderBestiary(root) {
  root.className = 'page bestiary-page';
  let monsters = load('monsters', []) || [];
  let kills = load('kills', {});
  let focus = new Set(load('focus', []));
  const ui = { q: '', region: '', status: load('bestiaryStatus', 'all') };

  const persist = () => {
    save('monsters', monsters);
    save('kills', kills);
    save('focus', [...focus]);
  };
  const regions = () => [...new Set(monsters.map(m => m.region))];
  const countOf = id => kills[id] || 0;

  root.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Bestiário</h1>
        <p class="muted">Marcos de abate por monstro: ${MILESTONES.map((m, i) => `<span class="pip t${i + 1}">${ROMAN[i + 1]}</span> ${m}`).join(' &nbsp;')}</p>
      </div>
      <div class="head-actions">
        <button class="btn primary" data-act="add">+ Monstro</button>
        <button class="btn" data-act="import">Importar</button>
        <button class="btn" data-act="export">Exportar</button>
      </div>
    </div>
    <div class="summary" id="summary"></div>
    <div class="toolbar">
      <input type="search" id="q" placeholder="Buscar monstro, região ou nota…" aria-label="Buscar">
      <select id="region" aria-label="Região"></select>
      <div class="chips" role="tablist" aria-label="Filtro">
        ${FILTERS.map(([k, l]) => `<button class="chip" role="tab" data-filter="${k}">${l}</button>`).join('')}
      </div>
    </div>
    <div id="list" class="bestiary-page"></div>

    <dialog class="dlg" id="dlg">
      <form method="dialog">
        <h2 id="dlg-title">Novo monstro</h2>
        <label>Nome<input type="text" name="name" required maxlength="60" autocomplete="off"></label>
        <label>Região<input type="text" name="region" list="regions" required maxlength="60" autocomplete="off"></label>
        <div class="row">
          <label>Nível<input type="number" name="level" min="1" max="99"></label>
          <label>Abates<input type="number" name="kills" min="0" max="99999"></label>
        </div>
        <label>Nota / local<input type="text" name="note" maxlength="120" placeholder="Ex.: perto do obelisco norte" autocomplete="off"></label>
        <datalist id="regions"></datalist>
        <div class="dlg-actions">
          <button type="button" class="btn ghost danger" data-act="del">Excluir</button>
          <span class="spacer"></span>
          <button class="btn" value="cancel" formnovalidate>Cancelar</button>
          <button class="btn primary" value="ok">Salvar</button>
        </div>
      </form>
    </dialog>`;

  const $ = s => root.querySelector(s);
  const listEl = $('#list'), dlg = $('#dlg'), form = dlg.querySelector('form');
  const fields = form.elements;

  // ---------- Renderização ----------
  function card(m) {
    const c = countOf(m.id), t = tierOf(c);
    const next = MILESTONES.find(x => c < x);
    let lo = 0;
    const segs = MILESTONES.map((hi, i) => {
      const fill = Math.max(0, Math.min(1, (c - lo) / (hi - lo)));
      lo = hi;
      return `<div class="seg ${c >= hi ? 'reached' : ''}"><div class="track"><i style="width:${fill * 100}%"></i></div><div class="lbl">${ROMAN[i + 1]} · ${hi}</div></div>`;
    }).join('');
    return `
      <article class="mcard tier-${t}" data-id="${esc(m.id)}">
        <header>
          ${entityIcon(isElite(m) ? 'boss' : 'monster', m.name, { size: 36, icon: m.icon })}
          <div>
            <h3 title="${esc(m.name)}">${esc(m.name)}</h3>
            <div class="sub">${m.level ? `Nv. ${m.level}` : ''}${m.level && m.note ? ' · ' : ''}${esc(m.note)}</div>
          </div>
          <button class="mini" data-act="focus" aria-pressed="${focus.has(m.id)}" title="Marcar como farmando agora" aria-label="Farmando agora">★</button>
          <button class="mini" data-act="edit" title="Editar" aria-label="Editar ${esc(m.name)}">✎</button>
        </header>
        <div class="count-row">
          <button class="count" data-act="set" title="Clique para digitar o valor" aria-label="${c} abates, editar">${int(c)}</button>
          <span class="muted">/ ${LAST}</span>
          ${t ? `<span class="pip t${t}" title="Marco ${ROMAN[t]}">${ROMAN[t]}</span>` : ''}
          <span class="next ${next ? '' : 'done'}">${next ? `faltam ${next - c} p/ ${ROMAN[MILESTONES.indexOf(next) + 1]}` : 'Completo ✓'}</span>
        </div>
        <div class="segbar">${segs}</div>
        <div class="actions">
          <button class="btn" data-act="add" data-n="-1" aria-label="Remover 1 abate">−1</button>
          <button class="btn primary" data-act="add" data-n="1" aria-label="Adicionar 1 abate">+1</button>
          <button class="btn" data-act="add" data-n="5" aria-label="Adicionar 5 abates">+5</button>
        </div>
      </article>`;
  }

  function renderSummary() {
    const n = monsters.length || 1;
    const counts = monsters.map(m => countOf(m.id));
    const reached = MILESTONES.map(ms => counts.filter(c => c >= ms).length);
    const done = reached.reduce((a, b) => a + b, 0);
    const total = counts.reduce((a, b) => a + b, 0);
    $('#summary').innerHTML = `
      <div class="stat">
        <div class="l">Progresso geral</div>
        <div class="v">${pct(done / (n * MILESTONES.length), 0)} <small>${done}/${n * MILESTONES.length} marcos · ${int(total)} abates</small></div>
        <div class="bar"><i style="width:${(done / (n * MILESTONES.length)) * 100}%"></i></div>
      </div>
      ${MILESTONES.map((ms, i) => `
        <div class="stat">
          <div class="l"><span class="pip t${i + 1}">${ROMAN[i + 1]}</span> ${ms} abates</div>
          <div class="v">${reached[i]}<small> / ${monsters.length}</small></div>
          <div class="bar"><i style="width:${(reached[i] / n) * 100}%;background:var(--t${i + 1})"></i></div>
        </div>`).join('')}`;
  }

  function regionProgress(region) {
    const ms = monsters.filter(m => m.region === region);
    return `${ms.filter(m => countOf(m.id) >= LAST).length}/${ms.length} completos`;
  }

  function renderList() {
    const q = ui.q.trim().toLowerCase();
    const test = matches[ui.status] || matches.all;
    const visible = monsters.filter(m =>
      (!ui.region || m.region === ui.region) &&
      (!q || `${m.name} ${m.region} ${m.note}`.toLowerCase().includes(q)) &&
      test(m, countOf(m.id), focus));

    if (!visible.length) {
      listEl.innerHTML = `<div class="empty card"><h2>Nada por aqui</h2><p class="muted">${monsters.length ? 'Nenhum monstro corresponde aos filtros.' : 'Com a captura ligada, cada monstro que você mata entra aqui sozinho, com o nome oficial do jogo, e os abates são contados automaticamente. Você também pode usar “+ Monstro” ou importar uma lista.'}</p></div>`;
      return;
    }

    const groups = new Map();
    for (const m of visible) {
      if (!groups.has(m.region)) groups.set(m.region, []);
      groups.get(m.region).push(m);
    }
    let html = '';
    const focused = ui.status === 'all' ? visible.filter(m => focus.has(m.id)) : [];
    if (focused.length) {
      html += `<section class="region"><div class="region-head"><h2>★ Farmando agora</h2><span class="rp">${focused.length}</span></div><div class="mgrid">${focused.map(card).join('')}</div></section>`;
    }
    for (const [region, ms] of groups) {
      ms.sort((a, b) => (a.level || 0) - (b.level || 0) || a.name.localeCompare(b.name));
      html += `<section class="region"><div class="region-head"><h2>${esc(region)}</h2><span class="rp" data-rp="${esc(region)}">${regionProgress(region)}</span></div><div class="mgrid">${ms.map(card).join('')}</div></section>`;
    }
    listEl.innerHTML = html;
  }

  function renderFilters() {
    const rs = regions();
    if (ui.region && !rs.includes(ui.region)) ui.region = '';
    $('#region').innerHTML = `<option value="">Todas as regiões</option>` + rs.map(r => `<option ${r === ui.region ? 'selected' : ''}>${esc(r)}</option>`).join('');
    $('#regions').innerHTML = rs.map(r => `<option value="${esc(r)}">`).join('');
    root.querySelectorAll('[data-filter]').forEach(b => {
      const on = b.dataset.filter === ui.status;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on);
    });
  }

  function renderAll() {
    renderFilters();
    renderSummary();
    renderList();
  }

  /** Atualiza só os cards afetados (rápido e mantém o scroll). */
  function refresh(id, flash) {
    const m = monsters.find(x => x.id === id);
    root.querySelectorAll(`.mcard[data-id="${CSS.escape(id)}"]`).forEach(el => {
      el.outerHTML = card(m);
    });
    if (flash) root.querySelectorAll(`.mcard[data-id="${CSS.escape(id)}"]`).forEach(el => el.classList.add('flash'));
    const rp = root.querySelector(`[data-rp="${CSS.escape(m.region)}"]`);
    if (rp) rp.textContent = regionProgress(m.region);
    renderSummary();
  }

  function setKills(id, value) {
    const before = countOf(id), after = clampKills(value);
    if (after === before) return;
    if (after) kills[id] = after; else delete kills[id];
    persist();
    const gained = tierOf(after) > tierOf(before);
    if (gained) {
      const m = monsters.find(x => x.id === id), t = tierOf(after);
      toast(`${m.name}: marco ${ROMAN[t]} (${MILESTONES[t - 1]}) alcançado!`);
    }
    refresh(id, gained);
  }

  function startInlineEdit(cardEl) {
    const id = cardEl.dataset.id;
    const btn = cardEl.querySelector('.count');
    const input = document.createElement('input');
    input.type = 'number';
    input.min = 0;
    input.className = 'count-input';
    input.value = countOf(id);
    input.setAttribute('aria-label', 'Quantidade de abates');
    btn.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const commit = ok => {
      if (done) return;
      done = true;
      if (ok && clampKills(input.value) !== countOf(id)) setKills(id, input.value);
      else refresh(id);
    };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') commit(true);
      if (e.key === 'Escape') commit(false);
    });
    input.addEventListener('blur', () => commit(true));
  }

  // ---------- Diálogo de adicionar/editar ----------
  let editing = null;
  function openDialog(m) {
    editing = m || null;
    form.reset();
    $('#dlg-title').textContent = m ? 'Editar monstro' : 'Novo monstro';
    form.querySelector('[data-act="del"]').hidden = !m;
    fields.name.value = m?.name || '';
    fields.region.value = m?.region || ui.region || '';
    fields.level.value = m?.level || '';
    fields.kills.value = m ? countOf(m.id) : '';
    fields.note.value = m?.note || '';
    dlg.returnValue = '';
    dlg.showModal();
    fields.name.focus();
  }

  dlg.addEventListener('close', () => {
    if (dlg.returnValue !== 'ok') return;
    const data = {
      name: fields.name.value.trim(),
      region: fields.region.value.trim(),
      level: parseInt(fields.level.value, 10) || null,
      note: fields.note.value.trim(),
    };
    if (!data.name || !data.region) return;
    let m = editing;
    if (m) Object.assign(m, data);
    else monsters.push(m = { id: 'c-' + uid(), ...data });
    const k = clampKills(fields.kills.value);
    if (k) kills[m.id] = k; else delete kills[m.id];
    persist();
    renderAll();
    toast(editing ? 'Monstro atualizado' : 'Monstro adicionado');
  });

  form.querySelector('[data-act="del"]').addEventListener('click', () => {
    if (!editing || !confirm(`Excluir "${editing.name}" e seu progresso?`)) return;
    monsters = monsters.filter(x => x !== editing);
    delete kills[editing.id];
    focus.delete(editing.id);
    persist();
    dlg.close('deleted');
    renderAll();
  });

  // ---------- Eventos ----------
  root.addEventListener('click', async e => {
    const filter = e.target.closest('[data-filter]');
    if (filter) {
      ui.status = filter.dataset.filter;
      save('bestiaryStatus', ui.status);
      renderFilters();
      return renderList();
    }
    const actEl = e.target.closest('[data-act]');
    if (!actEl || dlg.contains(actEl)) return;
    const act = actEl.dataset.act;
    const cardEl = actEl.closest('.mcard');
    const id = cardEl?.dataset.id;

    if (cardEl && act === 'add') return setKills(id, countOf(id) + Number(actEl.dataset.n));
    if (cardEl && act === 'set') return startInlineEdit(cardEl);
    if (cardEl && act === 'focus') {
      focus.has(id) ? focus.delete(id) : focus.add(id);
      persist();
      return renderList();
    }
    if (cardEl && act === 'edit') return openDialog(monsters.find(m => m.id === id));

    if (act === 'add') return openDialog();
    if (act === 'export') return download('bestiario-aion2.json', { monsters, kills, focus: [...focus] });
    if (act === 'import') {
      let data;
      try { data = await pickJson(); } catch { return toast('Arquivo não é um JSON válido'); }
      if (!data) return;
      const list = Array.isArray(data) ? data : data.monsters;
      if (!Array.isArray(list)) return toast('O arquivo precisa ter uma lista "monsters"');
      monsters = list
        .filter(m => m && m.name)
        .map(m => ({ id: String(m.id || 'c-' + uid()), name: String(m.name), region: String(m.region || 'Sem região'), level: parseInt(m.level, 10) || null, note: String(m.note || ''), icon: m.icon ? String(m.icon) : '', elite: !!m.elite }));
      if (data.kills && typeof data.kills === 'object') kills = Object.fromEntries(Object.entries(data.kills).map(([k, v]) => [k, clampKills(v)]));
      if (Array.isArray(data.focus)) focus = new Set(data.focus.map(String));
      persist();
      renderAll();
      toast(`${monsters.length} monstros importados`);
    }
  });

  $('#q').addEventListener('input', e => { ui.q = e.target.value; renderList(); });
  $('#region').addEventListener('change', e => { ui.region = e.target.value; renderList(); });

  renderAll();
}
