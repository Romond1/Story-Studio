import { contextBridge, ipcRenderer } from 'electron';
import type { AssetItem, ImportResult, ProjectData, ProjectState } from '../shared/types';

const api = {
  createProject: (): Promise<ProjectState | null> => ipcRenderer.invoke('project:create'),
  openProject: (): Promise<ProjectState | null> => ipcRenderer.invoke('project:open'),
  importMedia: (): Promise<ImportResult | null> => ipcRenderer.invoke('project:import-media'),
  importAudio: (): Promise<AssetItem[] | null> => ipcRenderer.invoke('project:import-audio'),
  importBubbleTemplate: (): Promise<AssetItem | null> => ipcRenderer.invoke('project:import-bubble-template'),
  saveProject: (data: ProjectData): Promise<{ lastSavedAt: string } | null> => ipcRenderer.invoke('project:save', data),
  saveProjectAs: (data: ProjectData): Promise<{ success: boolean; filePath?: string; lastSavedAt?: string; cancelled?: boolean } | null> => ipcRenderer.invoke('project:save-as', data),
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
  importBubbleTemplate: () => ipcRenderer.invoke('import-bubble-template'),
  importLanguageBoardBackground: () => ipcRenderer.invoke('import-language-bg')
});
