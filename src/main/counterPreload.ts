import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('counterWindow', {
  minimize: (): void => ipcRenderer.send('counter-window:minimize'),
  close: (): void => ipcRenderer.send('counter-window:close'),
});
