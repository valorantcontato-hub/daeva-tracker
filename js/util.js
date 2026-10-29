const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);

const nf = d => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: d });
const nf0 = nf(0), nf1 = nf(1), nf2 = nf(2);

/** 1234567 -> "1,23M" */
export function compact(n) {
  const a = Math.abs(n);
  if (a >= 1e9) return nf2.format(n / 1e9) + 'B';
  if (a >= 1e6) return nf2.format(n / 1e6) + 'M';
  if (a >= 1e3) return nf1.format(n / 1e3) + 'K';
  return nf0.format(n);
}
export const int = n => nf0.format(n);
export const pct = (n, d = 1) => nf(d).format(n * 100) + '%';

export function duration(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function dateTime(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function download(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Abre o seletor de arquivo e devolve o JSON lido (ou null se cancelado). */
export function pickJson() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return resolve(null);
      try { resolve(JSON.parse(await file.text())); } catch (e) { reject(e); }
    });
    input.click();
  });
}

let toastTimer;
export function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
