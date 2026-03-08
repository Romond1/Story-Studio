/// <reference types="vite/client" />

import type { AssetItem, ImportResult, ProjectData, ProjectState } from '../shared/types';

declare global {
  interface Window {
    appApi: {
      createProject: () => Promise<ProjectState | null>;
      openProject: () => Promise<ProjectState | null>;
      openProjectByPath: (folderPath: string) => Promise<ProjectState | null>;
      importMedia: () => Promise<ImportResult | null>;
      importAudio: () => Promise<AssetItem[] | null>;
      saveProject: (
        data: ProjectData,
        mode?: 'save' | 'saveAs'
      ) => Promise<{ lastSavedAt: string; folderPath: string } | null>;
      forceClose: () => void;
      onRequestClose: (callback: () => void) => () => void;
    };
  }
}
