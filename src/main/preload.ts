import { contextBridge, ipcRenderer } from 'electron';
import type { ImportResult, ProjectData, ProjectState } from '../shared/types';

const api = {
  createProject: (): Promise<ProjectState | null> => ipcRenderer.invoke('project:create'),
  openProject: (): Promise<ProjectState | null> => ipcRenderer.invoke('project:open'),
  importMedia: (): Promise<ImportResult | null> => ipcRenderer.invoke('project:import-media'),
  saveProject: (data: ProjectData): Promise<{ lastSavedAt: string } | null> => ipcRenderer.invoke('project:save', data)
};

contextBridge.exposeInMainWorld('appApi', api);
