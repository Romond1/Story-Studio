import { useEffect } from 'react';
import { blocksMouseNavigation } from '../../shared/mouseNavigation';

/** Installed only while a lesson is open. Never captures ordinary editing keys. */
export function useLessonMouseSafety(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const mouse = (event: MouseEvent) => {
      if (blocksMouseNavigation(true, event.button)) { event.preventDefault(); event.stopPropagation(); }
    };
    const key = (event: KeyboardEvent) => {
      if (blocksMouseNavigation(true, event.key)) { event.preventDefault(); event.stopPropagation(); }
    };
    const types = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'auxclick'] as const;
    types.forEach(type => window.addEventListener(type, mouse, true));
    window.addEventListener('keydown', key, true);
    const previous = document.documentElement.style.overscrollBehaviorX;
    document.documentElement.style.overscrollBehaviorX = 'none';
    return () => {
      types.forEach(type => window.removeEventListener(type, mouse, true));
      window.removeEventListener('keydown', key, true);
      document.documentElement.style.overscrollBehaviorX = previous;
    };
  }, [active]);
}
