// App desktop: janela principal + widgets como janelas de overlay (sem borda, transparentes,
// sempre por cima do jogo, arrastáveis, travaveis com clique atravessando).
// Também inicia a captura (daeva-capture.exe) e se atualiza sozinho pelo GitHub Releases.
import { app, BrowserWindow, ipcMain, screen, globalShortcut, shell } from 'electron';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import updaterPkg from 'electron-updater';
import { start } from '../server.mjs';

const { autoUpdater } = updaterPkg;

// Porta fixa: o localStorage (progresso, perfis, histórico) é por origem, então ela não pode variar.
const PORT = 47173;
const BASE = `http://localhost:${PORT}`;
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PRELOAD = fileURLToPath(new URL('./preload.cjs', import.meta.url));
const WIDGETS = {
  party: { width: 320, height: 270 },
  skills: { width: 340, height: 340 },
  farm: { width: 300, height: 300 },
};
const MARGIN = 16;
const UPDATE_CHECK_MS = 4 * 60 * 60e3;

let mainWin = null;
const wins = new Map();
const cfgPath = () => join(app.getPath('userData'), 'widgets.json');
let cfg = {};

// ---------- Estado geral (atualização, Npcap, captura) mostrado no app ----------
const status = {
  version: app.getVersion(),
  update: 'idle', // idle | checking | downloading | ready | latest | error | dev
  progress: 0,
  npcap: existsSync(join(process.env.WINDIR || 'C:\\Windows', 'System32', 'Npcap', 'wpcap.dll')),
  capture: 'stopped', // stopped | running | missing
};
function setStatus(patch) {
  Object.assign(status, patch);
  for (const w of [mainWin, ...wins.values()]) if (w && !w.isDestroyed()) w.webContents.send('app:status', status);
}

// ---------- Atualização automática ----------
function setupUpdater() {
  if (!app.isPackaged) return setStatus({ update: 'dev' });
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => setStatus({ update: 'checking' }));
  autoUpdater.on('update-not-available', () => setStatus({ update: 'latest' }));
  autoUpdater.on('download-progress', p => setStatus({ update: 'downloading', progress: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', info => setStatus({ update: 'ready', next: info.version }));
  autoUpdater.on('error', () => setStatus({ update: 'error' }));
  const check = () => autoUpdater.checkForUpdates().catch(() => setStatus({ update: 'error' }));
  check();
  setInterval(check, UPDATE_CHECK_MS).unref();
}

// ---------- Captura ----------
const captureExe = () => app.isPackaged
  ? join(process.resourcesPath, 'capture', 'daeva-capture.exe')
  : join(ROOT, 'capture', 'bin', 'daeva-capture.exe');
let captureProc = null;
let captureRestarts = 0;

function startCapture() {
  const exe = captureExe();
  if (!existsSync(exe)) return setStatus({ capture: 'missing' });
  if (!status.npcap) return setStatus({ capture: 'stopped' });
  captureProc = spawn(exe, ['--url', BASE], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const startedAt = Date.now();
  setStatus({ capture: 'running' });
  // Rodou um bom tempo antes de cair: volta a tentar rápido na próxima vez.
  captureProc.once('exit', () => { if (Date.now() - startedAt > 60e3) captureRestarts = 0; });
  captureProc.stdout.on('data', d => process.stdout.write('[captura] ' + d));
  captureProc.stderr.on('data', d => process.stderr.write('[captura] ' + d));
  captureProc.on('exit', () => {
    captureProc = null;
    setStatus({ capture: 'stopped' });
    // Reinicia se cair (com espera crescente, até 1 min).
    if (!app.isQuitting) setTimeout(startCapture, Math.min(60e3, 2000 * 2 ** captureRestarts++));
  });
}

// ---------- Widgets ----------
function loadCfg() {
  try { cfg = JSON.parse(readFileSync(cfgPath(), 'utf8')); } catch { cfg = {}; }
  for (const id of Object.keys(WIDGETS)) cfg[id] = { visible: false, locked: false, corner: '', bounds: null, ...cfg[id] };
}
let saveTimer;
function saveCfg() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => writeFileSync(cfgPath(), JSON.stringify(cfg, null, 2)), 300);
}
function pushState() {
  const state = Object.fromEntries(Object.entries(cfg).map(([id, c]) => [id, { visible: c.visible, locked: c.locked, corner: c.corner }]));
  for (const w of [mainWin, ...wins.values()]) if (w && !w.isDestroyed()) w.webContents.send('widgets:state', state);
  return state;
}

function cornerBounds(id, corner) {
  const { width, height } = cfg[id].bounds || WIDGETS[id];
  const area = screen.getPrimaryDisplay().workArea;
  const left = area.x + MARGIN, right = area.x + area.width - width - MARGIN;
  const top = area.y + MARGIN, bottom = area.y + area.height - height - MARGIN;
  const pos = { tl: [left, top], tr: [right, top], bl: [left, bottom], br: [right, bottom] }[corner];
  return pos ? { x: pos[0], y: pos[1], width, height } : null;
}

function defaultBounds(id) {
  // Empilha os widgets no canto superior direito na primeira vez.
  const area = screen.getPrimaryDisplay().workArea;
  const order = Object.keys(WIDGETS).indexOf(id);
  const { width, height } = WIDGETS[id];
  return { x: area.x + area.width - width - MARGIN - order * 24, y: area.y + MARGIN + order * 40, width, height };
}

function applyLock(win, locked) {
  // Travado: o mouse "atravessa" a janela até o jogo; forward mantém o hover.
  win.setIgnoreMouseEvents(locked, { forward: true });
  win.setFocusable(!locked);
}

function openWidget(id) {
  if (wins.has(id)) return wins.get(id).showInactive();
  const c = cfg[id];
  const bounds = cornerBounds(id, c.corner) || c.bounds || defaultBounds(id);
  const win = new BrowserWindow({
    ...bounds,
    minWidth: 220, minHeight: 120,
    frame: false, transparent: true, hasShadow: false, resizable: true,
    alwaysOnTop: true, skipTaskbar: true, fullscreenable: false, maximizable: false, minimizable: false,
    show: false, backgroundColor: '#00000000',
    webPreferences: { preload: PRELOAD, contextIsolation: true, sandbox: true },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadURL(`${BASE}/#/w/${id}`);
  win.once('ready-to-show', () => { win.showInactive(); applyLock(win, c.locked); });
  const remember = () => {
    if (win.isDestroyed()) return;
    c.bounds = win.getBounds();
    saveCfg();
  };
  win.on('moved', () => { c.corner = ''; remember(); pushState(); });
  win.on('resized', remember);
  win.on('closed', () => {
    wins.delete(id);
    if (!app.isQuitting) { c.visible = false; saveCfg(); pushState(); }
  });
  wins.set(id, win);
}

function setWidget(id, patch) {
  const c = cfg[id];
  if (!c) return;
  Object.assign(c, patch);
  const win = wins.get(id);
  if ('visible' in patch) patch.visible ? openWidget(id) : win?.close();
  if (win && !win.isDestroyed()) {
    if ('locked' in patch) applyLock(win, c.locked);
    if ('corner' in patch && c.corner) win.setBounds(cornerBounds(id, c.corner));
  }
  saveCfg();
  pushState();
}

function createMain() {
  mainWin = new BrowserWindow({
    width: 1280, height: 840, minWidth: 380, minHeight: 500,
    backgroundColor: '#0b0e14', title: 'Daeva Tracker', autoHideMenuBar: true,
    webPreferences: { preload: PRELOAD, contextIsolation: true, sandbox: true },
  });
  mainWin.loadURL(BASE + '/');
  // Links externos (Npcap, GitHub) abrem no navegador padrão.
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
  mainWin.on('closed', () => { mainWin = null; app.quit(); });
}

ipcMain.handle('widget:list', () => pushState());
ipcMain.handle('widget:toggle', (_e, id, on) => setWidget(id, { visible: !!on }));
ipcMain.handle('widget:set', (_e, id, patch) => {
  const allowed = {};
  if ('locked' in patch) allowed.locked = !!patch.locked;
  if ('corner' in patch) allowed.corner = ['', 'tl', 'tr', 'bl', 'br'].includes(patch.corner) ? patch.corner : '';
  setWidget(id, allowed);
});
ipcMain.on('widget:close-self', e => {
  for (const [id, w] of wins) if (w.webContents === e.sender) setWidget(id, { visible: false });
});
ipcMain.handle('app:status', () => status);
ipcMain.handle('app:install-update', () => {
  if (status.update !== 'ready') return;
  app.isQuitting = true;
  autoUpdater.quitAndInstall(true, true);
});
ipcMain.handle('app:recheck-npcap', () => {
  setStatus({ npcap: existsSync(join(process.env.WINDIR || 'C:\\Windows', 'System32', 'Npcap', 'wpcap.dll')) });
  if (status.npcap && !captureProc) { captureRestarts = 0; startCapture(); }
  return status;
});

// Uma instância só: abrir de novo apenas traz a janela principal para frente.
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => {
  if (!mainWin) return;
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.focus();
});

app.whenReady().then(async () => {
  try {
    await start(PORT);
  } catch (e) {
    // Outra instância já está servindo nesta porta: reaproveita.
    if (e.code !== 'EADDRINUSE') throw e;
  }
  loadCfg();
  createMain();
  for (const [id, c] of Object.entries(cfg)) if (c.visible) openWidget(id);
  startCapture();
  setupUpdater();

  globalShortcut.register('CommandOrControl+Shift+L', () => {
    const lock = ![...wins.keys()].every(id => cfg[id].locked);
    for (const id of wins.keys()) setWidget(id, { locked: lock });
  });
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    const anyVisible = [...wins.values()].some(w => w.isVisible());
    for (const w of wins.values()) anyVisible ? w.hide() : w.showInactive();
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
  captureProc?.kill();
});
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
