import { useEffect, useRef, type ReactNode, type PointerEvent } from 'react';
import type { VideoTrimSettings } from '../../shared/types';
import { getEffectiveVideoTrim } from '../../shared/videoTrim';
import { useNearViewport } from '../useNearViewport';

/** Seek only the existing timeline decoder; canvas and Present playback are untouched. */
export function TimelineThumbnail({ children, color, trim, video, src }: { children: ReactNode; color: string; trim?: VideoTrimSettings; video: boolean; src?: string }) {
  const host = useRef<HTMLSpanElement>(null), frame = useRef(0), target = useRef<number | null>(null);
  const near=useNearViewport(host);
  const clear = () => { cancelAnimationFrame(frame.current); frame.current = 0; target.current = null; };
  const seek = () => {
    frame.current = 0;
    const node = host.current?.querySelector('video');
    if (!node || node.seeking || target.current === null || !Number.isFinite(node.duration) || node.duration <= 0) return;
    const range = getEffectiveVideoTrim(trim, node.duration);
    const time = range.inSec + target.current * Math.max(0, range.outSec - range.inSec - .05);
    node.muted = true; node.pause();
    if (Math.abs(node.currentTime - time) > .025) node.currentTime = time;
  };
  useEffect(() => {
    if (!video) return;
    const node = host.current?.querySelector('video');
    node?.addEventListener('loadedmetadata', seek); node?.addEventListener('seeked', seek);
    return () => { clear(); node?.removeEventListener('loadedmetadata', seek); node?.removeEventListener('seeked', seek); if(node&&!node.isConnected){node.pause();node.removeAttribute('src');node.load();} };
  }, [video, trim, src, near]);
  const scrub = (event: PointerEvent<HTMLSpanElement>) => {
    if (!video || event.buttons || event.pointerType === 'touch') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    target.current = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    if (!frame.current) frame.current = requestAnimationFrame(seek);
  };
  return <span ref={host} className="lesson-timeline-thumb" style={{ background: color }} onPointerMove={scrub} onPointerLeave={clear} onPointerDown={clear} onDragStart={clear}>{near?children:null}</span>;
}
