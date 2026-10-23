import type {StudentsApi} from '../shared/students/protocol';
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { TranslationControlApi } from '../shared/translation';
const translationControl:TranslationControlApi={
  prepare:settings=>ipcRenderer.invoke('translation:prepare',settings),
  getState:()=>ipcRenderer.invoke('translation:state-get'),
  subscribeState:listener=>{const handle=(_event:Electron.IpcRendererEvent,state:Parameters<typeof listener>[0])=>listener(state);ipcRenderer.on('translation:state',handle);return()=>ipcRenderer.removeListener('translation:state',handle);},
  run:request=>ipcRenderer.invoke('translation:run',request),
  cancel:(unload?:boolean)=>ipcRenderer.invoke('translation:cancel',unload),
  format:(text,mode)=>ipcRenderer.invoke('translation:format',text,mode),
  publish:caption=>ipcRenderer.invoke('translation:publish',caption),
  setAppearance:appearance=>ipcRenderer.invoke('translation:appearance',appearance),
  subscribeStatus:listener=>{const handle=(_event:Electron.IpcRendererEvent,status:string)=>listener(status);ipcRenderer.on('translation:status',handle);return()=>{ipcRenderer.removeListener('translation:status',handle);};},
};
contextBridge.exposeInMainWorld('translationControl',translationControl);
import type { CameraControlApi, CameraState } from '../shared/cameraProtocol';

const cameraControl: CameraControlApi = {
  get: () => ipcRenderer.invoke('camera:control-get'),
  set: settings => ipcRenderer.invoke('camera:set', settings),
  subscribe: listener => {
    const handle = (_event: Electron.IpcRendererEvent, state: CameraState) => listener(state);
    ipcRenderer.on('camera:state', handle);
    return () => ipcRenderer.removeListener('camera:state', handle);
  },
};
contextBridge.exposeInMainWorld('cameraControl', cameraControl);
import type { AssetItem, MediaImportContext, ImportResult, ProjectData, ProjectState, StudentRosterSettings } from '../shared/types';
import type { AudioSettingsV1 } from '../shared/audioSettings';
import type { PresentSnapshot } from '../shared/presentationSnapshot';
import type { PresentStatus } from '../shared/presentStatus';
import type { LessonProject, LessonProjectState } from '../shared/lesson/model';

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

const mediaRegistry: import('../shared/mediaRegistryProtocol').MediaRegistryApi = {
  getLease: folder => ipcRenderer.invoke('media-registry:lease', folder),
  register: request => ipcRenderer.invoke('media-registry:register', request),
  resolve: request => ipcRenderer.invoke('media-registry:resolve', request),
};
const api = {
  onDashZoom:(listener:(packet:{instanceId:string;zoom:number})=>void)=>{const handle=(_event:Electron.IpcRendererEvent,packet:{instanceId:string;zoom:number})=>listener(packet);ipcRenderer.on('present:dash-zoom',handle);return()=>ipcRenderer.removeListener('present:dash-zoom',handle);},
  heroDash:{list:()=>ipcRenderer.invoke('hero-dash:list'),importImages:(paths?:string[])=>ipcRenderer.invoke('hero-dash:import',paths),saveCollection:(id:string|undefined,config:import('../shared/heroDash').DashConfig,mediaMap:Record<string,string>)=>ipcRenderer.invoke('hero-dash:save',id,config,mediaMap),loadCollection:(id:string)=>ipcRenderer.invoke('hero-dash:load',id)},
  progression: Object.fromEntries(['getSnapshot','registerRun','recordEvent','lifecycle','completeActivation','decideReward','requestReward','adjustReward','advanceRelic','completeEpisode','getRunInventory'].map(method=>[method,(input:unknown)=>ipcRenderer.invoke(`progression:${method}`,input)])),
  mediaRegistry,
  derivedMedia: { begin: (request: Parameters<import('../shared/episodeProtocol').DerivedMediaApi['begin']>[0]) => ipcRenderer.invoke('derived-media:begin', request), getSource: (request: import('../shared/episodeProtocol').DerivedSourceRequest) => ipcRenderer.invoke('derived-media:source', request), publish: (request: import('../shared/episodeProtocol').PublishDerivedRequest) => ipcRenderer.invoke('derived-media:publish', request) } satisfies import('../shared/episodeProtocol').DerivedMediaApi,
  launchGame: (snapshot: PresentSnapshot): Promise<void> => ipcRenderer.invoke('present:launch-game', snapshot),
  sendGameInput: (packet: import('../shared/gameHost').GameInputPacket): void => ipcRenderer.send('present:game-input', packet),
  sendModuleHost: (message: import('../shared/modules/protocol').HostToModuleMessage): Promise<boolean> => ipcRenderer.invoke('present:module-host', message),
  onModuleEvent: (listener: (message: import('../shared/modules/protocol').ModuleToHostMessage) => void): (() => void) => {
    const handle = (_event: Electron.IpcRendererEvent, message: import('../shared/modules/protocol').ModuleToHostMessage) => listener(message);
    ipcRenderer.on('present:module-event', handle);
    return () => ipcRenderer.removeListener('present:module-event', handle);
  },
  onGameEnded: (callback: (event: import('../shared/gameHost').GameEndedEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, event: import('../shared/gameHost').GameEndedEvent) => callback(event);
    ipcRenderer.on('present:game-ended', listener);
    return () => ipcRenderer.removeListener('present:game-ended', listener);
  },
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
  importMediaFolder: (context?: MediaImportContext): Promise<ImportResult | null> => ipcRenderer.invoke('project:import-folder', context),
  importMedia: (context?: MediaImportContext): Promise<ImportResult | null> => ipcRenderer.invoke('project:import-media', context),
  importDroppedMedia: (filePaths: string[], context?: MediaImportContext): Promise<ImportResult | null> => ipcRenderer.invoke('project:import-dropped-media', filePaths, context),
  getPendingDroppedFilePaths: (): string[] => latestDroppedFilePaths,
  getPathForFile: (file: any): string => webUtils.getPathForFile(file),
  importAudioResult: (): Promise<ImportResult | null> => ipcRenderer.invoke('project:import-audio-result'),
  importAudio: (): Promise<AssetItem[] | null> => ipcRenderer.invoke('project:import-audio'),
  importBubbleTemplate: (): Promise<AssetItem | null> => ipcRenderer.invoke('project:import-bubble-template'),
  saveProject: (
    data: ProjectData,
    mode: 'save' | 'saveAs',
    expectedFolder: string,
  ): Promise<{ lastSavedAt: string; folderPath: string } | null> => ipcRenderer.invoke('project:save', data, mode, expectedFolder),
  students: Object.fromEntries(['getSnapshot','createProfile','updateProfile','setArchived','mapLegacy','importProfile','createClass','updateClass','setClassArchived','selectClass'].map(method=>[method,(input:unknown)=>ipcRenderer.invoke('students:'+method,input)])) as unknown as StudentsApi,
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
contextBridge.exposeInMainWorld('lessonApi', {
  autosave: (data: LessonProject, folder: string) => ipcRenderer.invoke('lesson:autosave', data, folder),
  recoveryList: (folder: string) => ipcRenderer.invoke('lesson:recovery-list', folder),
  recoveryRead: (folder: string, name: string, current?: LessonProject) => ipcRenderer.invoke('lesson:recovery-read', folder, name, current),
  exportPackage: (data: LessonProject, expectedFolder: string) => ipcRenderer.invoke('lesson:export-package', data, expectedFolder),
  importPackage: () => ipcRenderer.invoke('lesson:import-package'),
  convertProject: (data: LessonProject, adventure: import('../shared/episodeProtocol').EpisodeAdventure, expectedFolder: string) => ipcRenderer.invoke('lesson:convert', data, adventure, expectedFolder),
  prepareGames: (data: LessonProject, expectedFolder: string): Promise<LessonProjectState> => ipcRenderer.invoke('lesson:prepare-games', data, expectedFolder),
  createDraft: (sequence: 'story' | 'activation'): Promise<LessonProjectState> => ipcRenderer.invoke('lesson:draft', sequence),
  createProject: (): Promise<LessonProjectState | null> => ipcRenderer.invoke('lesson:create'),
  openProject: (): Promise<LessonProjectState | null> => ipcRenderer.invoke('lesson:open'),
  openProjectByPath: (folderPath: string): Promise<LessonProjectState | null> => ipcRenderer.invoke('lesson:open-path', folderPath),
  activateProject: (token: string): void => {
    const error = ipcRenderer.sendSync('lesson:activate', token);
    if (error) throw new Error(error);
  },
  saveProject: (data: LessonProject, mode: 'save' | 'saveAs', expectedFolder: string): Promise<{ lastSavedAt: string; folderPath: string } | null> =>
    ipcRenderer.invoke('lesson:save', data, mode, expectedFolder),
});
contextBridge.exposeInMainWorld('api', {
  importBubbleTemplate: () => ipcRenderer.invoke('import-bubble-template')
});
