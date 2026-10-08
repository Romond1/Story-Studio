import type { ACard, BCard, BCardInstance, BCardLibrary, BCardSideConfig, BCardTeachState, Section } from './types';
import type { CardMotion, TimerAnchor } from './cardRuntime';
export interface BoardVisual { movement?: CardMotion; key: string; card: ACard; states: Record<string, BCardTeachState>; startedAt: number }
export interface BreakVisual {
  title: string; questions?: string; background?: string; bgTransform?: Section['bgTransform'];
  font?: string; fontSize?: number; titleFontSize?: number; timerSize?: number; isBold?: boolean; isItalic?: boolean;
  align?: Section['align']; position?: Section['position']; textColor?: string;
  timer?: boolean; timerMode?: string; timerDuration?: number; anchor: TimerAnchor;
  thumbnails: { id: string; src: string; width: number; x: number; y: number; scale: number; fit: string }[];
}
export interface ActivityScene { boards: BoardVisual[]; cards: BCardLibrary; images: Record<string, string>; break?: BreakVisual; overlays?: { instances: BCardInstance[]; states: Record<string, BCardTeachState> } }
const obj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === 'string' && v.length <= 32768;
function pick(v: Record<string, any>, strings: string[], numbers: string[] = [], booleans: string[] = []) {
  const clean: Record<string, any> = {};
  for (const k of strings) if (str(v[k])) clean[k] = v[k];
  for (const k of numbers) if (num(v[k])) clean[k] = v[k];
  for (const k of booleans) if (typeof v[k] === 'boolean') clean[k] = v[k];
  return clean;
}
function instances(value: unknown): BCardInstance[] {
  if (!Array.isArray(value)) throw Error('instances');
  return value.map(v => {
    if (!obj(v) || !str(v.id) || !str(v.bCardId) || !obj(v.position) || !obj(v.size) || ![v.position.x,v.position.y,v.size.width,v.size.height,v.zIndex].every(num) || v.size.width <= 0 || v.size.height <= 0) throw Error('instance');
    return { id: v.id, bCardId: v.bCardId, position: { x: v.position.x, y: v.position.y }, size: { width: v.size.width, height: v.size.height }, zIndex: v.zIndex, ...(v.displayMode === 'board' ? { displayMode: 'board' as const } : {}) };
  });
}
function states(v: unknown, items: BCardInstance[]) {
  const clean: Record<string, BCardTeachState> = {};
  if (obj(v)) for (const i of items) if (obj(v[i.id])) clean[i.id] = { isFlipped: v[i.id].isFlipped === true, isBlurred: v[i.id].isBlurred === true, isCovered: v[i.id].isCovered === true, isZoomed: v[i.id].isZoomed === true };
  return clean;
}
/** Narrow student projection; no card library metadata, audio references, or teacher notes. */
export function parseActivityScene(value: unknown): ActivityScene | null {
  try {
    if (!obj(value) || !Array.isArray(value.boards) || !obj(value.cards) || !obj(value.images)) return null;
    const result: ActivityScene = { boards: [], cards: {}, images: {} }; const neededCards = new Set<string>(), neededImages = new Set<string>();
    for (const board of value.boards) {
      if (!obj(board) || !str(board.key) || !num(board.startedAt) || !obj(board.card) || !obj(board.card.background)) return null;
      const source = board.card, items = instances(source.bCardInstances);
      const background: ACard['background'] = { offsetX: 50, offsetY: 50, scale: 1, blur: 0, ...pick(source.background, ['mode','color','gradientStart','gradientEnd','gradientDirection','imageId'], ['offsetX','offsetY','scale','blur']) };
      if (background.imageId) neededImages.add(background.imageId);
      const card = { id: String(source.id ?? ''), name: '', stageMode: source.stageMode === 'half' ? 'half' : 'full', background, ...pick(source, ['title','questions','font','textColor','align','position','timerMode'], ['fontSize','titleFontSize','timerSize','timerDuration'], ['isBold','isItalic','timer']), bCardInstances: items } as ACard;
      items.forEach(i => neededCards.add(i.bCardId)); result.boards.push({ key: board.key, card, states: states(board.states, items), startedAt: board.startedAt, ...(obj(board.movement) && num(board.movement.durationMs) && num(board.movement.startedAt) && num(board.movement.key) && str(board.movement.easing) ? { movement: { durationMs: board.movement.durationMs, startedAt: board.movement.startedAt, key: board.movement.key, easing: board.movement.easing } } : {}) });
    }
    if (value.overlays !== undefined) {
      if (!obj(value.overlays)) return null;
      const items = instances(value.overlays.instances); items.forEach(i => neededCards.add(i.bCardId)); result.overlays = { instances: items, states: states(value.overlays.states, items) };
    }
    const face = (v: unknown): BCardSideConfig => {
      if (!obj(v)) throw Error('face');
      const clean = pick(v, ['imageId','text','backgroundColor','emoji']); if (clean.imageId) neededImages.add(clean.imageId);
      if (obj(v.textStyle)) clean.textStyle = pick(v.textStyle, ['fontFamily','color','textAlign','verticalAlign'], ['fontSize']); return clean;
    };
    for (const id of neededCards) { const c = value.cards[id]; if (obj(c)) result.cards[id] = { id, name: '', front: face(c.front), back: face(c.back) } as BCard; }
    for (const id of neededImages) if (str(value.images[id]) && value.images[id].startsWith('media://')) result.images[id] = value.images[id];
    if (value.break !== undefined) {
      const b = value.break; if (!obj(b) || !obj(b.anchor) || !num(b.anchor.startTime) || !num(b.anchor.accumulated) || !Array.isArray(b.thumbnails)) return null;
      const background = str(b.background) && !/url\s*\(/i.test(b.background) ? b.background : str(b.background) && /^url\(["']?media:\/\/[^\r\n]+["']?\)$/i.test(b.background) ? b.background : '#111';
      result.break = { title: str(b.title) ? b.title : '', background, ...pick(b, ['questions','font','align','position','textColor','timerMode'], ['fontSize','titleFontSize','timerSize','timerDuration'], ['isBold','isItalic','timer']), anchor: { isRunning: b.anchor.isRunning === true, startTime: b.anchor.startTime, accumulated: b.anchor.accumulated }, thumbnails: b.thumbnails.filter((t: any) => obj(t) && str(t.id) && str(t.src) && t.src.startsWith('media://') && [t.width,t.x,t.y,t.scale].every(num)).map((t: any) => ({ id: t.id, src: t.src, width: t.width, x: t.x, y: t.y, scale: t.scale, fit: t.fit === 'contain' ? 'contain' : 'cover' })) };
      if (obj(b.bgTransform) && ['x','y','scale','blur'].every(k => num(b.bgTransform[k]))) result.break.bgTransform = { x: b.bgTransform.x, y: b.bgTransform.y, scale: b.bgTransform.scale, blur: b.bgTransform.blur };
    }
    return result;
  } catch { return null; }
}
