import { readGameInputMessage } from '../language-snake/inputBridge.mjs';

/** Lifecycle glue for the existing Present iframe protocol; no game state lives here. */
export function installHostBridge({ targetWindow, instanceId, unmount, stopAnimations }) {
  const parentWindow = targetWindow.parent;
  const origin = targetWindow.location.origin;
  let disposed = false;

  const notify = (type, detail) => {
    if (disposed || !instanceId || parentWindow === targetWindow) return;
    parentWindow.postMessage({ channel: 'story-studio-game', type, instanceId, ...(detail ? { detail } : {}) }, origin === 'null' ? '*' : origin);
  };
  const stopMedia = () => {
    for (const media of targetWindow.document.querySelectorAll('audio, video')) {
      media.pause();
      media.srcObject = null;
      media.removeAttribute('src');
      for (const source of media.querySelectorAll('source')) source.removeAttribute('src');
      media.load();
    }
    for (const animation of targetWindow.document.getAnimations()) animation.cancel();
    stopAnimations();
  };
  const handleInput = (event) => {
    if (disposed) return;
    const input = readGameInputMessage(event, { parentWindow, instanceId, origin });
    if (!input) return;
    targetWindow.dispatchEvent(new targetWindow.KeyboardEvent(input.phase, { ...input, bubbles: true, cancelable: true }));
  };
  const isolateInput = (event) => {
    // Native iframe events cannot bubble into Story Studio. Keep configured
    // modifier shortcuts available; Control's relay rejects browser modifiers.
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    const editing = event.target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
    if (!editing && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) event.preventDefault();
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    targetWindow.removeEventListener('message', handleInput);
    targetWindow.removeEventListener('keydown', isolateInput, true);
    targetWindow.removeEventListener('pagehide', dispose);
    stopMedia();
    unmount();
  };
  targetWindow.addEventListener('message', handleInput);
  targetWindow.addEventListener('keydown', isolateInput, true);
  targetWindow.addEventListener('pagehide', dispose, { once: true });
  return {
    ready: () => notify('ready'),
    error: (error) => { stopMedia(); notify('error', String(error?.message || error || 'Final Boss Hero could not start.').slice(0, 2048)); },
    dispose,
  };
}
