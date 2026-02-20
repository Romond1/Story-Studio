// src/main/main.ts
import { app, BrowserWindow, dialog, ipcMain, protocol } from 'electron';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import type { AssetItem, ImportResult, MediaType, ProjectData, ProjectState, Section, Slide } from '../shared/types';

const PROJECT_FILENAME = 'project.json';
const TEMP_PROJECT_FILENAME = 'project.tmp.json';
const ASSETS_DIR = 'assets';


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

function detectMediaType(ext: string): MediaType | null {
  if (imageExts.has(ext)) return 'image';
  if (videoExts.has(ext)) return 'video';
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


function normalizeProjectData(data: ProjectData): ProjectData {
  const hasSections = Array.isArray((data as ProjectData & { sections?: Section[] }).sections)
    && ((data as ProjectData & { sections?: Section[] }).sections?.length ?? 0) > 0;

  if (hasSections) {
    return data;
  }

  const defaultSection: Section = { id: randomUUID(), name: 'Section 1' };
  return {
    ...data,
    sections: [defaultSection],
    slides: data.slides.map((slide) => ({
      ...slide,
      sectionId: defaultSection.id
    }))
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
  const data: ProjectData = {
    version: 1,
    createdAt: now,
    updatedAt: now,
    slides: [],
    assets: [],
    sections: [{ id: randomUUID(), name: 'Section 1' }]
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

ipcMain.handle('project:save', async (_, data: ProjectData) => {
  if (!currentProjectFolder) throw new Error('Create or open a project first');
  const lastSavedAt = await writeProjectAtomic(currentProjectFolder, data);
  return { lastSavedAt };
});
