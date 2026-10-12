/// <reference types="vite/client" />

import type { AssetItem, ImportResult, ProjectData, ProjectState, StudentRosterSettings } from '../shared/types';
import type { AudioSettingsV1 } from '../shared/audioSettings';
import type { PresentSnapshot } from '../shared/presentationSnapshot';
import type { PresentStatus } from '../shared/presentStatus';
import type { LessonProject, LessonProjectState } from '../shared/lesson/model';

declare global {
  interface Window {
    cameraControl?: import('../shared/cameraProtocol').CameraControlApi;
    cameraPresenter?: import('../shared/cameraProtocol').CameraPresenterApi;
    lessonApi: {
      createDraft: (sequence: 'story' | 'activation') => Promise<LessonProjectState>;
      createProject: () => Promise<LessonProjectState | null>;
      openProject: () => Promise<LessonProjectState | null>;
      openProjectByPath: (folderPath: string) => Promise<LessonProjectState | null>;
      activateProject: (token: string) => void;
      saveProject: (data: LessonProject, mode: 'save' | 'saveAs', expectedFolder: string) => Promise<{ lastSavedAt: string; folderPath: string } | null>;
    };
    appApi: {
      sendGameInput: (packet: import('../shared/gameHost').GameInputPacket) => void;
      onGameEnded: (callback: (event: import('../shared/gameHost').GameEndedEvent) => void) => () => void;
      getPresentMediaRuntime: () => Promise<import('../shared/presentationMedia').MediaRuntime>;
      onPresentMediaRuntime: (callback: (runtime: import('../shared/presentationMedia').MediaRuntime) => void) => () => void;
      onPresentMediaPacket: (callback: (packet: import('../shared/presentationMedia').MediaPacket) => void) => () => void;
      sendPresentMediaPacket: (packet: import('../shared/presentationMedia').MediaPacket) => void;
      revokePresentMedia: () => Promise<void>;
      getPresentStatus: () => Promise<PresentStatus>;
      onPresentStatus: (callback: (status: PresentStatus) => void) => () => void;
      openPresent: () => Promise<void>;
      publishPresentSnapshot: (snapshot: PresentSnapshot) => Promise<boolean>;
      launchGame: (snapshot: PresentSnapshot) => Promise<void>;
      createProject: () => Promise<ProjectState | null>;
      openProject: () => Promise<ProjectState | null>;
      openProjectByPath: (folderPath: string) => Promise<ProjectState | null>;
      activateProject: (token: string) => void;
      importMediaFolder: () => Promise<ImportResult | null>;
      importMedia: () => Promise<ImportResult | null>;
      importDroppedMedia: (filePaths: string[]) => Promise<ImportResult | null>;
      getPendingDroppedFilePaths: () => string[];
      getPathForFile: (file: File) => string;
      importAudio: () => Promise<AssetItem[] | null>;
      saveProject: (
        data: ProjectData,
        mode: 'save' | 'saveAs',
        expectedFolder: string,
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
