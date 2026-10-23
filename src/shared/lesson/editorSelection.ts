import type { EditorSelection, LessonProject } from './model';

/** History restores content first, then a valid editor location in that revision. */
export function restoreEditorSelection(project: LessonProject, selection: EditorSelection): EditorSelection {
  const entry = project.sequences[selection.sequence].find(e => e.id === selection.entryId);
  if (entry) return { ...selection, objectId: project.scenes[entry.sceneId]?.objects.some(o => o.id === selection.objectId) ? selection.objectId : null };
  const sequence = project.sequences[selection.sequence].length ? selection.sequence : selection.sequence === 'story' ? 'activation' : 'story';
  return { sequence, entryId: project.sequences[sequence][0]?.id ?? null, objectId: null };
}
