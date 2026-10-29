// Faixa de status do app desktop: atualização automática, Npcap e captura.
import { esc } from './util.js';

export function initDesktopBanner() {
  const api = window.desktop;
  const el = document.getElementById('app-banner');
  if (!api || !el || document.documentElement.classList.contains('widget-mode')) return;

  function render(s) {
    let html = '';
    if (s.update === 'ready') {
      html = `<span>✨ Nova versão <b>${esc(s.next || '')}</b> pronta.</span><button class="btn sm primary" data-act="install">Reiniciar e atualizar</button>`;
    } else if (!s.npcap) {
      html = `<span>Para ver o DPS ao vivo, instale o <b>Npcap</b> (marque “WinPcap API-compatible Mode”).</span>
        <a class="btn sm primary" href="https://npcap.com/#download" target="_blank" rel="noopener">Baixar Npcap</a>
        <button class="btn sm" data-act="recheck">Já instalei</button>`;
    } else if (s.capture === 'missing') {
      html = '<span>A captura não foi encontrada. Reinstale o app ou rode <b>capture\\setup.ps1</b>.</span>';
    } else if (s.update === 'downloading') {
      html = `<span>Baixando atualização… ${s.progress}%</span>`;
    }
    el.innerHTML = html;
    el.hidden = !html;
    const v = document.querySelector('.brand');
    if (v) v.title = `Daeva Tracker ${s.version} · captura ${s.capture === 'running' ? 'ativa' : 'parada'}`;
  }

  el.addEventListener('click', async e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'install') api.installUpdate();
    if (act === 'recheck') render(await api.recheckNpcap());
  });
  api.onStatus(render);
  api.status().then(render);
}
