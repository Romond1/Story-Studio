import type { LessonProject } from './lesson/model';
import type { VideoTrimSettings } from './types';
import { getEffectiveVideoTrim, isVideoTrimSettings } from './videoTrim';

export function updateSceneVideoTrim<T extends LessonProject>(project: T, sceneId: string, trim: VideoTrimSettings, duration: number): T {
  const scene = project.scenes[sceneId];
  if (!scene || !project.assets.some(asset => asset.id === scene.background.assetId && asset.mediaType === 'video')) throw new Error('Select a video scene to trim.');
  if (!isVideoTrimSettings(trim) || !Number.isFinite(duration) || duration <= 0) throw new Error('Choose a valid video range.');
  const effective = getEffectiveVideoTrim(trim, duration);
  if (effective.outSec <= effective.inSec) throw new Error('The video range must contain playable time.');
  const videoTrim = effective.isTrimmed ? { inSec: effective.inSec, outSec: effective.outSec } : undefined;
  if (JSON.stringify(scene.background.videoTrim) === JSON.stringify(videoTrim)) return project;
  const { videoTrim: _old, ...background } = scene.background;
  return { ...project, scenes: { ...project.scenes, [sceneId]: { ...scene, background: { ...background, ...(videoTrim ? { videoTrim } : {}) } } } };
}
