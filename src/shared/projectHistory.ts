import { isEditableKeyTarget } from './movement';

/** In-memory history of immutable content revisions. File identity is never history. */
export class ProjectHistory<T extends object> {
  private past: T[] = [];
  private future: T[] = [];
  private current: T | null = null;
  private saved: T | null = null;
  private lastGroup: object | undefined;

  constructor(private readonly limit = 100) {}

  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  get isDirty() { return this.current !== this.saved; }

  reset(value: T | null, saved = true) {
    this.current = value;
    this.saved = saved ? value : null;
    this.past = [];
    this.future = [];
    this.breakGroup();
  }

  record(value: T, group?: object) {
    if (value === this.current) return;
    if (this.current && (!group || group !== this.lastGroup || this.current === this.saved)) {
      this.past.push(this.current);
      if (this.past.length > this.limit) this.past.shift();
    }
    this.current = value;
    this.future = [];
    this.lastGroup = group;
  }

  undo(): T | null {
    if (!this.current || !this.canUndo) return null;
    this.future.push(this.current);
    this.current = this.past.pop()!;
    this.breakGroup();
    return this.current;
  }

  redo(): T | null {
    if (!this.current || !this.canRedo) return null;
    this.past.push(this.current);
    this.current = this.future.pop()!;
    this.breakGroup();
    return this.current;
  }

  breakGroup() { this.lastGroup = undefined; }

  markSaved(written: T) {
    this.saved = written;
    this.breakGroup();
  }

  /** Automatic defaults/roster reconciliation are not authored undo steps. */
  rebase(value: T) {
    if (this.current === this.saved) this.saved = value;
    this.current = value;
  }
}

export function getHistoryShortcut(event: {
  ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean;
  repeat: boolean; key: string;
  target: { tagName?: string; isContentEditable?: boolean } | null;
}): 'undo' | 'redo' | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.repeat
    || event.key.toLowerCase() !== 'z' || isEditableKeyTarget(event.target)) return null;
  return event.shiftKey ? 'redo' : 'undo';
}
