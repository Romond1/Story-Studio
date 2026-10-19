import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { setSoundEnabled, stopMusic } from './effects.js';
import { readGameInputMessage } from './inputBridge.mjs';
import './viewport.css';

const instanceId = new URLSearchParams(window.location.search).get('instanceId') || '';
const parentWindow = window.parent;
const parentOrigin = window.location.origin;
const notifyHost = (type, detail) => {
  if (parentWindow === window || !instanceId) return;
  parentWindow.postMessage({ channel: 'story-studio-game', type, instanceId, ...(detail ? { detail } : {}) }, parentOrigin === 'null' ? '*' : parentOrigin);
};

class GameErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error) {
    stopMusic();
    setSoundEnabled(false);
    notifyHost('error', error?.message || 'Language Snake could not start.');
  }

  render() {
    if (this.state.failed) return <p className="game-load-error">Language Snake could not start. Use Restart in Story Studio to try again.</p>;
    return this.props.children;
  }
}

function HostedGame() {
  useEffect(() => { notifyHost('ready'); }, []);
  return <App />;
}

const handleInput = (event) => {
  const input = readGameInputMessage(event, { parentWindow, instanceId, origin: parentOrigin });
  if (!input) return;
  window.dispatchEvent(new KeyboardEvent(input.phase, { key: input.key, code: input.code, repeat: input.repeat, shiftKey: input.shiftKey, bubbles: true, cancelable: true }));
};
// The original game listens globally. Keep native movement arrows from also
// scrolling the playfield, while retaining browser shortcuts and field editing.
const isolateGameInput = (event) => {
  if (event.ctrlKey || event.altKey || event.metaKey) { event.stopImmediatePropagation(); return; }
  const editing = event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
  if (!editing && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) event.preventDefault();
};
window.addEventListener('message', handleInput);
window.addEventListener('keydown', isolateGameInput, true);

const root = ReactDOM.createRoot(document.getElementById('root'));
if (instanceId) {
  // One mount: StrictMode's development remount would randomize a second board.
  root.render(<GameErrorBoundary><HostedGame /></GameErrorBoundary>);
} else {
  root.render(<p className="game-load-error">Launch Language Snake from Story Studio’s Challenge section.</p>);
}

window.addEventListener('pagehide', () => {
  window.removeEventListener('message', handleInput);
  window.removeEventListener('keydown', isolateGameInput, true);
  root.unmount();
  stopMusic();
  setSoundEnabled(false);
}, { once: true });
