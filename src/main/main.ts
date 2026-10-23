import {StudentSettingsRepository} from './studentSettingsRepository';
import {HeroDashLibrary} from './heroDashLibrary';
import {StudentService} from './studentService';
import { DerivedMediaService } from './derivedMediaService';
import { MediaRegistryService } from './mediaRegistryService';
import { blocksMouseNavigation } from '../shared/mouseNavigation';
import { importProjectMedia, detectMediaType } from './mediaImportService';
// src/main/main.ts
import { app, BrowserWindow, dialog, ipcMain, protocol, nativeImage } from 'electron';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import type {
  ACardRefItem,
  AssetItem,
  BCardInstance,
  BoostPack,
  ImportResult,
  MediaType,
  MediaImportContext,
  ProjectData,
  ProjectState,
  Section,
  SequenceItem,
  Slide,
  SparkStudent,
  StoryReferenceItem,
  StudentRosterSettings,
} from '../shared/types';
import type { AudioSettingsV1 } from '../shared/audioSettings';
import { normalizeAudioSettings } from '../shared/audioSettings';
import { normalizeSlideVideoAudio } from '../shared/videoAudio';
import { normalizeSlideVideoTrim } from '../shared/videoTrim';
import { normalizeSlideImageAdjustments } from '../shared/imageAdjustments';
import { normalizeRelicSystem } from '../shared/relics';
import { normalizeSparkStudents } from '../shared/sparkRewards';
import { installPresentWindow } from './presentWindow';
import { LegacyCardPersistence } from './legacyCardPersistence';
import { assertCardsV2 } from '../shared/cardsV2';
import { installLessonPersistence } from './lessonPersistence';
import { rejectPackageFolder } from './episodePackageService';
import { ProgressionRepository } from './progressionRepository';
import { ProgressionService } from './progressionService';
import { installProgressionIPC } from './progressionIPC';
import type { LessonProject, LessonProjectState } from '../shared/lesson/model';

const PROJECT_FILENAME = 'project.json';
const TEMP_PROJECT_FILENAME = 'project.tmp.json';
const ASSETS_DIR = 'assets';
type SaveMode = 'save' | 'saveAs';


protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true
    }
  }
]);

let mainWindow: BrowserWindow | null = null;
let creatingMainWindow = false;
let currentProjectFolder: string | null = null;
let activeProjectFormat: 'legacy' | 'lesson' | null = null;
let activeLessonId: string | null = null;
let activeDocumentFormat: string | null = null;
let activeAdventureId: string | null = null;
let pendingProject: { token: string; folderPath: string; format: 'legacy' | 'lesson'; id?: string; documentFormat?: string; adventureId?: string; cards?: LegacyCardPersistence } | null = null;
const loadedCardBaselines = new WeakMap<ProjectState, LegacyCardPersistence>();
let activeCardPersistence: LegacyCardPersistence | null = null;
let projectWriteInProgress = false;
let projectImportsInProgress = 0;
const mediaRegistry = new MediaRegistryService();
const heroDashLibrary=new HeroDashLibrary(path.join(app.getPath('userData'),'hero-dash'));
ipcMain.handle('hero-dash:list',event=>{requireControl(event);return heroDashLibrary.list();});
ipcMain.handle('hero-dash:import',(event,paths?:string[])=>{requireControl(event);return withProjectWrite(async()=>{
 if(paths===undefined){const result=await dialog.showOpenDialog(getWindow(),{title:'Hero Dash — Browse Images',properties:['openFile','multiSelections'],filters:[{name:'Images',extensions:['png','jpg','jpeg','webp','gif','bmp']}]});if(result.canceled)return {images:[],failures:[]};paths=result.filePaths;}
 return heroDashLibrary.importImages(paths);
});});
ipcMain.handle('hero-dash:save',(event,id:string|undefined,config:unknown,mediaMap:Record<string,string>)=>{requireControl(event);return withProjectWrite(()=>heroDashLibrary.saveCollection(id,config as import('../shared/heroDash').DashConfig,async ref=>{
 const url=mediaMap?.[ref];if(typeof url!=='string'||!url.startsWith('media://'))throw Error('Episode image is unavailable.');
 if(new URL(url).hostname==='scoped-derived'){const bytes=await derivedMedia.read(url);if(!bytes)throw Error('Derived image is unavailable.');return {bytes,name:'Episode image.png'};}
 const resolved=new URL(url).hostname==='scoped'?await mediaRegistry.resolveUrl(url):await mediaRegistry.resolveLegacyUrl(url);if(!resolved)throw Error('Episode image reference expired.');
 if((await fs.stat(resolved)).size>50*1024*1024)throw Error('Image exceeds 50 MB.');return {bytes:await fs.readFile(resolved),name:path.basename(resolved)};
}));});
ipcMain.handle('hero-dash:load',(event,id:string)=>{requireControl(event);return heroDashLibrary.loadCollection(id);});
const derivedMedia = new DerivedMediaService(mediaRegistry, bytes => nativeImage.createFromBuffer(Buffer.from(bytes)).getSize());
function requireControl(event: Electron.IpcMainInvokeEvent): void {
  if (!event || !mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) throw new Error('Control window required.');
}
ipcMain.handle('derived-media:begin', (event, request) => { requireControl(event); return derivedMedia.begin(request); });
const progression = new ProgressionService(new ProgressionRepository(path.join(app.getPath('userData'),'progression','progression-v1.json')),{
  getScope:()=>{const lease=currentProjectFolder?mediaRegistry.getLease(currentProjectFolder):null;return currentProjectFolder&&activeDocumentFormat==='story-studio-episode'&&activeLessonId&&activeAdventureId&&lease?{folderPath:currentProjectFolder,episodeId:activeLessonId,adventureId:activeAdventureId,leaseId:lease.id}:null;},
  getRoster:async()=>(await readStoryStudioSettings()).studentRoster,
});
installProgressionIPC(progression,requireControl);
ipcMain.handle('derived-media:source', (event, request) => { requireControl(event); return derivedMedia.getSource(request); });
ipcMain.handle('derived-media:publish', (event, request) => { requireControl(event); return derivedMedia.publish(request); });
ipcMain.handle('media-registry:lease', (event, folder) => { requireControl(event); return mediaRegistry.getLease(folder); });
ipcMain.handle('media-registry:register', (event, request) => { requireControl(event); return mediaRegistry.register(request); });
ipcMain.handle('media-registry:resolve', (event, request) => { requireControl(event); return mediaRegistry.resolve(request); });

function handleProjectImport(channel: string, handler: Parameters<typeof ipcMain.handle>[1]) {
  ipcMain.handle(channel, async (event, ...args) => {
    requireControl(event);
    if (projectWriteInProgress) throw new Error('Project is saving. Import after saving finishes.');
    projectImportsInProgress++;
    try {
      return await handler(event, ...args);
    } finally {
      projectImportsInProgress--;
    }
  });
}

function prepareProject(project: ProjectState): ProjectState {
  const activationToken = randomUUID();
  pendingProject = {
    token: activationToken, folderPath: project.folderPath, format: 'legacy',
    cards: loadedCardBaselines.get(project) || new LegacyCardPersistence(project.data, project.data),
  };
  return { ...project, activationToken };
}

// In-memory commit only: synchronous acknowledgement lets the renderer commit its
// prepared document in the same turn, without an asynchronous edit/switch gap.
function activateProjectCandidate(token: unknown, format: 'legacy' | 'lesson'): string | null {
  if (projectImportsInProgress) {
    return 'Project is importing assets. Please wait and open again.';
  }
  if (projectWriteInProgress) {
    return 'Project is saving. Please wait and try again.';
  }
  if (!pendingProject || pendingProject.token !== token || pendingProject.format !== format) {
    return 'Project candidate expired. Please open the project again.';
  }
  mediaRegistry.activate(pendingProject.folderPath);
  currentProjectFolder = pendingProject.folderPath;
  activeProjectFormat = pendingProject.format;
  activeLessonId = pendingProject.id ?? null;
  activeDocumentFormat = pendingProject.documentFormat ?? null;
  activeAdventureId = pendingProject.adventureId ?? null;
  progression.retire();
  activeCardPersistence = pendingProject.cards ?? null;
  pendingProject = null;
  return null;
}
ipcMain.on('project:activate', (event, token: unknown) => {
  event.returnValue = activateProjectCandidate(token, 'legacy');
});

async function withProjectWrite<T>(operation: () => Promise<T>): Promise<T> {
  if (projectImportsInProgress) throw new Error('Project is importing assets. Save after importing finishes.');
  if (projectWriteInProgress) throw new Error('Project is saving. Please wait and try again.');
  projectWriteInProgress = true;
  try { return await operation(); }
  finally { projectWriteInProgress = false; }
}

const imageExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']);
const videoExts = new Set(['.mp4', '.mov', '.webm', '.mkv', '.avi']);
const audioExts = new Set(['.mp3', '.wav', '.ogg', '.aac', '.m4a']);

async function importMediaFiles(filePaths: string[], context?: MediaImportContext): Promise<ImportResult | null> {
  if (!currentProjectFolder) throw new Error('Create or open a project first');
  if (!filePaths.length) return null;
  const folder = currentProjectFolder;
  if(context && context.folderPath!==folder)throw new Error('Project changed during import. Please retry.');
  const saved=JSON.parse(await fs.readFile(projectPath(folder),'utf8'));
  const assets=context?.assets??saved.assets??[];
  if(!Array.isArray(assets)||assets.some(asset=>!asset||typeof asset.id!=='string'||typeof asset.filename!=='string'||typeof asset.originalName!=='string'))throw new Error('Invalid current media catalogue.');
  let batchChoice: 'existing'|'incoming'|undefined;
  const options={existingAssets:assets,resolveDuplicate:async(existing:AssetItem,source:string,sizeBytes:number):Promise<'existing'|'incoming'>=>{
    if(batchChoice)return batchChoice;
    const answer=await dialog.showMessageBox(getWindow(),{type:'question',title:'Media with this filename already exists',message:`Which copy of “${path.basename(source)}” should be kept?`,detail:`Existing Media Pool item: ${existing.originalName} (${existing.sizeBytes} bytes)\nIncoming: ${source} (${sizeBytes} bytes)\n\nUse incoming updates this Media Pool item wherever it is used. Undo can restore the previous version.`,buttons:['Keep existing','Use incoming'],defaultId:0,cancelId:0,checkboxLabel:'Use this choice for all matching filenames in this import',checkboxChecked:false});
    const choice=answer.response===1?'incoming':'existing';if(answer.checkboxChecked)batchChoice=choice;return choice;
  }};
  if (activeProjectFormat === 'lesson') {
    // Import assets once; scene creation belongs to the new authoring commands.
    const result = await importProjectMedia(folder, filePaths, '', options);
    return { ...result, createdSlides: [] };
  }
  const sectionId=(await loadProject(folder)).data.sections[0]?.id ?? randomUUID();
  return importProjectMedia(folder,filePaths,sectionId,options);
}

function getWindow(): BrowserWindow {
  if (!mainWindow) throw new Error('Main window is unavailable');
  return mainWindow;
}

function projectPath(folder: string): string {
  return path.join(folder, PROJECT_FILENAME);
}

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'story-studio-settings.json');
}

const studentSettings = new StudentSettingsRepository(settingsPath());
const students = new StudentService(studentSettings);
async function readStoryStudioSettings() { return studentSettings.read(); }

async function ensureFolderIsEmpty(folder: string): Promise<void> {
  const entries = await fs.readdir(folder);
  if (entries.length > 0) {
    throw new Error('Selected folder is not empty. Choose an empty folder to create or copy a project.');
  }
}

async function copyProjectFolder(sourceFolder: string, targetFolder: string): Promise<void> {
  await fs.mkdir(targetFolder, { recursive: true });
  const sourceEntries = await fs.readdir(sourceFolder, { withFileTypes: true });
  for (const entry of sourceEntries) {
    // Publish project.json only after the copy and final write succeed.
    if (entry.name === PROJECT_FILENAME || entry.name === TEMP_PROJECT_FILENAME) continue;
    const sourcePath = path.join(sourceFolder, entry.name);
    const targetPath = path.join(targetFolder, entry.name);
    await fs.cp(sourcePath, targetPath, { recursive: true, errorOnExist: true, force: false });
  }
}

async function writeProjectAtomic(folder: string, data: ProjectData | LessonProject, createOnly = false): Promise<string> {
  if ('cardsV2' in data && data.cardsV2 !== undefined) assertCardsV2(data.cardsV2);
  const now = new Date().toISOString();
  const finalData = { ...data, updatedAt: now };
  const tmpPath = path.join(folder, `.project-${randomUUID()}.tmp`);
  const finalPath = projectPath(folder);
  const serialized = JSON.stringify(finalData, null, 2);
  const file = await fs.open(tmpPath, 'wx');
  try {
    try {
      await file.writeFile(serialized, 'utf8');
      await file.sync();
    } finally {
      await file.close();
    }
    if (createOnly) {
      // Unlike rename, link cannot replace a concurrently created project.json.
      await fs.link(tmpPath, finalPath);
    } else {
      await fs.rename(tmpPath, finalPath);
    }
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
  return now;
}

async function loadProject(folder: string): Promise<ProjectState> {
  await rejectPackageFolder(folder);
  const raw = await fs.readFile(projectPath(folder), 'utf8');
  const parsed = JSON.parse(raw) as ProjectData;
  if (parsed && typeof parsed === 'object' && 'format' in parsed) {
    throw new Error('This project uses a new or unsupported format. Open scene lessons in the new lesson workspace.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
    || !Array.isArray(parsed.slides) || !Array.isArray(parsed.assets)) {
    throw new Error('Invalid project.json: expected a project with slides and assets arrays.');
  }
  if (parsed.cardsV2 !== undefined) assertCardsV2(parsed.cardsV2);
  const data = normalizeProjectData(JSON.parse(JSON.stringify(parsed)));
  const project = { folderPath: folder, data, lastSavedAt: data.updatedAt };
  loadedCardBaselines.set(project, new LegacyCardPersistence(parsed, data));
  return project;
}


function normalizeSectionMusic(section: Section): Section {
  if (Array.isArray((section as Section & { bgm?: Section["bgm"] }).bgm)) {
    return section;
  }
  if (section.bgm && !Array.isArray(section.bgm)) {
    return { ...section, bgm: [section.bgm as any] };
  }
  return { ...section, bgm: [] };
}

function emptyBoostPack(): BoostPack {
  return {
    activationSequence: [],
    languageSequence: [],
    gamesSequence: [],
  };
}

const DEFAULT_BCARD_SIZE = { width: 270, height: 390 };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function coerceFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function defaultBCardCenter(index: number): { x: number; y: number } {
  return {
    x: clamp(48 + (index % 4) * 6, 12, 88),
    y: clamp(34 + Math.floor(index / 4) * 8, 12, 88),
  };
}

function legacyBCardRefToInstance(raw: Record<string, unknown>, index: number): BCardInstance | null {
  const bCardId = typeof raw.bCardId === 'string' ? raw.bCardId : '';
  if (!bCardId) return null;

  const rawPos = raw.position as Record<string, unknown> | undefined;
  const rawX = coerceFiniteNumber(rawPos?.x);
  const rawY = coerceFiniteNumber(rawPos?.y);
  const center = rawX === null || rawY === null
    ? defaultBCardCenter(index)
    : {
        x: clamp(((rawX + DEFAULT_BCARD_SIZE.width / 2) / 1280) * 100, 8, 92),
        y: clamp(((rawY + DEFAULT_BCARD_SIZE.height / 2) / 720) * 100, 8, 92),
      };

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : randomUUID(),
    bCardId,
    position: center,
    size: { ...DEFAULT_BCARD_SIZE },
    zIndex: index + 1,
    displayMode: raw.stageMode === 'board' ? 'board' : 'overlay',
  };
}

function normalizeBCardInstance(raw: unknown, index: number): BCardInstance | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;

  if (item.type === 'bCardRef') {
    return legacyBCardRefToInstance(item, index);
  }

  const bCardId = typeof item.bCardId === 'string' ? item.bCardId : '';
  if (!bCardId) return null;

  const rawPosition = item.position as Record<string, unknown> | undefined;
  const rawSize = item.size as Record<string, unknown> | undefined;
  const x = coerceFiniteNumber(rawPosition?.x);
  const y = coerceFiniteNumber(rawPosition?.y);
  const width = coerceFiniteNumber(rawSize?.width);
  const height = coerceFiniteNumber(rawSize?.height);
  const zIndex = coerceFiniteNumber(item.zIndex);

  return {
    id: typeof item.id === 'string' && item.id ? item.id : randomUUID(),
    bCardId,
    position: x === null || y === null ? defaultBCardCenter(index) : { x: clamp(x, 0, 100), y: clamp(y, 0, 100) },
    size: {
      width: width === null ? DEFAULT_BCARD_SIZE.width : Math.max(40, width),
      height: height === null ? DEFAULT_BCARD_SIZE.height : Math.max(40, height),
    },
    zIndex: zIndex === null ? index + 1 : Math.max(1, Math.round(zIndex)),
    displayMode: item.displayMode === 'board' || item.stageMode === 'board' ? 'board' : 'overlay',
    flags: item.flags && typeof item.flags === 'object' ? item.flags as Record<string, boolean> : undefined,
  };
}

function normalizeBCardInstances(input: unknown): BCardInstance[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item, index) => normalizeBCardInstance(item, index))
    .filter((item): item is BCardInstance => item !== null);
}

function mergeBCardInstances(primary: BCardInstance[], fallback: BCardInstance[]): BCardInstance[] {
  if (!fallback.length) return primary;
  const existing = new Set(primary.map((item) => item.id));
  const merged = [...primary];
  for (const instance of fallback) {
    if (existing.has(instance.id)) continue;
    merged.push(instance);
    existing.add(instance.id);
  }
  return merged;
}

function generateBubbleId(data: ProjectData): string {
  let maxId = 0;
  for (const slide of data.slides || []) {
    for (const overlay of slide.overlays || []) {
      if (overlay.bubbleId && overlay.bubbleId.startsWith('B')) {
        const num = parseInt(overlay.bubbleId.substring(1), 10);
        if (!isNaN(num) && num > maxId) {
          maxId = num;
        }
      }
    }
  }
  return `B${maxId + 1}`;
}

function normalizeStoryReferences(input: unknown): StoryReferenceItem[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item): StoryReferenceItem | null => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      const id = typeof raw.id === 'string' && raw.id ? raw.id : randomUUID();

      if (raw.type === 'aCardRef') {
        const aCardId = typeof raw.aCardId === 'string' ? raw.aCardId : '';
        return { id, type: 'aCardRef', aCardId };
      }

      return null;
    })
    .filter((item): item is StoryReferenceItem => item !== null);
}

function normalizeLegacyStoryBCardRefs(input: unknown): BCardInstance[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      if (raw.type !== 'bCardRef') return null;
      return legacyBCardRefToInstance(raw, index);
    })
    .filter((item): item is BCardInstance => item !== null);
}

function normalizeSequenceItem(raw: unknown): SequenceItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const id = typeof item.id === 'string' && item.id ? item.id : randomUUID();
  const bCardInstances = normalizeBCardInstances(item.bCardInstances);
  const cardPlacementId = typeof item.cardPlacementId === 'string' ? item.cardPlacementId : undefined;
  if (item.type === 'cardActivityRef') {
    if (item.engine !== 'card-v2' || typeof item.placementId !== 'string') throw new Error('Unsupported Card activity reference');
    return { id, type: 'cardActivityRef', engine: 'card-v2', placementId: item.placementId };
  }

  if (item.type === 'slideRef') {
    return {
      id,
      type: 'slideRef',
      slideId: typeof item.slideId === 'string' ? item.slideId : '',
      ...(typeof item.independentCopyOf === 'string' ? {independentCopyOf:item.independentCopyOf} : {}),
      viewOverride: item.viewOverride && typeof item.viewOverride === 'object' ? item.viewOverride as { zoom?: number; panX?: number; panY?: number } : undefined,
      bCardInstances,
      ...(cardPlacementId ? { cardPlacementId } : {}),
    };
  }

  if (item.type === 'breakRef') {
    return {
      id,
      type: 'breakRef',
      breakId: typeof item.breakId === 'string' ? item.breakId : '',
      textOverride: typeof item.textOverride === 'string' ? item.textOverride : undefined,
      bCardInstances,
      ...(cardPlacementId ? { cardPlacementId } : {}),
    };
  }

  if (item.type === 'promptCard') {
    return {
      id,
      type: 'promptCard',
      title: typeof item.title === 'string' ? item.title : undefined,
      body: typeof item.body === 'string' ? item.body : '',
      durationMs: coerceFiniteNumber(item.durationMs) ?? undefined,
      bCardInstances,
      ...(cardPlacementId ? { cardPlacementId } : {}),
    };
  }

  if (item.type === 'miniGame') {
    return {
      id,
      type: 'miniGame',
      gameType: 'placeholder',
      config: item.config && typeof item.config === 'object' ? item.config as Record<string, unknown> : undefined,
      bCardInstances,
      ...(cardPlacementId ? { cardPlacementId } : {}),
    };
  }

  if (item.type === 'aCardRef') {
    return {
      id,
      type: 'aCardRef',
      aCardId: typeof item.aCardId === 'string' ? item.aCardId : '',
      bCardInstances,
      ...(cardPlacementId ? { cardPlacementId } : {}),
    };
  }

  return null;
}

function normalizeBoostSequence(input: unknown): SequenceItem[] {
  if (!Array.isArray(input)) return [];

  const next: SequenceItem[] = [];
  let pendingInstances: BCardInstance[] = [];

  for (const raw of input) {
    if (raw && typeof raw === 'object' && (raw as Record<string, unknown>).type === 'bCardRef') {
      const migrated = legacyBCardRefToInstance(raw as Record<string, unknown>, pendingInstances.length);
      if (migrated) {
        pendingInstances = [...pendingInstances, migrated];
      }
      continue;
    }

    const normalized = normalizeSequenceItem(raw);
    if (!normalized) continue;

    if (pendingInstances.length > 0) {
      normalized.bCardInstances = [...(normalized.bCardInstances || []), ...pendingInstances];
      pendingInstances = [];
    }

    next.push(normalized);
  }

  if (pendingInstances.length > 0) {
    if (next.length > 0) {
      const last = next[next.length - 1];
      last.bCardInstances = [...(last.bCardInstances || []), ...pendingInstances];
    } else {
      next.push({
        id: randomUUID(),
        type: 'promptCard',
        title: 'Migrated BCards',
        body: '',
        bCardInstances: pendingInstances,
      });
    }
  }

  return next;
}

function createDefaultSparkStudent(name = 'Student 1'): SparkStudent {
  return {
    id: randomUUID(),
    name,
    yellowSparks: 0,
    blueSparks: 0,
    pinkSparks: 0,
    crowns: 0,
    stars: 0,
    badgeVisible: true,
    badgeSparkVariant: 'gold',
  };
}

function normalizeProjectData(data: ProjectData): ProjectData {
  const isV1 = !data.version || data.version === 1;
  const isV2 = data.version === 2;
  const isV3 = data.version === 3;

  let sections = Array.isArray((data as any).sections) ? (data as any).sections : [];
  if (sections.length === 0) {
    sections = [normalizeSectionMusic({ id: randomUUID(), name: 'Section 1' })];
  } else {
    sections = sections.map((sec: any) => ({
      ...normalizeSectionMusic(sec),
      tags: Array.isArray(sec.tags) ? sec.tags : [],
      storyReferences: normalizeStoryReferences(sec.storyReferences),
      bCardInstances: mergeBCardInstances(
        normalizeBCardInstances(sec.bCardInstances),
        normalizeLegacyStoryBCardRefs(sec.storyReferences),
      ),
    }));
  }

  const defaultSectionId = sections[0].id;

  let slides = Array.isArray(data.slides) ? data.slides : [];
  const assetMediaTypes = new Map((Array.isArray(data.assets) ? data.assets : []).map((asset) => [asset.id, asset.mediaType] as const));

  // We need to pass the whole data object to generate sequential IDs if missing
  // But we want to mutate our local copy of overlays.
  // We'll mutate the incoming data object for the generator to see the newly generated IDs,
  // or just track maxId locally. A simpler way is tracking the highest ID seen.

  let currentMaxBubbleId = 0;
  for (const slide of slides) {
    for (const overlay of slide.overlays || []) {
      if (overlay.bubbleId && overlay.bubbleId.startsWith('B')) {
        const num = parseInt(overlay.bubbleId.substring(1), 10);
        if (!isNaN(num) && num > currentMaxBubbleId) currentMaxBubbleId = num;
      }
    }
  }

  slides = slides.map((slide: any) => {
    const overlays = Array.isArray(slide.overlays) ? slide.overlays.map((ov: any) => {
      let bubbleId = ov.bubbleId;
      if (!bubbleId) {
        currentMaxBubbleId++;
        bubbleId = `B${currentMaxBubbleId}`;
      }
      return {
        ...ov,
        bubbleId,
      };
    }) : [];

    const mediaType = assetMediaTypes.get(slide.assetId);
    return normalizeSlideImageAdjustments(normalizeSlideVideoTrim(normalizeSlideVideoAudio({
      ...slide,
      sectionId: slide.sectionId || defaultSectionId,
      name: typeof slide.name === 'string' ? slide.name : undefined,
      tags: Array.isArray(slide.tags) ? slide.tags : [],
      overlays,
      audioCues: Array.isArray(slide.audioCues) ? slide.audioCues : [],
      storyReferences: normalizeStoryReferences(slide.storyReferences),
      bCardInstances: mergeBCardInstances(
        normalizeBCardInstances(slide.bCardInstances),
        normalizeLegacyStoryBCardRefs(slide.storyReferences),
      ),
    }, mediaType), mediaType), mediaType);
  });

  const boostPack = data.boostPack && typeof data.boostPack === 'object'
    ? {
        activationSequence: normalizeBoostSequence((data.boostPack as any).activationSequence),
        languageSequence: normalizeBoostSequence((data.boostPack as any).languageSequence),
        gamesSequence: normalizeBoostSequence((data.boostPack as any).gamesSequence),
      }
    : emptyBoostPack();

  const sparkStudents = normalizeSparkStudents(
    (data as ProjectData & { sparkStudents?: unknown }).sparkStudents,
    randomUUID,
  );
  if (sparkStudents.length === 0) {
    sparkStudents.push(createDefaultSparkStudent());
  }

  const activeStudentIdRaw = (data as ProjectData & { activeStudentId?: unknown }).activeStudentId;
  const activeStudentId = typeof activeStudentIdRaw === 'string' && sparkStudents.some((s) => s.id === activeStudentIdRaw)
    ? activeStudentIdRaw
    : sparkStudents[0].id;

  return {
    ...data,
    version: 4,
    sections,
    slides,
    boostPack,
    sparkStudents,
    activeStudentId,
    relicSystem: normalizeRelicSystem((data as ProjectData & { relicSystem?: unknown }).relicSystem),
  };
}

async function resolveMediaPathFromUrl(rawUrl: string): Promise<{ resolvedPath: string } | { status: number; message: string }> {
  const resolvedPath = await mediaRegistry.resolveLegacyUrl(rawUrl);
  return resolvedPath ? { resolvedPath } : { status: 403, message: 'Missing or unsafe media path' };
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.avi') return 'video/x-msvideo';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.ogg' || ext === '.ogv') return 'video/ogg';
  if (ext === '.mov') return 'video/quicktime';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.bmp') return 'image/bmp';
  if (ext === '.mp3') return 'audio/mpeg';
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.aac') return 'audio/aac';
  if (ext === '.m4a') return 'audio/mp4';
  return 'application/octet-stream';
}

function toWebStream(filePath: string, start?: number, end?: number): ReadableStream<Uint8Array> {
  const stream = start === undefined ? createReadStream(filePath) : createReadStream(filePath, { start, end });
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
}

async function serveMediaFile(request: Request, filePath: string): Promise<Response> {
  const stat = await fs.stat(filePath);
  const size = stat.size;
  const range = request.headers.get('range');

  const headers = new Headers();
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Type', getMimeType(filePath));

  if (!range) {
    headers.set('Content-Length', String(size));
    return new Response(toWebStream(filePath), { status: 200, headers });
  }

  const match = /^bytes=(\d+)-(\d*)$/i.exec(range.trim());
  if (!match) {
    return new Response('Invalid Range', { status: 416 });
  }

  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : size - 1;
  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
    return new Response('Range Not Satisfiable', { status: 416 });
  }

  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(toWebStream(filePath, start, end), { status: 206, headers });
}

function registerMediaProtocol(): void {
  if (typeof protocol.handle === 'function') {
    protocol.handle('media', async (request) => {
      if(new URL(request.url).hostname==='hero-dash'){const file=await heroDashLibrary.resolveUrl(request.url);return file?serveMediaFile(request,file):new Response('Review image unavailable',{status:404});}
      if (new URL(request.url).hostname === 'scoped-derived') {
        const bytes = await derivedMedia.read(request.url);
        return bytes ? new Response(Buffer.from(bytes), { headers: { 'Content-Type': 'image/png', 'Content-Length': String(bytes.byteLength) } }) : new Response('Expired derived grant', { status: 403 });
      }
      const scoped = new URL(request.url).hostname === 'scoped';
      const scopedPath = scoped ? await mediaRegistry.resolveUrl(request.url) : null;
      const result = scoped ? (scopedPath ? { resolvedPath: scopedPath } : { status: 403, message: 'Expired or invalid media grant' }) : await resolveMediaPathFromUrl(request.url);
      if ('status' in result) {
        return new Response(result.message, { status: result.status });
      }

      try {
        return await serveMediaFile(request, result.resolvedPath);
      } catch {
        return new Response('Not found', { status: 404 });
      }
    });
    return;
  }

  protocol.registerFileProtocol('media', async (request, callback) => {
    const scoped = new URL(request.url).hostname === 'scoped';
      const scopedPath = scoped ? await mediaRegistry.resolveUrl(request.url) : null;
      const result = scoped ? (scopedPath ? { resolvedPath: scopedPath } : { status: 403, message: 'Expired or invalid media grant' }) : await resolveMediaPathFromUrl(request.url);
    if ('status' in result) {
      callback({ error: -10 });
      return;
    }

    callback({ path: result.resolvedPath });
  });
}

function createMainWindow(): void {
  if (mainWindow || creatingMainWindow) return;
  creatingMainWindow = true;
  console.log('[main] createMainWindow called');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      backgroundThrottling: false,
      nodeIntegration: false
    }
  });

  mainWindow.on('app-command', (event, command) => {
    if (blocksMouseNavigation(!!currentProjectFolder, command)) event.preventDefault();
  });
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (blocksMouseNavigation(!!currentProjectFolder, input.key)) event.preventDefault();
  });

  installPresentWindow(() => mainWindow,{authorizeInitialize:message=>progression.authorizeInitialize(message),acceptedModule:message=>progression.acceptedModule(message),hostCommand:message=>progression.hostCommand(message),retire:instanceId=>progression.retire(instanceId)});
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.on('close', (e) => {
    if (forceClose) return;
    e.preventDefault();
    mainWindow?.webContents.send('app:request-close');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    creatingMainWindow = false;
  });
}

let forceClose = false;

ipcMain.on('app:force-close', () => {
  forceClose = true;
  mainWindow?.close();
});

ipcMain.on('app:reload', () => {
  mainWindow?.webContents.reloadIgnoringCache();
});

const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  console.log('[main] Quitting secondary instance');
  app.quit();
} else {
  app.whenReady().then(() => {
    registerMediaProtocol();
    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('project:create', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(getWindow(), {
    title: 'Choose Project Folder',
    properties: ['openDirectory', 'createDirectory']
  });
  if (canceled || filePaths.length === 0) return null;

  const folderPath = filePaths[0];
  await ensureFolderIsEmpty(folderPath);

  const now = new Date().toISOString();
  const defaultSparkStudent = createDefaultSparkStudent();
  const data: ProjectData = {
    version: 4,
    createdAt: now,
    updatedAt: now,
    slides: [],
    assets: [],
    sections: [{ id: randomUUID(), name: 'Section 1' }],
    boostPack: emptyBoostPack(),
    sparkStudents: [defaultSparkStudent],
    activeStudentId: defaultSparkStudent.id,
    relicSystem: normalizeRelicSystem(undefined),
  };

  const assetsPath = path.join(folderPath, ASSETS_DIR);
  await fs.mkdir(assetsPath); // Exclusive: never reuse a pre-existing assets folder.
  try {
    const lastSavedAt = await writeProjectAtomic(folderPath, data, true);
    return prepareProject({ folderPath, data: { ...data, updatedAt: lastSavedAt }, lastSavedAt });
  } catch (error) {
    // Remove only our empty directory, never recursively remove user content.
    await fs.rmdir(assetsPath).catch(() => {});
    throw error;
  }
});

ipcMain.handle('project:open', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(getWindow(), {
    title: 'Open Project Folder',
    properties: ['openDirectory']
  });
  if (canceled || filePaths.length === 0) return null;

  const folderPath = filePaths[0];

  const pjPath = projectPath(folderPath);
  try {
    await fs.access(pjPath);
  } catch {
    throw new Error('project.json not found in selected folder');
  }

  return prepareProject(await loadProject(folderPath));
});

ipcMain.handle('project:open-path', async (_, folderPathRaw: unknown) => {
  if (typeof folderPathRaw !== 'string' || !folderPathRaw.trim()) {
    throw new Error('Invalid project path');
  }

  const folderPath = path.resolve(folderPathRaw);
  const pjPath = projectPath(folderPath);
  try {
    await fs.access(pjPath);
  } catch {
    throw new Error('project.json not found at saved project path');
  }

  return prepareProject(await loadProject(folderPath));
});

handleProjectImport('project:import-media', async (_, context?: MediaImportContext): Promise<ImportResult | null> => {
  if (!currentProjectFolder) throw new Error('Create or open a project first');

  const { canceled, filePaths } = await dialog.showOpenDialog(getWindow(), {
    title: 'Import Media',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Media', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'mp4', 'mov', 'webm', 'mkv', 'avi', 'mp3', 'wav', 'ogg', 'aac', 'm4a'] }
    ]
  });
  if (canceled || filePaths.length === 0) return null;

  return importMediaFiles(filePaths,context);
});

handleProjectImport('project:import-folder', async (_,context?:MediaImportContext):Promise<ImportResult|null> => {
  const {canceled,filePaths}=await dialog.showOpenDialog(getWindow(),{title:'Import folder into Media Pool',properties:['openDirectory']});
  return canceled?null:importMediaFiles(filePaths,context);
});

handleProjectImport('project:import-dropped-media', async (_, filePaths: string[],context?:MediaImportContext): Promise<ImportResult | null> => {
  if (!currentProjectFolder) throw new Error('Create or open a project first');
  if (!Array.isArray(filePaths)) return null;
  return importMediaFiles(filePaths,context);
});

async function saveProject(data: ProjectData, mode: SaveMode, expectedFolder: string) {
  if (!currentProjectFolder) throw new Error('Create or open a project first');
  await rejectPackageFolder(currentProjectFolder);
  if (expectedFolder !== currentProjectFolder) throw new Error('Active project changed. Save cancelled; please try again.');
  if (activeProjectFormat !== 'legacy' || (data && typeof data === 'object' && 'format' in data)) {
    throw new Error('Cannot save legacy data over a project with a different format.');
  }
  const onDisk = JSON.parse(await fs.readFile(projectPath(currentProjectFolder), 'utf8'));
  if (!onDisk || typeof onDisk !== 'object' || 'format' in onDisk || !Array.isArray(onDisk.slides) || !Array.isArray(onDisk.assets)) {
    throw new Error('The project format on disk changed. Open the intended legacy project again before saving.');
  }
  const sourceFolder = currentProjectFolder;
  const authoredData = activeCardPersistence ? activeCardPersistence.forSave(data) : data;

  if (mode === 'saveAs') {
    const { canceled, filePaths } = await dialog.showOpenDialog(getWindow(), {
      title: 'Save Project As',
      properties: ['openDirectory', 'createDirectory']
    });
    if (canceled || filePaths.length === 0) return null;

    const targetFolder = filePaths[0];
    const normalizedSource = path.resolve(sourceFolder);
    const normalizedTarget = path.resolve(targetFolder);
    if (normalizedSource === normalizedTarget) {
      throw new Error('Please choose a different folder for Save As.');
    }
    const relativeTarget = path.relative(normalizedSource, normalizedTarget);
    if (!relativeTarget.startsWith(`..${path.sep}`) && relativeTarget !== '..' && !path.isAbsolute(relativeTarget)) {
      throw new Error('Choose a Save As folder outside the current project.');
    }

    await ensureFolderIsEmpty(targetFolder);
    await copyProjectFolder(sourceFolder, targetFolder);
    const lastSavedAt = await writeProjectAtomic(targetFolder, authoredData, true);
    mediaRegistry.activate(targetFolder);
    currentProjectFolder = targetFolder;
    pendingProject = null;
    return { lastSavedAt, folderPath: targetFolder };
  }

  const lastSavedAt = await writeProjectAtomic(sourceFolder, authoredData);
  return { lastSavedAt, folderPath: sourceFolder };
}

ipcMain.handle('project:save', async (_, data: ProjectData, mode: SaveMode = 'save', expectedFolder: string) => {
  return withProjectWrite(() => saveProject(data, mode, expectedFolder));
});

installLessonPersistence({
  getWindow,
  getBackupRoot: () => path.join(app.getPath('userData'), 'migration-backups'),
  getPackageContext: () => ({leaseId: currentProjectFolder ? mediaRegistry.getLease(currentProjectFolder)?.id ?? null : null, builtinRoot: app.isPackaged ? path.join(app.getAppPath(), 'games') : path.resolve(__dirname, '../../../games')}),
  authorize: requireControl,
  getActive: () => ({ folderPath: currentProjectFolder, format: activeProjectFormat, id: activeLessonId, documentFormat: activeDocumentFormat }),
  prepare: (project): LessonProjectState => {
    const activationToken = randomUUID();
    pendingProject = { token: activationToken, folderPath: project.folderPath, format: 'lesson', id: project.data.id, documentFormat: project.data.format, ...(project.data.format==='story-studio-episode'?{adventureId:project.data.adventure.id}:{}) };
    return { ...project, activationToken };
  },
  activate: token => activateProjectCandidate(token, 'lesson'),
  adoptSavedFolder: folderPath => { progression.retire(); mediaRegistry.activate(folderPath); currentProjectFolder = folderPath; pendingProject = null; },
  withWrite: withProjectWrite,
  ensureFolderIsEmpty,
  copyProjectFolder,
  writeAtomic: writeProjectAtomic,
});

ipcMain.handle('settings:get-student-roster', async (event):Promise<StudentRosterSettings> => {requireControl(event);return students.getSnapshot();});
ipcMain.handle('settings:save-student-roster', async (event,settings:StudentRosterSettings):Promise<StudentRosterSettings> => {requireControl(event);return students.saveLegacy(settings);});
ipcMain.handle('settings:get-audio', async (event):Promise<AudioSettingsV1> => {requireControl(event);return (await studentSettings.read()).audio;});
ipcMain.handle('settings:save-audio', async (event,settings:AudioSettingsV1):Promise<AudioSettingsV1> => {requireControl(event);return (await studentSettings.update(current=>({...current,audio:normalizeAudioSettings(settings)}))).audio;});
for(const method of ['getSnapshot','createProfile','updateProfile','setArchived','mapLegacy','importProfile','createClass','updateClass','setClassArchived','selectClass'] as const){
 ipcMain.handle('students:'+method,async(event,input)=>{requireControl(event);return (students[method] as (input:any)=>Promise<unknown>).call(students,input);});
}

async function importAudioResult(): Promise<ImportResult | null> {
  if (!currentProjectFolder) throw new Error('Create or open a project first');
  const folder = currentProjectFolder;

  const { canceled, filePaths } = await dialog.showOpenDialog(getWindow(), {
    title: 'Import Audio',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'aac', 'm4a'] }
    ]
  });
  if (canceled || filePaths.length === 0) return null;

  return importProjectMedia(folder, filePaths.filter(file => detectMediaType(path.extname(file)) === 'audio'), '');
}
handleProjectImport('project:import-audio-result', importAudioResult);
handleProjectImport('project:import-audio', async () => (await importAudioResult())?.importedAssets ?? null);

handleProjectImport('import-bubble-template', async (): Promise<{ success: boolean; relativePath?: string; asset?: AssetItem }> => {
  if (!currentProjectFolder) return { success: false };
  const folder = currentProjectFolder;
  const { canceled, filePaths } = await dialog.showOpenDialog(getWindow(), {
    title: 'Import Bubble Template', properties: ['openFile'], filters: [{ name: 'PNG', extensions: ['png'] }]
  });
  if (canceled || !filePaths.length) return { success: false };
  const result = await importProjectMedia(folder, filePaths.filter(file => path.extname(file).toLowerCase() === '.png'), '');
  const asset = result.importedAssets[0];
  return asset ? { success: true, relativePath: asset.relativePath, asset } : { success: false };
});
