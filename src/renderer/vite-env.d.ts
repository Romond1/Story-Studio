/// <reference types="vite/client" />

import type { AssetItem, ImportResult, ProjectData, ProjectState, StudentRosterSettings } from '../shared/types';
import type { AudioSettingsV1 } from '../shared/audioSettings';

declare global {
  interface Window {
    appApi: {
      createProject: () => Promise<ProjectState | null>;
      openProject: () => Promise<ProjectState | null>;
      openProjectByPath: (folderPath: string) => Promise<ProjectState | null>;
      importMedia: () => Promise<ImportResult | null>;
      importDroppedMedia: (filePaths: string[]) => Promise<ImportResult | null>;
      getPendingDroppedFilePaths: () => string[];
      getPathForFile: (file: File) => string;
      importAudio: () => Promise<AssetItem[] | null>;
      saveProject: (
        data: ProjectData,
        mode?: 'save' | 'saveAs'
      ) => Promise<{ lastSavedAt: string; folderPath: string } | null>;
      getStudentRoster: () => Promise<StudentRosterSettings>;
      saveStudentRoster: (settings: StudentRosterSettings) => Promise<StudentRosterSettings>;
      getAudioSettings: () => Promise<AudioSettingsV1>;
      saveAudioSettings: (settings: AudioSettingsV1) => Promise<AudioSettingsV1>;
      forceClose: () => void;
      reloadApp: () => void;
      onRequestClose: (callback: () => void) => () => void;
    };
  }
}
