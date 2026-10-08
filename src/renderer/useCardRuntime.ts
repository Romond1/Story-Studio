import { useRef, useState } from 'react';
import { CardRuntime, emptyCardState, type CardMotion, type CardOccurrence } from '../shared/cardRuntime';
import type { BCardInstance, BCardTeachState } from '../shared/types';
import type { LogicalFrame } from '../shared/staticScene';
export interface CardBinding {
  state: CardOccurrence;
  move: (id: string, updates: Partial<BCardInstance>) => void;
  setState: (id: string, next: BCardTeachState) => void;
  toggle: (id: string, property: keyof BCardTeachState) => void;
  shuffle: (frame: LogicalFrame, movement?: CardMotion) => void;
}
export function useCardRuntime(sessionId: string, occurrenceId: string, activation: number) {
  const holder = useRef({ sessionId, core: new CardRuntime() });
  const [, update] = useState(0);
  if (holder.current.sessionId !== sessionId) holder.current = { sessionId, core: new CardRuntime() };
  const core = holder.current.core;
  const commandTarget = JSON.stringify([occurrenceId, activation]);
  core.activate(occurrenceId, commandTarget);
  return (ref: string, instances: BCardInstance[]): CardBinding => {
    const state = core.ensure(ref, instances, Date.now());
    const changed = (success: boolean) => { if (success) update(n => n + 1); };
    return {
      state,
      move: (id, updates) => changed(core.move(commandTarget, ref, id, updates)),
      setState: (id, next) => changed(core.setState(commandTarget, ref, id, next)),
      toggle: (id, property) => { const previous = core.get(ref)?.states[id] ?? emptyCardState(); changed(core.setState(commandTarget, ref, id, { ...previous, [property]: !previous[property] })); },
      shuffle: (frame, movement) => changed(core.shuffle(commandTarget, ref, frame, Math.random, movement)),
    };
  };
}
