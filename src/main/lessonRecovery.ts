import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { LessonProject } from '../shared/lesson/model';
import { parseSceneDocument } from '../shared/lesson/validation';

const CHECKPOINT_NAME = /^\d{13}-[\da-f-]{36}\.json$/;
const RECOVERY_LIMIT = 30;

export function recoveryDirectory(root: string, folder: string, id: string): string {
  return path.join(root, 'lesson-recovery', createHash('sha256').update(path.resolve(folder) + '\0' + id).digest('hex'));
}
export async function checkpoint(root: string, folder: string, data: LessonProject, reason: string): Promise<void> {
  const directory = recoveryDirectory(root, folder, data.id);
  await fs.mkdir(directory, { recursive: true });
  const names = (await fs.readdir(directory)).filter(name => CHECKPOINT_NAME.test(name)).sort().reverse();
  const prune = async (keep: number) => { for (const name of names.slice(keep)) await fs.unlink(path.join(directory, name)); };
  if (names[0]) {
    let previous: { data?: unknown } | undefined;
    try { previous = JSON.parse(await fs.readFile(path.join(directory, names[0]), 'utf8')); } catch { /* A damaged checkpoint must not block a fresh backup. */ }
    if (JSON.stringify(previous?.data) === JSON.stringify(data)) { await prune(RECOVERY_LIMIT); return; }
  }
  // Keep ordering deterministic even when consecutive writes share a millisecond.
  const timestamp = Math.max(Date.now(), names[0] ? Number(names[0].slice(0, 13)) + 1 : 0);
  const name = `${timestamp}-${randomUUID()}.json`, temporary = path.join(directory, `${name}.tmp`);
  const handle = await fs.open(temporary, 'wx');
  try { await handle.writeFile(JSON.stringify({ createdAt: new Date().toISOString(), reason, data })); await handle.sync(); }
  finally { await handle.close(); }
  await fs.rename(temporary, path.join(directory, name));
  await prune(RECOVERY_LIMIT - 1);
}
export async function recoveryList(root: string, folder: string, id: string) {
  const directory = recoveryDirectory(root, folder, id);
  let names: string[];
  try { names = await fs.readdir(directory); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  const result: { name: string; createdAt: string; reason: string; title: string }[] = [];
  for (const name of names.filter(n => CHECKPOINT_NAME.test(n)).sort().reverse().slice(0, RECOVERY_LIMIT)) {
    try { const value = JSON.parse(await fs.readFile(path.join(directory, name), 'utf8')); if (value.data?.id === id) result.push({ name, createdAt: value.createdAt, reason: value.reason, title: value.data.title }); } catch { /* Ignore incomplete or externally damaged snapshots. */ }
  }
  return result;
}
export async function readRecovery(root: string, folder: string, id: string, name: unknown): Promise<LessonProject> {
  if (typeof name !== 'string' || !/^\d{13}-[\da-f-]{36}\.json$/.test(name)) throw new Error('Invalid recovery version.');
  const snapshot = JSON.parse(await fs.readFile(path.join(recoveryDirectory(root, folder, id), name), 'utf8'));
  const data = parseSceneDocument(snapshot.data);
  if (data.id !== id) throw new Error('Recovery version belongs to another project.');
  return data;
}
