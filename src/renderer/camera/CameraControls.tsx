import { useEffect, useRef, useState } from 'react';
import { CAMERA_DEFAULTS, type CameraSettings, type CameraState } from '../../shared/cameraProtocol';
import './camera.css';

export function CameraControls() {
  const [state, setState] = useState<CameraState>({ settings: CAMERA_DEFAULTS, status: { state: 'off', devices: [] } });
  const current = useRef(state.settings);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  useEffect(() => {
    const api = window.cameraControl;
    if (!api) return;
    let disposed = false, received = false;
    const accept = (next: CameraState) => { current.current = next.settings; setState(next); };
    const unsubscribe = api.subscribe(next => { received = true; accept(next); });
    void api.get().then(next => { if (!disposed && !received) accept(next); }).catch(() => setError('Camera controls are unavailable.'));
    return () => { disposed = true; request.current++; unsubscribe(); };
  }, []);
  const update = async (patch: Partial<CameraSettings>) => {
    const api = window.cameraControl;
    if (!api) return;
    const token = ++request.current;
    const next = { ...current.current, ...patch };
    current.current = next; setState(old => ({ ...old, settings: next })); setError('');
    const enabling = patch.enabled === true;
    if (enabling) setBusy(true);
    try {
      if (enabling) await window.appApi.openPresent();
      const accepted = await api.set(next);
      if (token === request.current) { current.current = accepted.settings; setState(accepted); }
    } catch (error) {
      if (token === request.current) {
        setError(error instanceof Error ? error.message : 'Unable to update camera.');
        void api.get().then(accepted => { if (token === request.current) { current.current = accepted.settings; setState(accepted); } }).catch(() => {});
      }
    } finally { if (enabling) setBusy(false); }
  };
  const settings = state.settings;
  return <section className="camera-controls teach-live-card" aria-label="Camera">
    <h3>Camera</h3>
    <button type="button" disabled={busy || !window.cameraControl} aria-pressed={settings.enabled} onClick={() => void update({ enabled: !settings.enabled })}>
      {settings.enabled ? 'Turn camera off' : 'Turn camera on'}
    </button>
    <p role="status">{error || state.status.message || (busy ? 'Waiting for camera permission…' : state.status.state === 'live' ? (settings.preset === 'hidden' ? 'Camera active · hidden' : 'Camera live in Presenter') : state.status.state === 'starting' ? 'Starting camera…' : 'Camera off')}</p>
    <fieldset disabled={busy || !window.cameraControl}>
      <label>Camera device<select value={settings.deviceId} onChange={e => void update({ deviceId: e.target.value })}>
        <option value="">System default</option>
        {settings.deviceId && !state.status.devices.some(d => d.deviceId === settings.deviceId) && <option value={settings.deviceId}>Selected camera (unavailable)</option>}
        {state.status.devices.filter(d => d.deviceId).map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
      </select></label>
      <label>Display preset<select value={settings.preset} onChange={e => void update({ preset: e.target.value as CameraSettings['preset'] })}>
        <option value="full">Full Screen</option><option value="lower-left">Lower Left</option><option value="lower-right">Lower Right</option><option value="hidden">Hidden</option>
      </select></label>
      <label className="camera-toggle"><input type="checkbox" checked={settings.chromaKey} onChange={e => void update({ chromaKey: e.target.checked })} />Green-screen chroma key</label>
      {([
        ['tolerance', 'Key tolerance', 0, 1, 0.01], ['softness', 'Edge softness', 0.001, 0.5, 0.001],
        ['brightness', 'Brightness', -1, 1, 0.01], ['contrast', 'Contrast', 0, 2, 0.01],
      ] as const).map(([key, label, min, max, step]) => <label className="camera-slider" key={key}>
        <span>{label}</span><input type="range" min={min} max={max} step={step} value={settings[key]} onChange={e => void update({ [key]: Number(e.target.value) })} /><output>{settings[key].toFixed(2)}</output>
      </label>)}
      <label className="camera-toggle"><input type="checkbox" checked={settings.mirror} onChange={e => void update({ mirror: e.target.checked })} />Mirror horizontally</label>
    </fieldset>
    <small>Hidden keeps the camera active. Camera off releases it.</small>
  </section>;
}
