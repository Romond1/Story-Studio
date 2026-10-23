/** The shortcut owns only the capture started by its initial key press. */
export function bindTranslationHoldKey(win: Window, doc: Document, actions: {
  start: () => boolean;
  stop: () => void;
  cancel: () => void;
}) {
  let held = false;
  let ownsCapture = false;
  const blocked = (event: KeyboardEvent) => {
    const target = event.target as Element | null;
    return event.defaultPrevented || event.isComposing || event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || doc.hidden ||
      !!target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], dialog, [role="dialog"], [role="menu"], [role="menubar"]') ||
      !!doc.querySelector('dialog[open], [role="dialog"][aria-modal="true"], [role="menu"]:not([hidden])');
  };
  const down = (event: KeyboardEvent) => {
    if (event.key.toLowerCase() !== 'w' || held || blocked(event)) return;
    event.preventDefault();
    held = true;
    ownsCapture = actions.start();
  };
  const up = (event: KeyboardEvent) => {
    if (event.key.toLowerCase() !== 'w' || !held) return;
    event.preventDefault();
    held = false;
    if (ownsCapture) { ownsCapture = false; actions.stop(); }
  };
  const cancel = () => {
    held = false;
    if (ownsCapture) { ownsCapture = false; actions.cancel(); }
  };
  const visibility = () => { if (doc.hidden) cancel(); };
  win.addEventListener('keydown', down);
  // Capture releases even if a newly focused editor consumes its own key events.
  win.addEventListener('keyup', up, true);
  win.addEventListener('blur', cancel);
  doc.addEventListener('visibilitychange', visibility);
  return () => {
    win.removeEventListener('keydown', down);
    win.removeEventListener('keyup', up, true);
    win.removeEventListener('blur', cancel);
    doc.removeEventListener('visibilitychange', visibility);
    cancel();
  };
}
