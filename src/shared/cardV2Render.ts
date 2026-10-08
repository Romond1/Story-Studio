import type { CardActivity, CardDefinition, CardGeometry, CardSession, CardStyle, CardStylePreset, CardsV2Module } from './cardsV2';
export { CARD_V2_DEFAULT_SIZES } from './cardsV2';

export const CARD_V2_FONT = 'Arial, "Noto Sans JP", "Yu Gothic", sans-serif';
export interface CardV2StyleTokens { surface: string; ink: string; border: string; accent: string; radius: number; borderWidth: number; padding: number }
export const CARD_V2_PRESETS: Record<CardStylePreset, CardV2StyleTokens> = {
  classroom: { surface: '#fffdf7', ink: '#1f2937', border: '#9ca3af', accent: '#467565', radius: 16, borderWidth: 2, padding: 20 },
  dark: { surface: '#202b38', ink: '#ffffff', border: '#8495ab', accent: '#d4ba7c', radius: 16, borderWidth: 2, padding: 20 },
  'high-contrast': { surface: '#ffffff', ink: '#000000', border: '#000000', accent: '#000000', radius: 8, borderWidth: 4, padding: 20 },
  'image-focus': { surface: '#f1f4f3', ink: '#172b24', border: '#80948b', accent: '#467565', radius: 14, borderWidth: 2, padding: 12 },
  'sentence-strip': { surface: '#fffdf7', ink: '#25334a', border: '#a3adba', accent: '#526e94', radius: 10, borderWidth: 2, padding: 18 }
};
export interface CardTextLine { text: string; width: number }
export interface CardTextFit { fontSize: number; lineHeight: number; lines: CardTextLine[]; overflow: boolean }
export interface CardTextPlan extends CardTextFit { box: CardGeometry; align: 'left' | 'center'; verticalAlign: 'top' | 'center'; emphasis: 'normal' | 'bold' | 'italic' }
export interface CardV2CardPlan { instanceId: string; faceId: string; box: CardGeometry; concealed: boolean; highlighted: boolean; style: CardV2StyleTokens; texts: CardTextPlan[]; image?: { src: string; alt: string; box: CardGeometry; fit: 'contain' }; overflow: boolean }
export interface CardV2RenderPlan { engine: 'card-v2'; version: 1; frame: { width: number; height: number }; cards: CardV2CardPlan[] }
export type CardTextMeasure = (text: string, fontSize: number) => number;

/** Deterministic advance widths. SVG textLength applies these exact advances on every surface.
 * This intentionally does not ask the local browser to choose wraps or a font size. */
export const measureCardText: CardTextMeasure = (text, fontSize) => {
  let units = 0;
  for (const cluster of graphemes(text)) {
    const char = Array.from(cluster)[0];
    if (/\p{Mark}|\u200d|\ufe0f/u.test(char)) continue;
    if (/\s/u.test(char)) units += .32;
    else if (/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(cluster)) units += 1;
    else if (/[ilI.,!'`:;]/.test(char)) units += .3;
    else if (/[MW@%]/.test(char)) units += .9;
    else if ((char.codePointAt(0) ?? 0) > 0x2e7f) units += 1;
    else units += .58;
  }
  return units * fontSize;
};
type GraphemeSegmenter = { segment: (text: string) => Iterable<{ segment: string }> };
const Segmenter = (Intl as unknown as { Segmenter?: new (locale: string, options: { granularity: string }) => GraphemeSegmenter }).Segmenter;
const segmenter = Segmenter ? new Segmenter('en', { granularity: 'grapheme' }) : undefined;
function graphemes(text: string): string[] {
  if (segmenter) return Array.from(segmenter.segment(text), item => item.segment);
  // Fallback for older hosts: combining marks, skin tones, paired flags and ZWJ chains.
  const result: string[] = [];
  for (const char of Array.from(text)) {
    const previous = result[result.length - 1];
    const flagPair = /\p{Regional_Indicator}/u.test(char) && previous && /^\p{Regional_Indicator}$/u.test(previous);
    if (result.length && (/\p{Mark}|\p{Emoji_Modifier}|\ufe0f|\u200d/u.test(char) || previous.endsWith('\u200d') || flagPair)) result[result.length - 1] += char;
    else result.push(char);
  }
  return result;
}
function tokenize(text: string): string[][] {
  return text.replace(/\r\n?/g, '\n').split('\n').map(paragraph => {
    const tokens: string[] = []; let previousKind = '';
    for (const cluster of graphemes(paragraph)) {
      const kind = /^\s/u.test(cluster) ? 'space' : /^[\u2e80-\uffff]|\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(cluster) ? 'glyph' : 'word';
      if (kind !== 'glyph' && kind === previousKind) tokens[tokens.length - 1] += cluster;
      else tokens.push(cluster);
      previousKind = kind;
    }
    return tokens;
  });
}
function wrap(paragraphs: string[][], width: number, size: number, measure: CardTextMeasure): CardTextLine[] {
  const lines: CardTextLine[] = [];
  const measured = new Map<string, number>();
  const advance = (value: string) => { let result = measured.get(value); if (result === undefined) { result = measure(value, size); measured.set(value, result); } return result; };
  for (const tokens of paragraphs) {
    if (!tokens.length) { lines.push({ text: '', width: 0 }); continue; }
    let line = '', lineWidth = 0;
    const push = () => { lines.push({ text: line, width: lineWidth }); line = ''; lineWidth = 0; };
    for (const token of tokens) {
      const tokenWidth = advance(token);
      if (line && lineWidth + tokenWidth > width + .00001) push();
      if (tokenWidth <= width + .00001) { line += token; lineWidth += tokenWidth; continue; }
      for (const char of graphemes(token)) {
        const charWidth = advance(char);
        if (line && lineWidth + charWidth > width + .00001) push();
        line += char; lineWidth += charWidth;
      }
    }
    if (line) push();
  }
  return lines;
}
const fitCache = new Map<string, CardTextFit>();
const copyFit = (fit: CardTextFit): CardTextFit => ({ ...fit, lines: fit.lines.map(line => ({ ...line })) });
export function fitCardText(text: string, box: { width: number; height: number }, style: Pick<CardStyle, 'fit' | 'fontSize' | 'minFontSize' | 'maxFontSize'> = {}, measure: CardTextMeasure = measureCardText): CardTextFit {
  const key = measure === measureCardText ? JSON.stringify([text, box.width, box.height, style.fit, style.fontSize, style.minFontSize, style.maxFontSize]) : undefined;
  const cached = key && fitCache.get(key); if (cached) return copyFit(cached);
  const finish = (fit: CardTextFit) => {
    if (key) { if (fitCache.size >= 128) fitCache.delete(fitCache.keys().next().value!); fitCache.set(key, copyFit(fit)); }
    return fit;
  };
  const min = Math.max(8, Math.min(160, style.minFontSize ?? 18));
  const max = Math.max(min, Math.min(160, style.maxFontSize ?? 48));
  const paragraphs = tokenize(text);
  const at = (fontSize: number): CardTextFit => {
    const lines = wrap(paragraphs, Math.max(1, box.width), fontSize, measure), lineHeight = fontSize * 1.25;
    return { fontSize, lineHeight, lines, overflow: lines.length * lineHeight > box.height + .001 || lines.some(l => l.width > box.width + .001) };
  };
  if (style.fit === 'manual') return finish(at(Math.max(8, Math.min(160, style.fontSize ?? 32))));
  let best = at(min);
  if (best.overflow || min === max) return finish(best);
  const largest = at(max); if (!largest.overflow) return finish(largest);
  // Greedy wrapping with positive, linearly scaled advances is monotonic in font size.
  // Quarter-unit precision needs at most ten binary-search trials over the bounded range.
  let low = 1, high = Math.ceil((max - min) * 4) - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2), candidate = at(min + middle / 4);
    if (candidate.overflow) high = middle - 1;
    else { best = candidate; low = middle + 1; }
  }
  return finish(best);
}
function styleTokens(style: CardStyle): CardV2StyleTokens {
  const preset = CARD_V2_PRESETS[style.preset] ?? CARD_V2_PRESETS.classroom;
  return { ...preset, padding: style.padding ?? preset.padding, radius: style.shape === 'pill' ? 60 : style.radius ?? preset.radius, borderWidth: style.borderWidth ?? preset.borderWidth, accent: style.accent && /^#[\da-f]{6}$/i.test(style.accent) ? style.accent : preset.accent };
}
export function buildCardV2FacePlan(card: CardDefinition, faceId: string, box: CardGeometry, resolveImageUrl: (assetId: string) => string | undefined = () => undefined): CardV2CardPlan {
  const face = card.faces.find(f => f.id === faceId);
  const authoredStyle = { ...card.style, ...face?.style }, style = styleTokens(authoredStyle);
  const pad = Math.min(style.padding, Math.max(0, Math.min(box.width, box.height) / 3));
  const inner = { x: pad, y: pad, width: Math.max(1, box.width - 2 * pad), height: Math.max(1, box.height - 2 * pad) };
  const plan: CardV2CardPlan = { instanceId: card.id, faceId, box: { ...box }, concealed: false, highlighted: false, style, texts: [], overflow: false };
  if (!face) return plan;
  const text = (value: string | undefined, area: CardGeometry, support = false) => {
    if (!value) return;
    const fit = fitCardText(value, area, support ? { ...authoredStyle, maxFontSize: Math.min(authoredStyle.maxFontSize ?? 48, 28), minFontSize: Math.min(authoredStyle.minFontSize ?? 18, 28) } : authoredStyle);
    plan.texts.push({ ...fit, box: area, align: authoredStyle.align ?? 'center', verticalAlign: authoredStyle.verticalAlign ?? 'center', emphasis: support ? 'normal' : face.emphasis ?? 'normal' });
    plan.overflow ||= fit.overflow;
  };
  if (face.layout === 'text-support') {
    const gap = 12, mainHeight = Math.max(1, (inner.height - gap) * .62);
    text(face.text, { ...inner, height: mainHeight });
    text(face.supportingText, { ...inner, y: inner.y + mainHeight + gap, height: Math.max(1, inner.height - mainHeight - gap) }, true);
  } else if (face.layout === 'text') text(face.text, inner);
  else {
    const imageHeight = face.layout === 'image-only' ? inner.height : Math.max(1, (inner.height - 12) * (face.layout === 'image-prompt' ? .55 : .65));
    const src = face.imageAssetId ? resolveImageUrl(face.imageAssetId) : undefined;
    if (src) plan.image = { src, alt: face.alt ?? '', box: { ...inner, height: imageHeight }, fit: 'contain' };
    if (face.layout !== 'image-only') text(face.text, { ...inner, y: inner.y + imageHeight + 12, height: Math.max(1, inner.height - imageHeight - 12) });
  }
  return plan;
}
/** Only the active face is materialized. Concealed cards never publish their text or image. */
export function buildCardV2RenderPlan(module: CardsV2Module, activity: CardActivity, session?: CardSession, resolveImageUrl?: (assetId: string) => string | undefined): CardV2RenderPlan {
  const cards: CardV2CardPlan[] = [];
  const order = session?.activityId === activity.id ? session.order : activity.instances.map(i => i.id);
  for (const id of order) {
    const instance = activity.instances.find(i => i.id === id); if (!instance) continue;
    const definition = module.cards[instance.cardId]; if (!definition) continue;
    const state = session?.activityId === activity.id ? session.instances[id] : undefined;
    const plan = buildCardV2FacePlan(instance.style ? { ...definition, style: { ...definition.style, ...instance.style }, faces: definition.faces.map(face=>({...face,style:{...definition.style,...face.style,...instance.style}})) } : definition, state?.faceId ?? instance.initialFaceId, state?.geometry ?? instance.geometry, resolveImageUrl);
    plan.instanceId = id; plan.concealed = state?.concealed ?? instance.initiallyConcealed; plan.highlighted = state?.highlighted ?? false;
    if (plan.concealed) { plan.texts = []; delete plan.image; plan.overflow = false; }
    cards.push(plan);
  }
  return { engine: 'card-v2', version: 1, frame: { ...activity.frame }, cards };
}

const obj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 100000;
const str = (v: unknown): v is string => typeof v === 'string' && v.length <= 32768;
function geometry(v: unknown): CardGeometry {
  if (!obj(v) || ![v.x, v.y, v.width, v.height].every(num) || v.width <= 0 || v.height <= 0) throw Error('geometry');
  return { x: v.x, y: v.y, width: v.width, height: v.height };
}
/** IPC whitelist, not a cast: strips definitions, teacher labels, inactive faces and URLs. */
export function parseCardV2RenderPlan(value: unknown): CardV2RenderPlan | null {
  try {
    if (!obj(value) || value.engine !== 'card-v2' || value.version !== 1 || !obj(value.frame) || !num(value.frame.width) || !num(value.frame.height) || value.frame.width <= 0 || value.frame.height <= 0 || !Array.isArray(value.cards) || value.cards.length > 500) return null;
    const cards: CardV2CardPlan[] = value.cards.map(v => {
      if (!obj(v) || !str(v.instanceId) || !str(v.faceId) || !obj(v.style)) throw Error('card');
      const style = {} as CardV2StyleTokens;
      for (const k of ['surface', 'ink', 'border', 'accent'] as const) { if (!str(v.style[k]) || !/^#[\da-f]{6}$/i.test(v.style[k])) throw Error('color'); style[k] = v.style[k]; }
      for (const k of ['radius', 'borderWidth', 'padding'] as const) { if (!num(v.style[k]) || v.style[k] < 0 || v.style[k] > 200) throw Error('style'); style[k] = v.style[k]; }
      const card: CardV2CardPlan = { instanceId: v.instanceId, faceId: v.faceId, box: geometry(v.box), concealed: v.concealed === true, highlighted: v.highlighted === true, style, texts: [], overflow: false };
      if (card.concealed) return card;
      if (!Array.isArray(v.texts) || v.texts.length > 2) throw Error('texts');
      card.texts = v.texts.map((t: unknown) => {
        if (!obj(t) || !num(t.fontSize) || t.fontSize < 8 || t.fontSize > 160 || !num(t.lineHeight) || t.lineHeight <= 0 || !Array.isArray(t.lines) || t.lines.length > 32768) throw Error('text');
        const lines = t.lines.map((l: unknown) => { if (!obj(l) || !str(l.text) || !num(l.width) || l.width < 0) throw Error('line'); return { text: l.text, width: l.width }; });
        return { box: geometry(t.box), fontSize: t.fontSize, lineHeight: t.lineHeight, lines, overflow: t.overflow === true, align: t.align === 'left' ? 'left' as const : 'center' as const, verticalAlign: t.verticalAlign === 'top' ? 'top' as const : 'center' as const, emphasis: t.emphasis === 'bold' ? 'bold' as const : t.emphasis === 'italic' ? 'italic' as const : 'normal' as const };
      });
      if (obj(v.image) && str(v.image.src) && /^media:\/\/[^\s<>]+$/i.test(v.image.src)) card.image = { src: v.image.src, alt: str(v.image.alt) ? v.image.alt : '', box: geometry(v.image.box), fit: 'contain' };
      card.overflow = card.texts.some(t => t.overflow);
      return card;
    });
    if (new Set(cards.map(c => c.instanceId)).size !== cards.length) return null;
    return { engine: 'card-v2', version: 1, frame: { width: value.frame.width, height: value.frame.height }, cards };
  } catch { return null; }
}
export function collectCardV2RenderImages(plan: CardV2RenderPlan | null | undefined): string[] { return Array.from(new Set(plan?.cards.flatMap(c => c.image ? [c.image.src] : []) ?? [])); }
