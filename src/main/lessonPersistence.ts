import { dialog, ipcMain, type BrowserWindow } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { LessonProject, LessonProjectState } from '../shared/lesson/model';
import { createLesson } from '../shared/lesson/commands';
import { parseLessonProject } from '../shared/lesson/validation';

type SaveMode = 'save' | 'saveAs';

/** Both formats share the same active-folder authority, locks and atomic writer. */
export interface LessonPersistenceHost {
  getWindow(): BrowserWindow;
  getActive(): { folderPath: string | null; format: 'legacy' | 'lesson' | null; id: string | null };
  prepare(project: Omit<LessonProjectState, 'activationToken'>): LessonProjectState;
  activate(token: unknown): string | null;
  adoptSavedFolder(folderPath: string): void;
  withWrite<T>(operation: () => Promise<T>): Promise<T>;
  ensureFolderIsEmpty(folderPath: string): Promise<void>;
  copyProjectFolder(source: string, target: string): Promise<void>;
  writeAtomic(folderPath: string, data: LessonProject, createOnly?: boolean): Promise<string>;
}

async function readLesson(folder: string): Promise<LessonProject> {
  const parsed: unknown = JSON.parse(await fs.readFile(path.join(folder, 'project.json'), 'utf8'));
  if (!parsed || typeof parsed !== 'object' || !('format' in parsed) || parsed.format !== 'story-studio-scene') {
    throw new Error('This is a legacy project or an unsupported format. Open legacy lessons in the legacy workspace.');
  }
  return parseLessonProject(parsed);
}

export function installLessonPersistence(host: LessonPersistenceHost): void {
  const openPath = async (folderPath: unknown) => {
    if (typeof folderPath !== 'string' || !folderPath.trim()) throw new Error('Invalid project path.');
    const folder = path.resolve(folderPath);
    const data = await readLesson(folder);
    return host.prepare({ folderPath: folder, data, lastSavedAt: data.updatedAt });
  };

  ipcMain.on('lesson:activate', (event, token: unknown) => {
    event.returnValue = host.activate(token);
  });

  ipcMain.handle('lesson:open-path', (_, folderPath: unknown) => openPath(folderPath));
  ipcMain.handle('lesson:open', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(host.getWindow(), {
      title: 'Open Story Studio Lesson', properties: ['openDirectory'],
    });
    return canceled || !filePaths.length ? null : openPath(filePaths[0]);
  });

  ipcMain.handle('lesson:create', () => host.withWrite(async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(host.getWindow(), {
      title: 'Choose an Empty Folder for the New Lesson', properties: ['openDirectory', 'createDirectory'],
    });
    if (canceled || !filePaths.length) return null;
    const folderPath = path.resolve(filePaths[0]);
    await host.ensureFolderIsEmpty(folderPath);
    const data = createLesson();
    const assetsPath = path.join(folderPath, 'assets');
    await fs.mkdir(assetsPath);
    try {
      const lastSavedAt = await host.writeAtomic(folderPath, parseLessonProject(data), true);
      return host.prepare({ folderPath, data: { ...data, updatedAt: lastSavedAt }, lastSavedAt });
    } catch (error) {
      // Only remove our empty directory. Never recursively remove user content.
      await fs.rmdir(assetsPath).catch(() => {});
      throw error;
    }
  }));

  ipcMain.handle('lesson:save', (_, value: unknown, mode: SaveMode = 'save', expectedFolder: unknown) => host.withWrite(async () => {
    const active = host.getActive();
    if (!active.folderPath || expectedFolder !== active.folderPath) throw new Error('Active project folder changed. Save cancelled.');
    if (active.format !== 'lesson') throw new Error('Cannot save the scene format over an active legacy project.');
    if (mode !== 'save' && mode !== 'saveAs') throw new Error('Invalid save mode.');
    const data = parseLessonProject(value);
    const onDisk = await readLesson(active.folderPath);
    if (data.id !== active.id || onDisk.id !== active.id) throw new Error('Project identity changed. Open the intended lesson again before saving.');

    if (mode === 'saveAs') {
      const { canceled, filePaths } = await dialog.showOpenDialog(host.getWindow(), {
        title: 'Save Lesson As', properties: ['openDirectory', 'createDirectory'],
      });
      if (canceled || !filePaths.length) return null;
      const target = path.resolve(filePaths[0]);
      const source = path.resolve(active.folderPath);
      const relative = path.relative(source, target);
      if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
        throw new Error('Choose a different, empty folder outside the current project for Save As.');
      }
      await host.ensureFolderIsEmpty(target);
      await host.copyProjectFolder(source, target);
      const lastSavedAt = await host.writeAtomic(target, data, true);
      host.adoptSavedFolder(target);
      return { lastSavedAt, folderPath: target };
    }

    const lastSavedAt = await host.writeAtomic(active.folderPath, data);
    return { lastSavedAt, folderPath: active.folderPath };
  }));
}
