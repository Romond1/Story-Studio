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

export type LessonShortcut = 'playback'|'previous'|'next'|'music'|'draw'|'clear-drawings'|'student'|'reward-1'|'reward-2'|'reward-3'|'reward-4';
export function lessonShortcut(event:TeacherKeyEvent & {code?:string;key?:string},mode:'edit'|'teach'):LessonShortcut|null {
  if(!isPlainTeacherKey(event))return null;
  if((event.target as {closest?:(value:string)=>unknown}|null)?.closest?.('[role="menu"], [role="dialog"]'))return null;
  const code=event.code??'',key=event.key?.toLowerCase();
  if(code==='Space'||key===' ')return 'playback';
  if(code==='KeyE'||key==='e')return 'draw';
  if(code==='KeyR'||key==='r')return 'clear-drawings';
  if(mode!=='teach')return null;
  if(code==='KeyA'||key==='a')return 'previous';
  if(code==='KeyD'||key==='d')return 'next';
  if(code==='KeyQ'||key==='q')return 'music';
  if(code==='F1'||key==='f1')return 'student';
  if(/^Digit[1-4]$/.test(code))return `reward-${code.slice(-1)}` as LessonShortcut;
  return null;
}
