// src/main/main.ts
import { app, BrowserWindow, dialog, ipcMain, protocol } from 'electron';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import type { AssetItem, BoostPack, ImportResult, MediaType, ProjectData, ProjectState, Section, Slide, SparkStudent, StoryReferenceItem } from '../shared/types';

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

const imageExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']);
const videoExts = new Set(['.mp4', '.mov', '.webm', '.mkv', '.avi']);
const audioExts = new Set(['.mp3', '.wav', '.ogg', '.aac', '.m4a']);

function detectMediaType(ext: string): MediaType | null {
  if (imageExts.has(ext)) return 'image';
  if (videoExts.has(ext)) return 'video';
  if (audioExts.has(ext)) return 'audio';
  return null;
}

function getWindow(): BrowserWindow {
  if (!mainWindow) throw new Error('Main window is unavailable');
  return mainWindow;
}

function projectPath(folder: string): string {
  return path.join(folder, PROJECT_FILENAME);
}

async function ensureProjectFolder(folder: string): Promise<void> {
  await fs.mkdir(path.join(folder, ASSETS_DIR), { recursive: true });
}

async function ensureFolderIsEmpty(folder: string): Promise<void> {
  const entries = await fs.readdir(folder);
  if (entries.length > 0) {
    throw new Error('Selected folder is not empty. Choose an empty folder for Save As.');
  }
}

async function copyProjectFolder(sourceFolder: string, targetFolder: string): Promise<void> {
  await fs.mkdir(targetFolder, { recursive: true });
  const sourceEntries = await fs.readdir(sourceFolder, { withFileTypes: true });
  for (const entry of sourceEntries) {
    if (entry.name === TEMP_PROJECT_FILENAME) continue;
    const sourcePath = path.join(sourceFolder, entry.name);
    const targetPath = path.join(targetFolder, entry.name);
    await fs.cp(sourcePath, targetPath, { recursive: true, errorOnExist: true, force: false });
  }
}

async function writeProjectAtomic(folder: string, data: ProjectData): Promise<string> {
  const now = new Date().toISOString();
  const finalData: ProjectData = { ...data, updatedAt: now };
  const tmpPath = path.join(folder, TEMP_PROJECT_FILENAME);
  const finalPath = projectPath(folder);
  await fs.writeFile(tmpPath, JSON.stringify(finalData, null, 2), 'utf8');
  await fs.rename(tmpPath, finalPath);
  return now;
}

async function loadProject(folder: string): Promise<ProjectState> {
  const raw = await fs.readFile(projectPath(folder), 'utf8');
  const parsed = JSON.parse(raw) as ProjectData;
  const data = normalizeProjectData(parsed);
  return { folderPath: folder, data, lastSavedAt: data.updatedAt };
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

      if (raw.type === 'bCardRef') {
        const bCardId = typeof raw.bCardId === 'string' ? raw.bCardId : '';
        const stageMode = raw.stageMode === 'board' ? 'board' : 'overlay';
        const rawPos = raw.position as Record<string, unknown> | undefined;
        const hasPos = rawPos && typeof rawPos.x === 'number' && typeof rawPos.y === 'number';
        const position = hasPos ? { x: Number(rawPos.x), y: Number(rawPos.y) } : undefined;
        return { id, type: 'bCardRef', bCardId, stageMode, position };
      }

      return null;
    })
    .filter((item): item is StoryReferenceItem => item !== null);
}

function createDefaultSparkStudent(name = 'Student 1'): SparkStudent {
  return {
    id: randomUUID(),
    name,
    yellowSparks: 0,
    blueSparks: 0,
    pinkSparks: 0,
    stars: 0,
    badgeVisible: true,
    badgeSparkVariant: 'gold',
  };
}

function normalizeSparkStudents(input: unknown): SparkStudent[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item): SparkStudent | null => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      const id = typeof raw.id === 'string' && raw.id ? raw.id : randomUUID();
      const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'Student';
      const yellowSparks = Number.isFinite(raw.yellowSparks) ? Math.max(0, Number(raw.yellowSparks)) : 0;
      const blueSparks = Number.isFinite(raw.blueSparks) ? Math.max(0, Number(raw.blueSparks)) : 0;
      const pinkSparks = Number.isFinite(raw.pinkSparks) ? Math.max(0, Number(raw.pinkSparks)) : 0;
      const computedStars = yellowSparks + blueSparks + pinkSparks;
      const stars = Number.isFinite(raw.stars) ? Math.max(0, Number(raw.stars)) : computedStars;
      const badgeVisible = raw.badgeVisible !== false;
      const badgeSparkVariant = raw.badgeSparkVariant === 'blue' || raw.badgeSparkVariant === 'pink' ? raw.badgeSparkVariant : 'gold';

      return {
        id,
        name,
        yellowSparks,
        blueSparks,
        pinkSparks,
        stars,
        badgeVisible,
        badgeSparkVariant,
      };
    })
    .filter((item): item is SparkStudent => item !== null);
}

function normalizeProjectData(data: ProjectData): ProjectData {
  const isV1 = !data.version || data.version === 1;
  const isV2 = data.version === 2;

  let sections = Array.isArray((data as any).sections) ? (data as any).sections : [];
  if (sections.length === 0) {
    sections = [normalizeSectionMusic({ id: randomUUID(), name: 'Section 1' })];
  } else {
    sections = sections.map((sec: any) => ({
      ...normalizeSectionMusic(sec),
      tags: Array.isArray(sec.tags) ? sec.tags : [],
      storyReferences: normalizeStoryReferences(sec.storyReferences),
    }));
  }

  const defaultSectionId = sections[0].id;

  let slides = Array.isArray(data.slides) ? data.slides : [];

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

    return {
      ...slide,
      sectionId: slide.sectionId || defaultSectionId,
      tags: Array.isArray(slide.tags) ? slide.tags : [],
      overlays,
      audioCues: Array.isArray(slide.audioCues) ? slide.audioCues : [],
      storyReferences: normalizeStoryReferences(slide.storyReferences),
    };
  });

  const boostPack = (data.boostPack && typeof data.boostPack === 'object' &&
    Array.isArray((data.boostPack as any).activationSequence))
    ? data.boostPack
    : emptyBoostPack();

  const sparkStudents = normalizeSparkStudents((data as ProjectData & { sparkStudents?: unknown }).sparkStudents);
  if (sparkStudents.length === 0) {
    sparkStudents.push(createDefaultSparkStudent());
  }

  const activeStudentIdRaw = (data as ProjectData & { activeStudentId?: unknown }).activeStudentId;
  const activeStudentId = typeof activeStudentIdRaw === 'string' && sparkStudents.some((s) => s.id === activeStudentIdRaw)
    ? activeStudentIdRaw
    : sparkStudents[0].id;

  return {
    ...data,
    version: 3,
    sections,
    slides,
    boostPack,
    sparkStudents,
    activeStudentId,
  };
}

function resolveMediaPathFromUrl(rawUrl: string): { resolvedPath: string } | { status: number; message: string } {
  if (!currentProjectFolder) {
    return { status: 400, message: 'No project is open' };
  }

  try {
    const requestUrl = new URL(rawUrl);
    const relativePath = decodeURIComponent(`${requestUrl.host}${requestUrl.pathname}`).replace(/^\/+/, '');
    const projectRoot = path.resolve(currentProjectFolder);
    const resolvedPath = path.resolve(projectRoot, relativePath);
    const rootWithSeparator = projectRoot.endsWith(path.sep) ? projectRoot : `${projectRoot}${path.sep}`;

    if (resolvedPath !== projectRoot && !resolvedPath.startsWith(rootWithSeparator)) {
      return { status: 403, message: 'Forbidden' };
    }

    return { resolvedPath };
  } catch {
    return { status: 400, message: 'Invalid media URL' };
  }
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.mp4') return 'video/mp4';
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
      const result = resolveMediaPathFromUrl(request.url);
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

  protocol.registerFileProtocol('media', (request, callback) => {
    const result = resolveMediaPathFromUrl(request.url);
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
      nodeIntegration: false
    }
  });

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
  await ensureProjectFolder(folderPath);

  const now = new Date().toISOString();
  const defaultSparkStudent = createDefaultSparkStudent();
  const data: ProjectData = {
    version: 3,
    createdAt: now,
    updatedAt: now,
    slides: [],
    assets: [],
    sections: [{ id: randomUUID(), name: 'Section 1' }],
    boostPack: emptyBoostPack(),
    sparkStudents: [defaultSparkStudent],
    activeStudentId: defaultSparkStudent.id,
  };

  await writeProjectAtomic(folderPath, data);
  currentProjectFolder = folderPath;
  return { folderPath, data, lastSavedAt: now } satisfies ProjectState;
});

ipcMain.handle('project:open', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(getWindow(), {
    title: 'Open Project Folder',
    properties: ['openDirectory']
  });
  if (canceled || filePaths.length === 0) return null;

  const folderPath = filePaths[0];
  await ensureProjectFolder(folderPath);

  const pjPath = projectPath(folderPath);
  try {
    await fs.access(pjPath);
  } catch {
    throw new Error('project.json not found in selected folder');
  }

  currentProjectFolder = folderPath;
  return loadProject(folderPath);
});

ipcMain.handle('project:import-media', async (): Promise<ImportResult | null> => {
  if (!currentProjectFolder) throw new Error('Create or open a project first');

  const { canceled, filePaths } = await dialog.showOpenDialog(getWindow(), {
    title: 'Import Media',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Media', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'mp4', 'mov', 'webm', 'mkv', 'avi'] }
    ]
  });
  if (canceled || filePaths.length === 0) return null;

  const importedAssets: AssetItem[] = [];
  const createdSlides: Slide[] = [];
  const defaultSectionId = (await loadProject(currentProjectFolder)).data.sections[0]?.id ?? randomUUID();

  for (const sourcePath of filePaths) {
    const ext = path.extname(sourcePath).toLowerCase();
    const mediaType = detectMediaType(ext);
    if (!mediaType) continue;

    const id = randomUUID();
    const filename = `${id}${ext}`;
    const targetPath = path.join(currentProjectFolder, ASSETS_DIR, filename);
    const stat = await fs.stat(sourcePath);
    await fs.copyFile(sourcePath, targetPath);

    importedAssets.push({
      id,
      relativePath: path.join(ASSETS_DIR, filename).replaceAll('\\', '/'),
      filename,
      originalName: path.basename(sourcePath),
      mediaType,
      sizeBytes: stat.size,
      importedAt: new Date().toISOString()
    });

    createdSlides.push({
      id: randomUUID(),
      assetId: id,
      sectionId: defaultSectionId,
      transition: 'fade'
    });
  }

  return { importedAssets, createdSlides };
});

ipcMain.handle('project:save', async (_, data: ProjectData, mode: SaveMode = 'save') => {
  if (!currentProjectFolder) throw new Error('Create or open a project first');

  if (mode === 'saveAs') {
    const sourceFolder = currentProjectFolder;
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

    await ensureFolderIsEmpty(targetFolder);
    await copyProjectFolder(sourceFolder, targetFolder);
    const lastSavedAt = await writeProjectAtomic(targetFolder, data);
    currentProjectFolder = targetFolder;
    return { lastSavedAt, folderPath: targetFolder };
  }

  const lastSavedAt = await writeProjectAtomic(currentProjectFolder, data);
  return { lastSavedAt, folderPath: currentProjectFolder };
});

ipcMain.handle('project:import-audio', async (): Promise<AssetItem[] | null> => {
  if (!currentProjectFolder) throw new Error('Create or open a project first');

  const { canceled, filePaths } = await dialog.showOpenDialog(getWindow(), {
    title: 'Import Audio',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'aac', 'm4a'] }
    ]
  });
  if (canceled || filePaths.length === 0) return null;

  const importedAssets: AssetItem[] = [];

  for (const sourcePath of filePaths) {
    const ext = path.extname(sourcePath).toLowerCase();
    const mediaType = detectMediaType(ext);
    if (mediaType !== 'audio') continue;

    const id = randomUUID();
    const filename = `${id}${ext}`;
    const targetPath = path.join(currentProjectFolder, ASSETS_DIR, filename);
    const stat = await fs.stat(sourcePath);
    await fs.copyFile(sourcePath, targetPath);

    importedAssets.push({
      id,
      relativePath: path.join(ASSETS_DIR, filename).replaceAll('\\', '/'),
      filename,
      originalName: path.basename(sourcePath),
      mediaType,
      sizeBytes: stat.size,
      importedAt: new Date().toISOString()
    });
  }

  return importedAssets;
});

ipcMain.handle('import-bubble-template', async (): Promise<{ success: boolean; relativePath?: string }> => {
  if (!currentProjectFolder) return { success: false };

  const { canceled, filePaths } = await dialog.showOpenDialog(getWindow(), {
    title: 'Import Bubble Template',
    properties: ['openFile'],
    filters: [{ name: 'PNG', extensions: ['png'] }]
  });

  if (canceled || filePaths.length === 0) return { success: false };

  const sourcePath = filePaths[0];
  const bubblesDir = path.join(currentProjectFolder, ASSETS_DIR, 'bubbles');

  try {
    // Ensure bubbles directory exists
    await fs.mkdir(bubblesDir, { recursive: true });

    const originalExt = path.extname(sourcePath);
    const originalBase = path.basename(sourcePath, originalExt);
    let fileName = path.basename(sourcePath);
    let targetPath = path.join(bubblesDir, fileName);
    let counter = 1;

    // Unique filename check
    while (await fs.stat(targetPath).then(() => true).catch(() => false)) {
      fileName = `${originalBase}_${counter}${originalExt}`;
      targetPath = path.join(bubblesDir, fileName);
      counter++;
    }

    await fs.copyFile(sourcePath, targetPath);

    const relativePath = path.join(ASSETS_DIR, 'bubbles', fileName).replace(/\\/g, '/');
    return { success: true, relativePath };
  } catch (err) {
    console.error('Failed to import bubble template:', err);
    return { success: false };
  }
});
