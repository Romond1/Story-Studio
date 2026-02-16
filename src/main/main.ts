import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AssetItem, ImportResult, MediaType, ProjectData, ProjectState, Slide } from '../shared/types';

const PROJECT_FILENAME = 'project.json';
const TEMP_PROJECT_FILENAME = 'project.tmp.json';
const ASSETS_DIR = 'assets';

let mainWindow: BrowserWindow | null = null;
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
  const data = JSON.parse(raw) as ProjectData;
  return { folderPath: folder, data, lastSavedAt: data.updatedAt };
}

function createWindow(): void {
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
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

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
    assets: []
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
