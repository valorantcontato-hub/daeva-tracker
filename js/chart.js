// Gráfico de linhas em SVG puro, redimensiona com o container e mostra tooltip no hover/toque.
import { compact, duration, esc } from './util.js';

function niceMax(v) {
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
const niceStep = raw => [5, 10, 15, 30, 60, 120, 300, 600].find(s => s >= raw) || 600;

/**
 * series: [{ name, color, values: number[] }]
 * Retorna { setHighlight(name) } para destacar uma linha sem recriar o gráfico.
 */
export function dpsChart(el, series, { highlight } = {}) {
  el.innerHTML = '<svg aria-hidden="true"></svg><div class="tip"></div>';
  const svg = el.querySelector('svg'), tip = el.querySelector('.tip');
  const n = Math.max(2, ...series.map(s => s.values.length));
  let max = 1;
  for (const s of series) for (const v of s.values) if (v > max) max = v;
  max = niceMax(max);
  let geom = null;

  function draw() {
    const W = el.clientWidth, H = el.clientHeight;
    if (!W || !H) return;
    const P = { l: 46, r: 10, t: 8, b: 22 };
    const pw = W - P.l - P.r, ph = H - P.t - P.b;
    const x = i => P.l + (i / (n - 1)) * pw;
    const y = v => P.t + (1 - v / max) * ph;
    geom = { W, P, pw };

    let out = '';
    for (const f of [0, .25, .5, .75, 1]) {
      const v = f * max, yy = y(v).toFixed(1);
      out += `<line class="grid" x1="${P.l}" x2="${W - P.r}" y1="${yy}" y2="${yy}"/><text x="${P.l - 8}" y="${+yy + 4}" text-anchor="end">${compact(v)}</text>`;
    }
    const step = niceStep(n / Math.max(2, Math.floor(pw / 70)));
    for (let i = 0; i < n; i += step) out += `<text x="${x(i).toFixed(1)}" y="${H - 4}" text-anchor="middle">${duration(i)}</text>`;
    // A linha destacada é desenhada por último para ficar por cima.
    const ordered = [...series].sort((a, b) => (a.name === highlight) - (b.name === highlight));
    for (const s of ordered) {
      let d = '';
      s.values.forEach((v, i) => { d += `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; });
      out += `<path d="${d}" stroke="${s.color}"${s.name === highlight ? ' class="hl"' : ''}/>`;
    }
    out += `<line class="cross" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}"/>`;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = out;
  }

  function hover(e) {
    if (!geom) return;
    const rect = el.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.round(((px - geom.P.l) / geom.pw) * (n - 1));
    const cross = svg.querySelector('.cross');
    if (i < 0 || i >= n) return leave();
    const cx = geom.P.l + (i / (n - 1)) * geom.pw;
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx);
    cross.style.visibility = 'visible';
    const rows = series.map(s => ({ s, v: s.values[i] || 0 })).sort((a, b) => b.v - a.v);
    const total = rows.reduce((a, r) => a + r.v, 0);
    tip.innerHTML = `<div class="tip-t">${duration(i)}</div>` +
      rows.map(({ s, v }) => `<div class="tip-r" style="--c:${s.color}"><span class="dot"></span>${esc(s.name)}<b>${compact(v)}</b></div>`).join('') +
      `<div class="tip-r sum">Party<b>${compact(total)}</b></div>`;
    tip.style.display = 'block';
    const tw = tip.offsetWidth;
    tip.style.left = (cx + 14 + tw < geom.W ? cx + 14 : Math.max(0, cx - tw - 14)) + 'px';
  }
  function leave() {
    tip.style.display = 'none';
    const cross = svg.querySelector('.cross');
    if (cross) cross.style.visibility = 'hidden';
  }

  el.addEventListener('pointermove', hover);
  el.addEventListener('pointerdown', hover);
  el.addEventListener('pointerleave', leave);
  new ResizeObserver(draw).observe(el);
  draw();

  return {
    setHighlight(name) { highlight = name; draw(); },
  };
}
