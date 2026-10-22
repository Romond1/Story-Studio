import { useEffect, useId, useRef, useState } from 'react';
import type { AssetItem } from '../shared/types';
import { MAX_MEDIA_TITLE_LENGTH, mediaDisplayName, mediaDisplayTitle, mediaTypeBadge } from '../shared/mediaDisplayName';
import './mediaPoolPreview.css';

export interface MediaAssetPreviewProps {
  asset: Readonly<AssetItem>;
  src?: string;
  onClose: () => void;
  onRename: (title: string) => void;
}

/** Local preview only. It never attaches to the presentation audio or media buses. */
export function MediaAssetPreview({ asset, src, onClose, onRename }: MediaAssetPreviewProps) {
  const dialog = useRef<HTMLDialogElement>(null), video = useRef<HTMLVideoElement>(null);
  const renameButton = useRef<HTMLButtonElement>(null), titleInput = useRef<HTMLInputElement>(null);
  const restoreRenameFocus = useRef(false);
  const [renaming, setRenaming] = useState(false), [title, setTitle] = useState(''), [error, setError] = useState('');
  const [mediaError, setMediaError] = useState(false);
  const headingId = useId(), errorId = useId();
  useEffect(() => {
    const node = dialog.current!;
    const trigger = document.activeElement as HTMLElement | null;
    const fallback = trigger?.closest('section')?.querySelector<HTMLInputElement>('input[type="search"], input[aria-label="Search media"]');
    const pool = node.closest('.lesson-pool, .media-pool');
    node.style.setProperty('--media-preview-width', `${Math.max(560, Math.min(800, (trigger?.getBoundingClientRect().width || 140) * 5))}px`);
    node.showModal();
    const position = () => {
      const left = pool?.getBoundingClientRect().left ?? 12;
      node.style.setProperty('--media-preview-left', `${Math.max(12, Math.min(left, window.innerWidth - node.offsetWidth - 12))}px`);
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(node);
    if (pool) observer.observe(pool);
    window.addEventListener('resize', position);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', position);
      node.close();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      else if (fallback?.isConnected) fallback.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => { setMediaError(false); }, [src]);
  useEffect(() => {
    const decoder = video.current;
    if (!decoder || !src) return;
    // StrictMode replays setup after cleanup on the same element in development.
    // Reestablish the source released by that cleanup without creating a decoder.
    if (decoder.getAttribute('src') !== src) decoder.setAttribute('src', src);
    decoder.muted = true;
    void decoder.play().catch(() => { /* Native controls remain usable if autoplay is blocked. */ });
    return () => { decoder.pause(); decoder.removeAttribute('src'); decoder.load(); };
  }, [src, mediaError]);
  useEffect(() => {
    if (renaming) { titleInput.current?.focus(); titleInput.current?.select(); }
    else if (restoreRenameFocus.current) { renameButton.current?.focus(); restoreRenameFocus.current = false; }
  }, [renaming]);
  const cancelRename = () => { restoreRenameFocus.current = true; setRenaming(false); setError(''); };
  return <dialog ref={dialog} className="media-asset-preview" aria-labelledby={headingId}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    onKeyDown={event => { event.stopPropagation(); }}
    onPointerDown={event => { event.stopPropagation(); }}
    onPointerUp={event => { event.stopPropagation(); }}
    onClick={event => {
      event.stopPropagation();
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <div className="media-preview-stage">
      {!src || mediaError ? <p role="status">Preview unavailable. The source media may be missing or unsupported.</p>
        : asset.mediaType === 'image' ? <img src={src} alt={mediaDisplayTitle(asset)} onError={() => setMediaError(true)} />
          : <video ref={video} src={src} autoPlay muted loop controls playsInline preload="metadata"
            aria-label="Media video preview" controlsList="nodownload noremoteplayback" disablePictureInPicture onError={() => setMediaError(true)} />}
      <button autoFocus type="button" className="media-preview-close" aria-label="Close media preview" onClick={onClose}>×</button>
    </div>
    <header className="media-preview-heading"><span className="media-pool-badge">{mediaTypeBadge(asset)}</span>
      <h2 id={headingId} title={mediaDisplayName(asset)}>{mediaDisplayTitle(asset)}</h2></header>
    {renaming ? <form className="media-preview-rename" onSubmit={event => {
      event.preventDefault();
      try { onRename(title); cancelRename(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not rename media.'); }
    }}>
      <label>Display title<input ref={titleInput} value={title} maxLength={MAX_MEDIA_TITLE_LENGTH} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} onChange={event => setTitle(event.target.value)} /></label>
      {error && <p id={errorId} role="alert">{error}</p>}
      <div className="media-preview-actions"><button type="submit" disabled={!title.trim()}>Save title</button><button type="button" onClick={cancelRename}>Cancel</button></div>
    </form> : <footer className="media-preview-actions">
      <button ref={renameButton} type="button" onClick={() => { setTitle(mediaDisplayTitle(asset)); setRenaming(true); }}>Rename</button>
    </footer>}
  </dialog>;
}
