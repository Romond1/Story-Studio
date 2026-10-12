import { contextBridge, ipcRenderer } from 'electron';
import type { CameraPresenterApi, CameraSettings } from '../shared/cameraProtocol';

const cameraPresenter: CameraPresenterApi = {
  get: () => ipcRenderer.invoke('camera:present-get'),
  report: status => ipcRenderer.send('camera:status', status),
  subscribe: listener => {
    const handle = (_event: Electron.IpcRendererEvent, settings: CameraSettings) => listener(settings);
    ipcRenderer.on('camera:settings', handle);
    return () => ipcRenderer.removeListener('camera:settings', handle);
  },
};
contextBridge.exposeInMainWorld('cameraPresenter', cameraPresenter);
import type { PresentApi, PresentEnvelope } from '../shared/presentationSnapshot';

const api: PresentApi = {
  subscribeGameInput(listener) {
    const handle = (_event: Electron.IpcRendererEvent, packet: import('../shared/gameHost').GameInputPacket) => listener(packet);
    ipcRenderer.on('present:game-input', handle);
    return () => ipcRenderer.removeListener('present:game-input', handle);
  },
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
