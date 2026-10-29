// Validação dos avistamentos recebidos (separada do Worker para ser testada sem Cloudflare).
export const CELL = 2500; // 25 m (a unidade do jogo é 1 cm); o app envia só a célula, nunca a posição exata
export const MAX_PER_REPORT = 50;
const NAME = /^[\p{L}\p{N} '’\-.:()]{2,60}$/u;
const REPORTER = /^[0-9a-f]{16}$/;
const LIMIT = 2_000_000 / CELL;

/** Devolve { reporter, mobs: [{ name, cx, cy }] } ou null se o relatório for inválido. */
export function parseReport(body) {
  if (!body || body.v !== 1 || !REPORTER.test(String(body.r || '')) || !Array.isArray(body.mobs)) return null;
  const mobs = [];
  for (const m of body.mobs.slice(0, MAX_PER_REPORT)) {
    const name = String(m?.n ?? '').trim(), cx = Number(m?.x), cy = Number(m?.y);
    if (!NAME.test(name) || !Number.isInteger(cx) || !Number.isInteger(cy) || Math.abs(cx) > LIMIT || Math.abs(cy) > LIMIT) continue;
    if (cx === 0 && cy === 0) continue;
    mobs.push({ name, cx, cy });
  }
  return mobs.length ? { reporter: body.r, mobs } : null;
}

/** Nomes pedidos em ?names=A|B|C (no máximo 12, os mesmos limites de nome). */
export function parseNames(raw) {
  return [...new Set(String(raw || '').split('|').map(s => s.trim()).filter(s => NAME.test(s)))].slice(0, 12);
}
