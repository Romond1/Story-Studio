import { useRef, useState } from 'react';
import { createTeachingScene, reduceTeachingScene, type SceneViewport, type TransientStroke } from '../shared/teachingScene';

export function useTeachingScene(targetKey: string) {
  const [rendered, render] = useState(() => createTeachingScene(targetKey));
  const ref = useRef(rendered);
  if (ref.current.targetKey !== targetKey) ref.current = createTeachingScene(targetKey);
  const state = ref.current;
  const apply = (changes: { viewport?: SceneViewport; transient?: TransientStroke[] }) => {
    const next = reduceTeachingScene(ref.current, { targetKey, sequence: ref.current.sequence + 1, ...changes });
    if (next === ref.current) return;
    ref.current = next; render(next);
  };
  return { state, updateViewport: (viewport: SceneViewport) => {
    const previous = ref.current.viewport;
    if (previous.zoom !== viewport.zoom || previous.pan.x !== viewport.pan.x || previous.pan.y !== viewport.pan.y) apply({ viewport });
  }, updateTransient: (transient: TransientStroke[]) => apply({ transient }) };
}
