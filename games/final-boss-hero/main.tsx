import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import gsap from 'gsap';
import { App } from './src/App';
import { installHostBridge } from './hostBridge.mjs';
import './src/styles.css';
import './viewport.css';

const instanceId = new URLSearchParams(window.location.search).get('instanceId') || '';
const root = ReactDOM.createRoot(document.getElementById('root')!);
const host = installHostBridge({
  targetWindow: window,
  instanceId,
  unmount: () => root.unmount(),
  // GSAP is isolated to this document. Closing the iframe releases its timeline.
  stopAnimations: () => gsap.globalTimeline.clear(),
});

class GameErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { host.error(error); }
  render() {
    return this.state.failed
      ? <p className="game-load-error">Final Boss Hero could not start. Use Restart in Story Studio to try again.</p>
      : this.props.children;
  }
}

function HostedGame() {
  useEffect(() => { host.ready(); }, []);
  return <App />;
}

// Mount once: development StrictMode would initialize two random battles.
root.render(instanceId
  ? <GameErrorBoundary><HostedGame /></GameErrorBoundary>
  : <p className="game-load-error">Launch Final Boss Hero from Story Studio’s Mastery section.</p>);
