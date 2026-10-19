import { parsePresentViewport } from '../shared/teachWorkspace';
import { installCameraBroadcast } from './cameraBroadcast';
import { installTranslationBroadcast } from './translationBroadcast';
import { BrowserWindow, ipcMain, screen } from 'electron';
import path from 'node:path';
import { PresentSnapshotRelay, parsePresentSnapshot } from '../shared/presentationSnapshot';
import type { PresentStatus } from '../shared/presentStatus';
import { parseMediaPacket, packetMatches, type MediaRuntime } from '../shared/presentationMedia';
import { parseGameInput, type GameEndedEvent } from '../shared/gameHost';
import { ModuleTransport } from './moduleTransport';
import { parseHostToModuleMessage, type HostToModuleMessage, type ModuleToHostMessage } from '../shared/modules/protocol';
export interface ProgressionTransportObserver {
  authorizeInitialize(message:HostToModuleMessage):boolean;
  acceptedModule(message:ModuleToHostMessage):void;
  hostCommand(message:HostToModuleMessage):void;
  retire(instanceId?:string):void;
}

let attachInstalledControl: (() => void) | null = null;
/** Transitional transport. This module cannot change a lesson or issue Core commands. */
export function installPresentWindow(getControl: () => BrowserWindow | null, progression?:ProgressionTransportObserver): void {
  if (attachInstalledControl) { attachInstalledControl(); return; }
  const relay = new PresentSnapshotRelay();
  let present: BrowserWindow | null = null;
  const camera = installCameraBroadcast(getControl, () => present);
  const translation = installTranslationBroadcast(getControl, () => present);
  let bounds: Electron.Rectangle | null = null;
  let openedBefore = false;
  let mediaRuntime: MediaRuntime = { generation: 0, available: false };
  let lastEndedGame: string | null = null;
  let moduleInstance: string | undefined;
  const modules = new ModuleTransport(() => {
    const target = relay.envelope.snapshot?.target;
    return { ...mediaRuntime, available: mediaRuntime.available && target?.kind === 'game' && target.instanceId !== lastEndedGame,
      ...(target?.kind === 'game' ? { instanceId: target.instanceId, moduleType: target.gameId } : {}) };
  }, message => { if (present && !present.isDestroyed()) present.webContents.send('present:module-host', message); },
  message => { progression?.acceptedModule(message); const control = getControl(); if (control && !control.isDestroyed()) control.webContents.send('present:module-event', message); });
  const envelope = () => {
    const value = relay.envelope;
    const target = value.snapshot?.target;
    // A closed/reloaded owner cannot be silently recreated from a retained snapshot.
    const snapshot = target?.kind === 'game' && target.instanceId === lastEndedGame
      ? { ...value.snapshot!, target: { kind: 'empty' as const, occurrenceId: `game-ended:${target.instanceId}` } } : value.snapshot;
    return { ...value, snapshot, rendererGeneration: mediaRuntime.generation };
  };
  const gameEnded = (reason: GameEndedEvent['reason']) => {
    const target = relay.envelope.snapshot?.target;
    if (target?.kind !== 'game' || target.instanceId === lastEndedGame) return;
    lastEndedGame = target.instanceId;
    progression?.retire(target.instanceId);
    modules.clear();
    const control = getControl();
    if (control && !control.isDestroyed() && !control.webContents.isDestroyed()) control.webContents.send('present:game-ended', { instanceId: target.instanceId, reason });
  };
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
    const target = relay.envelope.snapshot?.target;
    const instance = target?.kind === 'game' ? target.instanceId : undefined;
    if (instance !== moduleInstance) { if(moduleInstance)progression?.retire(moduleInstance); modules.clear(); moduleInstance = instance; }
    if (present && !present.isDestroyed() && !present.webContents.isDestroyed()) present.webContents.send('present:snapshot', envelope());
  };
  const reset = () => { progression?.retire(); modules.clear(); translation.reset(); camera.reset(); mediaLifecycle(!!present && !present.isDestroyed()); relay.reset(); send(); if (present) reportStatus('connecting'); };
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

  ipcMain.on('present:dash-zoom',(event,value:unknown)=>{
    if(!authorized(event,present)||!value||typeof value!=='object')return;
    const packet=value as {instanceId?:unknown;zoom?:unknown},target=relay.envelope.snapshot?.target;
    if(target?.kind!=='game'||target.gameId!=='hero-dash'||target.instanceId!==packet.instanceId||target.instanceId===lastEndedGame||typeof packet.zoom!=='number'||!Number.isFinite(packet.zoom)||packet.zoom<.65||packet.zoom>1.8)return;
    const control=getControl();if(control&&!control.isDestroyed())control.webContents.send('present:dash-zoom',{instanceId:target.instanceId,zoom:packet.zoom});
  });
  ipcMain.on('present:game-input', (event, value: unknown) => {
    if (!authorized(event, getControl())) return;
    const packet = parseGameInput(value);
    const target = relay.envelope.snapshot?.target;
    if (!packet || target?.kind !== 'game' || packet.instanceId !== target.instanceId || packet.instanceId === lastEndedGame || !present || present.isDestroyed() || present.webContents.isDestroyed()) return;
    present.webContents.send('present:game-input', packet);
  });

  ipcMain.handle('present:module-host', (event, value: unknown) => {
    if (!authorized(event, getControl())) throw new Error('Only Control may configure activities.');
    const message=parseHostToModuleMessage(value);if(!message)return false;
    if(message.type==='initialize'&&progression&&!progression.authorizeInitialize(message))return false;
    const accepted=modules.send(message);if(accepted)progression?.hostCommand(message);return accepted;
  });
  ipcMain.handle('present:module-get', (event, instanceId: unknown) => {
    if (!authorized(event, present)) throw new Error('Only Present may request its activity.');
    return typeof instanceId === 'string' ? modules.get(instanceId) : null;
  });
  ipcMain.on('present:module-event', (event, value: unknown) => {
    if (authorized(event, present)) modules.receive(value);
  });

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
    const media = target?.kind === 'video' || target?.kind === 'scene' ? target.media : undefined;
    if (!mediaRuntime.available || !packet || !media || !packetMatches(packet, media, mediaRuntime.generation)) return;
    if (fromControl ? !['answer','ice','receiver-ready'].includes(packet.type) : !['offer','ice','status'].includes(packet.type)) return;
    if (packet.status && packet.status.epoch !== media.epoch) return;
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

  const openPresent = async () => {
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
    let loaded = false;
    status = { ...status, needsReshare: openedBefore };
    openedBefore = true;
    reportStatus('connecting');
    window.setMenu(null);
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.webContents.on('did-start-navigation', (_event, _url, inPlace, mainFrame) => { if (mainFrame && !inPlace) { if (loaded) gameEnded('reload'); loaded = false; mediaLifecycle(false); reportStatus('connecting'); } });
    window.webContents.on('did-finish-load', () => { loaded = true; mediaLifecycle(true, false); send(); });
    window.on('close', () => { translation.reset(); camera.reset(); bounds = window.getBounds(); });
    window.webContents.on('render-process-gone', () => { translation.reset(); camera.reset(); });
    window.on('closed', () => { if (present === window) { gameEnded(crashed ? 'crashed' : 'closed'); present = null; mediaLifecycle(false); reportStatus(crashed ? 'error' : 'closed'); } });
    // Crashed Present never takes Control with it. Reopen creates a fresh renderer.
    window.webContents.on('render-process-gone', () => { crashed = true; if (!window.isDestroyed()) window.destroy(); });
    try {
      const devUrl = process.env.VITE_DEV_SERVER_URL;
      if (devUrl) await window.loadURL(new URL('present.html', devUrl.endsWith('/') ? devUrl : `${devUrl}/`).href);
      else await window.loadFile(path.join(__dirname, '../../renderer/present.html'));
    } catch (error) { crashed = true; if (!window.isDestroyed()) window.destroy(); throw error; }
  };
  ipcMain.handle('present:open', async event => {
    if (!authorized(event, getControl())) throw new Error('Present can only be opened by Control.');
    await openPresent();
  });
  ipcMain.handle('present:launch-game', async (event, value: unknown) => {
    if (!authorized(event, getControl())) throw new Error('Only Control may launch a game.');
    const snapshot = parsePresentSnapshot(value);
    if (snapshot?.target.kind !== 'game' || !relay.publish(snapshot)) throw new Error('The game session could not be registered. Try launching again.');
    // Commit the instance identity before showing/creating its owner. A close
    // event now always identifies the run Control just requested.
    if (present) reportStatus('connecting');
    send();
    await openPresent();
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
    const activeMedia = mediaTarget?.kind === 'video' || mediaTarget?.kind === 'scene' ? mediaTarget.media : undefined;
    if (activeMedia && activeMedia.rendererGeneration !== mediaRuntime.generation) return;
    status = { ...status, detail: error === true ? (typeof detail === 'string' ? detail.slice(0, 2048) : 'Some lesson content could not be displayed.') : undefined };
    reportStatus(error === true ? 'error' : 'ready');
    // Readiness only: never a lesson command or revision mutation.
    if (error === true) console.warn('[Present]', status.detail);
  });
}
