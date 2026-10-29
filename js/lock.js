// Bloqueio de cópia: nada de selecionar texto, copiar, arrastar/salvar imagens ou abrir o menu do
// botão direito. Campos de digitação (busca, nome do personagem...) continuam normais.
// Observação: isso impede o uso casual; uma captura de tela sempre será possível.
const EDITABLE = 'input, textarea, select, [contenteditable="true"]';
const editable = e => e.target instanceof Element && e.target.closest(EDITABLE);

export function lockApp() {
  const stop = e => { if (!editable(e)) e.preventDefault(); };
  for (const type of ['contextmenu', 'dragstart', 'selectstart', 'copy', 'cut']) {
    document.addEventListener(type, stop, true);
  }
  // Salvar, imprimir, ver código-fonte, copiar tudo: sem atalho.
  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    if (editable(e)) {
      // Dentro de um campo só bloqueia os atalhos de página (salvar/imprimir/código-fonte).
      if (ctrl && ['s', 'p', 'u'].includes(k)) e.preventDefault();
      return;
    }
    if (ctrl && ['s', 'p', 'u', 'a', 'c', 'x'].includes(k)) e.preventDefault();
    if (e.key === 'F12' || (ctrl && e.shiftKey && ['i', 'j', 'c'].includes(k))) e.preventDefault();
  }, true);
}
