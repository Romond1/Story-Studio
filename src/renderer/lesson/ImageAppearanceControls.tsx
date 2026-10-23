import type { ImageAppearance } from '../../shared/lesson/imageAppearance';
export function ImageAppearanceControls({ value = {}, onChange }: { value?: ImageAppearance; onChange: (value?: ImageAppearance) => void }) {
  const slider = (label: string, key: keyof ImageAppearance, fallback: number, min: number, max: number, step = 1) => <label className="lesson-field"><span>{label}</span><input type="range" aria-label={label} min={min} max={max} step={step} value={Number(value[key] ?? fallback)} onChange={e => onChange({ ...value, [key]: Number(e.target.value) })} /><output>{value[key] ?? fallback}</output></label>;
  return <details className="lesson-inspector-section" open><summary>Image appearance</summary><div>
    {slider('Image zoom', 'scale', 1, .25, 3, .05)}{slider('Image blur', 'blur', 0, 0, 40)}{slider('Edge feather', 'feather', 0, 0, 100)}{slider('Image opacity', 'opacity', 1, .1, 1, .05)}{slider('Frame width', 'border', 0, 0, 5, .5)}
    <label className="lesson-field"><span>Image matte color</span><input aria-label="Image matte color" type="color" value={value.background ?? '#182331'} onChange={e => onChange({ ...value, background: e.target.value })} /></label>
    <button onClick={() => onChange(undefined)}>Reset image appearance</button>
  </div></details>;
}
