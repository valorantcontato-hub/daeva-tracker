import { load, save } from '../store.js';
import { esc, int } from '../util.js';
import { getMe } from '../profiles.js';
import { readBestiary, writeBestiary, imageUrl, bestiaryKey } from '../bestiary-state.js';
import { mergeMonsterCatalog } from '../monster-catalog.js';
import { getPetCatalog, readCollection } from '../collection.js';
import { petProgress } from '../collection-state.js';

const FILTERS = [['all','Todos'],['focus','★ Farmando'],['progress','Em progresso'],['todo','Faltando'],['done','Completos'],['unknown','Não sincronizados']];
export function renderBestiary(root) {
  root.className = 'page bestiary-page';
  const me = getMe(), PAGE_SIZE = 60;
  let monsters, state, collection;
  const ui = { q:'', region:'', page:0, status:'all', mode:load('bestiaryMode','collection') };
  root.innerHTML = `<div class="page-head"><div><h1>Bestiário</h1><p class="muted small">${esc(me?.name || 'Sem personagem vinculado')}</p></div></div>
    <div class="chips"><button class="chip" data-mode="collection">Coleção do jogo</button><button class="chip" data-mode="monsters">Monstros · abates do app</button></div>
    <p class="note small" id="collection-status"></p>
    <div class="toolbar"><input type="search" id="q" placeholder="Buscar monstro ou região…" aria-label="Buscar"><select id="region" aria-label="Região"></select>
      <div class="chips" role="tablist" aria-label="Filtro">${FILTERS.map(([k,l])=>`<button class="chip" data-filter="${k}" role="tab">${l}</button>`).join('')}</div></div>
    <div class="small muted" id="bestiary-summary"></div><div id="list" class="bestiary-page compact-monsters"></div>
    <div class="bestiary-pagination"><button class="btn sm" data-page="-1">Anterior</button><span class="small muted" id="bestiary-page-count"></span><button class="btn sm" data-page="1">Próxima</button></div>`;
  const $ = selector => root.querySelector(selector);
  const progress = m => m.petId ? petProgress(collection,m.petId) : {known:false,percent:0};
  function card(m) {
    const p = progress(m), c = state.kills[m.id] || 0, focused = state.focus.includes(m.id);
    const label = m.petId ? !p.known ? 'Não sincronizado' : p.complete ? 'Completo · III' : `Nv. ${p.level} · ${p.points}/${p.goal} almas` : `${int(c)} abates no app`;
    const tip = `${m.name}\n${label}${m.petId && p.known ? '\n' + p.remaining + ' almas até o nível III' : ''}${m.note ? '\n' + m.note : ''}`;
    return `<article class="mcard monster-line tier-${p.level || 0}" data-id="${esc(m.id)}" data-tip="${esc(tip)}">
      <i class="monster-fill" style="width:${p.percent}%"></i>
      <span class="monster-photo">${imageUrl(m.icon) ? `<img src="${esc(m.icon)}" alt="" loading="lazy" draggable="false" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>Sem foto</span>` : '<span>Sem foto</span>'}</span>
      <span class="monster-name"><b>${esc(m.name)}</b><small class="muted">${esc(m.region || 'Sem região')}</small></span>
      <span class="monster-count"><b class="count small">${esc(label)}</b></span>
      <button class="mini" data-favorite="${esc(m.id)}" aria-pressed="${focused}" aria-label="${focused ? 'Remover dos favoritos' : 'Favoritar'} ${esc(m.name)}">★</button></article>`;
  }
  function renderList() {
    const q = ui.q.trim().toLowerCase();
    const visible = monsters.filter(m => {
      const p = progress(m);
      const matches = ui.status === 'focus' ? state.focus.includes(m.id) : ui.status === 'progress' ? p.known && !p.complete && p.total > 0 : ui.status === 'todo' ? p.known && !p.complete : ui.status === 'done' ? p.complete : ui.status === 'unknown' ? !p.known : true;
      return matches && (!ui.region || m.maps?.includes(ui.region) || m.region === ui.region) && (!q || `${m.name} ${m.note} ${m.maps?.join(' ')}`.toLowerCase().includes(q));
    });
    const pages = Math.max(1,Math.ceil(visible.length/PAGE_SIZE)); ui.page = Math.min(ui.page,pages-1);
    const first = ui.page*PAGE_SIZE;
    $('#bestiary-page-count').textContent = `${visible.length ? first+1 : 0}–${Math.min(first+PAGE_SIZE,visible.length)} / ${visible.length}`;
    $('[data-page="-1"]').disabled = ui.page===0; $('[data-page="1"]').disabled = ui.page+1>=pages;
    root.querySelectorAll('[data-filter]').forEach(el=> {const on=el.dataset.filter===ui.status; el.classList.toggle('active',on);el.setAttribute('aria-selected',on);});
    root.querySelectorAll('[data-mode]').forEach(el=>el.classList.toggle('active',el.dataset.mode===ui.mode));
    $('#bestiary-summary').textContent = ui.mode==='collection' ? `${monsters.filter(m=>progress(m).complete).length} / ${monsters.length} completos · ${state.focus.length} favoritos` : `${monsters.length} monstros · Abates locais não indicam a conclusão da coleção`;
    $('#collection-status').textContent = ui.mode!=='collection' ? 'Abates observados pelo app. Esse histórico não recupera abates anteriores e não equivale às almas da coleção.' : collection ? `Coleção recebida do jogo em ${new Date(collection.capturedAt).toLocaleString()}. O último estado fica salvo para este personagem.` : 'Aguardando a coleção do jogo. Com a captura atualizada e ligada, volte à seleção de personagens e entre novamente. Até receber a lista, o progresso fica desconhecido.';
    const groups = new Map();
    for (const m of visible.slice(first,first+PAGE_SIZE)) {const region=ui.region||m.region||'Sem região';if(!groups.has(region))groups.set(region,[]);groups.get(region).push(m);}
    $('#list').innerHTML = [...groups].map(([region,entries])=>`<section class="region"><div class="region-head"><h2>${esc(region)}</h2></div><div class="monster-lines">${entries.map(card).join('')}</div></section>`).join('') || '<p class="muted small">Nenhum monstro corresponde aos filtros.</p>';
  }
  function refresh() {
    if (!root.isConnected) {removeEventListener('storage',refresh);removeEventListener('a2t:changed',refresh);return;}
    if (bestiaryKey(me)!==bestiaryKey()) return dispatchEvent(new HashChangeEvent('hashchange'));
    state=readBestiary(me); collection=readCollection(me);
    monsters=ui.mode==='collection' ? getPetCatalog().map(p=>({id:'pet-'+p.id,petId:p.id,name:p.name,icon:p.icon,region:p.family,maps:[...new Set(p.mobs.flatMap(m=>m.maps))],note:p.mobs.map(m=>m.name).join(', ')})) : mergeMonsterCatalog(load('monsters',[]));
    const regions=[...new Set(monsters.flatMap(m=>[m.region,...(m.maps||[])]).filter(Boolean))].sort();
    $('#region').innerHTML='<option value="">Todas as regiões</option>'+regions.map(r=>`<option value="${esc(r)}" ${r===ui.region?'selected':''}>${esc(r)}</option>`).join('');
    renderList();
  }
  root.addEventListener('click',e=> {
    const star=e.target.closest('[data-favorite]'),filter=e.target.closest('[data-filter]'),page=e.target.closest('[data-page]'),mode=e.target.closest('[data-mode]');
    if(star) {const fresh=readBestiary(me),favorites=new Set(fresh.focus);favorites.has(star.dataset.favorite)?favorites.delete(star.dataset.favorite):favorites.add(star.dataset.favorite);writeBestiary({...fresh,focus:favorites},me);state=readBestiary(me);renderList();}
    if(filter) {ui.status=filter.dataset.filter;ui.page=0;renderList();}
    if(page) {ui.page=Math.max(0,ui.page+Number(page.dataset.page));renderList();$('.toolbar').scrollIntoView({block:'start'});}
    if(mode) {ui.mode=mode.dataset.mode;ui.status='all';ui.region='';ui.page=0;save('bestiaryMode',ui.mode);refresh();}
  });
  $('#q').addEventListener('input',e=>{ui.q=e.target.value;ui.page=0;renderList();});
  $('#region').addEventListener('change',e=>{ui.region=e.target.value;ui.page=0;renderList();});
  addEventListener('storage',refresh);addEventListener('a2t:changed',refresh);refresh();
}
