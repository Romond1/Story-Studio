import { checkpoint, recoveryList, readRecovery } from './lessonRecovery';
import { dialog, ipcMain, type BrowserWindow } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { createEpisodeFromScene, putAdventureDefinition } from '../shared/episode/commands';
import type { LessonProject, LessonProjectState } from '../shared/lesson/model';
import { createLesson, createScene, insertScene } from '../shared/lesson/commands';
import { parseLessonProject, parseSceneDocument } from '../shared/lesson/validation';

import { convertSceneToEpisode } from './episodeConversion';
import { exportEpisodePackage, importEpisodePackage, rejectPackageFolder } from './episodePackageService';
import type { EpisodeAdventure } from '../shared/episodeProtocol';

type SaveMode = 'save' | 'saveAs';

/** Both formats share the same active-folder authority, locks and atomic writer. */
export interface LessonPersistenceHost {
  getWindow(): BrowserWindow;
  getBackupRoot(): string;
  getPackageContext?(): { leaseId: string | null; builtinRoot: string };
  authorize(event: Electron.IpcMainInvokeEvent): void;
  getActive(): { folderPath: string | null; format: 'legacy' | 'lesson' | null; id: string | null; documentFormat: string | null };
  prepare(project: Omit<LessonProjectState, 'activationToken'>): LessonProjectState;
  activate(token: unknown): string | null;
  adoptSavedFolder(folderPath: string): void;
  withWrite<T>(operation: () => Promise<T>): Promise<T>;
  ensureFolderIsEmpty(folderPath: string): Promise<void>;
  copyProjectFolder(source: string, target: string): Promise<void>;
  writeAtomic(folderPath: string, data: LessonProject, createOnly?: boolean): Promise<string>;
}

async function readLesson(folder: string): Promise<LessonProject> {
  await rejectPackageFolder(folder);
  const parsed: unknown = JSON.parse(await fs.readFile(path.join(folder, 'project.json'), 'utf8'));
  if (!parsed || typeof parsed !== 'object' || !('format' in parsed) || !['story-studio-scene', 'story-studio-episode'].includes(String(parsed.format))) {
    throw new Error('This is a legacy project or an unsupported format. Open legacy lessons in the legacy workspace.');
  }
  return parseSceneDocument(parsed);
}

export function installLessonPersistence(host: LessonPersistenceHost): void {
  const drafts = new Set<string>();
  ipcMain.handle('lesson:prepare-games', (event, value: unknown, expectedFolder: unknown) => {
    host.authorize(event);
    return host.withWrite(async () => {
      const active = host.getActive();
      if (!active.folderPath || active.folderPath !== expectedFolder || active.format !== 'lesson') throw new Error('Active project changed.');
      const scene = parseSceneDocument(value);
      const original = await fs.readFile(path.join(active.folderPath, 'project.json'), 'utf8');
      const disk = parseSceneDocument(JSON.parse(original));
      if (scene.id !== active.id || disk.id !== active.id || disk.format !== scene.format || active.documentFormat !== scene.format) throw new Error('Project identity or format changed.');
      let data = scene;
      let lastSavedAt = disk.updatedAt;
      if (scene.format === 'story-studio-scene') {
        const episode = createEpisodeFromScene(scene, { id: scene.id, version: '1' });
        data = putAdventureDefinition(episode, { id: scene.id, version: '1', name: scene.title, description: '', rewards: [], relics: [] });
        // Media stays in place. Preserve the original envelope before atomic publication.
        const backup = path.join(host.getBackupRoot(), randomUUID());
        await fs.mkdir(backup, { recursive: true });
        await fs.writeFile(path.join(backup, 'project.json'), original, { flag: 'wx' });
        if (await fs.readFile(path.join(active.folderPath, 'project.json'), 'utf8') !== original) throw new Error('Project changed during preparation.');
        lastSavedAt = await host.writeAtomic(active.folderPath, data);
      }
      return { ...host.prepare({ folderPath: active.folderPath, data, lastSavedAt }), isDraft: drafts.has(active.folderPath) };
    });
  });
  const capture = (expectedFolder?:unknown) => {
    const active=host.getActive(),context=host.getPackageContext?.();
    if(expectedFolder!==undefined&&(!active.folderPath||active.folderPath!==expectedFolder||active.documentFormat!=='story-studio-episode'))throw Error('Active episode changed.');
    return {active,context,assertCurrent:()=>{const now=host.getActive();if(now.folderPath!==active.folderPath||now.id!==active.id||host.getPackageContext?.().leaseId!==context?.leaseId)throw Error('Active project lease changed.');}};
  };
  ipcMain.handle('lesson:export-package',(event,value:unknown,expectedFolder:unknown)=>{host.authorize(event);return host.withWrite(async()=>{
    const {active,context,assertCurrent}=capture(expectedFolder);if(!context?.leaseId||!active.folderPath)throw Error('Active episode lease required.');
    const data=parseSceneDocument(value);if(data.id!==active.id||data.format!=='story-studio-episode')throw Error('Active episode identity changed.');const onDisk=await readLesson(active.folderPath);if(onDisk.id!==active.id||onDisk.format!==data.format)throw Error('On-disk episode identity changed.');
    const choice=await dialog.showOpenDialog(host.getWindow(),{title:'Export Portable Episode: Choose an Empty Folder',properties:['openDirectory','createDirectory']});if(choice.canceled||!choice.filePaths.length)return null;
    return exportEpisodePackage({source:active.folderPath,target:choice.filePaths[0],data,builtinRoot:context.builtinRoot,assertCurrent});
  });});
  ipcMain.handle('lesson:import-package',(event)=>{host.authorize(event);return host.withWrite(async()=>{
    const {assertCurrent}=capture();const source=await dialog.showOpenDialog(host.getWindow(),{title:'Import Portable Episode: Choose Package',properties:['openDirectory']});if(source.canceled||!source.filePaths.length)return null;
    const target=await dialog.showOpenDialog(host.getWindow(),{title:'Import Portable Episode: Choose an Empty Editable Folder',properties:['openDirectory','createDirectory']});if(target.canceled||!target.filePaths.length)return null;
    const result=await importEpisodePackage({source:source.filePaths[0],target:target.filePaths[0],assertCurrent});assertCurrent();return host.prepare(result);
  });});
  ipcMain.handle('lesson:convert', (event, value: unknown, adventure: EpisodeAdventure, expectedFolder: unknown) => {
    host.authorize(event);
    return host.withWrite(async () => {
      const active = host.getActive();
      if (!active.folderPath || active.folderPath !== expectedFolder || active.format !== 'lesson') throw new Error('Active project changed or legacy conversion is unsupported.');
      const data = parseLessonProject(value);
      if (data.id !== active.id || active.documentFormat !== 'story-studio-scene') throw new Error('Only the active scene-v1 lesson can be converted.');
      const { canceled, filePaths } = await dialog.showOpenDialog(host.getWindow(), {title: 'Convert to Episode: Choose an Empty Folder', properties: ['openDirectory', 'createDirectory']});
      if (canceled || !filePaths.length) return null;
      const result = await convertSceneToEpisode({source: active.folderPath, target: path.resolve(filePaths[0]), backupRoot: host.getBackupRoot(), data, adventure, writeAtomic: host.writeAtomic});
      return { ...host.prepare(result), backupPath: result.backupPath, migrationReport: result.migrationReport };
    });
  });
  ipcMain.handle('lesson:draft', (_, sequence: unknown) => host.withWrite(async () => {
    if (sequence !== 'story' && sequence !== 'activation') throw new Error('Invalid lesson phase.');
    const folderPath = await fs.mkdtemp(path.join(os.tmpdir(), 'story-studio-draft-'));
    await fs.mkdir(path.join(folderPath, 'assets'));
    const data = insertScene(createLesson(), sequence, createScene()).project;
    const lastSavedAt = await host.writeAtomic(folderPath, data, true);
    drafts.add(folderPath);
    return { ...host.prepare({ folderPath, data, lastSavedAt }), isDraft: true };
  }));
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

  const recoveryActive = (expectedFolder: unknown) => {
    const active = host.getActive();
    if (!active.folderPath || !active.id || active.format !== 'lesson' || active.folderPath !== expectedFolder) throw new Error('Active project changed.');
    return active as typeof active & { folderPath: string; id: string };
  };
  ipcMain.handle('lesson:recovery-list', (event, expectedFolder: unknown) => { host.authorize(event); return host.withWrite(async () => { const a = recoveryActive(expectedFolder); return recoveryList(host.getBackupRoot(), a.folderPath, a.id); }); });
  ipcMain.handle('lesson:recovery-read', (event, expectedFolder: unknown, name: unknown, current: unknown) => { host.authorize(event); return host.withWrite(async () => { const a = recoveryActive(expectedFolder); const data = await readRecovery(host.getBackupRoot(), a.folderPath, a.id, name); if (data.format !== a.documentFormat) throw new Error('Recovery format changed.'); if (current !== undefined) { const previous = parseSceneDocument(current); if (previous.id !== a.id || previous.format !== a.documentFormat) throw new Error('Current project changed.'); await checkpoint(host.getBackupRoot(), a.folderPath, previous, 'Before recovery restore'); } return data; }); });
  ipcMain.handle('lesson:autosave', (event, value: unknown, expectedFolder: unknown) => { host.authorize(event); return host.withWrite(async () => {
    const a = recoveryActive(expectedFolder), data = parseSceneDocument(value), disk = await readLesson(a.folderPath);
    if (data.id !== a.id || disk.id !== a.id || data.format !== a.documentFormat || disk.format !== data.format) throw new Error('Project identity or format changed. Autosave cancelled.');
    await checkpoint(host.getBackupRoot(), a.folderPath, disk, 'Before autosave');
    await checkpoint(host.getBackupRoot(), a.folderPath, data, 'Autosave');
    const lastSavedAt = await host.writeAtomic(a.folderPath, data);
    return { lastSavedAt, folderPath: a.folderPath, isDraft: drafts.has(a.folderPath) };
  }); });
  ipcMain.handle('lesson:save', (_, value: unknown, mode: SaveMode = 'save', expectedFolder: unknown) => host.withWrite(async () => {
    const active = host.getActive();
    if (!active.folderPath || expectedFolder !== active.folderPath) throw new Error('Active project folder changed. Save cancelled.');
    if (active.format !== 'lesson') throw new Error('Cannot save the scene format over an active legacy project.');
    if (mode !== 'save' && mode !== 'saveAs') throw new Error('Invalid save mode.');
    const data = parseSceneDocument(value);
    const onDisk = await readLesson(active.folderPath);
    if (data.format !== onDisk.format || data.format !== active.documentFormat) throw new Error('Project format changed. Reopen the intended project.');
    if (data.id !== active.id || onDisk.id !== active.id) throw new Error('Project identity changed. Open the intended lesson again before saving.');

    if (mode === 'saveAs' || drafts.has(active.folderPath)) {
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

    await checkpoint(host.getBackupRoot(), active.folderPath, onDisk, 'Before manual save');
    await checkpoint(host.getBackupRoot(), active.folderPath, data, 'Manual save');
    const lastSavedAt = await host.writeAtomic(active.folderPath, data);
    return { lastSavedAt, folderPath: active.folderPath };
  }));
}
