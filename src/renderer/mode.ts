export type AppMode = "edit" | "teach";

export const DEFAULT_MODE: AppMode = "edit";

export function ensureEditMode(mode: AppMode, actionName: string): boolean {
    if (mode !== 'edit') {
        console.warn(`[Mode] Action '${actionName}' blocked in '${mode}' mode.`);
        return false;
    }
    return true;
}
