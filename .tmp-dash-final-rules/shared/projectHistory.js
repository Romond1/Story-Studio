"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectHistory = void 0;
exports.getHistoryShortcut = getHistoryShortcut;
const movement_1 = require("./movement");
/** In-memory history of immutable content revisions. File identity is never history. */
class ProjectHistory {
    constructor(limit = 100) {
        this.limit = limit;
        this.past = [];
        this.future = [];
        this.current = null;
        this.saved = null;
    }
    get canUndo() { return this.past.length > 0; }
    get canRedo() { return this.future.length > 0; }
    get isDirty() { return this.current !== this.saved; }
    reset(value, saved = true) {
        this.current = value;
        this.saved = saved ? value : null;
        this.past = [];
        this.future = [];
        this.breakGroup();
    }
    record(value, group) {
        if (value === this.current)
            return;
        if (this.current && (!group || group !== this.lastGroup || this.current === this.saved)) {
            this.past.push(this.current);
            if (this.past.length > this.limit)
                this.past.shift();
        }
        this.current = value;
        this.future = [];
        this.lastGroup = group;
    }
    undo() {
        if (!this.current || !this.canUndo)
            return null;
        this.future.push(this.current);
        this.current = this.past.pop();
        this.breakGroup();
        return this.current;
    }
    redo() {
        if (!this.current || !this.canRedo)
            return null;
        this.past.push(this.current);
        this.current = this.future.pop();
        this.breakGroup();
        return this.current;
    }
    breakGroup() { this.lastGroup = undefined; }
    markSaved(written) {
        this.saved = written;
        this.breakGroup();
    }
    /** Automatic defaults/roster reconciliation are not authored undo steps. */
    rebase(value) {
        if (this.current === this.saved)
            this.saved = value;
        this.current = value;
    }
}
exports.ProjectHistory = ProjectHistory;
function getHistoryShortcut(event) {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.repeat
        || event.key.toLowerCase() !== 'z' || (0, movement_1.isEditableKeyTarget)(event.target))
        return null;
    return event.shiftKey ? 'redo' : 'undo';
}
