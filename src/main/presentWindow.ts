import { parsePresentViewport } from '../shared/teachWorkspace';
import { BrowserWindow, ipcMain, screen } from 'electron';
import path from 'node:path';
import { PresentSnapshotRelay } from '../shared/presentationSnapshot';
import type { PresentStatus } from '../shared/presentStatus';
import { parseMediaPacket, packetMatches, type MediaRuntime } from '../shared/presentationMedia';

let attachInstalledControl: (() => void) | null = null;
/** Transitional transport. This module cannot change a lesson or issue Core commands. */
export function installPresentWindow(getControl: () => BrowserWindow | null): void {
  if (attachInstalledControl) { attachInstalledControl(); return; }
  const relay = new PresentSnapshotRelay();
  let present: BrowserWindow | null = null;
  let bounds: Electron.Rectangle | null = null;
  let openedBefore = false;
  let mediaRuntime: MediaRuntime = { generation: 0, available: false };
  const envelope = () => ({ ...relay.envelope, rendererGeneration: mediaRuntime.generation });
  const mediaLifecycle = (available: boolean, invalidate = true) => {
    mediaRuntime = { generation: mediaRuntime.generation + (invalidate ? 1 : 0), available };
    const control = getControl();
    if (control && !control.isDestroyed()) control.webContents.send('present:media-runtime', mediaRuntime);
  };
  let status: PresentStatus = { state: 'closed', generation: 0, sequence: 0, needsReshare: false };
  const reportStatus = (state: PresentStatus['state']) => {
    status = { ...status, state, detail: state === 'error' ? status.detail : undefined, generation: relay.envelope.generation, sequence: relay.envelope.sequence };
    const control = getControl();
    if (control && !control.isDestroyed() && !control.webContents.isDestroyed()) control.webContents.send('present:lifecycle', status);
  };
  const authorized = (event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent, window: BrowserWindow | null) =>
    !!window && !window.isDestroyed() && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame;
  const send = () => {
    if (present && !present.isDestroyed() && !present.webContents.isDestroyed()) present.webContents.send('present:snapshot', envelope());
  };
  const reset = () => { mediaLifecycle(!!present && !present.isDestroyed()); relay.reset(); send(); if (present) reportStatus('connecting'); };
  const attached = new WeakSet<BrowserWindow>();
  attachInstalledControl = () => {
    const control = getControl();
    if (!control || attached.has(control)) return;
    attached.add(control);
    control.webContents.on('did-start-navigation', (_event, _url, inPlace, mainFrame) => { if (mainFrame && !inPlace) reset(); });
    control.webContents.on('render-process-gone', reset);
    control.on('closed', () => { reset(); present?.close(); });
  };
  attachInstalledControl();

  const keepPresentReachable = () => {
    if (!present || present.isDestroyed()) return;
    const current = present.getBounds();
    const displays = screen.getAllDisplays();
    if (displays.some(({ workArea: a }) => current.x >= a.x && current.y >= a.y && current.x + current.width <= a.x + a.width && current.y + current.height <= a.y + a.height)) return;
    const work = screen.getDisplayMatching(getControl()?.getBounds() ?? current).workArea;
    const width = Math.min(current.width, work.width), height = Math.min(current.height, work.height);
    present.setBounds({ x: work.x + Math.floor((work.width - width) / 2), y: work.y + Math.floor((work.height - height) / 2), width, height });
  };
  screen.on('display-removed', keepPresentReachable);
  screen.on('display-metrics-changed', keepPresentReachable);

  ipcMain.handle('present:media-runtime', event => {
    if (!authorized(event, getControl())) throw new Error('Only Control may request media runtime.');
    return mediaRuntime;
  });
  ipcMain.handle('present:media-revoke', event => {
    if (!authorized(event, getControl())) throw new Error('Only Control may revoke media.');
    mediaLifecycle(mediaRuntime.available); send();
  });
  ipcMain.on('present:media-signal', (event, value: unknown) => {
    const fromControl = authorized(event, getControl());
    if (!fromControl && !authorized(event, present)) return;
    const packet = parseMediaPacket(value);
    const target = relay.envelope.snapshot?.target;
    if (!mediaRuntime.available || !packet || target?.kind !== 'video' || !packetMatches(packet, target.media, mediaRuntime.generation)) return;
    if (fromControl ? !['answer','ice','receiver-ready'].includes(packet.type) : !['offer','ice','status'].includes(packet.type)) return;
    if (packet.status && packet.status.epoch !== target.media.epoch) return;
    const destination = fromControl ? present : getControl();
    if (destination && !destination.isDestroyed() && !destination.webContents.isDestroyed()) destination.webContents.send('present:media-signal', packet);
  });

  ipcMain.on('present:viewport', (event, value: unknown) => {
    if (!authorized(event, present)) return;
    const viewport = parsePresentViewport(value);
    if (!viewport || (status.viewport?.width === viewport.width && status.viewport?.height === viewport.height)) return;
    status = { ...status, viewport };
    reportStatus(status.state);
  });

  ipcMain.handle('present:get-status', event => {
    if (!authorized(event, getControl())) throw new Error('Only Control may request Present status.');
    return status;
  });

  ipcMain.handle('present:open', async event => {
    if (!authorized(event, getControl())) throw new Error('Present can only be opened by Control.');
    if (present && !present.isDestroyed()) { present.show(); present.focus(); return; }
    const work = screen.getDisplayMatching(getControl()!.getBounds()).workArea;
    const reachable = bounds && screen.getAllDisplays().some(display => {
      const a = display.workArea;
      return bounds!.x >= a.x && bounds!.y >= a.y && bounds!.x + bounds!.width <= a.x + a.width && bounds!.y + bounds!.height <= a.y + a.height;
    });
    const width = Math.min(960, work.width); const height = Math.min(600, work.height);
    const placement = reachable ? bounds! : { x: work.x + Math.floor((work.width - width) / 2), y: work.y + Math.floor((work.height - height) / 2), width, height };
    const window = new BrowserWindow({ ...placement, title: 'Story Studio — Present', backgroundColor: '#08090c', resizable: true,
      autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'presentPreload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
    present = window;
    let crashed = false;
    status = { ...status, needsReshare: openedBefore };
    openedBefore = true;
    reportStatus('connecting');
    window.setMenu(null);
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.webContents.on('did-start-navigation', (_event, _url, inPlace, mainFrame) => { if (mainFrame && !inPlace) { mediaLifecycle(false); reportStatus('connecting'); } });
    window.webContents.on('did-finish-load', () => { mediaLifecycle(true, false); send(); });
    window.on('close', () => { bounds = window.getBounds(); });
    window.on('closed', () => { if (present === window) { present = null; mediaLifecycle(false); reportStatus(crashed ? 'error' : 'closed'); } });
    // Crashed Present never takes Control with it. Reopen creates a fresh renderer.
    window.webContents.on('render-process-gone', () => { crashed = true; if (!window.isDestroyed()) window.destroy(); });
    try {
      const devUrl = process.env.VITE_DEV_SERVER_URL;
      if (devUrl) await window.loadURL(new URL('present.html', devUrl.endsWith('/') ? devUrl : `${devUrl}/`).href);
      else await window.loadFile(path.join(__dirname, '../../renderer/present.html'));
    } catch (error) { crashed = true; if (!window.isDestroyed()) window.destroy(); throw error; }
  });
  ipcMain.handle('present:publish', (event, snapshot: unknown) => {
    if (!authorized(event, getControl())) throw new Error('Only Control may publish presentation state.');
    const accepted = relay.publish(snapshot);
    if (accepted) { if (present) reportStatus('connecting'); send(); }
    return !!accepted;
  });
  ipcMain.handle('present:snapshot', event => {
    if (!authorized(event, present)) throw new Error('Only Present may request a snapshot.');
    return envelope();
  });
  ipcMain.on('present:status', (event, generation: unknown, sequence: unknown, error: unknown, detail: unknown) => {
    if (!authorized(event, present)) return;
    if (generation !== relay.envelope.generation || sequence !== relay.envelope.sequence) return;
    const mediaTarget = relay.envelope.snapshot?.target;
    if (mediaTarget?.kind === 'video' && mediaTarget.media.rendererGeneration !== mediaRuntime.generation) return;
    status = { ...status, detail: error === true ? (typeof detail === 'string' ? detail.slice(0, 2048) : 'Some lesson content could not be displayed.') : undefined };
    reportStatus(error === true ? 'error' : 'ready');
    // Readiness only: never a lesson command or revision mutation.
    if (error === true) console.warn('[Present]', status.detail);
  });
}
