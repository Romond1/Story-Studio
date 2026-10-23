import type { ImageAppearance } from './imageAppearance';
import type { BubbleOptions } from './bubbleAppearance';
import type { AssetItem, MediaBin, MarkerStroke, VideoTrimSettings } from '../types';
import type { CardDefinition, CardGeometry, CardSet } from '../cardsV2';
import type { SceneViewport } from '../teachingScene';

export type SequenceKind = 'story' | 'activation';
export type Rect = CardGeometry;
export interface SceneEntry { id: string; sceneId: string; section: string; sectionId?: string; kind?: 'scene' | 'break' }
export interface LessonSection { id: string; name: string; sequence: SequenceKind; beforeEntryId?: string; audio?: SceneAudio[] }
export interface SceneBackground { color: string; assetId?: string; videoTrim?: VideoTrimSettings; imageAppearance?: ImageAppearance }
interface ObjectBase { id: string; box: Rect; visible: boolean }
export interface SceneCard extends ObjectBase {
  kind: 'card'; cardId: string; initialFaceId: string; initiallyConcealed: boolean;
  interaction: 'cycle' | 'reveal' | 'manual';
}
export interface SceneText extends ObjectBase, BubbleOptions {
  kind: 'text' | 'bubble'; text: string; fontSize: number; color: string;
  bubbleDefId?: string; align: 'left' | 'center' | 'right';
}
export interface SceneImage extends ObjectBase { kind: 'image'; assetId: string; appearance?: ImageAppearance }
export interface SceneVideo extends ObjectBase { kind: 'video'; assetId: string }
export type SceneObject = SceneCard | SceneText | SceneImage | SceneVideo;
export interface SceneAudio { id: string; assetId: string; volume: number; loop: boolean; autoplay: boolean; shortcut?: string }
export interface LessonScene {
  id: string; title: string; frame: { width: number; height: number };
  background: SceneBackground; objects: SceneObject[]; drawings: MarkerStroke[];
  audio: SceneAudio[]; transition: { kind: 'none' | 'fade'; durationMs: number };
  viewport: SceneViewport; notes: string;
}
export interface SceneDocumentFields {
  id: string; title: string;
  createdAt: string; updatedAt: string; assets: AssetItem[]; mediaBins: MediaBin[];
  scenes: Record<string, LessonScene>; sequences: Record<SequenceKind, SceneEntry[]>;
  sections?: LessonSection[];
  cards: Record<string, CardDefinition>; library: string[]; cardSets: CardSet[];
}
export interface SceneLessonProject extends SceneDocumentFields { format: 'story-studio-scene'; version: 1 }
export type LessonProject = SceneLessonProject | import('../episode/model').EpisodeProject;
export type SceneDocument = LessonProject;
export interface LessonProjectState { data: LessonProject; folderPath: string; lastSavedAt: string; activationToken: string; isDraft?: boolean }
export interface LessonLocation { sequence: SequenceKind; entryId: string }
export interface EditorSelection { sequence: SequenceKind; entryId: string | null; objectId: string | null }
export interface CardLiveState { faceId: string; concealed: boolean; box?: Rect }
export interface SceneLiveState {
  sceneId: string; cards: Record<string, CardLiveState>; drawings: MarkerStroke[]; viewport: SceneViewport;
  drawingUndo?: MarkerStroke[][]; drawingRedo?: MarkerStroke[][];
}
export interface LessonSession {
  id: string; revision: number; visit: number; cursor: LessonLocation | null;
  storyReturn: LessonLocation | null; cards: Record<string, CardLiveState>;
  drawings: MarkerStroke[]; viewport: SceneViewport;
  /** Runtime only, keyed by sequence and stable entry ID, never by scene ID. */
  scenes?: Record<string, SceneLiveState>;
  drawingUndo?: MarkerStroke[][]; drawingRedo?: MarkerStroke[][];
  /** Teaching-only scores and visuals; never part of a saved lesson document. */
  rewards?: import('./rewards').LessonRewardState;
}
export const makeId = () => globalThis.crypto.randomUUID();
export const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
export function sceneAt(project: LessonProject, location: LessonLocation | EditorSelection | null): LessonScene | undefined {
  if (!location?.entryId) return undefined;
  const entry = project.sequences[location.sequence].find(item => item.id === location.entryId);
  return entry && project.scenes[entry.sceneId];
}
