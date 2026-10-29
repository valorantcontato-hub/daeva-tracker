// Avistamentos compartilhados de monstros do Lotus Tracker (Cloudflare Worker + D1).
// POST /avistamentos  {v:1, r:"<id anônimo>", mobs:[{n:"nome", x:célulaX, y:célulaY}]}  -> guarda a célula de 25 m onde o mob foi visto.
// GET  /spawns?names=A|B                                                               -> {"A":[[cx,cy],...]} das células vistas.
// Não guarda nome de jogador, IP nem posição exata. Uma célula só aparece para os outros com MIN_REPORTERS pessoas diferentes.
import { parseReport, parseNames } from './validate.mjs';

const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', ...extra },
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' } });

    if (url.pathname === '/avistamentos' && request.method === 'POST') {
      if (Number(request.headers.get('content-length') || 0) > 8000) return json({ error: 'grande demais' }, 413);
      let body; try { body = await request.json(); } catch { return json({ error: 'json inválido' }, 400); }
      const report = parseReport(body);
      if (!report) return json({ error: 'relatório inválido' }, 400);
      const now = Math.floor(Date.now() / 1000);
      const upsert = env.DB.prepare(`INSERT INTO spawns (name, cx, cy, r1, updated) VALUES (?1, ?2, ?3, ?4, ?5)
        ON CONFLICT(name, cx, cy) DO UPDATE SET
          r2 = CASE WHEN r1 <> excluded.r1 AND r2 IS NULL THEN excluded.r1 ELSE r2 END,
          r3 = CASE WHEN r1 <> excluded.r1 AND r2 IS NOT NULL AND r2 <> excluded.r1 AND r3 IS NULL THEN excluded.r1 ELSE r3 END,
          updated = excluded.updated`);
      await env.DB.batch(report.mobs.map(m => upsert.bind(m.name, m.cx, m.cy, report.reporter, now)));
      return json({ ok: true, saved: report.mobs.length });
    }

    if (url.pathname === '/spawns' && request.method === 'GET') {
      const names = parseNames(url.searchParams.get('names'));
      if (!names.length) return json({});
      const min = Math.max(1, Number(env.MIN_REPORTERS) || 1);
      const marks = names.map((_, i) => `?${i + 1}`).join(',');
      const { results } = await env.DB.prepare(
        `SELECT name, cx, cy FROM spawns WHERE name IN (${marks}) AND (1 + (r2 IS NOT NULL) + (r3 IS NOT NULL)) >= ${min} LIMIT 6000`
      ).bind(...names).all();
      const out = {};
      for (const r of results) (out[r.name] ||= []).push([r.cx, r.cy]);
      return json(out, 200, { 'cache-control': 'public, max-age=120' });
    }

    return json({ error: 'não encontrado' }, 404);
  },
};
