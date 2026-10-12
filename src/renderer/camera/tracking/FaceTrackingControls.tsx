import type { TrackingSettings, TrackingStatus } from '../../../shared/faceTrackingProtocol';

export function FaceTrackingControls({ settings, status, cameraEnabled, disabled, onChange }: {
  settings: TrackingSettings; status?: TrackingStatus; cameraEnabled: boolean; disabled: boolean;
  onChange: (settings: TrackingSettings) => void;
}) {
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
    </fieldset>
    <p role="status">{status?.message || labels[status?.state ?? 'off']}</p>
    {status?.state === 'error' && <small>Turn tracking off and on to retry. The camera can keep running.</small>}
  </section>;
}
