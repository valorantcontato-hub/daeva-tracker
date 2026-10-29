// Atualização ao vivo da interface: a cada minuto confere o branch main no GitHub e baixa só os
// arquivos de interface (index.html, css/, js/, icons/) que mudaram. O servidor local passa a servir
// essas cópias e todas as janelas recarregam — sem reinstalar nem reiniciar o app.
// Mudanças no Electron, no servidor ou na captura chegam por release (electron-updater).
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const WEB = /^(index\.html|css\/|js\/|icons\/)/;
const INTERVAL_MS = 60e3;

// SHA de blob do git: permite comparar o arquivo do pacote com o do GitHub sem baixá-lo.
const blobSha = buf => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');

/**
 * opts: { owner, repo, branch, appDir (arquivos do pacote), dataDir (userData), appVersion, onUpdate(sha) }
 * Retorna a pasta de sobreposição que o servidor deve servir antes do pacote.
 */
export async function setupLiveUi(opts) {
  const root = join(opts.dataDir, 'live-ui');
  const filesDir = join(root, 'files');
  const stateFile = join(root, 'state.json');
  let state = {};
  try { state = JSON.parse(await readFile(stateFile, 'utf8')); } catch { }

  // Versão nova do app instalada: os arquivos do pacote já são mais novos, descarta as cópias.
  if (state.appVersion !== opts.appVersion) {
    await rm(root, { recursive: true, force: true });
    state = { appVersion: opts.appVersion };
  }

  const api = `https://api.github.com/repos/${opts.owner}/${opts.repo}`;
  const headers = { 'User-Agent': 'daeva-tracker', Accept: 'application/vnd.github+json' };

  async function check() {
    // ETag: respostas 304 não contam no limite de requisições da API do GitHub.
    const res = await fetch(`${api}/commits/${opts.branch}`, {
      headers: state.etag ? { ...headers, 'If-None-Match': state.etag } : headers,
      signal: AbortSignal.timeout(15e3),
    });
    if (res.status === 304 || !res.ok) return;
    const etag = res.headers.get('etag');
    const { sha } = await res.json();
    if (sha === state.sha) { state.etag = etag; return; }

    const tree = await (await fetch(`${api}/git/trees/${sha}?recursive=1`, { headers, signal: AbortSignal.timeout(15e3) })).json();
    if (!Array.isArray(tree.tree)) return;
    // Só os arquivos que diferem do pacote instalado.
    const wanted = [];
    for (const t of tree.tree) {
      if (t.type !== 'blob' || !WEB.test(t.path)) continue;
      const bundled = join(opts.appDir, t.path);
      if (!existsSync(bundled) || blobSha(await readFile(bundled)) !== t.sha) wanted.push(t);
    }
    const key = wanted.map(t => t.path + ':' + t.sha).join('|');
    const first = !state.sha;
    if (key === state.overlayKey) {
      // Commit sem mudança de interface: nada a baixar nem recarregar.
      Object.assign(state, { sha, etag });
      await mkdir(root, { recursive: true });
      await writeFile(stateFile, JSON.stringify(state));
      return;
    }

    // Baixa numa pasta nova e troca de uma vez: nunca serve uma mistura de versões.
    const next = join(root, 'next');
    await rm(next, { recursive: true, force: true });
    let changed = 0;
    for (const t of wanted) {
      const raw = await fetch(`https://raw.githubusercontent.com/${opts.owner}/${opts.repo}/${sha}/${t.path.split('/').map(encodeURIComponent).join('/')}`, { signal: AbortSignal.timeout(30e3) });
      if (!raw.ok) throw new Error(`download ${t.path}: ${raw.status}`);
      const dest = join(next, t.path);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, Buffer.from(await raw.arrayBuffer()));
      changed++;
    }
    await rm(filesDir, { recursive: true, force: true });
    if (changed) await rename(next, filesDir);
    else await rm(next, { recursive: true, force: true });

    Object.assign(state, { sha, etag, overlayKey: key });
    await mkdir(root, { recursive: true });
    await writeFile(stateFile, JSON.stringify(state));
    if (!first || changed) opts.onUpdate(sha.slice(0, 7), changed);
  }

  const run = () => check().catch(e => console.warn('[live-ui]', e.message));
  setTimeout(run, 3000);
  setInterval(run, INTERVAL_MS).unref();
  return filesDir;
}
