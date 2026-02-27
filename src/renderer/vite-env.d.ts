/// <reference types="vite/client" />

import type { AssetItem, ImportResult, ProjectData, ProjectState } from '../shared/types';

declare global {
  interface Window {
    appApi: {
      createProject: () => Promise<ProjectState | null>;
      openProject: () => Promise<ProjectState | null>;
      importMedia: () => Promise<ImportResult | null>;
      importFiles: (paths: string[]) => Promise<ImportResult | null>;
      importAudio: () => Promise<AssetItem[] | null>;
      importBubbleTemplate: () => Promise<AssetItem | null>;
      saveProject: (data: ProjectData) => Promise<{ lastSavedAt: string } | null>;
      saveProjectAs: (data: ProjectData) => Promise<{ success: boolean; filePath?: string; lastSavedAt?: string; cancelled?: boolean } | null>;
      forceClose: () => void;
      getPathForFile: (file: File) => string;
      onRequestClose: (callback: () => void) => () => void;
    };
    api: {
      importBubbleTemplate: () => Promise<AssetItem | null>;
      importLanguageBoardBackground: () => Promise<AssetItem | null>;
    };
  }
}
