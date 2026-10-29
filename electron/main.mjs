// App desktop: janela principal + widgets como janelas de overlay (sem borda, transparentes,
// sempre por cima do jogo, arrastáveis, travaveis com clique atravessando).
// Também inicia a captura (daeva-capture.exe) e se atualiza sozinho pelo GitHub Releases.
import { app, BrowserWindow, ipcMain, screen, globalShortcut, shell } from 'electron';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, watch, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import updaterPkg from 'electron-updater';
import { start, notifyReload } from '../server.mjs';
import { setupLiveUi } from './live-ui.mjs';
import { uiRepository } from './ui-source.mjs';
import { migrateWidgets, widgetBounds, widgetPointerOpacity, widgetScale } from './widget-config.mjs';
import { gameFocusAllows } from './game-focus.mjs';

const { autoUpdater } = updaterPkg;

// Testes do app em desenvolvimento sem mexer nos dados (nem na instância única) do app instalado.
// The display name changes; the legacy storage path and app ID keep installed profiles intact.
app.setName('Lotus Tracker');
app.setPath('userData', process.env.DAEVA_USERDATA || join(app.getPath('appData'), 'daeva-tracker'));
app.setAppUserModelId('app.daevatracker');

// Porta fixa: o localStorage (progresso, perfis, histórico) é por origem, então ela não pode variar.
const PORT = Number(process.env.DAEVA_PORT) || 47173;
const BASE = `http://localhost:${PORT}`;
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PRELOAD = fileURLToPath(new URL('./preload.cjs', import.meta.url));
const WIDGETS = {
  party: { width: 320, height: 270 },
  skills: { width: 340, height: 340 },
  radar: { width: 300, height: 460 },
};
const UPDATE_CHECK_MS = 15 * 60e3;
// npm run dev: recarrega ao salvar a interface e reinicia ao salvar o código do app.
const DEV = !app.isPackaged;

let mainWin = null;
const wins = new Map();
const activeWidgets = new Map();
let gameAllowed = false, lastGameFocus = 0;
function allowGameOverlays(allowed) {
  if (allowed === gameAllowed) return;
  gameAllowed = allowed;
  for (const [id, win] of wins) if (!win.isDestroyed()) applyLock(win, cfg[id].locked, activeWidgets.get(id));
}
function updateGameFocus(message) {
  lastGameFocus = Date.now();
  const handles = [...wins.values()].filter(win => !win.isDestroyed()).map(win => win.getNativeWindowHandle().readBigUInt64LE().toString());
  allowGameOverlays(gameFocusAllows(message, handles, gameAllowed));
}
const cfgPath = () => join(app.getPath('userData'), 'widgets.json');
let cfg = {};

// ---------- Estado geral (atualização, Npcap, captura) mostrado no app ----------
const status = {
  version: app.getVersion(),
  update: 'idle', // idle | checking | downloading | ready | latest | error | dev
  progress: 0,
  npcap: existsSync(join(process.env.WINDIR || 'C:\\Windows', 'System32', 'Npcap', 'wpcap.dll')),
  capture: 'stopped', // stopped | running | missing
  movementEnabled: true, // leitura nativa automática; respeita a confirmação do Windows
  autostart: app.isPackaged && app.getLoginItemSettings().openAtLogin,
};
const AUTOSTART = process.argv.includes('--autostart');
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
let captureGeneration = 0;
let captureStopFile = '';
let readMovement = true;

function stopCapture() {
  captureGeneration++;
  if (captureStopFile) writeFileSync(captureStopFile, 'stop');
  captureProc?.kill();
  captureProc = null;
}

function startCapture() {
  if (process.env.DAEVA_NO_CAPTURE) return; // testes do app sem iniciar a captura
  const exe = captureExe();
  if (!existsSync(exe)) return setStatus({ capture: 'missing' });
  if (!status.npcap) return setStatus({ capture: 'stopped' });
  const generation = ++captureGeneration;
  captureStopFile = join(app.getPath('userData'), `capture-${process.pid}-${randomUUID()}.stop`);
  const args = ['--url', BASE, '--owner-pid', String(process.pid), '--stop-file', captureStopFile, ...(readMovement ? ['--launch-elevated'] : ['--passive-only'])];
  const options = { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] };
  captureProc = spawn(exe, args, options);
  const startedAt = Date.now();
  setStatus({ capture: 'running' });
  // Rodou um bom tempo antes de cair: volta a tentar rápido na próxima vez.
  captureProc.once('exit', () => { if (Date.now() - startedAt > 60e3) captureRestarts = 0; });
  captureProc.stdout.on('data', d => process.stdout.write('[captura] ' + d));
  captureProc.stderr.on('data', d => process.stderr.write('[captura] ' + d));
  captureProc.on('exit', code => {
    if (generation !== captureGeneration) return;
    captureProc = null;
    setStatus({ capture: 'stopped' });
    // Reinicia se cair (com espera crescente, até 1 min).
    if (readMovement && code === 1223) {
      readMovement = false;
      setStatus({ movementEnabled: false, movementState: 'permission', movementMessage: 'Reabra o Lotus e autorize o administrador para a leitura de movimento.' });
    }
    if (!app.isQuitting) setTimeout(() => { if (generation === captureGeneration) startCapture(); }, Math.min(60e3, 2000 * 2 ** captureRestarts++));
  });
}

// ---------- Widgets ----------
function loadCfg() {
  try { cfg = JSON.parse(readFileSync(cfgPath(), 'utf8')); } catch { cfg = {}; }
  migrateWidgets(cfg);
  for (const id of Object.keys(WIDGETS)) {
    cfg[id] = { visible: false, locked: false, bounds: null, ...cfg[id] };
    cfg[id].scale = widgetScale(cfg[id].scale);
  }
}
let saveTimer;
function flushCfg() {
  clearTimeout(saveTimer);
  writeFileSync(cfgPath(), JSON.stringify(cfg, null, 2));
}
function saveCfg() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushCfg, 300);
}
function pushState() {
  const state = Object.fromEntries(Object.entries(cfg).filter(([id]) => WIDGETS[id]).map(([id, c]) => [id, { visible: c.visible, locked: c.locked, scale: c.scale }]));
  for (const w of [mainWin, ...wins.values()]) if (w && !w.isDestroyed()) w.webContents.send('widgets:state', state);
  return state;
}

function defaultBounds(id) {
  const saved = cfg[id].bounds;
  const display = saved ? screen.getDisplayMatching(saved) : screen.getPrimaryDisplay();
  const area = id === 'radar' ? display.bounds : display.workArea;
  return widgetBounds(id, WIDGETS[id], saved, area, cfg[id].scale);
}

function applyLock(win, locked, active = true) {
  active = active && gameAllowed;
  // Travado: o mouse "atravessa" a janela até o jogo. Sem "forward": o hover já é lido por polling do cursor, e o
  // encaminhamento de mouse do Electron, numa janela do tamanho da tela, interfere no cursor do jogo (puxa para o centro).
  win.setIgnoreMouseEvents(locked || !active);
  // O overlay nunca recebe foco: assim ele não tira o jogo do primeiro plano nem atrapalha o alt-tab.
  win.setFocusable(false);
  applyPointerOpacity(win, locked, active);
}

function applyPointerOpacity(win, locked, active = true) {
  const opacity = active && gameAllowed ? widgetPointerOpacity(locked, win.getBounds(), screen.getCursorScreenPoint()) : 0;
  if (win.getOpacity() !== opacity) win.setOpacity(opacity);
}

// Polling the native pointer also sees it through a click-through window.
// DOM mouseenter cannot reliably restore a window that is already invisible.
setInterval(() => {
  if (gameAllowed && Date.now() - lastGameFocus > 2000) allowGameOverlays(false);
  for (const [id, win] of wins) if (!win.isDestroyed()) applyPointerOpacity(win, cfg[id].locked, activeWidgets.get(id));
}, 50).unref();

function openWidget(id) {
  if (wins.has(id)) return wins.get(id).showInactive();
  const c = cfg[id];
  activeWidgets.set(id, id === 'radar');
  const bounds = defaultBounds(id);
  const win = new BrowserWindow({
    ...bounds,
    frame: false, transparent: true, hasShadow: false, resizable: false, focusable: false,
    alwaysOnTop: true, skipTaskbar: true, fullscreenable: false, maximizable: false, minimizable: false,
    show: false, backgroundColor: '#00000000',
    webPreferences: { preload: PRELOAD, contextIsolation: true, sandbox: true, devTools: DEV, spellcheck: false },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadURL(`${BASE}/#/w/${id}`);
  win.once('ready-to-show', () => { win.showInactive(); applyLock(win, c.locked, activeWidgets.get(id)); });
  const remember = () => {
    if (win.isDestroyed()) return;
    c.bounds = win.getBounds();
    saveCfg();
  };
  win.on('moved', remember);
  win.on('resized', remember);
  win.on('closed', () => {
    wins.delete(id);
    activeWidgets.delete(id);
    if (!app.isQuitting) { c.visible = false; saveCfg(); pushState(); }
  });
  wins.set(id, win);
}

function setWidget(id, patch) {
  if (!WIDGETS[id]) return;
  const c = cfg[id];
  if (!c) return;
  Object.assign(c, patch);
  const win = wins.get(id);
  if ('visible' in patch) patch.visible ? openWidget(id) : win?.close();
  if (win && !win.isDestroyed()) {
    if ('locked' in patch) applyLock(win, c.locked, activeWidgets.get(id));
    if ('scale' in patch) win.setBounds(defaultBounds(id));
  }
  saveCfg();
  pushState();
}

// Proporção da referência: 580 × 940, limitada à área útil do monitor.
function mainBounds() {
  const b = cfg.mainBounds;
  const saved = b && Number.isFinite(b.x) && Number.isFinite(b.y);
  const area = (saved ? screen.getDisplayMatching({ x: b.x, y: b.y, width: 580, height: 940 }) : screen.getPrimaryDisplay()).workArea;
  const size = { width: Math.min(580, area.width - 24), height: Math.min(940, area.height - 24) };
  if (!saved) return size;
  return { ...size,
    x: Math.max(area.x + 12, Math.min(b.x, area.x + area.width - size.width - 12)),
    y: Math.max(area.y + 12, Math.min(b.y, area.y + area.height - size.height - 12)),
  };
}

function createMain() {
  mainWin = new BrowserWindow({
    ...mainBounds(),
    // Sem barra do Windows: o nome e os botões (minimizar/fechar) são desenhados dentro do app.
    frame: false, transparent: true, hasShadow: false, resizable: false, maximizable: false, fullscreenable: false,
    backgroundColor: '#00000000', title: 'Lotus Tracker', icon: join(ROOT, 'icons', 'lotus-blue.png'), autoHideMenuBar: true, show: false,
    webPreferences: { additionalArguments: ['--lotus-rounded'], preload: PRELOAD, contextIsolation: true, sandbox: true, devTools: DEV, spellcheck: false },
  });
  // Aberto pelo Windows no login: sobe minimizado (a captura já fica rodando e os widgets abrem).
  const rememberMain = () => {
    if (!mainWin || mainWin.isMinimized()) return;
    const { x, y } = mainWin.getBounds();
    cfg.mainBounds = { x, y };
    saveCfg();
  };
  mainWin.on('move', rememberMain);
  mainWin.once('ready-to-show', () => { mainWin.show(); if (AUTOSTART) mainWin.minimize(); });
  mainWin.loadURL(BASE + '/');
  // Links externos (Npcap, GitHub) abrem no navegador padrão.
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
  mainWin.on('closed', () => { mainWin = null; app.quit(); });
}

ipcMain.handle('widget:list', () => pushState());
ipcMain.on('widget:activity', (event, id, active) => {
  const win = wins.get(id);
  if (!['party', 'skills'].includes(id) || !win || win.webContents !== event.sender) return;
  activeWidgets.set(id, !!active);
  applyLock(win, cfg[id].locked, !!active);
});
ipcMain.handle('widget:toggle', (_e, id, on) => setWidget(id, { visible: !!on }));
ipcMain.handle('widget:set', (_e, id, patch) => {
  const allowed = {};
  if ('locked' in patch) allowed.locked = !!patch.locked;
  if ('scale' in patch) allowed.scale = widgetScale(patch.scale);
  setWidget(id, allowed);
});
ipcMain.on('widget:close-self', e => {
  for (const [id, w] of wins) if (w.webContents === e.sender) setWidget(id, { visible: false });
});
ipcMain.handle('app:status', () => status);
// Botões da barra de título desenhada dentro do app (só valem para a janela principal).
ipcMain.on('win:minimize', e => { if (BrowserWindow.fromWebContents(e.sender) === mainWin) mainWin.minimize(); });
ipcMain.on('win:close', e => { if (BrowserWindow.fromWebContents(e.sender) === mainWin) mainWin.close(); });
// Opcional e só o usuário liga: abrir junto com o Windows deixa a captura rodando antes do jogo abrir.
ipcMain.handle('app:autostart', (_e, on) => {
  if (app.isPackaged && typeof on === 'boolean') app.setLoginItemSettings({ openAtLogin: on, args: ['--autostart'] });
  setStatus({ autostart: app.isPackaged && app.getLoginItemSettings().openAtLogin });
  return status.autostart;
});
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

/** Dev: código do Electron/servidor mudou — reinicia o app inteiro (a interface só recarrega). */
function watchAppCode() {
  let timer;
  const restart = name => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log(`[dev] ${name} mudou — reiniciando o app`);
      app.isQuitting = true;
      captureProc?.kill();
      app.relaunch();
      app.exit(0);
    }, 300);
  };
  watch(join(ROOT, 'electron'), (_e, name) => name && restart('electron/' + name));
  for (const f of ['server.mjs', 'js/encounter.js', 'js/util.js']) watch(join(ROOT, f), () => restart(f));
}

/** App instalado: interface nova no GitHub chega sozinha (veja live-ui.mjs). */
async function liveUiOverlay() {
  if (DEV) return '';
  try {
    const pkg = JSON.parse(readFileSync(join(app.getAppPath(), 'package.json'), 'utf8'));
    const source = uiRepository(pkg);
    if (!source) return '';
    const { owner, repo } = source;
    return await setupLiveUi({
      owner, repo, branch: 'main',
      appDir: app.getAppPath(), dataDir: app.getPath('userData'), appVersion: app.getVersion(),
      onUpdate: sha => { setStatus({ liveUi: sha }); notifyReload(); },
    });
  } catch (e) {
    console.warn('[live-ui]', e.message);
    return '';
  }
}

app.whenReady().then(async () => {
  try {
    await start(PORT, { overlay: await liveUiOverlay(), dev: DEV,
      onMovementStatus: message => setStatus({ movementState: message.state, movementMessage: message.message }),
      onGameFocus: updateGameFocus });
    if (DEV) watchAppCode();
  } catch (e) {
    // Outra instância já está servindo nesta porta: reaproveita.
    if (e.code !== 'EADDRINUSE') throw e;
  }
  loadCfg();
  delete cfg.movementEnabled; // migra a preferência antiga; movimento agora é integrado e automático.
  setStatus({ movementEnabled: true, movementState: 'starting', movementMessage: 'Inicializando leitura nativa de movimento.' });
  createMain();
  for (const id of Object.keys(WIDGETS)) if (cfg[id].visible) openWidget(id);
  startCapture();
  setupUpdater();

  const toggleLock = () => {
    const lock = ![...wins.keys()].every(id => cfg[id].locked);
    for (const id of wins.keys()) setWidget(id, { locked: lock });
  };
  if (!globalShortcut.register('PageDown', toggleLock)) console.warn('Tecla PgDown já está em uso por outro programa');
  globalShortcut.register('CommandOrControl+Shift+L', toggleLock);
  // Insert (ou Ctrl+Shift+H): mostra/esconde no jogo os widgets que estão ligados.
  const toggleWidgets = () => {
    const anyVisible = [...wins.values()].some(w => w.isVisible());
    for (const w of wins.values()) anyVisible ? w.hide() : w.showInactive();
  };
  if (!globalShortcut.register('Insert', toggleWidgets)) console.warn('Tecla Insert já está em uso por outro programa');
  if (!globalShortcut.register('PageUp', toggleWidgets)) console.warn('Tecla PgUp já está em uso por outro programa');
  globalShortcut.register('CommandOrControl+Shift+H', toggleWidgets);
});

app.on('before-quit', () => {
  app.isQuitting = true;
  // Persist final geometry even if Windows has not sent the end-of-drag event yet.
  for (const [id, win] of wins) if (!win.isDestroyed()) cfg[id].bounds = win.getBounds();
  flushCfg();
  stopCapture();
});
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
