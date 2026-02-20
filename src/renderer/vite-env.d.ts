/// <reference types="vite/client" />

import type { ImportResult, ProjectData, ProjectState } from '../shared/types';

declare global {
  interface Window {
    appApi: {
      createProject: () => Promise<ProjectState | null>;
      openProject: () => Promise<ProjectState | null>;
      importMedia: () => Promise<ImportResult | null>;
      importAudio: () => Promise<AssetItem[] | null>;
      saveProject: (data: ProjectData) => Promise<{ lastSavedAt: string } | null>;
      forceClose: () => void;
      onRequestClose: (callback: () => void) => () => void;
    };
  }
}
