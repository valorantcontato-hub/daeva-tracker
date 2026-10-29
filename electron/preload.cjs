// Ponte segura entre as páginas (app e widgets) e o processo principal do Electron.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay', {
  list: () => ipcRenderer.invoke('widget:list'),
  toggle: (id, on) => ipcRenderer.invoke('widget:toggle', id, on),
  set: (id, patch) => ipcRenderer.invoke('widget:set', id, patch),
  activity: (id, active) => ipcRenderer.send('widget:activity', id, !!active),
  closeSelf: () => ipcRenderer.send('widget:close-self'),
  positioning: on => ipcRenderer.invoke('widget:positioning', !!on),
  getPositioning: () => ipcRenderer.invoke('widget:positioning-state'),
  onPositioning: cb => ipcRenderer.on('widgets:positioning', (_e, on) => cb(!!on)),
  resetPositions: () => ipcRenderer.invoke('widget:reset-positions'),
  getShopMarks: () => ipcRenderer.invoke('shopmarks:get'),
  setShopMarks: on => ipcRenderer.invoke('shopmarks:set', !!on),
  onState: cb => ipcRenderer.on('widgets:state', (_e, state) => cb(state)),
});

contextBridge.exposeInMainWorld('desktop', {
  rounded: process.argv.includes('--lotus-rounded'),
  status: () => ipcRenderer.invoke('app:status'),
  onStatus: cb => ipcRenderer.on('app:status', (_e, s) => cb(s)),
  installUpdate: () => ipcRenderer.invoke('app:install-update'),
  recheckNpcap: () => ipcRenderer.invoke('app:recheck-npcap'),
  setAutostart: on => ipcRenderer.invoke('app:autostart', on),
  minimize: () => ipcRenderer.send('win:minimize'),
  close: () => ipcRenderer.send('win:close'),
});
