import { CAPTION_STYLE, publicCaptionStyle, validCaptionStyle, type CaptionStyle, type JapaneseMode, type SpeechExecution, type TargetLanguage } from './translation';

export interface TranslationPreferences {
  target: TargetLanguage;
  mode: JapaneseMode;
  model: 'base.en' | 'small.en';
  execution: SpeechExecution;
  readings: string;
  auto: boolean;
  style: CaptionStyle;
  fontSize: number;
  position: 'top' | 'bottom';
}
export const TRANSLATION_PREFERENCES: TranslationPreferences = {
  target: 'ja', mode: 'standard', model: 'base.en', execution: 'auto', readings: '', auto: false,
  style: CAPTION_STYLE, fontSize: 36, position: 'top',
};
const key = 'story-studio.translation-preferences.v1';
/** Persist only user preferences; transcript, capture, and engine intent stay private runtime state. */
export function parseTranslationPreferences(value: unknown): TranslationPreferences {
  const p = value && typeof value === 'object' ? value as Partial<TranslationPreferences> : {};
  return {
    target: ['ja', 'it', 'ro'].includes(p.target as string) ? p.target! : 'ja',
    mode: ['standard', 'kana', 'furigana'].includes(p.mode as string) ? p.mode! : 'standard',
    model: p.model === 'small.en' ? 'small.en' : 'base.en',
    execution: ['auto', 'gpu', 'cpu'].includes(p.execution as string) ? p.execution! : 'auto',
    readings: typeof p.readings === 'string' ? p.readings.slice(0, 2000) : '',
    auto: p.auto === true,
    style: publicCaptionStyle(validCaptionStyle(p.style) ? p.style : CAPTION_STYLE),
    fontSize: typeof p.fontSize === 'number' && Number.isFinite(p.fontSize) && p.fontSize >= 20 && p.fontSize <= 72 ? p.fontSize : 36,
    position: p.position === 'bottom' ? 'bottom' : 'top',
  };
}
export function loadTranslationPreferences(storage: { getItem(key: string): string | null }): TranslationPreferences {
  try { return parseTranslationPreferences(JSON.parse(storage.getItem(key) ?? 'null')); }
  catch { return parseTranslationPreferences(null); }
}
export function saveTranslationPreferences(storage: { setItem(key: string, value: string): void }, preferences: TranslationPreferences): boolean {
  try { storage.setItem(key, JSON.stringify(parseTranslationPreferences(preferences))); return true; }
  catch { return false; }
}
