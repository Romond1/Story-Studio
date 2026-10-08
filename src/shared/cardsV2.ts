/** Authored Card V2 data. Runtime state is deliberately a separate type. */
export type CardLayout = 'text' | 'image-only' | 'image-text' | 'image-prompt' | 'text-support';
export type CardStylePreset = 'classroom' | 'dark' | 'high-contrast' | 'image-focus' | 'sentence-strip';
export interface CardStyle { preset: CardStylePreset; align?: 'left' | 'center'; verticalAlign?: 'top' | 'center'; fit?: 'auto' | 'manual'; minFontSize?: number; maxFontSize?: number; fontSize?: number; padding?: number; radius?: number; borderWidth?: number; accent?: string; shape?: 'landscape' | 'portrait' | 'square' | 'strip' | 'pill' }
export interface CardFace { id: string; label: string; layout: CardLayout; text?: string; supportingText?: string; imageAssetId?: string; alt?: string; emphasis?: 'normal' | 'bold' | 'italic'; style?: CardStyle }
export interface CardDefinition { id: string; label: string; tags: string[]; faces: CardFace[]; style: CardStyle; template?: CardTemplate }
export interface CardSetEntry { id: string; cardId: string }
export interface CardSet { id: string; label: string; tags: string[]; entries: CardSetEntry[] }
export interface CardGeometry { x: number; y: number; width: number; height: number }
export interface CardInstance { style?: CardStyle; id: string; cardId: string; geometry: CardGeometry; initialFaceId: string; revealFaceId?: string; initiallyConcealed: boolean; role?: string }
export interface CardActivity { id: string; type: 'recall-reveal'; label: string; setId?: string; frame: { width: number; height: number }; instances: CardInstance[]; allowCycling: boolean; allowDirectFace: boolean; circularCycling: boolean }
export interface CardPlacement { id: string; activityId: string; label: string }
export interface CardsV2Module { engine: 'card-v2'; version: 1; cards: Record<string, CardDefinition>; sets: Record<string, CardSet>; activities: Record<string, CardActivity>; placements: Record<string, CardPlacement> }
export type CardTemplate = 'text' | 'image-text' | 'picture-recall' | 'question-answer-explanation' | 'vocabulary';
export interface CardSessionToken { sessionId: string; projectId: string; occurrenceId: string; targetRevision: number; revision: number }
export interface CardInstanceState { instanceId: string; faceId: string; concealed: boolean; selected: boolean; locked: boolean; highlighted: boolean; geometry: CardGeometry }
export interface CardSession { token: CardSessionToken; placementId: string; activityId: string; phase: 'active'; order: string[]; instances: Record<string, CardInstanceState> }
export type CardCommand = { type: 'StartActivity'; placementId: string } | { type: 'ResetActivity' | 'RevealSelected' | 'RevealAll' } | { type: 'SetFace'; instanceId: string; faceId: string } | { type: 'SetFaceAll'; faceId: string } | { type: 'NextFace' | 'PreviousFace' | 'SelectCard' | 'ResetFace'; instanceId: string } | { type: 'SetConcealment'; instanceId: string; concealed: boolean };

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export const CARD_V2_DEFAULT_SIZES = { landscape: { width: 300, height: 210 }, portrait: { width: 230, height: 320 }, square: { width: 260, height: 260 }, strip: { width: 560, height: 140 }, pill: { width: 280, height: 110 } };
const copyLabel = (label: string) => `${label.slice(0, 195)} copy`;
export function createCardsV2(): CardsV2Module { return { engine: 'card-v2', version: 1, cards: {}, sets: {}, activities: {}, placements: {} }; }
export function createCard(template: CardTemplate, id: () => string): CardDefinition {
  const labels = template === 'question-answer-explanation' ? ['Question', 'Answer', 'Explanation'] : template === 'vocabulary' ? ['Image', 'Word', 'Example', 'Translation'] : template === 'picture-recall' ? ['Image', 'Word'] : ['Content'];
  return { id: id(), label: 'New card', tags: [], template, style: { preset: 'classroom', fit: 'auto', minFontSize: 18, maxFontSize: 52 }, faces: labels.map((label, i) => ({ id: id(), label, layout: (template === 'picture-recall' || template === 'vocabulary') && i === 0 ? 'image-only' : template === 'image-text' ? 'image-text' : 'text', text: '' })) };
}
export function createActivity(module: CardsV2Module, setId: string, id: () => string): CardActivity {
  const set = module.sets[setId]; if (!set) throw new Error('Unknown card set');
  const columns = set.entries.length <= 4 ? Math.max(1, Math.ceil(Math.sqrt(set.entries.length))) : 4;
  const rows = Math.max(1, Math.ceil(set.entries.length / columns));
  const cellWidth = (1200 - (columns - 1) * 16) / columns;
  const cellHeight = set.entries.length <= 8 ? (640 - (rows - 1) * 16) / rows : 320;
  return { id: id(), type: 'recall-reveal', label: set.label, setId, frame: { width: 1280, height: Math.max(720, rows * cellHeight + (rows - 1) * 16 + 80) }, allowCycling: true, allowDirectFace: true, circularCycling: false, instances: set.entries.map((entry, index) => {
    const card = module.cards[entry.cardId]; if (!card) throw new Error('Unknown card');
    const size = CARD_V2_DEFAULT_SIZES[card.style.shape ?? (card.style.preset === 'sentence-strip' ? 'strip' : 'landscape')];
    const scale = Math.min(1, cellWidth / size.width, cellHeight / size.height);
    const width = size.width * scale, height = size.height * scale;
    return { id: id(), cardId: card.id, initialFaceId: card.faces[0].id, revealFaceId: card.faces[1]?.id ?? card.faces[0].id, initiallyConcealed: false, geometry: { x: 40 + index % columns * (cellWidth + 16), y: 40 + Math.floor(index / columns) * (cellHeight + 16), width, height } };
  }) };
}
export function duplicateCard(module: CardsV2Module, cardId: string, id: () => string): CardDefinition {
  const card = clone(module.cards[cardId]); return { ...card, id: id(), label: copyLabel(card.label), faces: card.faces.map(face => ({ ...face, id: id() })) };
}
export function duplicateSet(module: CardsV2Module, setId: string, id: () => string): CardSet {
  const set = clone(module.sets[setId]); return { ...set, id: id(), label: copyLabel(set.label), entries: set.entries.map(entry => ({ ...entry, id: id() })) };
}
export function duplicateInstance(instance: CardInstance, id: () => string): CardInstance { return { ...clone(instance), id: id() }; }
export function duplicatePlacement(module: CardsV2Module, placementId: string, id: () => string): { activity: CardActivity; placement: CardPlacement } {
  const source = module.placements[placementId], activity = clone(module.activities[source.activityId]);
  activity.id = id(); activity.label = copyLabel(activity.label); activity.instances = activity.instances.map(instance => ({ ...instance, id: id() }));
  return { activity, placement: { ...source, id: id(), activityId: activity.id, label: copyLabel(source.label) } };
}
export function cardUsageCount(module: CardsV2Module, cardId: string): number { return Object.values(module.placements).filter(p => module.activities[p.activityId]?.instances.some(i => i.cardId === cardId)).length; }
export function removeCardFace(module: CardsV2Module, cardId: string, faceId: string): boolean {
  const card = module.cards[cardId]; if (!card || card.faces.length <= 1 || !card.faces.some(f => f.id === faceId)) return false;
  if (Object.values(module.activities).some(a => a.instances.some(i => i.cardId === cardId && (i.initialFaceId === faceId || i.revealFaceId === faceId)))) return false;
  card.faces = card.faces.filter(f => f.id !== faceId); return true;
}

/** Strict validation is also the persistence boundary: no CSS, HTML fields or runtime fields. */
export function validateCardsV2(value: unknown): string[] {
  const errors: string[] = [];
  const fail = (path: string) => { errors.push(`Invalid Card V2 ${path}`); };
  const object = (v: any, keys?: string[]) => v && typeof v === 'object' && !Array.isArray(v) && (!keys || Object.keys(v).every(k => keys.includes(k)));
  const str = (v: any, max = 20000) => typeof v === 'string' && v.length <= max;
  const identity = (v: any) => str(v, 160) && /^[\w.-]+$/.test(v) && !['__proto__','constructor','prototype',...Object.getOwnPropertyNames(Object.prototype)].includes(v);
  const num = (v: any, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  const tags = (v: any) => Array.isArray(v) && v.length <= 100 && v.every(t => str(t, 100));
  const list = (v: any, max = 500) => Array.isArray(v) && v.length <= max;
  const style = (s: any) => object(s, ['preset','align','verticalAlign','fit','minFontSize','maxFontSize','fontSize','padding','radius','borderWidth','accent','shape']) && ['classroom','dark','high-contrast','image-focus','sentence-strip'].includes(s.preset) && (s.align === undefined || ['left','center'].includes(s.align)) && (s.verticalAlign === undefined || ['top','center'].includes(s.verticalAlign)) && (s.fit === undefined || ['auto','manual'].includes(s.fit)) && ['minFontSize','maxFontSize','fontSize'].every(k => s[k] === undefined || num(s[k], 8, 160)) && ['padding','radius','borderWidth'].every(k => s[k] === undefined || num(s[k], 0, 80)) && (s.minFontSize === undefined || s.maxFontSize === undefined || s.minFontSize <= s.maxFontSize) && (s.accent === undefined || /^#[0-9a-fA-F]{6}$/.test(s.accent)) && (s.shape === undefined || ['landscape','portrait','square','strip','pill'].includes(s.shape));
  const geometry = (g: any) => object(g, ['x','y','width','height']) && num(g.x,0,10000) && num(g.y,0,10000) && num(g.width,40,10000) && num(g.height,40,10000);
  const m = value as any;
  if (!object(m,['engine','version','cards','sets','activities','placements']) || m.engine !== 'card-v2' || m.version !== 1) return ['Unsupported or invalid Card V2 module/version'];
  for (const key of ['cards','sets','activities','placements']) if (!object(m[key]) || Object.keys(m[key]).length > 2000) fail(key);
  if (errors.length) return errors;
  const records = (record: any, check: (v: any) => boolean, name: string) => Object.entries(record).forEach(([key,v]:[string,any]) => { if (!identity(key) || !object(v) || v.id !== key || !check(v)) fail(`${name}.${key}`); });
  records(m.cards, c => object(c,['id','label','tags','faces','style','template']) && str(c.label,200) && tags(c.tags) && style(c.style) && (c.template === undefined || ['text','image-text','picture-recall','question-answer-explanation','vocabulary'].includes(c.template)) && list(c.faces,32) && c.faces.length > 0 && new Set(c.faces.map((f:any)=>f?.id)).size === c.faces.length && c.faces.every((f:any) => object(f,['id','label','layout','text','supportingText','imageAssetId','alt','emphasis','style']) && identity(f.id) && str(f.label,200) && ['text','image-only','image-text','image-prompt','text-support'].includes(f.layout) && ['text','supportingText','alt'].every(k => f[k] === undefined || str(f[k])) && (f.imageAssetId === undefined || identity(f.imageAssetId)) && (f.emphasis === undefined || ['normal','bold','italic'].includes(f.emphasis)) && (f.style === undefined || style(f.style))), 'cards');
  if (errors.length) return errors;
  records(m.sets, s => object(s,['id','label','tags','entries']) && str(s.label,200) && tags(s.tags) && list(s.entries,100) && new Set(s.entries.map((e:any)=>e?.id)).size === s.entries.length && s.entries.every((e:any) => object(e,['id','cardId']) && identity(e.id) && identity(e.cardId) && !!m.cards[e.cardId]), 'sets');
  records(m.activities, a => object(a,['id','type','label','setId','frame','instances','allowCycling','allowDirectFace','circularCycling']) && a.type === 'recall-reveal' && str(a.label,200) && (a.setId === undefined || identity(a.setId) && !!m.sets[a.setId]) && object(a.frame,['width','height']) && num(a.frame.width,320,10000) && num(a.frame.height,240,10000) && ['allowCycling','allowDirectFace','circularCycling'].every(k => typeof a[k] === 'boolean') && list(a.instances,100) && new Set(a.instances.map((i:any)=>i?.id)).size === a.instances.length && a.instances.every((i:any) => object(i,['id','cardId','geometry','initialFaceId','revealFaceId','initiallyConcealed','role','style']) && (i.style === undefined || style(i.style)) && identity(i.id) && identity(i.cardId) && !!m.cards[i.cardId] && geometry(i.geometry) && i.geometry.x+i.geometry.width <= a.frame.width && i.geometry.y+i.geometry.height <= a.frame.height && typeof i.initiallyConcealed === 'boolean' && (i.role === undefined || str(i.role,100)) && m.cards[i.cardId].faces.some((f:any)=>f.id===i.initialFaceId) && (i.revealFaceId === undefined || m.cards[i.cardId].faces.some((f:any)=>f.id===i.revealFaceId))), 'activities');
  records(m.placements, p => object(p,['id','activityId','label']) && str(p.label,200) && identity(p.activityId) && !!m.activities[p.activityId], 'placements');
  return errors;
}
export function assertCardsV2(value: unknown): CardsV2Module { const errors = validateCardsV2(value); if (errors.length) throw new Error(errors.join('; ')); return value as CardsV2Module; }

/** Control alone constructs this authority. Present receives snapshots/render plans only. */
export class CardSessionAuthority {
  private state: CardSession | null = null;
  private token: CardSessionToken;
  private module: CardsV2Module;
  constructor(module: CardsV2Module, token: CardSessionToken) { this.module = clone(assertCardsV2(module)); this.token = { ...token }; }
  currentToken(): CardSessionToken { return { ...this.token }; }
  snapshot(): CardSession | null { return this.state ? clone(this.state) : null; }
  /** Accept authored edits while retaining this occurrence's independent live state. */
  reconcile(module: CardsV2Module): void {
    const nextModule = clone(assertCardsV2(module));
    const nextToken = { ...this.token, revision: this.token.revision + 1 };
    let nextState: CardSession | null = null;
    if (this.state) {
      const previous = this.state, placement = nextModule.placements[previous.placementId], activity = placement ? nextModule.activities[placement.activityId] : undefined;
      if (placement && activity) {
        const preserve = previous.activityId === activity.id;
        const instances: Record<string, CardInstanceState> = Object.fromEntries(activity.instances.map(instance => {
          const old = preserve ? previous.instances[instance.id] : undefined;
          const faceId = old && nextModule.cards[instance.cardId].faces.some(face => face.id === old.faceId) ? old.faceId : instance.initialFaceId;
          return [instance.id, old ? { ...old, faceId, geometry: { ...instance.geometry } } : { instanceId: instance.id, faceId, concealed: instance.initiallyConcealed, selected: false, locked: false, highlighted: false, geometry: { ...instance.geometry } }];
        }));
        const order = activity.instances.map(instance => instance.id);
        nextState = { token: nextToken, placementId: placement.id, activityId: activity.id, phase: 'active', order, instances };
      }
    }
    this.module = nextModule; this.token = nextToken; this.state = nextState;
  }
  activate(token: CardSessionToken): boolean {
    if (token.sessionId !== this.token.sessionId || token.projectId !== this.token.projectId || token.occurrenceId !== this.token.occurrenceId || token.targetRevision < this.token.targetRevision) return false;
    this.token = { ...token, revision: this.token.revision + 1 }; if (this.state) this.state.token = { ...this.token }; return true;
  }
  dispatch(token: CardSessionToken, command: CardCommand): boolean {
    if (Object.keys(this.token).some(k => token[k as keyof CardSessionToken] !== this.token[k as keyof CardSessionToken])) return false;
    if (command.type === 'StartActivity') {
      const p = this.module.placements[command.placementId]; if (!p) return false;
      this.initialize(p);
    } else {
      if (!this.state) return false;
      const activity = this.module.activities[this.state.activityId];
      if (command.type === 'ResetActivity') this.initialize(this.module.placements[this.state.placementId]);
      else if (command.type === 'RevealAll' || command.type === 'RevealSelected') {
        for (const instance of activity.instances) { const state = this.state.instances[instance.id]; if (!state.locked && (command.type === 'RevealAll' || state.selected)) { state.concealed = false; state.faceId = instance.revealFaceId ?? state.faceId; } }
      } else if (command.type === 'SetFaceAll') {
        if (!activity.allowDirectFace) return false;
        for (const instance of activity.instances) if (!this.state.instances[instance.id].locked && this.module.cards[instance.cardId].faces.some(f => f.id === command.faceId)) this.state.instances[instance.id].faceId = command.faceId;
      } else {
        if (!('instanceId' in command)) return false;
        const state = this.state.instances[command.instanceId], instance = activity.instances.find(i => i.id === command.instanceId);
        if (!state || !instance || state.locked) return false;
        const faces = this.module.cards[instance.cardId].faces;
        if (command.type === 'SetFace') { if (!activity.allowDirectFace || !faces.some(f => f.id === command.faceId)) return false; state.faceId = command.faceId; }
        else if (command.type === 'NextFace' || command.type === 'PreviousFace') {
          if (!activity.allowCycling) return false;
          let index = faces.findIndex(f => f.id === state.faceId) + (command.type === 'NextFace' ? 1 : -1);
          index = activity.circularCycling ? (index + faces.length) % faces.length : Math.max(0, Math.min(faces.length - 1, index)); state.faceId = faces[index].id;
        } else if (command.type === 'ResetFace') state.faceId = instance.initialFaceId;
        else if (command.type === 'SelectCard') { for (const s of Object.values(this.state.instances)) s.selected = s === state; }
        else if (command.type === 'SetConcealment') state.concealed = command.concealed;
        else return false;
      }
    }
    this.token.revision++; if (this.state) this.state.token = { ...this.token }; return true;
  }
  private initialize(placement: CardPlacement): void {
    const activity = this.module.activities[placement.activityId];
    this.state = { token: { ...this.token }, placementId: placement.id, activityId: activity.id, phase: 'active', order: activity.instances.map(i => i.id), instances: Object.fromEntries(activity.instances.map(i => [i.id, { instanceId: i.id, faceId: i.initialFaceId, concealed: i.initiallyConcealed, selected: false, locked: false, highlighted: false, geometry: { ...i.geometry } }])) };
  }
}

