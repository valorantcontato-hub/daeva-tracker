import { readAccountState } from '../account-state.js';
import { currentAccountCounter } from '../account-model.js';
import { int } from '../util.js';

const kinahIcon = '<img src="./icons/account-kinah.webp" alt="" draggable="false">';
const energyIcon = '<img src="./icons/account-od-energy.webp" alt="" draggable="false">';
const icon = (symbol, css) => `<span class="resource-icon ${css}" aria-hidden="true">${symbol}</span>`;
const wait = 'Aguardando dados do jogo';
const remaining = time => {
  const minutes = Math.max(0, Math.ceil((time - Date.now()) / 60000));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
};

export function accountResourcesHtml(me) {
  const state = readAccountState(me), energy = state?.odEnergy;
  const duty = currentAccountCounter(state?.dutyMissions), craft = currentAccountCounter(state?.craftOdyleEnergy);
  const fill = energy?.max ? Math.max(0, Math.min(100, energy.current / energy.max * 100)) : 0;
  const refill = energy?.nextRefillAt && Date.parse(energy.nextRefillAt) > Date.now() ? remaining(Date.parse(energy.nextRefillAt)) : null;
  return `<div class="resource-row" title="${state?.kinah == null ? wait : 'Saldo lido do personagem conectado'}">${icon(kinahIcon, 'kinah-icon')}<span>Kinah</span><b>${state?.kinah == null ? '—' : int(state.kinah)}</b></div>
    <div class="resource-energy" title="${energy ? 'Energia normal e energia carregada do personagem conectado' : wait}">
      ${icon(energyIcon, 'energy-icon')}
      <div class="energy-content"><div class="energy-top"><span class="energy-label">Od Energy</span><span class="energy-amount"><b>${energy ? int(energy.current) : '—'}</b>${energy?.bonus ? ` <em>(+${int(energy.bonus)})</em>` : ''}<small>/${energy?.max ? int(energy.max) : '—'}</small></span><span class="energy-refill">${refill ? `Recarga em <b>${refill}</b>` : energy?.max && energy.current >= energy.max ? 'Completa' : 'Recarga: —'}</span></div><div class="energy-track"><i style="width:${fill}%"></i></div></div>
    </div>
    <div class="resource-row" title="${duty ? 'Missões concluídas neste período' : wait}">${icon('☷', 'duty-icon')}<span>Duty Missions</span><b>${duty ? int(duty.completed) : '—'}<small>/${duty?.max || 5}</small></b></div>
    <div class="resource-row" title="${craft ? 'Fabricações usadas nesta semana' : wait}">${icon('◇', 'craft-icon')}<span>Craft Odyle Energy</span><b>${craft ? int(craft.crafted) : '—'}<small>/${craft?.max || 20}</small></b></div>`;
}

export function wireAccountResources(root, profile) {
  const timer = setInterval(() => {
    if (!root.isConnected) return clearInterval(timer);
    const el = root.querySelector('.account-resources');
    if (el && !document.hidden) el.innerHTML = accountResourcesHtml(profile());
  }, 1000);
}
