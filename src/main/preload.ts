import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { AssetItem, ImportResult, ProjectData, ProjectState, StudentRosterSettings } from '../shared/types';

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
  createProject: (): Promise<ProjectState | null> => ipcRenderer.invoke('project:create'),
  openProject: (): Promise<ProjectState | null> => ipcRenderer.invoke('project:open'),
  openProjectByPath: (folderPath: string): Promise<ProjectState | null> => ipcRenderer.invoke('project:open-path', folderPath),
  importMedia: (): Promise<ImportResult | null> => ipcRenderer.invoke('project:import-media'),
  importDroppedMedia: (filePaths: string[]): Promise<ImportResult | null> => ipcRenderer.invoke('project:import-dropped-media', filePaths),
  getPendingDroppedFilePaths: (): string[] => latestDroppedFilePaths,
  getPathForFile: (file: any): string => webUtils.getPathForFile(file),
  importAudio: (): Promise<AssetItem[] | null> => ipcRenderer.invoke('project:import-audio'),
  importBubbleTemplate: (): Promise<AssetItem | null> => ipcRenderer.invoke('project:import-bubble-template'),
  saveProject: (
    data: ProjectData,
    mode: 'save' | 'saveAs' = 'save'
  ): Promise<{ lastSavedAt: string; folderPath: string } | null> => ipcRenderer.invoke('project:save', data, mode),
  getStudentRoster: (): Promise<StudentRosterSettings> => ipcRenderer.invoke('settings:get-student-roster'),
  saveStudentRoster: (settings: StudentRosterSettings): Promise<StudentRosterSettings> =>
    ipcRenderer.invoke('settings:save-student-roster', settings),
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
