// Skills do seu personagem, separadas em ativas, passivas e stigmas (dados do site oficial).
import { classInfo } from '../data/classes.js';
import { getMe } from '../profiles.js';
import { classIcon } from '../icons.js';
import { esc } from '../util.js';

const GROUPS = [
  ['Active', 'Skills ativas', 'As skills que contam no widget de DPS.'],
  ['Passive', 'Skills passivas', ''],
  ['Dp', 'Stigmas', ''],
];

const tile = s => `
  <div class="skill-tile ${s.equipped ? 'equipped' : 'idle'}" data-tip="${esc([s.name, `Nível ${s.level}`, s.equipped ? '✔ Equipada' : 'Não equipada'].join('\n'))}">
    <span class="skill-ico">${s.icon ? `<img src="${esc(s.icon)}" alt="" draggable="false" loading="lazy">` : ''}<b>${s.level}</b></span>
    <span class="skill-name">${esc(s.name)}</span>
  </div>`;

export function renderSkills(root, _params, profile) {
  root.className = 'page skills-page';
  const me = profile || getMe();
  if (!me) {
    root.innerHTML = `<div class="card empty"><h1>Skills</h1><p class="muted">Vincule o seu personagem para ver as skills.</p>
      <div class="head-actions"><a class="btn primary" href="#/conta">Buscar meu personagem</a></div></div>`;
    return;
  }
  const c = classInfo(me.class);
  root.innerHTML = `
    <div class="page-head"><div><h1>Skills</h1>
      <p class="muted" style="display:flex;align-items:center;gap:8px">${classIcon(me.class, 20)}<b style="color:${c.color}">${esc(c.name)}</b> · ${esc(me.name)}</p></div></div>
    ${GROUPS.map(([key, title, hint]) => {
      const list = (me.skills || []).filter(s => s.category === key).sort((a, b) => b.equipped - a.equipped || b.level - a.level);
      if (!list.length) return '';
      return `<section class="card">
        <div class="card-head"><h2>${title}</h2><span class="muted small">${list.filter(s => s.equipped).length} equipadas · ${list.length} no total</span></div>
        ${hint ? `<p class="muted small" style="margin:-4px 0 10px">${hint}</p>` : ''}
        <div class="skill-grid">${list.map(tile).join('')}</div>
      </section>`;
    }).join('')}`;
}
