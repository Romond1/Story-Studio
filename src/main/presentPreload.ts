import { contextBridge, ipcRenderer } from 'electron';
import type { PresentApi, PresentEnvelope } from '../shared/presentationSnapshot';

const api: PresentApi = {
  reportViewport: viewport => ipcRenderer.send('present:viewport', viewport),
  subscribeMedia(listener) {
    const handle = (_event: Electron.IpcRendererEvent, packet: import('../shared/presentationMedia').MediaPacket) => listener(packet);
    ipcRenderer.on('present:media-signal', handle);
    return () => ipcRenderer.removeListener('present:media-signal', handle);
  },
  sendMedia: packet => ipcRenderer.send('present:media-signal', packet),
  subscribeSnapshot(listener) {
    const handle = (_event: Electron.IpcRendererEvent, snapshot: PresentEnvelope) => listener(snapshot);
    ipcRenderer.on('present:snapshot', handle);
    return () => ipcRenderer.removeListener('present:snapshot', handle);
  },
  requestSnapshot: () => ipcRenderer.invoke('present:snapshot'),
  reportApplied: (generation, sequence, error, detail) => ipcRenderer.send('present:status', generation, sequence, error === true, detail),
};
contextBridge.exposeInMainWorld('presentApi', api);
