// Modo Stream: endereços dos widgets para a "Fonte de Navegador" do OBS/Streamlabs (a Twitch recebe o que o OBS captura).
const ITEMS = [
  { id: 'party', label: 'DPS do chefe', w: 320, h: 270 },
  { id: 'skills', label: 'Skills', w: 340, h: 340 },
  { id: 'radar', label: 'Mini mapa', w: 300, h: 460 },
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
    <p>Para os widgets aparecerem na Twitch, adicione cada um no OBS (ou Streamlabs) como <b>Fonte → Navegador</b>, cole o endereço e use a largura e a altura indicadas. O fundo já é transparente. Deixe o Lotus Tracker aberto durante a live.</p>
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
