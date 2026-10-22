import { isEditableKeyTarget } from './movement';

export interface TeacherKeyEvent {
  defaultPrevented?: boolean;
  isComposing?: boolean;
  repeat?: boolean;
  target?: unknown;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

/** Teacher command handlers share one ownership guard; Present installs none. */
export function shouldIgnoreTeacherKey(event: TeacherKeyEvent): boolean {
  const target = event.target && typeof event.target === 'object'
    ? event.target as { tagName?: string; isContentEditable?: boolean; closest?: (selector: string) => unknown } : null;
  return !!(event.defaultPrevented || event.isComposing || event.repeat || isEditableKeyTarget(target)
    || (typeof target?.closest === 'function' && target.closest('dialog[open]')));
}

export function isPlainTeacherKey(event: TeacherKeyEvent): boolean {
  return !shouldIgnoreTeacherKey(event) && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey;
}

export function claimTeacherKey(event: { preventDefault(): void; stopImmediatePropagation(): void }): void {
  event.preventDefault();
  event.stopImmediatePropagation();
}
