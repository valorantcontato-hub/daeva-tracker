// Modo Stream: endereços dos widgets para a "Fonte de Navegador" do OBS/Streamlabs (a Twitch recebe o que o OBS captura).
const ITEMS = [
  { id: 'all', label: 'Todos os widgets', w: 1000, h: 470 },
];

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function openStreamMode() {
  if (document.getElementById('stream-mode')) return;
  const base = location.origin + location.pathname.replace(/[^/]*$/, '');
  const rows = ITEMS.map(i => {
    const url = `${base}#/w/${i.id}`;
    return `<div class="sm-row"><div><b>${i.label}</b><small>Largura ${i.w} · Altura ${i.h}</small></div>
      <input readonly value="${esc(url)}" aria-label="Endereço de ${i.label}"><button data-copy="${esc(url)}">Copiar</button></div>`;
  }).join('');
  const box = document.createElement('div');
  box.id = 'stream-mode';
  box.className = 'sm-backdrop';
  box.innerHTML = `<div class="sm-card" role="dialog" aria-label="Modo Stream">
    <div class="sm-title"><span>👁 Modo Stream</span><button class="sm-close" aria-label="Fechar">✕</button></div>
    <p>Para os widgets aparecerem na Twitch, adicione no OBS (ou Streamlabs) como <b>Fonte → Navegador</b>, cole o endereço único abaixo e use a largura e a altura indicadas (um endereço só para os três: DPS do chefe, Skills e Mini mapa lado a lado; cada um some sozinho quando não está em uso). O fundo já é transparente. Deixe o Lotus Tracker aberto durante a live.</p>
    ${rows}
    <p class="sm-note">Dica: as janelas do overlay no jogo não são vistas pelo OBS em "Captura de jogo"; a fonte de navegador funciona em qualquer modo de captura.</p>
  </div>`;
  const close = () => box.remove();
  box.addEventListener('click', async e => {
    if (e.target === box || e.target.closest('.sm-close')) return close();
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Copiado ✓'; }
    catch { b.previousElementSibling.select(); b.textContent = 'Ctrl+C'; }
    setTimeout(() => { b.textContent = 'Copiar'; }, 1500);
  });
  document.body.append(box);
}
