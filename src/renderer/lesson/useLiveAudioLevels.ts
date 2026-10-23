import { useState } from 'react';
import type { SceneAudio } from '../../shared/lesson/model';
const KEY = 'story-studio.live-audio-levels.v1';
export function useLiveAudioLevels(projectId?: string) {
  const [levels, setLevels] = useState<Record<string, number>>(() => {
    try { const value = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).filter(([key, level]) => key.length < 500 && typeof level === 'number' && Number.isFinite(level) && level >= 0 && level <= 1)) as Record<string, number> : {}; } catch { return {}; }
  });
  const key = (track: SceneAudio) => `${projectId}:${track.id}:${track.assetId}`;
  return {
    tracks: (tracks: SceneAudio[]) => tracks.map(track => ({ ...track, volume: levels[key(track)] ?? track.volume })),
    setVolume: (track: SceneAudio, volume: number) => {
      if (!Number.isFinite(volume)) return;
      setLevels(old => { const next = { ...old, [key(track)]: Math.max(0, Math.min(1, volume)) }; try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* Live adjustment remains usable when preference storage is unavailable. */ } return next; });
    },
  };
}
