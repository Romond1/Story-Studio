import { makeId, type LessonProject, type SequenceKind } from './model';
import { createScene, insertScene } from './commands';
import { LESSON_LIMITS } from './limits';

/** Preserve sequence and audio exactly while upgrading old display labels. */
export function migrateSections<T extends LessonProject>(project: T): T {
  const normalize = (entries: LessonProject['sequences']['story']) => entries.map(entry => entry.kind === 'break' && (entry.sectionId || entry.section) ? { ...entry, sectionId: undefined, section: '' } : entry);
  const story = normalize(project.sequences.story), activation = normalize(project.sequences.activation);
  if (story.some((e,i) => e !== project.sequences.story[i]) || activation.some((e,i) => e !== project.sequences.activation[i])) project = { ...project, sequences: { story, activation } };
  if (project.sections) return project;
  const sections: NonNullable<LessonProject['sections']> = [];
  const sequences = { ...project.sequences };
  for (const sequence of ['story', 'activation'] as const) {
    let previous: (typeof sections)[number] | undefined;
    sequences[sequence] = project.sequences[sequence].map(entry => {
      if (!entry.section.trim()) { previous = undefined; return entry; }
      let section = previous?.name === entry.section ? previous : undefined;
      if (!section) { section = { id: makeId(), name: entry.section, sequence }; sections.push(section); }
      previous = section;
      return { ...entry, sectionId: section.id };
    });
  }
  return sections.length ? { ...project, sections, sequences } : project;
}
export function addSection<T extends LessonProject>(project: T, sequence: SequenceKind, name = 'New section') {
  project = migrateSections(project);
  if ((project.sections?.length ?? 0) >= LESSON_LIMITS.sections) throw new Error(`This lesson can contain at most ${LESSON_LIMITS.sections} sections.`);
  const sectionId = makeId();
  return { project: { ...project, sections: [...(project.sections ?? []), { id: sectionId, name: name.trim().slice(0, 500) || 'New section', sequence }] }, sectionId };
}
export function renameSection<T extends LessonProject>(project: T, sectionId: string, name: string): T {
  name = name.trim().slice(0, 500); if (!name) return project;
  return { ...project, sections: project.sections?.map(s => s.id === sectionId ? { ...s, name } : s),
    sequences: { story: project.sequences.story.map(e => e.sectionId === sectionId ? { ...e, section: name } : e), activation: project.sequences.activation.map(e => e.sectionId === sectionId ? { ...e, section: name } : e) } };
}
export function moveEntryToSection<T extends LessonProject>(project: T, sequence: SequenceKind, entryId: string, sectionId?: string, beforeEntryId?: string): T {
  const section = project.sections?.find(s => s.id === sectionId && s.sequence === sequence);
  if (sectionId && !section) throw new Error('Section no longer exists in this sequence.');
  const original = project.sequences[sequence].find(e => e.id === entryId);
  if (!original || entryId === beforeEntryId) return project;
  const breakDestinationSection = original.kind === 'break' ? sectionId : undefined;
  if (original.kind === 'break') { beforeEntryId = beforeEntryId ? topLevelBoundary(project, sequence, beforeEntryId) : sectionId ? breakAfterGroup(project, sequence, undefined, sectionId) : undefined; sectionId = undefined; }
  const breakAtEnd = original.kind === 'break' && !beforeEntryId;
  const entries = project.sequences[sequence].filter(e => e.id !== entryId);
  let index = beforeEntryId ? entries.findIndex(e => e.id === beforeEntryId) : -1;
  if (breakAtEnd) index = entries.length;
  if (index < 0) {
    const last = entries.map(e => e.sectionId).lastIndexOf(sectionId);
    if (last >= 0) index = last + 1;
    else {
      const groups = timelineGroups(project, sequence), groupIndex = groups.findIndex(g => g.kind !== 'break' && g.sectionId === sectionId);
      const following = groups.slice(groupIndex + 1).flatMap(g => g.entries).find(e => e.id !== entryId);
      index = following ? entries.findIndex(e => e.id === following.id) : entries.length;
    }
  }
  entries.splice(index, 0, { ...original, sectionId, section: original.kind === 'break' ? '' : section?.name ?? '' });
  return { ...project, ...(breakDestinationSection && !project.sequences[sequence].some(e => e.kind !== 'break' && e.sectionId === breakDestinationSection) ? { sections: project.sections?.map(s => s.id === breakDestinationSection ? { ...s, beforeEntryId: entryId } : s) } : {}), sequences: { ...project.sequences, [sequence]: entries } };
}
export function insertBreak<T extends LessonProject>(project: T, sequence: SequenceKind, beforeEntryId?: string, sectionId?: string) {
  const scene = createScene('Break');
  scene.objects = [
    { kind: 'text', id: makeId(), visible: true, text: 'Review together', fontSize: 44, color: '#ffffff', align: 'center', box: { x: 80, y: 20, width: 1120, height: 70 } },
    { kind: 'text', id: makeId(), visible: true, text: 'What do you remember? Share one idea with the class.', fontSize: 24, color: '#ffffff', align: 'center', box: { x: 80, y: 92, width: 1120, height: 36 } },
  ];
  const boundary = sectionId ? breakAfterGroup(project, sequence, undefined, sectionId) : topLevelBoundary(project, sequence, beforeEntryId);
  const added = insertScene(project, sequence, scene, boundary);
  const next = { ...added.project, sequences: { ...added.project.sequences, [sequence]: added.project.sequences[sequence].map(e => e.id === added.entryId ? { ...e, kind: 'break' as const, sectionId: undefined, section: '' } : e) } };
  return { project: sectionId && !project.sequences[sequence].some(e => e.sectionId === sectionId && e.kind !== 'break') ? { ...next, sections: next.sections?.map(s => s.id === sectionId ? { ...s, beforeEntryId: added.entryId } : s) } : next, entryId: added.entryId };
}

/** Containers follow sequence order; disjoint legacy runs remain in place. */
export function timelineGroups<T extends LessonProject>(project: T, sequence: SequenceKind) {
  const groups: { key: string; kind: 'section' | 'ungrouped' | 'break'; sectionId?: string; entries: LessonProject['sequences']['story'] }[] = [];
  for (const entry of project.sequences[sequence]) {
    const previous = groups[groups.length - 1];
    if (entry.kind === 'break') groups.push({ key: entry.id, kind: 'break', entries: [entry] });
    else if (previous && previous.kind !== 'break' && previous.sectionId === entry.sectionId) previous.entries.push(entry);
    else groups.push({ key: entry.id, kind: entry.sectionId ? 'section' : 'ungrouped', sectionId: entry.sectionId, entries: [entry] });
  }
  const sections = project.sections?.filter(s => s.sequence === sequence) ?? [];
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (groups.some(g => g.sectionId === section.id)) continue;
    const nextIds = sections.slice(i + 1).map(s => s.id);
    const anchored = section.beforeEntryId ? groups.findIndex(g => g.entries.some(e => e.id === section.beforeEntryId)) : -1;
    const index = anchored >= 0 ? anchored : groups.findIndex(g => g.sectionId && nextIds.includes(g.sectionId));
    groups.splice(index < 0 ? groups.length : index, 0, { key: section.id, kind: 'section', sectionId: section.id, entries: [] });
  }
  if (!groups.some(g => g.kind === 'ungrouped')) groups.push({ key: 'ungrouped', kind: 'ungrouped', entries: [] });
  return groups;
}

/** One immutable transaction moves every child, keeping scene and entry identities. */
export function moveSection<T extends LessonProject>(project: T, sequence: SequenceKind, sectionId: string, beforeSectionId?: string, beforeEntryId?: string): T {
  const all = project.sections?.filter(s => s.sequence === sequence) ?? [];
  const visualIds = [...new Set(timelineGroups(project, sequence).map(g => g.sectionId).filter((id): id is string => !!id))];
  const own = visualIds.map(id => all.find(s => s.id === id)).filter((s): s is typeof all[number] => !!s);
  if (!own.some(s => s.id === sectionId) || (beforeSectionId && !own.some(s => s.id === beforeSectionId))) throw new Error('Section no longer exists in this sequence.');
  if (sectionId === beforeSectionId) return project;
  const section = own.find(s => s.id === sectionId)!;
  const ordered = own.filter(s => s.id !== sectionId);
  const sectionIndex = beforeSectionId ? ordered.findIndex(s => s.id === beforeSectionId) : ordered.length;
  ordered.splice(sectionIndex, 0, section);
  const children = project.sequences[sequence].filter(e => e.sectionId === sectionId);
  const entries = project.sequences[sequence].filter(e => e.sectionId !== sectionId);
  const nextEntry = beforeEntryId ?? ordered.slice(sectionIndex + 1).map(s => entries.find(e => e.sectionId === s.id)?.id ?? (entries.some(e => e.id === s.beforeEntryId) ? s.beforeEntryId : undefined)).find(Boolean);
  const target = nextEntry ? entries.findIndex(e => e.id === nextEntry) : -1;
  const positioned = ordered.map(s => s.id === sectionId ? { ...s, beforeEntryId: children.length ? undefined : nextEntry } : s);
  entries.splice(target < 0 ? entries.length : target, 0, ...children);
  return { ...project, sections: [...(project.sections ?? []).filter(s => s.sequence !== sequence), ...positioned], sequences: { ...project.sequences, [sequence]: entries } };
}

/** Cut transfers occurrences, never duplicates or detaches linked scenes. */
export function moveTimelineEntries<T extends LessonProject>(project: T, source: SequenceKind, destination: SequenceKind, ids: string[], sectionId?: string, beforeEntryId?: string): T {
  const section = project.sections?.find(s => s.id === sectionId && s.sequence === destination);
  if (sectionId && !section) throw new Error('Section no longer exists in this sequence.');
  const moving = project.sequences[source].filter(e => ids.includes(e.id));
  if (moving.some(e => e.kind === 'break') && moving.some(e => e.kind !== 'break')) throw new Error('Move breaks separately from section scenes.');
  if (moving.some(e => e.kind === 'break')) beforeEntryId = topLevelBoundary(project, destination, beforeEntryId);
  if (!moving.length || (source === destination && beforeEntryId && ids.includes(beforeEntryId))) return project;
  const remaining = project.sequences[source].filter(e => !ids.includes(e.id));
  const targets = [...(source === destination ? remaining : project.sequences[destination])];
  if (targets.length + moving.length > LESSON_LIMITS.entriesPerSequence) throw new Error('The destination sequence has no room for these scenes.');
  let index = beforeEntryId ? targets.findIndex(e => e.id === beforeEntryId) : -1;
  if (index < 0) { const last = targets.map(e => e.sectionId).lastIndexOf(sectionId); index = last < 0 ? targets.length : last + 1; }
  targets.splice(index, 0, ...moving.map(e => ({ ...e, sectionId: e.kind === 'break' ? undefined : sectionId, section: e.kind === 'break' ? '' : section?.name ?? '' })));
  return { ...project, sequences: { ...project.sequences, [source]: remaining, [destination]: targets } };
}

/** Explicit append boundary keeps disjoint ungrouped/legacy runs independent. */
export function timelineGroupBoundary<T extends LessonProject>(project: T, sequence: SequenceKind, group: ReturnType<typeof timelineGroups>[number]): string | undefined {
  const last = group.entries[group.entries.length - 1];
  if (!last) { const groups = timelineGroups(project, sequence), index = groups.findIndex(g => g.key === group.key); return groups.slice(index + 1).flatMap(g => g.entries)[0]?.id; }
  const index = project.sequences[sequence].findIndex(e => e.id === last.id);
  return project.sequences[sequence][index + 1]?.id;
}

/** Explicit membership makes empty/collapsed targets identical to populated targets. */
export function insertSectionMedia<T extends LessonProject>(project: T, sequence: SequenceKind, assetIds: string[], sectionId?: string, beforeEntryId?: string) {
  if (sectionId && !project.sections?.some(s => s.id === sectionId && s.sequence === sequence)) throw new Error('Section no longer exists.');
  const assets = assetIds.map(id => { const asset = project.assets.find(a => a.id === id && a.mediaType !== 'audio'); if (!asset) throw new Error('Drop image or video media here.'); return asset; });
  const entryIds: string[] = [];
  for (const asset of assets.length ? assets : [undefined]) {
    const section = project.sections?.find(s => s.id === sectionId);
    const groups = timelineGroups(project, sequence);
    const groupIndex = groups.findIndex(g => g.kind !== 'break' && g.sectionId === sectionId);
    const own = project.sequences[sequence].filter(e => e.kind !== 'break' && e.sectionId === sectionId);
    const lastIndex = own.length ? project.sequences[sequence].findIndex(e => e.id === own[own.length - 1].id) : -1;
    const next = beforeEntryId ?? (lastIndex >= 0 ? project.sequences[sequence][lastIndex + 1]?.id : groups.slice(groupIndex + 1).flatMap(g => g.entries)[0]?.id);
    const added = insertScene(project, sequence, createScene(asset?.originalName ?? 'New scene', asset?.id), next);
    project = { ...added.project, sequences: { ...added.project.sequences, [sequence]: added.project.sequences[sequence].map(e => e.id === added.entryId ? { ...e, sectionId, section: section?.name ?? '' } : e) } };
    entryIds.push(added.entryId);
  }
  return { project, entryIds };
}


/** A break can be dropped before a container, never between its children. */
export function topLevelBoundary(project: LessonProject, sequence: SequenceKind, beforeEntryId?: string): string | undefined {
  if (!beforeEntryId) return undefined;
  const group = timelineGroups(project, sequence).find(g => g.entries.some(e => e.id === beforeEntryId));
  return group?.entries[0]?.id;
}
export function breakAfterGroup(project: LessonProject, sequence: SequenceKind, entryId?: string, sectionId?: string): string | undefined {
  const groups = timelineGroups(project, sequence);
  const group = sectionId ? groups.find(g => g.sectionId === sectionId) : groups.find(g => g.entries.some(e => e.id === entryId));
  return group ? timelineGroupBoundary(project, sequence, group) : undefined;
}
/** Remove occurrences, retaining scene/asset definitions and other linked uses. */
export function removeTimelineGroup<T extends LessonProject>(project: T, sequence: SequenceKind, sectionId?: string, keepScenes = false): T {
  const own = (e: LessonProject['sequences']['story'][number]) => e.kind !== 'break' && e.sectionId === sectionId;
  const entries = keepScenes ? project.sequences[sequence].map(e => own(e) ? { ...e, sectionId: undefined, section: '' } : e) : project.sequences[sequence].filter(e => !own(e));
  return { ...project, sections: project.sections?.filter(s => s.id !== sectionId || s.sequence !== sequence), sequences: { ...project.sequences, [sequence]: entries } };
}


/** Review media and its caption remain ordinary movable, editable scene objects. */
export function addReviewMedia(scene: import('./model').LessonScene, asset: import('../types').AssetItem, caption: string): import('./model').LessonScene {
  if (asset.mediaType !== 'image' && asset.mediaType !== 'video') throw new Error('Choose an image or video.');
  if (scene.objects.length + 2 > LESSON_LIMITS.objectsPerScene) throw new Error('This review board has no room for more objects.');
  const count = scene.objects.filter(o => o.kind === 'image' || o.kind === 'video').length;
  const width = scene.frame.width * .4, height = scene.frame.height * .28;
  const x = scene.frame.width * (.06 + (count % 2) * .48), y = scene.frame.height * (.18 + (Math.floor(count / 2) % 2) * .39);
  return { ...scene, objects: [...scene.objects,
    { id: makeId(), kind: asset.mediaType, assetId: asset.id, visible: true, ...(asset.mediaType === 'image' ? { appearance: { border: 1 } } : {}), box: { x, y, width, height } },
    { id: makeId(), kind: 'text', text: caption.slice(0, 20000), visible: true, fontSize: 26, color: '#ffffff', align: 'center', box: { x, y: y + height + 8, width, height: scene.frame.height * .07 } },
  ] };
}
