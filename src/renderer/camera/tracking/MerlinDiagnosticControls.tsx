import { createMerlinDiagnostics, type MerlinDiagnostics, type TrackingSettings } from '../../../shared/faceTrackingProtocol';

const toggles: [keyof Omit<MerlinDiagnostics, 'enabled'>, string][] = [
  ['hairRoots', 'Hair-root corrections'], ['pitchCompensation', 'Pitch compensation'],
  ['residualRegistration', 'Screen-space registration'], ['springMotion', 'Spring-bone motion'],
  ['jawMotion', 'Jaw animation'], ['costume', 'Costume geometry'], ['occlusion', 'Depth occlusion'],
  ['axes', 'Head/model axes and pivots'], ['referencePoints', 'Canonical and observed references'],
  ['attachmentOrigins', 'Attachment origins'], ['occluderWireframe', 'Occluder wireframe'],
];

export function MerlinDiagnosticControls({ settings, disabled, onChange, onClose }: {
  settings: TrackingSettings; disabled: boolean; onChange: (value: TrackingSettings) => void; onClose: () => void;
}) {
  const options = settings.merlinDiagnostics ?? { ...createMerlinDiagnostics('rigid'), enabled: false };
  const update = (patch: Partial<MerlinDiagnostics>) => onChange({
    ...settings, merlin: true, merlinDiagnostics: { ...options, ...patch },
  });
  return <section className="merlin-diagnostics" aria-label="Merlin developer diagnostics">
    <h4>Merlin developer diagnostics</h4>
    <p>Guides appear in Present and will be visible in a screen share. Use outside a live lesson.</p>
    <fieldset disabled={disabled}>
      <label className="camera-toggle"><input type="checkbox" checked={options.enabled}
        onChange={e => update({ enabled: e.target.checked })} />Enable diagnostic view</label>
      <div className="merlin-diagnostic-presets">
        <button type="button" onClick={() => onChange({ ...settings, merlin: true, merlinDiagnostics: createMerlinDiagnostics('rigid') })}>Rigid preset</button>
        <button type="button" onClick={() => onChange({ ...settings, merlin: true, merlinDiagnostics: createMerlinDiagnostics('compensated') })}>Compensated preset</button>
      </div>
      <fieldset disabled={!options.enabled}>
        {toggles.map(([key, label]) => <label className="camera-toggle" key={key}><input type="checkbox"
          checked={options[key]} onChange={e => update({ [key]: e.target.checked })} />{label}</label>)}
      </fieldset>
    </fieldset>
    <p>Axes: X red, Y green, Z blue. White: canonical pivot. Orange: model pivot and bone origins.
      Solid points: canonical anatomy. Rings: observed landmarks. Green wireframe: existing depth proxy.</p>
    <p>63° virtual camera · centimetres · +Y up · −Z into screen. Model alignment and head fit remain unvalidated.</p>
    <button type="button" onClick={onClose}>Close diagnostics</button>
  </section>;
}
