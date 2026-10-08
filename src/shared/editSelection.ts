import { createPresentationSession, reducePresentationSession, type PresentationSession } from './presentationSession';
import type { ProjectData } from './types';

/** Control-local selectors only. Never part of ProjectData or a live runtime. */
export type EditSelection = Pick<PresentationSession, 'mode' | 'sectionId' | 'storySlideId' | 'boostTab' | 'boostItemId' | 'boardId'> & { revision: number };
export function createEditSelection(data: ProjectData | null): EditSelection {
  return { mode: 'story', sectionId: data?.sections[0]?.id ?? null, storySlideId: data?.slides.find(s=>s.sectionId===data.sections[0]?.id)?.id ?? null,
    boostTab: 'activation', boostItemId: null, boardId: null, revision: 0 };
}
export function selectEdit(previous: EditSelection, changes: Partial<Omit<EditSelection,'revision'>>): EditSelection {
  return Object.entries(changes).some(([key,value])=>previous[key as keyof EditSelection]!==value) ? {...previous,...changes,revision:previous.revision+1} : previous;
}
/** Reuse the pure resolver; this adapter is never committed to Core. */
export function editSessionView(edit: EditSelection, live: PresentationSession): PresentationSession {
  return {...createPresentationSession(`edit:${live.sessionId}`), ...edit, projectId:live.projectId, targetRevision:edit.revision};
}
export function showEditInPresent(edit: EditSelection, live: PresentationSession): PresentationSession {
  const {revision, ...changes} = edit;
  // Return-from-booster checkpoint remains Core's behavior, then explicitly select
  // the requested object so that checkpoint restoration cannot override the handoff.
  const mode = reducePresentationSession(live,{type:'select',changes:{mode:edit.mode}});
  return reducePresentationSession(mode,{type:'select',changes});
}
export function runNavigationAudio(mode: 'edit'|'teach', sectionChanged: boolean, audio: {stopSlideAudio:()=>void;stopSectionMusic:()=>void}) {
  if(mode !== 'teach') return;
  audio.stopSlideAudio();
  if(sectionChanged) audio.stopSectionMusic();
}
