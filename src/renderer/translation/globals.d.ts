import type { CaptionApi, TranslationControlApi } from '../../shared/translation';
declare global { interface Window { translationControl: TranslationControlApi; captionApi: CaptionApi } }
export {};
