import { useEffect, useRef } from 'react';
import type { LessonSection } from '../../shared/lesson/model';
import { claimTeacherKey, lessonShortcut } from '../../shared/keyboardShortcuts';
import { audioManager } from '../audio/AudioManager';
import { SceneAudioOwner } from './SceneAudioOwner';

/** Scope must include project/activation, mode, sequence, section, and break identity. */
export function useSectionMusic({ section, scope, resolve, shortcutEnabled, onPlayBreak, onError }: {
  section?: LessonSection;
  scope: string;
  resolve: (id: string) => string | undefined;
  shortcutEnabled: boolean;
  onPlayBreak?: () => void;
  onError: (reason: unknown) => void;
}) {
  const owner = useRef(new SceneAudioOwner(audioManager));
  const tracks = section?.audio ?? [];
  const audioKey = JSON.stringify(tracks.map(({ volume, ...track }) => [track, resolve(track.assetId)]));
  const volumeKey = JSON.stringify(tracks.map(track => [track.assetId, track.volume]));
  // Deliberately excludes scene/visit identity: section music survives scene navigation.
  useEffect(() => {
    const current = owner.current;
    return () => current.stop();
  }, [scope, audioKey]);
  useEffect(() => { for (const track of tracks) { const url = resolve(track.assetId); if (url) owner.current.setVolume(url, track.volume); } }, [audioKey, volumeKey]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (!shortcutEnabled || document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]') || lessonShortcut(event, 'teach') !== 'music') return;
      claimTeacherKey(event);
      if (onPlayBreak) onPlayBreak();
      else if (tracks.length) void owner.current.play(tracks, resolve).catch(onError);
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  });
  return owner.current;
}
