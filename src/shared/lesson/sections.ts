import { makeId, type LessonProject, type SequenceKind } from './model';
import { createScene, insertScene } from './commands';
import { LESSON_LIMITS } from './limits';

/** Preserve sequence and audio exactly while upgrading old display labels. */
export function migrateSections(project: LessonProject): LessonProject {
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
export function addSection(project: LessonProject, sequence: SequenceKind, name = 'New section') {
  project = migrateSections(project);
  if ((project.sections?.length ?? 0) >= LESSON_LIMITS.sections) throw new Error(`This lesson can contain at most ${LESSON_LIMITS.sections} sections.`);
  const sectionId = makeId();
  return { project: { ...project, sections: [...(project.sections ?? []), { id: sectionId, name: name.trim().slice(0, 500) || 'New section', sequence }] }, sectionId };
}
export function renameSection(project: LessonProject, sectionId: string, name: string): LessonProject {
  name = name.trim().slice(0, 500); if (!name) return project;
  return { ...project, sections: project.sections?.map(s => s.id === sectionId ? { ...s, name } : s),
    sequences: { story: project.sequences.story.map(e => e.sectionId === sectionId ? { ...e, section: name } : e), activation: project.sequences.activation.map(e => e.sectionId === sectionId ? { ...e, section: name } : e) } };
}
export function moveEntryToSection(project: LessonProject, sequence: SequenceKind, entryId: string, sectionId?: string, beforeEntryId?: string): LessonProject {
  const section = project.sections?.find(s => s.id === sectionId && s.sequence === sequence);
  if (sectionId && !section) throw new Error('Section no longer exists in this sequence.');
  const original = project.sequences[sequence].find(e => e.id === entryId);
  if (!original || entryId === beforeEntryId) return project;
  const entries = project.sequences[sequence].filter(e => e.id !== entryId);
  let index = beforeEntryId ? entries.findIndex(e => e.id === beforeEntryId && e.sectionId === sectionId) : -1;
  if (index < 0) { const last = entries.map(e => e.sectionId).lastIndexOf(sectionId); index = last < 0 ? entries.length : last + 1; }
  entries.splice(index, 0, { ...original, sectionId, section: section?.name ?? '' });
  return { ...project, sequences: { ...project.sequences, [sequence]: entries } };
}
export function insertBreak(project: LessonProject, sequence: SequenceKind, beforeEntryId?: string, sectionId?: string) {
  const scene = createScene('Break');
  scene.objects = [
    { kind: 'text', id: makeId(), visible: true, text: 'Review together', fontSize: 52, color: '#ffffff', align: 'center', box: { x: 160, y: 170, width: 960, height: 100 } },
    { kind: 'bubble', id: makeId(), visible: true, text: 'What do you remember? Share one idea with the class.', fontSize: 32, color: '#182331', align: 'center', box: { x: 230, y: 330, width: 820, height: 170 } },
  ];
  const added = insertScene(project, sequence, scene, beforeEntryId);
  const inherited = sectionId ?? project.sequences[sequence].find(e => e.id === beforeEntryId)?.sectionId;
  let next = { ...added.project, sequences: { ...added.project.sequences, [sequence]: added.project.sequences[sequence].map(e => e.id === added.entryId ? { ...e, kind: 'break' as const } : e) } };
  if (inherited) next = moveEntryToSection(next, sequence, added.entryId, inherited, beforeEntryId);
  return { project: next, entryId: added.entryId };
}
