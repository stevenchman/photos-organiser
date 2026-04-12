/**
 * Preload — exposes window controls to the renderer via contextBridge.
 * Node/Electron APIs never leak into the renderer.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('APP', {
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close:    () => ipcRenderer.send('window-close'),
    onState:  (cb) => ipcRenderer.on('window-state', (_, state) => cb(state)),
  },
});
