import type { VideoTrimSettings } from '../../shared/types';
import { getEffectiveVideoTrim } from '../../shared/videoTrim';

/** Enforce the saved range on the existing Edit decoder, with no extra media element. */
export function bindEditVideoTrim(video: HTMLVideoElement, trim: VideoTrimSettings): () => void {
  let frame = 0;
  const cancel = () => { if (frame) cancelAnimationFrame(frame); frame = 0; };
  const enforce = () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    const range = getEffectiveVideoTrim(trim, video.duration);
    if (video.currentTime < range.inSec) video.currentTime = range.inSec;
    else if (video.currentTime >= range.outSec) {
      if (!video.paused) video.pause();
      if (video.currentTime !== range.outSec) video.currentTime = range.outSec;
    }
  };
  const tick = () => { frame = 0; enforce(); if (!video.paused && !video.ended) frame = requestAnimationFrame(tick); };
  const play = () => {
    cancel();
    const range = getEffectiveVideoTrim(trim, video.duration);
    if (range.outSec > range.inSec && (video.currentTime < range.inSec || video.currentTime >= range.outSec)) video.currentTime = range.inSec;
    enforce(); if (!video.paused && !video.ended) frame = requestAnimationFrame(tick);
  };
  const events = ['loadedmetadata', 'durationchange', 'seeking', 'timeupdate'];
  events.forEach(event => video.addEventListener(event, enforce));
  video.addEventListener('play', play); video.addEventListener('pause', cancel); video.addEventListener('ended', cancel);
  enforce(); if (!video.paused) play();
  return () => { cancel(); events.forEach(event => video.removeEventListener(event, enforce)); video.removeEventListener('play', play); video.removeEventListener('pause', cancel); video.removeEventListener('ended', cancel); };
}
