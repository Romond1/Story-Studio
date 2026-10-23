import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { AssetItem } from '../shared/types';
import { mediaDisplayTitle, mediaTypeBadge } from '../shared/mediaDisplayName';
import './mediaPoolPreview.css';
import { useNearViewport } from './useNearViewport';

/** Scrubbing reuses the thumbnail decoder and never starts playback. */
export function MediaPoolThumbnail({ asset, src }: { asset: Readonly<AssetItem>; src?: string }) {
  const video = useRef<HTMLVideoElement>(null), frame = useRef(0), target = useRef<number | null>(null);
  const host=useRef<HTMLSpanElement>(null),near=useNearViewport(host,asset.mediaType==='video');
  useEffect(()=>{if(!near&&video.current){video.current.pause();video.current.removeAttribute('src');video.current.load();}},[near,src]);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [enlarged, setEnlarged] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const clear = () => { clearTimeout(timer.current); setEnlarged(null); cancelAnimationFrame(frame.current); frame.current = 0; target.current = null; video.current?.pause(); };
  useEffect(() => () => { clearTimeout(timer.current); cancelAnimationFrame(frame.current); }, [src]);
  useEffect(() => {
    if (!enlarged) return;
    const dismiss = () => clear();
    window.addEventListener('scroll', dismiss, true); window.addEventListener('resize', dismiss); window.addEventListener('keydown', dismiss);
    return () => { window.removeEventListener('scroll', dismiss, true); window.removeEventListener('resize', dismiss); window.removeEventListener('keydown', dismiss); };
  }, [enlarged]);
  const seek = () => {
    frame.current = 0;
    const node = video.current;
    if (!node || node.seeking || target.current === null || !Number.isFinite(node.duration) || node.duration <= 0) return;
    const time = target.current * Math.max(0, node.duration - .05);
    if (Math.abs(node.currentTime - time) > .025) node.currentTime = time;
  };
  const scrub = (event: PointerEvent<HTMLSpanElement>) => {
    if (event.pointerType === 'touch' || event.buttons) return;
    const node = video.current;
    if (!node) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    target.current = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    if (!frame.current) frame.current = requestAnimationFrame(seek);
  };
  return <>
    <span ref={host} className="media-pool-thumbnail" onPointerMove={scrub} onPointerLeave={clear} onPointerDown={clear} onContextMenu={clear}
      onPointerEnter={event => {
        if (asset.mediaType !== 'image' || !src || event.pointerType === 'touch' || event.buttons) return;
        const thumbnail = event.currentTarget;
        timer.current = setTimeout(() => {
          if (!thumbnail.isConnected || !thumbnail.matches(':hover')) return;
          const bounds = thumbnail.getBoundingClientRect();
          const image = thumbnail.querySelector('img');
          if (!image?.naturalWidth || !image.naturalHeight) return;
          const ratio = image.naturalWidth / image.naturalHeight;
          const width = Math.min(bounds.width * 2.5, window.innerWidth - 16, (window.innerHeight - 16) * ratio);
          const height = width / ratio;
          setEnlarged({ left: Math.max(8, Math.min(bounds.left - (width - bounds.width) / 2, window.innerWidth - width - 8)), top: Math.max(8, Math.min(bounds.top - (height - bounds.height) / 2, window.innerHeight - height - 8)), width, height });
        }, 250);
      }}>
      {asset.mediaType === 'image' ? <img src={src} alt="" loading="lazy" draggable={false} />
        : asset.mediaType === 'video' ? <video ref={video} src={near?src:undefined} muted preload={near?'metadata':'none'} playsInline onLoadedMetadata={seek} onSeeked={seek} />
          : <span aria-hidden="true">♫</span>}
      <span className="media-pool-badge">{mediaTypeBadge(asset)}</span>
      {asset.mediaType === 'video' && <span className="media-pool-play" aria-hidden="true">↔</span>}
    </span>
    <span className="media-pool-title">{mediaDisplayTitle(asset)}</span>
    {enlarged && createPortal(<div className="media-pool-hover-preview" style={enlarged} aria-hidden="true"><img src={src} alt="" /><span className="media-pool-badge">PIC</span></div>, document.body)}
  </>;
}
