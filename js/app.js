import { renderDps } from './views/dps.js';
import { renderBestiary } from './views/bestiary.js';
import { renderAccount } from './views/account.js';
import { renderHome } from './views/home.js';
import { lockApp } from './lock.js';
import { initTooltips, hideTooltip } from './tooltip.js';
import { renderWidgetsPage, renderWidget } from './views/widgets.js';
import { loadIconManifest } from './icons.js';
import { startLive } from './live.js';
import { initDesktopBanner } from './desktop.js';
import { load, save } from './store.js';

const view = document.getElementById('view');
const routes = { inicio: renderHome, dps: renderDps, bestiario: renderBestiary, conta: renderAccount, widgets: renderWidgetsPage, w: renderWidget };

function route() {
  hideTooltip();
  const [name, ...params] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  // Skills e Daevanion agora vivem dentro do Início (menu do personagem).
  if (name === 'skills' || name === 'daevanion') return void location.replace('#/inicio/' + name);
  const key = routes[name] ? name : 'inicio';
  // #/w/<id> = widget isolado (janela de overlay): sem cabeçalho, fundo transparente.
  document.documentElement.classList.toggle('widget-mode', key === 'w');
  document.querySelectorAll('[data-route]').forEach(a => {
    const on = a.dataset.route === key;
    a.classList.toggle('active', on);
    a.toggleAttribute('aria-current', on);
  });
  // Um container novo por rota: os listeners da view anterior vão embora junto.
  const root = document.createElement('div');
  view.replaceChildren(root);
  routes[key](root, params);
}

document.getElementById('theme-toggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  save('theme', next);
});

addEventListener('hashchange', route);
// Mudanças feitas em outra janela (ex.: +1 no widget de Farm) ou pela captura atualizam a tela.
function refreshOnData(e) {
  if (document.documentElement.classList.contains('widget-mode')) return;
  if (e.type === 'storage' && !/^a2t:(kills|focus|monsters|encounters|me|party)$/.test(e.key || '')) return;
  if (document.querySelector('dialog[open]') || document.activeElement?.matches('input, select')) return;
  route();
}
addEventListener('storage', refreshOnData);
addEventListener('a2t:changed', refreshOnData);

// Uma vez: remove os dados fictícios das versões anteriores (lutas de exemplo e monstros sem progresso).
if (!load('realDataOnly', false)) {
  save('encounters', load('encounters', []).filter(e => !e.sample));
  const kills = load('kills', {});
  save('monsters', load('monsters', []).filter(m => !/^(bs|pr|pe|ra)-\d\d$/.test(m.id) || kills[m.id]));
  save('realDataOnly', true);
}
// Interface atualizada (dev ao salvar, ou atualização ao vivo do app instalado): recarrega a janela.
if (typeof EventSource !== 'undefined') {
  new EventSource('/api/reload/stream').onmessage = () => location.reload();
}

lockApp();
initTooltips();
await loadIconManifest();
startLive();
route();
initDesktopBanner();
