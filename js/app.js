import { renderDps } from './views/dps.js';
import { renderTraining } from './views/training.js';
import { startTrainingRecorder } from './training.js';
import { renderBestiary } from './views/bestiary.js';
import { renderAccount } from './views/account.js';
import { renderHome } from './views/home.js';
import { lockApp } from './lock.js';
import { initTooltips, hideTooltip, setTooltipContext } from './tooltip.js';
import { initI18n } from './i18n.js';
import { getLang, setLang, LANGS } from './lang.js';
import { getMe, relocalizeProfiles, needsRelocalization } from './profiles.js';
import { renderWidgetsPage, renderWidget } from './views/widgets.js';
import { loadIconManifest } from './icons.js';
import { loadMonsterCatalog } from './monster-catalog.js';
import { startLive } from './live.js';
import { loadPetCatalog, startCollection } from './collection.js';
import { initDesktopBanner } from './desktop.js';
import { load, save, notifyChange } from './store.js';

const view = document.getElementById('view');
const routes = { inicio: renderHome, boss: renderDps, treinamento: renderTraining, bestiario: renderBestiary, conta: renderAccount, widgets: renderWidgetsPage, w: renderWidget };

function route() {
  hideTooltip();
  const [name, ...params] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  if (name === 'dps') return void location.replace('#/boss' + (params.length ? '/' + params.map(encodeURIComponent).join('/') : ''));
  // Skills e Daevanion agora vivem dentro do Início (menu do personagem).
  if (['skills', 'daevanion'].includes(name)) return void location.replace('#/inicio/' + name);
  const key = routes[name] ? name : 'inicio';
  // #/w/<id> = widget isolado (janela de overlay): sem cabeçalho, fundo transparente.
  document.documentElement.classList.toggle('widget-mode', key === 'w');
  document.documentElement.classList.toggle('home-fit', key === 'inicio' && !params[0]);
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

document.documentElement.dataset.theme = 'dark';
save('theme', 'dark');
// Fit the overview to the real space left by the title bar, update banner and navigation.
const measureShell = () => {
  for (const [variable,selector] of [['topbar','.topbar'],['navigation','.tabs'],['banner','#app-banner']])
    document.documentElement.style.setProperty(`--${variable}-height`, `${document.querySelector(selector)?.getBoundingClientRect().height || 0}px`);
};
const shellObserver = new ResizeObserver(measureShell);
for (const selector of ['.topbar','.tabs','#app-banner']) if (document.querySelector(selector)) shellObserver.observe(document.querySelector(selector));
measureShell();

addEventListener('hashchange', route);
// Mudanças feitas em outra janela (ex.: +1 no widget de Farm) ou pela captura atualizam a tela.
function refreshOnData(e) {
  if (document.documentElement.classList.contains('widget-mode')) return;
  if (e.type === 'storage' && !/^a2t:(kills|focus|monsters|encounters|me|party|bestiary:.*)$/.test(e.key || '')) return;
  // O bestiário atualiza os contadores preservando busca, filtros e página atual.
  if (view.firstElementChild?.classList.contains('bestiary-page')) return;
  if (view.firstElementChild?.classList.contains('training-page')) return;
  if (document.querySelector('dialog[open]') || document.activeElement?.matches('input, select, textarea')) return;
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

// App desktop: janela sem barra do Windows; o topo do app arrasta a janela e tem minimizar/fechar.
if (window.desktop) {
  document.documentElement.classList.add('desktop');
  document.getElementById('win-min').addEventListener('click', () => window.desktop.minimize());
  document.getElementById('win-close').addEventListener('click', () => window.desktop.close());
}

// Idioma (PT/EN): troca a interface e os nomes reais do jogo (vindos do site oficial no idioma escolhido).
const langBtns = [...document.querySelectorAll('.lang-switch [data-lang]')];
langBtns.forEach(b => b.classList.toggle('active', b.dataset.lang === getLang()));
document.querySelector('.lang-switch')?.addEventListener('click', async e => {
  const b = e.target.closest('[data-lang]');
  if (!b || b.dataset.lang === getLang()) return;
  langBtns.forEach(x => { x.disabled = true; });
  b.textContent = '…';
  setLang(b.dataset.lang);
  try { await relocalizeProfiles(); } catch { /* recarrega mesmo assim */ }
  location.reload();
});
// Perfis salvos em outro idioma são refeitos em segundo plano.
if (needsRelocalization()) relocalizeProfiles().then(notifyChange, () => {});

lockApp();
initTooltips();
setTooltipContext(getMe()); // já começa a buscar os detalhes dos itens, para o tooltip abrir na hora
await loadIconManifest();
await loadMonsterCatalog();
await loadPetCatalog();
startCollection();
startLive();
startTrainingRecorder();
route();
initDesktopBanner();
initI18n();
