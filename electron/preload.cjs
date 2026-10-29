// Ponte segura entre as páginas (app e widgets) e o processo principal do Electron.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay', {
  list: () => ipcRenderer.invoke('widget:list'),
  toggle: (id, on) => ipcRenderer.invoke('widget:toggle', id, on),
  set: (id, patch) => ipcRenderer.invoke('widget:set', id, patch),
  closeSelf: () => ipcRenderer.send('widget:close-self'),
  onState: cb => ipcRenderer.on('widgets:state', (_e, state) => cb(state)),
});

contextBridge.exposeInMainWorld('desktop', {
  status: () => ipcRenderer.invoke('app:status'),
  onStatus: cb => ipcRenderer.on('app:status', (_e, s) => cb(s)),
  installUpdate: () => ipcRenderer.invoke('app:install-update'),
  recheckNpcap: () => ipcRenderer.invoke('app:recheck-npcap'),
  setAutostart: on => ipcRenderer.invoke('app:autostart', on),
});
