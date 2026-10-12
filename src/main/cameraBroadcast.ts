import { BrowserWindow, dialog, ipcMain } from 'electron';
import { CAMERA_DEFAULTS, parseCameraSettings, parseCameraStatus, type CameraState } from '../shared/cameraProtocol';

/** A sibling of the lesson relay. Device metadata/status travel only back to Control. */
export function installCameraBroadcast(getControl: () => BrowserWindow | null, getPresent: () => BrowserWindow | null) {
  let state: CameraState = { settings: { ...CAMERA_DEFAULTS }, status: { state: 'off', devices: [] } };
  let permissionGranted = false;
  let revision = 0;
  const authorized = (event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent, window: BrowserWindow | null) =>
    !!window && !window.isDestroyed() && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame;
  const send = (window: BrowserWindow | null, channel: string, value: unknown) => {
    if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) window.webContents.send(channel, value);
  };
  const publish = () => {
    send(getControl(), 'camera:state', state);
    send(getPresent(), 'camera:settings', state.settings);
  };
  const reset = () => {
    revision++;
    state = { settings: { ...state.settings, enabled: false }, status: { state: 'off', devices: [] } };
    publish();
  };
  ipcMain.handle('camera:control-get', event => {
    if (!authorized(event, getControl())) throw new Error('Only Control may read camera status.');
    return state;
  });
  ipcMain.handle('camera:present-get', event => {
    if (!authorized(event, getPresent())) throw new Error('Only Presenter may read camera intent.');
    return state.settings;
  });
  ipcMain.handle('camera:set', async (event, value: unknown) => {
    if (!authorized(event, getControl())) throw new Error('Only Control may change the camera.');
    const settings = parseCameraSettings(value);
    if (!settings) throw new Error('Invalid camera settings.');
    const request = ++revision;
    if (settings.enabled && !getPresent()) throw new Error('Open Presenter before enabling the camera.');
    if (settings.enabled && !permissionGranted) {
      // Electron auto-grants media by default. Ask explicitly in the private window,
      // then getUserMedia performs the actual OS/device permission request.
      const result = await dialog.showMessageBox(getControl()!, {
        type: 'question', title: 'Enable Presenter camera?',
        message: 'Allow Story Studio Presenter to use your camera?',
        detail: 'Your camera will appear in the Presenter window. No microphone is requested. Camera off releases the device.',
        buttons: ['Allow camera', 'Cancel'], defaultId: 1, cancelId: 1,
      });
      if (request !== revision || !authorized(event, getControl())) return state;
      if (result.response !== 0) return state;
      permissionGranted = true;
    }
    if (request !== revision) return state;
    const acquisitionChanged = settings.enabled !== state.settings.enabled || settings.deviceId !== state.settings.deviceId;
    state = { settings, status: acquisitionChanged ? { state: settings.enabled ? 'starting' : 'off', devices: state.status.devices } : state.status };
    publish();
    return state;
  });
  ipcMain.on('camera:status', (event, value: unknown) => {
    if (!authorized(event, getPresent())) return;
    const status = parseCameraStatus(value);
    if (!status || (!state.settings.enabled && status.state !== 'off')) return;
    state = { ...state, status };
    send(getControl(), 'camera:state', state);
  });
  return { reset };
}
