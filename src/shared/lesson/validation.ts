import { isImageAppearance } from './imageAppearance';
import { validBubbleOptions } from './bubbleAppearance';
import { assertCardsV2 } from '../cardsV2';
import { clone, type LessonProject, type SceneLessonProject } from './model';
import { LESSON_LIMITS } from './limits';
import { migrateSections } from './sections';
import { parseEpisodeProject } from '../episode/validation';
import { isMediaDisplayTitle } from '../mediaDisplayName';
import { isVideoTrimSettings } from '../videoTrim';

const record = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max = 65536): value is string => typeof value === 'string' && value.length <= max;
const color = (value: unknown): value is string => typeof value === 'string' && /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value);
const reservedIds = new Set(['__proto__', 'constructor', 'prototype', ...Object.getOwnPropertyNames(Object.prototype)]);
const id = (value: unknown): value is string => text(value, 200) && value.length > 0 && !reservedIds.has(value);
const owns = (records: Record<string, unknown>, key: unknown) => id(key) && Object.prototype.hasOwnProperty.call(records, key);
const number = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const list = (value: unknown, max = 2000): value is any[] => Array.isArray(value) && value.length <= max;
const unique = (values: any[]) => values.every(v => record(v) && id(v.id)) && new Set(values.map(v => v.id)).size === values.length;
const check = (valid: unknown, message: string): void => { if (!valid) throw new Error(`Invalid lesson: ${message}`); };
const safePath = (value: unknown) => text(value, 4096) && /^assets\//.test(value) && !value.includes('\\') && !value.split('/').some(part => part === '..' || part === '.') && !/[\u0000-\u001f:?#]/.test(value);
function validateBox(box: any, frame: any) {
  check(record(box) && number(box.x, 0, frame.width) && number(box.y, 0, frame.height)
    && number(box.width, 1, frame.width) && number(box.height, 1, frame.height)
    && box.x + box.width <= frame.width + .01 && box.y + box.height <= frame.height + .01, 'object geometry');
}
export function validateSceneDocumentBody(value: unknown, hasAsset?: (assetId: unknown, kind?: string) => boolean): void {
  check(record(value), 'document body');
  const p = value as Record<string, any>;
  check(id(p.id) && text(p.title, 500) && text(p.createdAt, 100) && text(p.updatedAt, 100), 'project identity');
  check(list(p.assets) && unique(p.assets) && list(p.mediaBins) && unique(p.mediaBins), 'media pool');
  for (const asset of p.assets) check(safePath(asset.relativePath) && ['image','video','audio'].includes(asset.mediaType)
    && text(asset.filename, 500) && text(asset.originalName, 500) && (asset.displayTitle === undefined || isMediaDisplayTitle(asset.displayTitle))
    && (asset.hiddenFromMediaPool === undefined || typeof asset.hiddenFromMediaPool === 'boolean')
    && number(asset.sizeBytes, 0, Number.MAX_SAFE_INTEGER) && text(asset.importedAt, 100)
    && (asset.binId === undefined || id(asset.binId) && p.mediaBins.some((bin: any) => bin.id === asset.binId)), 'asset/bin reference');
  const asset = hasAsset ?? ((assetId: unknown, kind?: string) => p.assets.some((a: any) => a.id === assetId && (!kind || a.mediaType === kind)));
  for (const bin of p.mediaBins) {
    check(text(bin.name, 500) && (!bin.parentId || p.mediaBins.some((b: any) => b.id === bin.parentId)), 'media bin');
    const seen = new Set<string>(); let current = bin;
    while (current) { check(!seen.has(current.id), 'media bin cycle'); seen.add(current.id); current = p.mediaBins.find((b: any) => b.id === current.parentId); }
  }
  check(record(p.cards) && list(p.library) && list(p.cardSets) && unique(p.cardSets), 'card collection');
  assertCardsV2({ engine: 'card-v2', version: 1, cards: p.cards, sets: Object.fromEntries(p.cardSets.map((s: any) => [s.id, s])), activities: {}, placements: {} });
  check(p.library.every((cardId: unknown) => owns(p.cards, cardId)), 'library reference');
  for (const card of Object.values(p.cards) as any[]) for (const face of card.faces) check(!face.imageAssetId || asset(face.imageAssetId, 'image'), 'card image reference');
  check(record(p.scenes) && Object.keys(p.scenes).length <= LESSON_LIMITS.scenes && record(p.sequences), 'scenes/sequences');
  if (p.sections !== undefined) {
    check(list(p.sections, LESSON_LIMITS.sections) && unique(p.sections), 'sections');
    for (const section of p.sections) check((section.beforeEntryId === undefined || id(section.beforeEntryId)) && text(section.name, 500) && section.name.trim().length && ['story', 'activation'].includes(section.sequence), 'section identity');
    for (const section of p.sections) if (section.audio !== undefined) {
      check(list(section.audio, 50) && unique(section.audio), 'section audio tracks');
      for (const track of section.audio) check(asset(track.assetId, 'audio') && number(track.volume, 0, 1) && typeof track.loop === 'boolean' && typeof track.autoplay === 'boolean' && (track.shortcut === undefined || /^[1-9]$/.test(track.shortcut)), 'section audio association');
    }
  }
  for (const sequence of ['story', 'activation']) {
    const entries = p.sequences[sequence];
    check(list(entries, LESSON_LIMITS.entriesPerSequence) && unique(entries), 'sequence entries');
    for (const entry of entries) {
      check(owns(p.scenes, entry.sceneId) && text(entry.section, 500), 'scene reference');
      check(entry.kind === undefined || ['scene', 'break'].includes(entry.kind), 'entry kind');
      check(entry.sectionId === undefined || id(entry.sectionId) && p.sections?.some((s: any) => s.id === entry.sectionId && s.sequence === sequence), 'section reference');
    }
  }
  const allEntries = [...p.sequences.story, ...p.sequences.activation]; check(unique(allEntries), 'global entry identity');
  for (const [key, scene] of Object.entries(p.scenes) as [string, any][]) {
    check(record(scene) && id(key) && scene.id === key && text(scene.title, 500) && text(scene.notes), 'scene identity');
    check(record(scene.frame) && number(scene.frame.width, 240, 10000) && number(scene.frame.height, 240, 10000), 'logical frame');
    check(record(scene.background) && color(scene.background.color) && (!scene.background.assetId || asset(scene.background.assetId) && !asset(scene.background.assetId, 'audio')), 'background');
    check(scene.background.imageAppearance === undefined || asset(scene.background.assetId, 'image') && isImageAppearance(scene.background.imageAppearance), 'background image appearance');
    check(scene.background.videoTrim === undefined || asset(scene.background.assetId, 'video') && isVideoTrimSettings(scene.background.videoTrim), 'video trim');
    check(record(scene.viewport) && number(scene.viewport.zoom, 1, 4) && record(scene.viewport.pan) && number(scene.viewport.pan.x, -40000, 40000) && number(scene.viewport.pan.y, -40000, 40000), 'viewport');
    check(record(scene.transition) && ['none','fade'].includes(scene.transition.kind) && number(scene.transition.durationMs, 0, 10000), 'transition');
    check(list(scene.objects, LESSON_LIMITS.objectsPerScene) && unique(scene.objects), 'scene objects');
    for (const object of scene.objects) {
      check(object.appearance === undefined || object.kind === 'image' && isImageAppearance(object.appearance), 'image appearance');
      validateBox(object.box, scene.frame); check(typeof object.visible === 'boolean', 'visibility');
      if (object.kind === 'card') {
        const card = p.cards[object.cardId];
        check(owns(p.cards, object.cardId) && card.faces.some((f: any) => f.id === object.initialFaceId) && typeof object.initiallyConcealed === 'boolean' && ['cycle','reveal','manual'].includes(object.interaction), 'card placement');
      } else if (object.kind === 'text' || object.kind === 'bubble') {
        check(validBubbleOptions(object), 'bubble tail or appearance delay');
        check(text(object.text) && number(object.fontSize, 8, 500) && color(object.color) && ['left','center','right'].includes(object.align) && (object.bubbleDefId === undefined || id(object.bubbleDefId)), 'text object');
      } else check((object.kind === 'image' || object.kind === 'video') && asset(object.assetId, object.kind), 'image object');
    }
    check(list(scene.audio, 50) && unique(scene.audio), 'audio tracks');
    for (const track of scene.audio) check(asset(track.assetId, 'audio') && number(track.volume, 0, 1) && typeof track.loop === 'boolean' && typeof track.autoplay === 'boolean' && (track.shortcut === undefined || /^[1-9]$/.test(track.shortcut)), 'audio association');
    check(list(scene.drawings, 1000) && unique(scene.drawings), 'drawings');
    for (const stroke of scene.drawings) {
      check(color(stroke.color) && number(stroke.size, 1, 100) && number(stroke.opacity, 0, 1) && typeof stroke.rainbow === 'boolean' && (stroke.fadeMs === undefined || number(stroke.fadeMs, 0, 60000)) && list(stroke.points, 100000), 'drawing stroke');
      for (const point of stroke.points) check(record(point) && number(point.x, -40000, 40000) && number(point.y, -40000, 40000) && number(point.t, 0, Number.MAX_SAFE_INTEGER), 'drawing point');
    }
  }
}
export function parseLessonProject(value: unknown): SceneLessonProject {
  check(record(value) && value.format === 'story-studio-scene' && value.version === 1, 'unsupported format. Open older lessons in Legacy mode.');
  validateSceneDocumentBody(value);
  return migrateSections(clone(value as SceneLessonProject));
}
export function parseSceneDocument(value: unknown): LessonProject {
  return record(value) && value.format === 'story-studio-episode' ? parseEpisodeProject(value) : parseLessonProject(value);
}
