import type { LessonSection, SceneAudio } from '../../shared/lesson/model';
import type { AssetItem } from '../../shared/types';
import { mediaDisplayTitle } from '../../shared/mediaDisplayName';

export function SectionMusicControls({ section, assets, onChange, onVolumeChange, onPlay, onStop }: {
  section: LessonSection;
  assets: readonly AssetItem[];
  onChange?: (section: LessonSection) => void;
  onVolumeChange?: (track: SceneAudio, volume: number) => void;
  onPlay: (tracks: SceneAudio[]) => void;
  onStop: () => void;
}) {
  const tracks = section.audio ?? [];
  const update = (id: string, patch: Partial<SceneAudio>) => {
    onStop();
    onChange?.({ ...section, audio: tracks.map(track => track.id === id ? { ...track, ...patch } : track) });
  };
  return <details className="lesson-inspector-section" open><summary>Section music · {section.name}</summary><div>
    <p className="lesson-hint">Q plays this music in Teach. Music continues between scenes in this section.</p>
    {onChange && <label className="lesson-field"><span>Add section music</span><select aria-label="Add section music" value="" disabled={tracks.length >= 50} onChange={event => {
      if (event.target.value) onChange({ ...section, audio: [...tracks, { id: crypto.randomUUID(), assetId: event.target.value, volume: 1, loop: true, autoplay: false }] });
    }}><option value="">Choose audio…</option>{assets.filter(asset => asset.mediaType === 'audio').map(asset => <option key={asset.id} value={asset.id}>{mediaDisplayTitle(asset)}</option>)}</select></label>}
    <div className="lesson-actions"><button disabled={!tracks.length} onClick={() => onPlay(tracks)}>Play section music</button><button onClick={onStop}>Stop section music</button></div>
    {tracks.map(track => <fieldset key={track.id}><legend>{assets.find(asset => asset.id === track.assetId) ? mediaDisplayTitle(assets.find(asset => asset.id === track.assetId)!) : 'Audio'}</legend>
      {(onChange || onVolumeChange) && <label className="lesson-field"><span>Volume</span><input aria-label="Section music volume" type="range" min="0" max="1" step=".05" value={track.volume} onChange={event => onVolumeChange ? onVolumeChange(track, Number(event.target.value)) : update(track.id, { volume: Number(event.target.value) })} /><output>{Math.round(track.volume * 100)}%</output></label>}
      {onChange && <>
        <label><input type="checkbox" checked={track.loop} onChange={event => update(track.id, { loop: event.target.checked })} /> Loop</label>
        <button onClick={() => { onStop(); onChange({ ...section, audio: tracks.filter(item => item.id !== track.id) }); }}>Remove section music</button></>}
    </fieldset>)}
  </div></details>;
}
