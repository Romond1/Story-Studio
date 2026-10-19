import type { TrackingSettings, TrackingStatus } from '../../../shared/faceTrackingProtocol';
import { useEffect, useRef, useState } from 'react';
import { MerlinDiagnosticControls } from './MerlinDiagnosticControls';

export function FaceTrackingControls({ settings, status, cameraEnabled, disabled, onChange }: {
  settings: TrackingSettings; status?: TrackingStatus; cameraEnabled: boolean; disabled: boolean;
  onChange: (settings: TrackingSettings) => void;
}) {
  const [diagnosticsAvailable, setDiagnosticsAvailable] = useState(!!settings.merlinDiagnostics);
  const current = useRef({ settings, onChange }); current.current = { settings, onChange };
  const closeDiagnostics = () => {
    setDiagnosticsAvailable(false);
    current.current.onChange({ ...current.current.settings, merlinDiagnostics: undefined });
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.altKey && event.shiftKey && event.code === 'KeyM' && !event.repeat) {
        event.preventDefault();
        setDiagnosticsAvailable(value => !value);
        current.current.onChange({ ...current.current.settings, merlinDiagnostics: undefined });
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const labels = { off: cameraEnabled ? 'Tracking off' : 'Camera off', initializing: 'Initializing tracking…', tracking: 'Tracking face', 'face-lost': 'Face lost · looking for a face', error: 'Tracking error' };
  return <section className="camera-controls teach-live-card" aria-label="Face Tracking">
    <h3>Face Tracking</h3>
    <fieldset disabled={disabled}>
      <label className="camera-toggle"><input type="checkbox" checked={settings.enabled}
        onChange={e => onChange({ ...settings, enabled: e.target.checked })} />Enable face tracking</label>
      <label className="camera-toggle"><input type="checkbox" checked={settings.markers}
        onChange={e => onChange({ ...settings, markers: e.target.checked })} />Show landmark markers</label>
      <label className="camera-toggle"><input type="checkbox" checked={settings.hat}
        onChange={e => onChange({ ...settings, hat: e.target.checked })} />Show temporary hat</label>
      <label className="camera-toggle"><input type="checkbox" checked={!!settings.merlin}
        onChange={e => onChange({ ...settings, merlin: e.target.checked })} />Show 3D Merlin costume · experimental</label>
      {settings.merlin && <label className="camera-toggle"><input type="checkbox" checked={!!settings.merlinEyebrows}
        onChange={e => onChange({ ...settings, merlinEyebrows: e.target.checked })} />Show Merlin 3D eyebrows (optional)</label>}
      <label className="camera-toggle"><input type="checkbox" checked={!!settings.merlinHat}
        onChange={e => onChange({ ...settings, merlinHat: e.target.checked })} />Show Merlin 3D hat</label>
      <label className="camera-toggle"><input type="checkbox" checked={!!settings.merlinRobe}
        onChange={e => onChange({ ...settings, merlinRobe: e.target.checked })} />Show Merlin 3D robe · experimental</label>
      {settings.merlinRobe && <small>The robe follows an estimated neck position. Shoulder and arm movements are not tracked.</small>}
    </fieldset>
    <p role="status">{status?.message || labels[status?.state ?? 'off']}</p>
    {status?.state === 'error' && <small>Turn tracking off and on to retry. The camera can keep running.</small>}
    {diagnosticsAvailable && <MerlinDiagnosticControls settings={settings} disabled={disabled} onChange={onChange} onClose={closeDiagnostics} />}
  </section>;
}
