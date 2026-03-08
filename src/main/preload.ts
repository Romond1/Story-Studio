import { contextBridge, ipcRenderer } from 'electron';
import type { AssetItem, ImportResult, ProjectData, ProjectState } from '../shared/types';

const api = {
  createProject: (): Promise<ProjectState | null> => ipcRenderer.invoke('project:create'),
  openProject: (): Promise<ProjectState | null> => ipcRenderer.invoke('project:open'),
  openProjectByPath: (folderPath: string): Promise<ProjectState | null> => ipcRenderer.invoke('project:open-path', folderPath),
  importMedia: (): Promise<ImportResult | null> => ipcRenderer.invoke('project:import-media'),
  importAudio: (): Promise<AssetItem[] | null> => ipcRenderer.invoke('project:import-audio'),
  importBubbleTemplate: (): Promise<AssetItem | null> => ipcRenderer.invoke('project:import-bubble-template'),
  saveProject: (
    data: ProjectData,
    mode: 'save' | 'saveAs' = 'save'
  ): Promise<{ lastSavedAt: string; folderPath: string } | null> => ipcRenderer.invoke('project:save', data, mode),
  forceClose: () => ipcRenderer.send('app:force-close'),
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
