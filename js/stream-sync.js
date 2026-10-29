// OBS/Streamlabs abrem os widgets em um navegador próprio, com armazenamento vazio. Para o overlay da stream mostrar o mesmo
// que o jogador configurou (skills mostradas, perfil, ícones, coleção, mascotes em farm...), o app envia o estado ao servidor local
// e as páginas de widget fora do app o recebem e o gravam no próprio armazenamento.
const PREFIX = 'a2t:';
const SKIP = new Set(['encounters', 'itemcache']); // pesados e inúteis para os widgets
const MAX_VALUE = 400_000;
const isReceiver = () => location.hash.startsWith('#/w/') && !window.overlay;

function snapshot() {
  const data = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(PREFIX)) continue;
      const name = k.slice(PREFIX.length), v = localStorage.getItem(k);
      if (SKIP.has(name) || v == null || v.length > MAX_VALUE) continue;
      data[name] = v;
    }
  } catch { /* sem armazenamento */ }
  return data;
}

async function push() {
  const data = snapshot(), body = JSON.stringify({ data });
  if (body === push.last) return;
  push.last = body;
  try { await fetch('/api/stream-state', { method: 'POST', headers: { 'content-type': 'application/json' }, body }); } catch { push.last = ''; }
}

let rev = -1;
async function pull() {
  try {
    const res = await fetch('/api/stream-state?rev=' + rev, { cache: 'no-store' });
    if (!res.ok) return;
    const state = await res.json();
    if (state.rev === rev || !state.data) return;
    rev = state.rev;
    let changed = false;
    for (const [name, v] of Object.entries(state.data)) {
      if (localStorage.getItem(PREFIX + name) !== v) { localStorage.setItem(PREFIX + name, v); changed = true; }
    }
    if (changed) dispatchEvent(new Event('a2t:changed'));
  } catch { /* servidor fora do ar */ }
}

export function startStreamSync() {
  if (startStreamSync.started || typeof fetch === 'undefined') return;
  startStreamSync.started = true;
  if (isReceiver()) { pull(); setInterval(pull, 2000); return; }
  if (location.hash.startsWith('#/w/')) return; // janelas de widget do próprio app: só a janela principal envia
  let timer;
  const soon = () => { clearTimeout(timer); timer = setTimeout(push, 800); };
  addEventListener('a2t:changed', soon);
  addEventListener('storage', soon);
  setInterval(push, 10_000);
  soon();
}
