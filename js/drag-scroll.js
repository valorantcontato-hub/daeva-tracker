// Rolagem arrastando, como no celular: clique em qualquer lugar da tela e arraste (para cima rola para baixo).
// Só no mouse; toque já rola sozinho. Campos de texto, listas e sliders mantêm o comportamento normal.
const NO_DRAG = 'input, textarea, select, [contenteditable="true"], .tooltip, [data-no-drag-scroll]';
const THRESHOLD = 6; // px antes de contar como arrasto (abaixo disso é um clique normal)

const scrollable = (el, axis) => {
  const s = getComputedStyle(el);
  const overflow = axis === 'y' ? s.overflowY : s.overflowX;
  const room = axis === 'y' ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth;
  return room > 1 && (overflow === 'auto' || overflow === 'scroll');
};

/** O elemento mais próximo (de baixo para cima) que rola no eixo, ou a própria página. */
export function scrollTarget(el, axis) {
  for (let e = el; e && e !== document.body && e !== document.documentElement; e = e.parentElement) if (scrollable(e, axis)) return e;
  return document.scrollingElement;
}

export function initDragScroll() {
  if (initDragScroll.done) return;
  initDragScroll.done = true;
  let down = null, dragging = false, last = null, velocity = { x: 0, y: 0 }, glide = 0;
  const stopGlide = () => { cancelAnimationFrame(glide); glide = 0; };

  addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest?.(NO_DRAG)) return;
    stopGlide();
    down = { x: e.clientX, y: e.clientY, tx: scrollTarget(e.target, 'x'), ty: scrollTarget(e.target, 'y') };
    last = { x: e.clientX, y: e.clientY, t: performance.now() };
    dragging = false;
    velocity = { x: 0, y: 0 };
  }, true);

  addEventListener('pointermove', e => {
    if (!down) return;
    if (!dragging) {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < THRESHOLD) return;
      dragging = true;
      document.documentElement.classList.add('drag-scrolling');
    }
    const now = performance.now(), dt = Math.max(1, now - last.t);
    const dx = e.clientX - last.x, dy = e.clientY - last.y;
    down.tx.scrollLeft -= dx;
    down.ty.scrollTop -= dy;
    velocity = { x: dx / dt, y: dy / dt };
    last = { x: e.clientX, y: e.clientY, t: now };
  }, true);

  const end = () => {
    if (!down) return;
    const { tx, ty } = down, was = dragging;
    down = null;
    document.documentElement.classList.remove('drag-scrolling');
    if (!was) return;
    dragging = false;
    // O clique que viria logo após o arrasto não deve acionar botões nem links.
    const eat = ev => { ev.stopPropagation(); ev.preventDefault(); };
    addEventListener('click', eat, { capture: true, once: true });
    setTimeout(() => removeEventListener('click', eat, true), 0);
    // Inércia curta, como no celular.
    let v = { ...velocity }, prev = performance.now();
    const step = now => {
      const dt = now - prev; prev = now;
      tx.scrollLeft -= v.x * dt; ty.scrollTop -= v.y * dt;
      v = { x: v.x * 0.94, y: v.y * 0.94 };
      glide = Math.abs(v.x) + Math.abs(v.y) > 0.02 ? requestAnimationFrame(step) : 0;
    };
    if (Math.abs(v.x) + Math.abs(v.y) > 0.15) glide = requestAnimationFrame(step);
  };
  addEventListener('pointerup', end, true);
  addEventListener('pointercancel', end, true);
  addEventListener('blur', end);
  addEventListener('wheel', stopGlide, { passive: true });
}
