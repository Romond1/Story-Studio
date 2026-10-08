import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { AssetItem, ImportResult, ProjectData, ProjectState, StudentRosterSettings } from '../shared/types';
import type { AudioSettingsV1 } from '../shared/audioSettings';
import type { PresentSnapshot } from '../shared/presentationSnapshot';
import type { PresentStatus } from '../shared/presentStatus';

let latestDroppedFilePaths: string[] = [];

(globalThis as any).addEventListener(
  'drop',
  (event: any) => {
    latestDroppedFilePaths = Array.from(event.dataTransfer?.files ?? [])
      .map((file) => webUtils.getPathForFile(file as any))
      .filter((filePath): filePath is string => filePath.length > 0);
  },
  true,
);

const api = {
  getPresentMediaRuntime: () => ipcRenderer.invoke('present:media-runtime'),
  onPresentMediaRuntime: (callback: (runtime: import('../shared/presentationMedia').MediaRuntime) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, runtime: import('../shared/presentationMedia').MediaRuntime) => callback(runtime);
    ipcRenderer.on('present:media-runtime', listener);
    return () => ipcRenderer.removeListener('present:media-runtime', listener);
  },
  onPresentMediaPacket: (callback: (packet: import('../shared/presentationMedia').MediaPacket) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, packet: import('../shared/presentationMedia').MediaPacket) => callback(packet);
    ipcRenderer.on('present:media-signal', listener);
    return () => ipcRenderer.removeListener('present:media-signal', listener);
  },
  sendPresentMediaPacket: (packet: import('../shared/presentationMedia').MediaPacket) => ipcRenderer.send('present:media-signal', packet),
  revokePresentMedia: () => ipcRenderer.invoke('present:media-revoke'),
  getPresentStatus: (): Promise<PresentStatus> => ipcRenderer.invoke('present:get-status'),
  onPresentStatus: (callback: (status: PresentStatus) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: PresentStatus) => callback(status);
    ipcRenderer.on('present:lifecycle', listener);
    return () => ipcRenderer.removeListener('present:lifecycle', listener);
  },
  openPresent: (): Promise<void> => ipcRenderer.invoke('present:open'),
  publishPresentSnapshot: (snapshot: PresentSnapshot): Promise<boolean> => ipcRenderer.invoke('present:publish', snapshot),
  createProject: (): Promise<ProjectState | null> => ipcRenderer.invoke('project:create'),
  openProject: (): Promise<ProjectState | null> => ipcRenderer.invoke('project:open'),
  openProjectByPath: (folderPath: string): Promise<ProjectState | null> => ipcRenderer.invoke('project:open-path', folderPath),
  activateProject: (token: string): void => {
    const error = ipcRenderer.sendSync('project:activate', token);
    if (error) throw new Error(error);
  },
  importMediaFolder: (): Promise<ImportResult | null> => ipcRenderer.invoke('project:import-folder'),
  importMedia: (): Promise<ImportResult | null> => ipcRenderer.invoke('project:import-media'),
  importDroppedMedia: (filePaths: string[]): Promise<ImportResult | null> => ipcRenderer.invoke('project:import-dropped-media', filePaths),
  getPendingDroppedFilePaths: (): string[] => latestDroppedFilePaths,
  getPathForFile: (file: any): string => webUtils.getPathForFile(file),
  importAudio: (): Promise<AssetItem[] | null> => ipcRenderer.invoke('project:import-audio'),
  importBubbleTemplate: (): Promise<AssetItem | null> => ipcRenderer.invoke('project:import-bubble-template'),
  saveProject: (
    data: ProjectData,
    mode: 'save' | 'saveAs',
    expectedFolder: string,
  ): Promise<{ lastSavedAt: string; folderPath: string } | null> => ipcRenderer.invoke('project:save', data, mode, expectedFolder),
  getStudentRoster: (): Promise<StudentRosterSettings> => ipcRenderer.invoke('settings:get-student-roster'),
  saveStudentRoster: (settings: StudentRosterSettings): Promise<StudentRosterSettings> =>
    ipcRenderer.invoke('settings:save-student-roster', settings),
  getAudioSettings: (): Promise<AudioSettingsV1> => ipcRenderer.invoke('settings:get-audio'),
  saveAudioSettings: (settings: AudioSettingsV1): Promise<AudioSettingsV1> =>
    ipcRenderer.invoke('settings:save-audio', settings),
  forceClose: () => ipcRenderer.send('app:force-close'),
  reloadApp: () => ipcRenderer.send('app:reload'),
  onRequestClose: (callback: () => void) => {
    ipcRenderer.on('app:request-close', () => callback());
    return () => {
      ipcRenderer.removeAllListeners('app:request-close');
    };
  }
};

contextBridge.exposeInMainWorld('appApi', api);
contextBridge.exposeInMainWorld('api', {
  importBubbleTemplate: () => ipcRenderer.invoke('import-bubble-template')
});
