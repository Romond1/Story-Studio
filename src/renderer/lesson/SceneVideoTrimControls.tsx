import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { VideoTrimSettings } from '../../shared/types';
import { getEffectiveVideoTrim } from '../../shared/videoTrim';
import './sceneVideoTrim.css';

export function SceneVideoTrimControls({ video, trim, onChange }: {
  video: HTMLVideoElement | null; trim?: VideoTrimSettings;
  onChange: (trim: VideoTrimSettings, duration: number, group?: object) => void;
}) {
  const [status, setStatus] = useState({ duration: 0, position: 0, playing: false });
  const [error, setError] = useState('');
  const gesture = useRef<object>();
  useEffect(() => {
    setError(''); gesture.current = undefined;
    const update = () => setStatus({ duration: video && Number.isFinite(video.duration) ? video.duration : 0, position: video?.currentTime ?? 0, playing: !!video && !video.paused && !video.ended });
    const events = ['loadedmetadata', 'durationchange', 'timeupdate', 'seeked', 'play', 'pause', 'ended', 'emptied'];
    events.forEach(event => video?.addEventListener(event, update)); update();
    return () => events.forEach(event => video?.removeEventListener(event, update));
  }, [video]);
  const range = getEffectiveVideoTrim(trim, status.duration), ready = !!video && status.duration > 0;
  const gap = Math.min(.04, status.duration);
  const clock = (time: number) => `${Math.floor(time / 60)}:${(time % 60).toFixed(1).padStart(4, '0')}`;
  const sharedHandle = {
    type: 'range', min: 0, max: status.duration || 1, step: .01, disabled: !ready,
    onPointerDown: () => { gesture.current = {}; },
    onPointerUp: () => { gesture.current = undefined; }, onPointerCancel: () => { gesture.current = undefined; },
    onKeyDown: () => { gesture.current ??= {}; }, onKeyUp: () => { gesture.current = undefined; }, onBlur: () => { gesture.current = undefined; },
  };
  return <div className="scene-video-trim-controls" role="group" aria-label="Edit video range controls">
    <div className="scene-video-playback">
      <button aria-label="Play edit video" title="Play selected range" disabled={!ready || status.playing} onClick={() => {
        if (!video) return; if (video.currentTime < range.inSec || video.currentTime >= range.outSec) video.currentTime = range.inSec;
        setError(''); void video.play().catch(() => setError('Video could not play.'));
      }}>▶ Play</button>
      <button aria-label="Pause edit video" disabled={!ready || !status.playing} onClick={() => video?.pause()}>Ⅱ Pause</button>
      <button aria-label="Stop edit video" title="Stop and return to range start" disabled={!ready} onClick={() => { if (video) { video.pause(); video.currentTime = range.inSec; } }}>■ Stop</button>
    </div>
    <div className="scene-video-trim-range" style={{ '--trim-start': `${status.duration ? range.inSec / status.duration * 100 : 0}%`, '--trim-end': `${status.duration ? range.outSec / status.duration * 100 : 100}%` } as CSSProperties}>
      <span className="scene-video-trim-track" />
      <span className="scene-video-trim-playhead" style={{ left: `${status.duration ? Math.min(100, status.position / status.duration * 100) : 0}%` }} />
      <input {...sharedHandle} aria-label="Video trim start" title={`Start: ${clock(range.inSec)}`} value={range.inSec}
        onChange={event => onChange({ inSec: Math.max(0, Math.min(Number(event.target.value), range.outSec - gap)), outSec: range.outSec }, status.duration, gesture.current)} />
      <input {...sharedHandle} aria-label="Video trim end" title={`End: ${clock(range.outSec)}`} value={range.outSec}
        onChange={event => onChange({ inSec: range.inSec, outSec: Math.min(status.duration, Math.max(Number(event.target.value), range.inSec + gap)) }, status.duration, gesture.current)} />
    </div>
    <output aria-label="Selected video range">{clock(range.inSec)}–{clock(range.outSec)} <span>({(range.outSec - range.inSec).toFixed(1)}s)</span></output>
    {error && <span className="lesson-error" role="alert">{error}</span>}
  </div>;
}
