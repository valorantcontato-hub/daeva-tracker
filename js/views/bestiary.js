import { load, save } from '../store.js';
import { MILESTONES } from '../data/monsters.js';
import { esc, int, pct, uid, download, pickJson, toast } from '../util.js';
import { getMe } from '../profiles.js';
import { readBestiary, writeBestiary, imageUrl, bestiaryKey } from '../bestiary-state.js';
import { mergeMonsterCatalog } from '../monster-catalog.js';

export const ROMAN = ['', 'I', 'II', 'III'];
export const LAST = MILESTONES[MILESTONES.length - 1];
export const tierOf = c => MILESTONES.filter(m => c >= m).length;
export const isElite = m => !!m.elite || /\belite\b/i.test(m.note || '');
export const clampKills = v => Math.max(0, Math.min(99999, Math.floor(Number(v) || 0)));

const FILTERS = [
  ['all', 'Todos'], ['focus', '★ Farmando'], ['progress', 'Em progresso'], ['todo', 'Sem abates registrados'], ['done', 'Completo'],
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
  let monsters = mergeMonsterCatalog(load('monsters', []) || []);
  const me = getMe();
  const state = readBestiary(me);
  let kills = state.kills;
  let focus = new Set(state.focus);
  const ui = { q: '', region: '', page: 0, status: load('bestiaryStatus', 'all') };
  const PAGE_SIZE = 60;

  const persist = () => {
    const stored = new Map(load('monsters', []).map(m => [m.id, m]));
    for (const m of monsters) if (!m.sourceSlug || m.customized || m.recorded) stored.set(m.id, m);
    save('monsters', [...stored.values()]);
    monsters = mergeMonsterCatalog([...stored.values()]);
    writeBestiary({ kills, focus }, me);
  };
  const regions = () => [...new Set(monsters.flatMap(m => [m.region, ...(m.maps || [])]).filter(Boolean))].sort();
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
    <p class="note bestiary-source">${esc(me?.name || 'Sem personagem vinculado')} · Catálogo de monstros com fotos quando disponíveis. Os abates são os registrados neste app; o histórico anterior da conta não é sincronizado. Zero registrado não confirma que esteja faltando no jogo.</p>
    <div class="summary" id="summary"></div>
    <div class="toolbar">
      <input type="search" id="q" placeholder="Buscar monstro, região ou nota…" aria-label="Buscar">
      <select id="region" aria-label="Região"></select>
      <div class="chips" role="tablist" aria-label="Filtro">
        ${FILTERS.map(([k, l]) => `<button class="chip" role="tab" data-filter="${k}">${l}</button>`).join('')}
      </div>
    </div>
    <div id="list" class="bestiary-page"></div>
    <div class="bestiary-pagination"><button class="btn sm" data-act="previous">Anterior</button><span class="small muted" id="bestiary-page-count"></span><button class="btn sm" data-act="next">Próxima</button></div>

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
        <label>Foto do monstro<input type="url" name="icon" maxlength="2000" placeholder="https://…" autocomplete="off"></label>
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
          <span class="monster-photo">${imageUrl(m.icon) ? `<img src="${esc(imageUrl(m.icon))}" alt="${esc(m.name)}" draggable="false" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>Foto indisponível</span>` : '<span>Sem foto</span>'}</span>
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
        <div class="l">Progresso registrado</div>
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
    const ms = monsters.filter(m => m.region === region || m.maps?.includes(region));
    return `${ms.filter(m => countOf(m.id) >= LAST).length}/${ms.length} completos`;
  }

  function renderList() {
    const q = ui.q.trim().toLowerCase();
    const test = matches[ui.status] || matches.all;
    const visible = monsters.filter(m =>
      (!ui.region || m.region === ui.region || m.maps?.includes(ui.region)) &&
      (!q || `${m.name} ${m.region} ${m.note}`.toLowerCase().includes(q)) &&
      test(m, countOf(m.id), focus));

    const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    ui.page = Math.min(ui.page, pages - 1);
    const first = ui.page * PAGE_SIZE;
    $('#bestiary-page-count').textContent = `${visible.length ? first + 1 : 0}–${Math.min(first + PAGE_SIZE, visible.length)} / ${visible.length} monstros`;
    $('[data-act="previous"]').disabled = ui.page === 0;
    $('[data-act="next"]').disabled = ui.page + 1 >= pages;

    if (!visible.length) {
      listEl.innerHTML = `<div class="empty card"><h2>Nada por aqui</h2><p class="muted">${monsters.length ? 'Nenhum monstro corresponde aos filtros.' : 'Com a captura ligada, cada monstro que você mata entra aqui sozinho, com o nome oficial do jogo, e os abates são contados automaticamente. Você também pode usar “+ Monstro” ou importar uma lista.'}</p></div>`;
      return;
    }

    const groups = new Map();
    const shown = visible.slice(first, first + PAGE_SIZE);
    const focused = ui.status === 'all' ? shown.filter(m => focus.has(m.id)) : [];
    const featured = new Set(focused.map(m => m.id));
    for (const m of shown) {
      if (featured.has(m.id)) continue;
      const region = ui.region || m.region;
      if (!groups.has(region)) groups.set(region, []);
      groups.get(region).push(m);
    }
    let html = '';
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

  /** Reaplica os filtros quando o contador muda de faixa (por exemplo, ficou completo). */
  function refresh(id, flash) {
    renderAll();
    if (flash) root.querySelectorAll(`.mcard[data-id="${CSS.escape(id)}"]`).forEach(el => el.classList.add('flash'));
  }

  function setKills(id, value) {
    const fresh = readBestiary(me);
    kills = fresh.kills; focus = new Set(fresh.focus);
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
    form.querySelector('[data-act="del"]').hidden = !m || !!m.sourceSlug;
    fields.name.value = m?.name || '';
    fields.region.value = m?.region || ui.region || '';
    fields.level.value = m?.level || '';
    fields.kills.value = m ? countOf(m.id) : '';
    fields.note.value = m?.note || '';
    fields.icon.value = imageUrl(m?.icon);
    dlg.returnValue = '';
    dlg.showModal();
    fields.name.focus();
  }

  dlg.addEventListener('close', () => {
    if (dlg.returnValue !== 'ok') return;
    const fresh = readBestiary(me);
    kills = fresh.kills; focus = new Set(fresh.focus);
    const data = {
      name: fields.name.value.trim(),
      region: fields.region.value.trim(),
      level: parseInt(fields.level.value, 10) || null,
      note: fields.note.value.trim(),
      icon: imageUrl(fields.icon.value.trim()),
      customized: true,
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
    save('monsters', load('monsters', []).filter(m => m.id !== editing.id));
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
      ui.page = 0;
      save('bestiaryStatus', ui.status);
      renderFilters();
      return renderList();
    }
    const actEl = e.target.closest('[data-act]');
    if (!actEl || dlg.contains(actEl)) return;
    const act = actEl.dataset.act;
    const cardEl = actEl.closest('.mcard');
    const id = cardEl?.dataset.id;

    if (act === 'previous' || act === 'next') {
      ui.page = Math.max(0, ui.page + (act === 'next' ? 1 : -1));
      renderList();
      return root.querySelector('.toolbar').scrollIntoView({ block: 'start' });
    }

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
        .map(m => ({ id: String(m.id || 'c-' + uid()), npcCode: Number(m.npcCode) || 0, name: String(m.name), region: String(m.region || 'Sem região'), level: parseInt(m.level, 10) || null, note: String(m.note || ''), icon: imageUrl(m.icon), elite: !!m.elite, customized: true }));
      monsters = mergeMonsterCatalog(monsters);
      if (data.kills && typeof data.kills === 'object') kills = Object.fromEntries(Object.entries(data.kills).map(([k, v]) => [k, clampKills(v)]));
      if (Array.isArray(data.focus)) focus = new Set(data.focus.map(String));
      persist();
      renderAll();
      toast(`${monsters.length} monstros importados`);
    }
  });

  $('#q').addEventListener('input', e => { ui.q = e.target.value; ui.page = 0; renderList(); });
  $('#region').addEventListener('change', e => { ui.region = e.target.value; ui.page = 0; renderList(); });

  const onData = () => {
    if (!root.isConnected) {
      removeEventListener('a2t:changed', onData); removeEventListener('storage', onData);
      return;
    }
    if (bestiaryKey(me) !== bestiaryKey()) return dispatchEvent(new HashChangeEvent('hashchange'));
    if (dlg.open || root.querySelector('.count-input')) return;
    const latest = readBestiary(me);
    kills = latest.kills; focus = new Set(latest.focus);
    monsters = mergeMonsterCatalog(load('monsters', []));
    renderAll();
  };
  addEventListener('a2t:changed', onData);
  addEventListener('storage', onData);

  renderAll();
}
