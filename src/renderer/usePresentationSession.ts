import { useCallback, useRef, useState, type MutableRefObject, type SetStateAction } from 'react';
import type { ProjectState } from '../shared/types';
import { createPresentationSession, reducePresentationSession, type PresentationSession } from '../shared/presentationSession';

/** Temporary UI adapter. Stable IDs in this session, not the old story index,
 * own presentation selection. Keep the ref synchronous for consecutive commands. */
export function usePresentationSession(project: MutableRefObject<ProjectState | null>) {
  const [session, render] = useState(() => createPresentationSession(crypto.randomUUID()));
  const ref = useRef(session);
  const commit = useCallback((next: PresentationSession) => {
    if (next === ref.current) return;
    ref.current = next;
    render(next);
  }, []);
  const select = useCallback(<K extends 'mode' | 'storySlideId' | 'sectionId' | 'boostTab' | 'boostItemId' | 'boardId'>(key: K, value: SetStateAction<PresentationSession[K]>) => {
    const resolved = typeof value === 'function'
      ? (value as (previous: PresentationSession[K]) => PresentationSession[K])(ref.current[key]) : value;
    commit(reducePresentationSession(ref.current, { type: 'select', changes: { [key]: resolved } }));
  }, [commit]);
  const setters = useRef({
    setActiveMovementEvent: (value: SetStateAction<PresentationSession['overlays']['movement']>) => {
      const next = typeof value === 'function' ? value(ref.current.overlays.movement) : value;
      commit(reducePresentationSession(ref.current, { type: 'movement', value: next }));
    },
    setTopMode: (value: SetStateAction<PresentationSession['mode']>) => select('mode', value),
    setSelectedSectionId: (value: SetStateAction<string | null>) => select('sectionId', value),
    setBoostTab: (value: SetStateAction<PresentationSession['boostTab']>) => select('boostTab', value),
    setSelectedBoostItemId: (value: SetStateAction<string | null>) => select('boostItemId', value),
    setSelectedACardId: (value: SetStateAction<string | null>) => select('boardId', value),
    setCurrentIndex: (index: number) => select('storySlideId', project.current?.data.slides[index]?.id ?? null),
  }).current;
  return { session, ref, commit, ...setters };
}
