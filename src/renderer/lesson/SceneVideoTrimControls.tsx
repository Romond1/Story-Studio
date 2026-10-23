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
      <button aria-label={status.playing?'Pause edit video':'Play edit video'} title="Play / Pause · Space" aria-pressed={status.playing} disabled={!ready} onClick={() => {
        if (!video) return; if(!video.paused){video.pause();return;} if (video.currentTime < range.inSec || video.currentTime >= range.outSec) video.currentTime = range.inSec;
        setError(''); void video.play().catch(() => setError('Video could not play.'));
      }}>{status.playing?'Ⅱ Pause':'▶ Play'}</button>
      <button aria-label="Stop edit video" title="Stop and return to range start" disabled={!ready} onClick={() => { if (video) { video.pause(); video.currentTime = range.inSec; } }}>■ Stop</button>
    </div>
    <div className="scene-video-trim-range" style={{ '--trim-start': `${status.duration ? range.inSec / status.duration * 100 : 0}%`, '--trim-end': `${status.duration ? range.outSec / status.duration * 100 : 100}%` } as CSSProperties}>
      <span className="scene-video-trim-track" />
      <span className="scene-video-trim-playhead" style={{ left: `${status.duration ? Math.min(100, status.position / status.duration * 100) : 0}%` }} />
      <input className="scene-video-seek" type="range" aria-label="Edit video position" title="Click or drag to seek" min={0} max={status.duration || 1} step={.01} disabled={!ready} value={status.position}
        onKeyDown={event => { if (event.key === ' ' && !event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey) { event.preventDefault(); event.stopPropagation(); if (video?.paused) void video.play().catch(() => setError('Video could not play.')); else video?.pause(); } }}
        onChange={event => { if (video) { const position = Math.max(range.inSec, Math.min(range.outSec, Number(event.target.value))); video.currentTime = position; setStatus(old => ({ ...old, position })); } }} />
      <input {...sharedHandle} aria-label="Video trim start" title={`Start: ${clock(range.inSec)}`} value={range.inSec}
        onChange={event => onChange({ inSec: Math.max(0, Math.min(Number(event.target.value), range.outSec - gap)), outSec: range.outSec }, status.duration, gesture.current)} />
      <input {...sharedHandle} aria-label="Video trim end" title={`End: ${clock(range.outSec)}`} value={range.outSec}
        onChange={event => onChange({ inSec: range.inSec, outSec: Math.min(status.duration, Math.max(Number(event.target.value), range.inSec + gap)) }, status.duration, gesture.current)} />
    </div>
    <div className="scene-video-times"><output aria-label="Video playback position" title="Current position / full source video duration">{clockPosition(status.position)} / {clockPosition(status.duration)}</output><output aria-label="Selected video range">{clock(range.inSec)}–{clock(range.outSec)} <span>({(range.outSec - range.inSec).toFixed(1)}s)</span></output></div>
    {error && <span className="lesson-error" role="alert">{error}</span>}
  </div>;
}

function clockPosition(seconds:number):string {
  const hundredths=Math.round(Math.max(0,Number.isFinite(seconds)?seconds:0)*100);
  return `${Math.floor(hundredths/6000)}:${String(Math.floor(hundredths/100)%60).padStart(2,'0')}.${String(hundredths%100).padStart(2,'0')}`;
}
