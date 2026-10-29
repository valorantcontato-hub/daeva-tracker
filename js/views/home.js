// Página inicial: o seu personagem — visual atual, equipamentos e aparência, atualizados sozinhos.
import { classInfo } from '../data/classes.js';
import { classIcon } from '../icons.js';
import { getMe, refreshProfile } from '../profiles.js';
import { setTooltipContext } from '../tooltip.js';
import { esc, int } from '../util.js';

const REFRESH_MS = 60e3;

// Mesma disposição da janela de equipamentos do jogo (pares lado a lado).
const GEAR = [
  ['MainHand', 'SubHand'], ['Helmet', 'Shoulder'], ['Torso', 'Pants'], ['Gloves', 'Boots'],
  ['Cape', 'Belt'], ['Necklace', 'Amulet'], ['Earring1', 'Earring2'], ['Ring1', 'Ring2'],
  ['Bracelet1', 'Bracelet2'], ['Rune1', 'Rune2'],
];
const ARCANA = ['Arcana1', 'Arcana2', 'Arcana3', 'Arcana4', 'Arcana5'];
// Aparência: os mesmos pares na vertical.
const LOOK = [['Helmet', 'Shoulder'], ['Torso', 'Pants'], ['Gloves', 'Boots'], ['Cape', 'Wings'], ['WingSkin', 'Pet']];
const gradeClass = g => 'g-' + String(g || 'common').toLowerCase();

/** Casa de item. Itens equipados (com slotPos numérico) mostram o detalhe real ao passar o mouse. */
function tile(item, { skin = false } = {}) {
  if (!item) return '<div class="slot empty"></div>';
  const detail = !skin && item.id && Number.isInteger(item.slotPos) ? `${item.id}|${item.enchant || 0}|${item.slotPos}` : `${item.id || 0}|0|x`;
  return `
    <div class="slot ${gradeClass(item.grade)}" data-item="${esc(detail)}" data-name="${esc(item.name)}" data-grade="${esc(item.grade || '')}" data-icon="${esc(item.icon || '')}">
      ${item.icon ? `<img src="${esc(item.icon)}" alt="" draggable="false">` : ''}
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
        <p class="muted">O jogo só informa o nome do personagem ao teleportar ou entrar numa DG. Faça um desses com o app aberto e o
        Daeva Tracker carrega o visual e os equipamentos sozinho — nas próximas vezes ele já lembra de você.<br>
        Ou vincule agora pela busca.</p>
        <div class="head-actions"><a class="btn primary" href="#/conta">Buscar meu personagem</a></div>
      </div>`;
    return;
  }

  function render() {
    setTooltipContext(me);
    const c = classInfo(me.class);
    const bySlot = Object.fromEntries((me.equipment || []).map(e => [e.slot, e]));
    const skins = Object.fromEntries((me.skins || []).map(e => [e.slot, e]));
    const extras = { Wings: me.wings, WingSkin: me.wingSkin, Pet: me.pet };
    const lookTile = slot => tile(skins[slot] || extras[slot], { skin: true });

    root.innerHTML = `
      <section class="hero card" style="--c:${c.color}">
        <div class="portrait">
          ${me.image ? `<img src="${esc(me.image)}" alt="" draggable="false">` : classIcon(me.class, 120)}
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
          ${window.desktop ? `<label class="switch small" title="A captura já fica rodando quando o jogo abrir, e o app reconhece o personagem sozinho">
            <input type="checkbox" id="autostart"> Abrir com o Windows</label>` : ''}
        </div>
      </section>

      <div class="home-grid">
        <section class="card">
          <div class="card-head"><h2>Equipamentos</h2></div>
          <div class="gear">
            ${GEAR.map(([a, b]) => `<div class="gear-row">${tile(bySlot[a])}${tile(bySlot[b])}</div>`).join('')}
          </div>
          <div class="card-head" style="margin-top:14px"><h3>Arcanas</h3></div>
          <div class="gear-row arcana">${ARCANA.map(s => tile(bySlot[s])).join('')}</div>
        </section>

        <section class="card">
          <div class="card-head"><h2>Aparência</h2></div>
          <div class="gear">
            ${LOOK.map(([a, b]) => `<div class="gear-row">${lookTile(a)}${lookTile(b)}</div>`).join('')}
          </div>
        </section>

        <section class="card stats-card">
          <div class="card-head"><h2>Atributos</h2></div>
          <div class="stat-list">${(me.stats || []).map(s => `
            <div class="stat-row"><span>${esc(s.name)}</span><b>${int(s.value)}</b></div>`).join('')}
          </div>
        </section>
      </div>`;
    window.desktop?.status().then(s => { const box = root.querySelector('#autostart'); if (box) box.checked = !!s.autostart; });
  }

  // Atualiza em silêncio a cada minuto (troca de equipamento no jogo aparece sozinha).
  async function refresh() {
    if (!root.isConnected) return clearInterval(timer);
    try {
      me = await refreshProfile(me);
      render();
    } catch { /* sem internet ou PlayNC fora do ar: mantém o que já está na tela */ }
  }

  root.addEventListener('change', e => {
    if (e.target.id === 'autostart') window.desktop?.setAutostart(e.target.checked);
  });
  const timer = setInterval(refresh, REFRESH_MS);
  render();
  refresh();
}
