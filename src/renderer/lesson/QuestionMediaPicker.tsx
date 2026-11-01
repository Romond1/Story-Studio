import { useRef, useState } from 'react';
import type { AssetItem } from '../../shared/types';
import { mediaDisplayTitle } from '../../shared/mediaDisplayName';
import { useNearViewport } from '../useNearViewport';
import './questionMediaPicker.css';

function Thumbnail({ asset, src }: { asset?: AssetItem; src?: string }) {
  const host = useRef<HTMLSpanElement>(null);
  const near = useNearViewport(host, asset?.mediaType === 'video');
  return <span ref={host} className="question-media-thumb" aria-hidden="true">
    {asset?.mediaType === 'image' && src ? <img src={src} alt="" loading="lazy" decoding="async" />
      : asset?.mediaType === 'video' && src ? <video src={near ? src : undefined} muted playsInline preload={near ? 'metadata' : 'none'} />
        : <span>{asset?.mediaType === 'audio' ? '♫' : asset?.mediaType === 'video' ? '▶' : asset ? '▧' : '＋'}</span>}
  </span>;
}

/** A bounded, searchable attachment chooser. Thumbnails never start playback. */
export function QuestionMediaPicker({ assets, value, resolveAsset, onChange }: {
  assets: AssetItem[]; value: string; resolveAsset?: (id: string) => string | undefined;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(40);
  const details = useRef<HTMLDetailsElement>(null);
  const selected = assets.find(asset => asset.id === value);
  const available = assets.filter(asset => ['image', 'video', 'audio'].includes(asset.mediaType));
  const filtered = available.filter(asset => `${mediaDisplayTitle(asset)} ${asset.mediaType === 'image' ? 'picture image' : asset.mediaType}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const choose = (id: string) => {
    onChange(id);
    if (details.current) {
      details.current.open = false;
      details.current.querySelector('summary')?.focus();
    }
  };
  return <div className="question-media-picker">
    <span className="question-media-label">Picture, video or audio</span>
    <details ref={details} onToggle={event => setOpen(event.currentTarget.open)} onKeyDown={event => { if (event.key === 'Escape' && details.current) { details.current.open = false; details.current.querySelector('summary')?.focus(); } }}>
      <summary aria-label="Question media" title={selected ? mediaDisplayTitle(selected) : undefined}>
        <Thumbnail asset={selected} src={selected && resolveAsset?.(selected.id)} />
        <span className="question-media-copy"><strong>{selected ? mediaDisplayTitle(selected) : value ? 'Missing media · choose another' : 'Choose media…'}</strong><small>{selected ? `${selected.mediaType === 'image' ? 'Picture' : selected.mediaType === 'video' ? 'Video' : 'Audio'} · Change attachment` : value ? 'Saved attachment is unavailable' : 'No media attachment'}</small></span>
      </summary>
      {open && <div className="question-media-options">
        <input type="search" aria-label="Search question media" placeholder="Search media…" value={query} onChange={event => { setQuery(event.target.value); setLimit(40); }} />
        <button type="button" className="question-media-clear" onClick={() => choose('')}>No media attachment{!value && ' ✓'}</button>
        <div className="question-media-list" role="group" aria-label="Available question media">
          {filtered.slice(0, limit).map(asset => <button type="button" key={asset.id} className="question-media-option" title={mediaDisplayTitle(asset)} aria-pressed={value === asset.id} onClick={() => choose(asset.id)}>
            <Thumbnail asset={asset} src={resolveAsset?.(asset.id)} />
            <span className="question-media-copy"><strong>{mediaDisplayTitle(asset)}</strong><small>{asset.mediaType === 'image' ? 'Picture' : asset.mediaType === 'video' ? 'Video' : 'Audio'}</small></span>
            {value === asset.id && <span aria-hidden="true">✓</span>}
          </button>)}
          {!filtered.length && <p className="lesson-hint">{available.length ? 'No matching media.' : 'Import a picture, video or audio to attach it.'}</p>}
          {filtered.length > limit && <button type="button" onClick={() => setLimit(count => count + 40)}>Show more ({filtered.length - limit} remaining)</button>}
        </div>
      </div>}
    </details>
  </div>;
}
