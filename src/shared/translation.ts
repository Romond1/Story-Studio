export type TargetLanguage = 'ja' | 'it' | 'ro';
export type JapaneseMode = 'standard' | 'kana' | 'furigana';
export type ReadingToken = { text: string; reading?: string };
export type CaptionStyle = {font:'sans'|'serif'|'rounded'|'mono';color:string;background:string;opacity:number;align:'left'|'center'|'right';bold:boolean;outline:boolean;lineHeight:number;width:number;offset:number};
export const CAPTION_STYLE:CaptionStyle={font:'sans',color:'#ffffff',background:'#000000',opacity:.86,align:'center',bold:false,outline:false,lineHeight:1.7,width:90,offset:3};
export function validCaptionStyle(value:unknown):value is CaptionStyle {
 if(!value||typeof value!=='object')return false;const s=value as CaptionStyle;
 return ['sans','serif','rounded','mono'].includes(s.font)&&['left','center','right'].includes(s.align)
  && typeof s.color==='string'&&/^#[0-9a-f]{6}$/i.test(s.color)&&typeof s.background==='string'&&/^#[0-9a-f]{6}$/i.test(s.background)
  &&typeof s.bold==='boolean'&&typeof s.outline==='boolean'
  && [[s.opacity,0,1],[s.lineHeight,1,2.5],[s.width,20,100],[s.offset,0,40]].every(([v,min,max])=>Number.isFinite(v)&&v>=min&&v<=max);
}
export function publicCaptionStyle(s:CaptionStyle):CaptionStyle {return {font:s.font,color:s.color,background:s.background,opacity:s.opacity,align:s.align,bold:s.bold,outline:s.outline,lineHeight:s.lineHeight,width:s.width,offset:s.offset};}
export type Caption = { language: TargetLanguage; mode: JapaneseMode; tokens: ReadingToken[]; fontSize: number; position: 'top' | 'bottom'; style?:CaptionStyle };
export type SpeechExecution = 'auto' | 'gpu' | 'cpu';
export type SpeechBackend = { backend: 'cpu' | 'cuda'; device?: string; reason?: string };
export type TranslationSettings = { target: TargetLanguage; model: 'base.en' | 'small.en'; execution?: SpeechExecution };
export type TranslationEngineState = { phase: 'off' | 'preparing' | 'ready' | 'error'; settings?: TranslationSettings; backend?: SpeechBackend; message?: string; metrics?: Record<string, number> };
export type TranslationRequest = { text?: string; audio?: number[]; target: TargetLanguage; model: 'base.en' | 'small.en'; execution?: SpeechExecution };
export type TranslationResult = { transcript: string; translation: string; metrics: Record<string, number>; speechBackend?: SpeechBackend };
export interface TranslationControlApi {
  setAppearance?(appearance:Pick<Caption,'fontSize'|'position'|'style'>):Promise<void>;
  prepare(settings: TranslationSettings): Promise<TranslationEngineState>;
  getState(): Promise<TranslationEngineState>;
  subscribeState(listener: (state: TranslationEngineState) => void): () => void;
  run(request: TranslationRequest): Promise<TranslationResult>;
  cancel(unload?: boolean): Promise<void>;
  format(text: string, mode: JapaneseMode): Promise<ReadingToken[]>;
  publish(caption: Caption | null): Promise<void>;
  subscribeStatus(listener: (status: string) => void): () => void;
}
export interface CaptionApi { get(): Promise<Caption | null>; subscribe(listener: (caption: Caption | null) => void): () => void }
export function validCaption(value: unknown): value is Caption {
  if (!value || typeof value !== 'object') return false;
  const c = value as Caption;
  return ['ja','it','ro'].includes(c.language) && ['standard','kana','furigana'].includes(c.mode)
    && (c.style===undefined||validCaptionStyle(c.style))
    && Number.isFinite(c.fontSize) && c.fontSize >= 20 && c.fontSize <= 72
    && ['top','bottom'].includes(c.position) && Array.isArray(c.tokens) && c.tokens.length <= 1000
    && c.tokens.every(t => t && typeof t.text === 'string' && t.text.length <= 2000 && (t.reading === undefined || typeof t.reading === 'string' && t.reading.length <= 2000))
    && c.tokens.reduce((n,t)=>n+t.text.length+(t.reading?.length ?? 0),0) <= 6000;
}
export function hasSpeech(audio: ArrayLike<number>): boolean {
  if (audio.length < 4800 || audio.length > 320000) return false;
  let voiced = 0;
  for (let start = 0; start < audio.length; start += 320) {
    let energy = 0;
    for (let i = start; i < Math.min(start + 320, audio.length); i++) { if (!Number.isFinite(audio[i])) return false; energy += audio[i] ** 2; }
    if (Math.sqrt(energy / 320) > 0.008) voiced++;
  }
  return voiced >= 10;
}
