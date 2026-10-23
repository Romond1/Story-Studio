import { useEffect, useRef, useState } from 'react';
import type { AssetItem } from '../../shared/types';
import { mediaDisplayTitle } from '../../shared/mediaDisplayName';
import type { LessonScene, SceneAudio } from '../../shared/lesson/model';

export function ReviewMediaPicker({ assets, resolve, value, onChange }: { assets: AssetItem[]; resolve: (id: string) => string | undefined; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState('');
  const host = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const selected = assets.find(a => a.id === value);
  useEffect(() => { if (!open) return; const outside = (e: PointerEvent) => { if (!host.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener('pointerdown', outside); return () => document.removeEventListener('pointerdown', outside); }, [open]);
  return <div className="break-media-picker" ref={host} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus(); } }}>
    <button ref={trigger} type="button" aria-label="Review media" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>{selected ? mediaDisplayTitle(selected) : 'Choose image or video…'} ▾</button>
    {open && <div className="break-media-options"><input autoFocus type="search" aria-label="Search review media" placeholder="Search media…" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); host.current?.querySelector<HTMLButtonElement>('[role=option]')?.focus(); } }} />
      <div role="listbox" aria-label="Review media choices" onKeyDown={e => { const nodes = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role=option]')); const current = nodes.indexOf(document.activeElement as HTMLButtonElement); const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -2, ArrowDown: 2 }[e.key]; if (offset !== undefined || e.key === 'Home' || e.key === 'End') { e.preventDefault(); nodes[e.key === 'Home' ? 0 : e.key === 'End' ? nodes.length - 1 : Math.max(0, Math.min(nodes.length - 1, current + (offset ?? 0)))]?.focus(); } }}>{assets.filter(a => mediaDisplayTitle(a).toLowerCase().includes(query.toLowerCase())).map(a => <button type="button" key={a.id} role="option" aria-selected={a.id === value} onClick={() => { onChange(a.id); setOpen(false); trigger.current?.focus(); }}>
        {a.mediaType === 'image' ? <img src={resolve(a.id)} alt="" loading="lazy" /> : <video src={resolve(a.id)} muted preload="metadata" />}
        <span>{mediaDisplayTitle(a)}</span><small>{a.mediaType === 'video' ? 'VID' : 'PIC'}</small>
      </button>)}</div>
    </div>}
  </div>;
}

export function BreakAudioControls({ scene, assets, onChange, onVolumeChange, onPlay, onStop }: { scene: LessonScene; assets: AssetItem[]; onChange?: (scene: LessonScene) => void; onVolumeChange?: (track: SceneAudio, volume: number) => void; onPlay: (tracks: SceneAudio[]) => void; onStop: () => void }) {
  const handlers = useRef({ onPlay, onStop, scene }); handlers.current = { onPlay, onStop, scene };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.repeat || e.defaultPrevented || document.querySelector('dialog[open]') || (e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable=true],[role=menu],[role=listbox]')) return;
      const digit = e.code.match(/^Digit([0-9])$/)?.[1]; if (!digit) return;
      if (digit === '0') { e.preventDefault(); e.stopImmediatePropagation(); handlers.current.onStop(); return; }
      const track = handlers.current.scene.audio.find(a => a.shortcut === digit);
      if (track) { e.preventDefault(); e.stopImmediatePropagation(); handlers.current.onPlay([track]); }
    };
    window.addEventListener('keydown', key, true);
    return () => { window.removeEventListener('keydown', key, true); handlers.current.onStop(); };
  }, [scene.id]);
  const update = (id: string, patch: Partial<SceneAudio>) => onChange?.({ ...scene, audio: scene.audio.map(a => a.id === id ? { ...a, ...patch } : patch.shortcut && a.shortcut === patch.shortcut ? { ...a, shortcut: undefined } : a) });
  return <div className="break-audio-controls" role="group" aria-label="Break audio">
    {onChange && <label className="lesson-field"><span>Add break audio</span><select aria-label="Add break audio" value="" disabled={scene.audio.length >= 50} onChange={e => { if (e.target.value) onChange({ ...scene, audio: [...scene.audio, { id: crypto.randomUUID(), assetId: e.target.value, volume: 1, loop: false, autoplay: false }] }); }}><option value="">Choose audio…</option>{assets.filter(a => a.mediaType === 'audio').map(a => <option key={a.id} value={a.id}>{mediaDisplayTitle(a)}</option>)}</select></label>}
    <div className="lesson-actions"><button disabled={!scene.audio.length} onClick={() => onPlay(scene.audio)}>Play break audio</button><button onClick={onStop}>Stop break audio</button></div>
    <small>Stop: Alt + 0</small>
    {scene.audio.map(track => <fieldset key={track.id}><legend>{assets.find(a => a.id === track.assetId) ? mediaDisplayTitle(assets.find(a => a.id === track.assetId)!) : 'Audio'}</legend><button onClick={() => onPlay([track])}>Play audio track</button>
      {onVolumeChange && <label className="lesson-field"><span>Volume</span><input aria-label="Break audio volume" type="range" min="0" max="1" step=".01" value={track.volume} onChange={event => onVolumeChange(track, Number(event.target.value))} /><output>{Math.round(track.volume * 100)}%</output></label>}
      {onChange ? <><label className="lesson-field"><span>Shortcut</span><select aria-label="Audio shortcut" value={track.shortcut ?? ''} onChange={e => update(track.id, { shortcut: e.target.value || undefined })}><option value="">None</option>{[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>Alt + {n}</option>)}</select></label>
        <label className="lesson-field"><span>Volume</span><input aria-label="Break audio volume" type="range" min="0" max="1" step=".05" value={track.volume} onChange={e => update(track.id, { volume: Number(e.target.value) })} /></label>
        <label><input type="checkbox" checked={track.loop} onChange={e => update(track.id,{loop:e.target.checked})} /> Loop</label><button onClick={() => { onStop(); onChange({...scene,audio:scene.audio.filter(a=>a.id!==track.id)}); }}>Remove break audio</button></> : <span>{track.shortcut ? `Alt + ${track.shortcut}` : ''}</span>}
    </fieldset>)}
  </div>;
}
