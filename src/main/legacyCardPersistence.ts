import { isDeepStrictEqual } from 'node:util';
import type { ProjectData } from '../shared/types';

// This boundary is main-process-only. Neither the original authored representation
// nor this bookkeeping is sent to the renderer or serialized into project.json.
type RecordData = Record<string, any>;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const equal = (a: unknown, b: unknown) => isDeepStrictEqual(a, b);
const list = (value: unknown): RecordData[] => Array.isArray(value) ? value : [];
const hostTypes = new Set(['slideRef', 'breakRef', 'promptCard', 'miniGame', 'aCardRef', 'cardActivityRef']);

function restoreField(target: RecordData, raw: RecordData, key: string) {
  if (Object.prototype.hasOwnProperty.call(raw, key)) target[key] = raw[key];
  else delete target[key];
}

// Preserve normalization-only differences, including unknown authored properties.
// Real edits (including property removal) always win over the original snapshot.
function mergeEdits(raw: RecordData, baseline: RecordData, current: RecordData): RecordData {
  const result = { ...raw };
  for (const key of new Set([...Object.keys(baseline), ...Object.keys(current)])) {
    if (!equal(baseline[key], current[key])) restoreField(result, current, key);
  }
  return result;
}

function restoreStoryHosts(raw: RecordData[], baseline: RecordData[], current: RecordData[]) {
  return current.map(host => {
    const index = baseline.findIndex(item => item.id === host.id);
    const original = raw[index];
    const before = baseline[index];
    if (!original || !before) return host;
    // These two fields are coupled: a legacy story ref becomes a runtime instance.
    // An explicit card edit persists the edited block; unrelated host edits do not.
    if (!equal(host.storyReferences, before.storyReferences)
      || !equal(host.bCardInstances, before.bCardInstances)) return host;
    const result = { ...host };
    restoreField(result, original, 'storyReferences');
    restoreField(result, original, 'bCardInstances');
    return result;
  });
}

type SequenceGroup = { before: RecordData[]; host?: RecordData; after: RecordData[] };

function restoreSequence(raw: RecordData[], baseline: RecordData[], current: RecordData[]) {
  if (equal(baseline, current)) return raw;

  // Mirror the existing compatibility attachment rule: pending legacy references
  // attach to the next host; trailing ones attach to the final host. Match groups
  // to the actual normalized IDs (which may have been generated during loading).
  const groups: SequenceGroup[] = [];
  let pending: RecordData[] = [];
  for (const item of raw) {
    if (item?.type === 'bCardRef') { pending.push(item); continue; }
    if (!hostTypes.has(item?.type)) continue;
    groups.push({ before: pending, host: item, after: [] });
    pending = [];
  }
  if (pending.length) {
    if (groups.length) groups[groups.length - 1].after = pending;
    else groups.push({ before: pending, after: [] });
  }

  return current.flatMap((host, currentIndex) => {
    const index = baseline.findIndex(item => item.id === host.id);
    const group = groups[index];
    const before = baseline[index];
    if (!group || !before) return [host];
    if (host.type !== before.type || !equal(host.bCardInstances, before.bCardInstances)) return [host];
    // Moving the final host or appending another host changes the meaning of
    // trailing legacy refs. Persist this explicitly edited layout as displayed,
    // rather than letting those cards attach to a different host on reopening.
    if (group.after.length && currentIndex !== current.length - 1) return [host];
    if (!group.host) {
      // A legacy-only sequence has a synthetic runtime prompt. Keep it out of
      // authored data unless the teacher intentionally edits that prompt.
      return equal(host, before) ? [...group.before, ...group.after] : [host];
    }
    return [...group.before, mergeEdits(group.host, before, host), ...group.after];
  });
}

export class LegacyCardPersistence {
  private readonly authored: ProjectData;
  private readonly normalized: ProjectData;

  constructor(authored: ProjectData, normalized: ProjectData) {
    // Isolate snapshots from renderer edits, normalization aliases and test/IPC
    // object ownership. Keep the load baseline across Save/Save As and undo/redo.
    this.authored = clone(authored);
    this.normalized = clone(normalized);
  }

  forSave(data: ProjectData): ProjectData {
    const result = clone(data);
    result.slides = restoreStoryHosts(list(this.authored.slides), list(this.normalized.slides), list(result.slides)) as ProjectData['slides'];
    result.sections = restoreStoryHosts(list(this.authored.sections), list(this.normalized.sections), list(result.sections)) as ProjectData['sections'];
    if (result.boostPack) {
      for (const key of ['activationSequence', 'languageSequence', 'gamesSequence'] as const) {
        const raw = this.authored.boostPack?.[key];
        const baseline = this.normalized.boostPack?.[key];
        if (equal(baseline, result.boostPack[key])) {
          restoreField(result.boostPack, this.authored.boostPack || {}, key);
        } else {
          result.boostPack[key] = restoreSequence(list(raw), list(baseline), list(result.boostPack[key])) as typeof result.boostPack[typeof key];
        }
      }
      if (!this.authored.boostPack && equal(data.boostPack, this.normalized.boostPack)) delete result.boostPack;
    }
    return result;
  }
}
