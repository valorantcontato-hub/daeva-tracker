// Página inicial: o seu personagem — visual atual, equipamentos e aparência, atualizados sozinhos.
import { classInfo } from '../data/classes.js';
import { classIcon } from '../icons.js';
import { getMe, refreshProfile } from '../profiles.js';
import { esc, int } from '../util.js';

const REFRESH_MS = 60e3;

// Mesma disposição da janela de equipamentos do jogo (pares lado a lado).
const LAYOUT = [
  ['MainHand', 'SubHand'], ['Helmet', 'Shoulder'], ['Torso', 'Pants'], ['Gloves', 'Boots'],
  ['Cape', 'Belt'], ['Necklace', 'Amulet'], ['Earring1', 'Earring2'], ['Ring1', 'Ring2'],
  ['Bracelet1', 'Bracelet2'], ['Rune1', 'Rune2'],
];
const ARCANA = ['Arcana1', 'Arcana2', 'Arcana3', 'Arcana4', 'Arcana5'];
const SKIN_ORDER = ['Helmet', 'Shoulder', 'Torso', 'Pants', 'Gloves', 'Boots', 'Cape'];
const SLOT_PT = {
  MainHand: 'Arma', SubHand: 'Mão secundária', Helmet: 'Elmo', Shoulder: 'Ombreira', Torso: 'Peitoral', Pants: 'Calça',
  Gloves: 'Luvas', Boots: 'Botas', Cape: 'Capa', Belt: 'Cinto', Necklace: 'Colar', Amulet: 'Amuleto',
  Earring1: 'Brinco', Earring2: 'Brinco', Ring1: 'Anel', Ring2: 'Anel', Bracelet1: 'Bracelete', Bracelet2: 'Bracelete',
  Rune1: 'Runa', Rune2: 'Runa', Arcana1: 'Arcana', Arcana2: 'Arcana', Arcana3: 'Arcana', Arcana4: 'Arcana', Arcana5: 'Arcana',
};
const gradeClass = g => 'g-' + String(g || 'common').toLowerCase();

function tile(item, slot, { skin = false } = {}) {
  if (!item) return `<div class="slot empty" title="${esc(SLOT_PT[slot] || slot)}"></div>`;
  const tip = `${item.name}${item.enchant ? ' +' + item.enchant : ''} · ${item.grade || ''} · ${SLOT_PT[item.slot] || item.slot || ''}`;
  return `
    <div class="slot ${gradeClass(item.grade)}" title="${esc(tip)}">
      ${item.icon ? `<img src="${esc(item.icon)}" alt="" loading="lazy">` : ''}
      ${item.enchant ? `<b class="enchant">+${item.enchant}</b>` : ''}
      ${item.exceed ? `<b class="exceed">★${item.exceed}</b>` : ''}
      ${skin ? '<i class="skin-mark">E</i>' : ''}
    </div>`;
}

export function renderHome(root) {
  root.className = 'page home-page';
  let me = getMe();

  if (!me) {
    root.innerHTML = `
      <div class="card empty">
        <h1>Seu personagem aparece aqui</h1>
        <p class="muted">Com o app aberto, entre numa DG ou teleporte no jogo: o Daeva Tracker identifica seu personagem e
        carrega o visual e os equipamentos sozinho.<br>Ou vincule agora pela busca.</p>
        <div class="head-actions"><a class="btn primary" href="#/conta">Buscar meu personagem</a></div>
      </div>`;
    return;
  }

  function render(status = '') {
    const c = classInfo(me.class);
    const bySlot = Object.fromEntries((me.equipment || []).map(e => [e.slot, e]));
    const skins = Object.fromEntries((me.skins || []).map(e => [e.slot, e]));
    const look = [
      ...SKIN_ORDER.filter(s => skins[s]).map(s => tile(skins[s], s, { skin: true })),
      me.wingSkin ? tile({ ...me.wingSkin, slot: 'Asas (visual)' }, 'Wings', { skin: true }) : '',
      me.wings ? tile({ ...me.wings, slot: 'Asas' }, 'Wings') : '',
      me.pet ? tile({ ...me.pet, slot: `Mascote · nível ${me.pet.level}` }, 'Pet') : '',
    ].join('');

    root.innerHTML = `
      <section class="hero card" style="--c:${c.color}">
        <div class="portrait">
          ${me.image ? `<img src="${esc(me.image)}" alt="Visual de ${esc(me.name)}">` : classIcon(me.class, 120)}
        </div>
        <div class="hero-info">
          <div class="eyebrow">${esc(me.serverName)} · ${esc(me.race)}</div>
          <h1 class="hero-name">${esc(me.name)}</h1>
          ${me.title ? `<div class="hero-title">${esc(me.title)}</div>` : ''}
          <div class="meta">${classIcon(me.class, 22)}<b style="color:${c.color}">${esc(c.name)}</b><span>Nível ${me.level}</span></div>
          <div class="hero-stats">
            <div><span>Combat Power</span><b>${int(me.combatPower || 0)}</b></div>
            <div><span>Item Level</span><b>${me.itemLevel != null ? int(me.itemLevel) : '—'}</b></div>
          </div>
          <div class="live-line small muted"><span class="live-dot"></span><span id="sync">${status || syncText()}</span>
            <button class="btn sm ghost" data-act="refresh">Atualizar agora</button></div>
        </div>
      </section>

      <div class="home-grid">
        <section class="card">
          <div class="card-head"><h2>Equipamentos</h2><span class="muted small">${(me.equipment || []).length} itens</span></div>
          <div class="gear">
            ${LAYOUT.map(([a, b]) => `<div class="gear-row">${tile(bySlot[a], a)}${tile(bySlot[b], b)}</div>`).join('')}
          </div>
          <div class="card-head" style="margin-top:14px"><h3>Arcanas</h3></div>
          <div class="gear-row arcana">${ARCANA.map(s => tile(bySlot[s], s)).join('')}</div>
        </section>

        <section class="card">
          <div class="card-head"><h2>Aparência equipada</h2></div>
          <div class="look">${look || '<p class="muted small">Sem itens de aparência.</p>'}</div>
          <div class="card-head" style="margin-top:16px"><h2>Itens</h2></div>
          <div class="item-list">
            ${[...LAYOUT.flat(), ...ARCANA].map(s => bySlot[s]).filter(Boolean).map(e => `
              <div class="item-row ${gradeClass(e.grade)}">
                ${tile(e, e.slot)}
                <span class="item-txt"><b>${esc(e.name)}${e.enchant ? ` <span class="muted">+${e.enchant}</span>` : ''}</b>
                <span class="small muted">${esc(SLOT_PT[e.slot] || e.slot)} · <span class="grade-txt">${esc(e.grade)}</span></span></span>
              </div>`).join('')}
          </div>
        </section>
      </div>`;
  }

  const syncText = () => `Atualizado às ${new Date(me.fetchedAt).toLocaleTimeString('pt-BR')} · fonte: site oficial (PlayNC)`;

  async function refresh() {
    if (!root.isConnected) return clearInterval(timer);
    const el = root.querySelector('#sync');
    if (el) el.textContent = 'Atualizando…';
    try {
      me = await refreshProfile(me);
      render();
    } catch (e) {
      if (el) el.textContent = `Não foi possível atualizar (${e.message})`;
    }
  }

  root.addEventListener('click', e => {
    if (e.target.closest('[data-act="refresh"]')) refresh();
  });
  const timer = setInterval(refresh, REFRESH_MS);
  render();
  refresh();
}
