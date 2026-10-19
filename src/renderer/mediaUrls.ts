import { visualMediaUrl } from '../shared/visualMedia';
import type { OverlayItem, BubbleTemplate } from '../shared/types';
import { createContext } from 'react';
import { compatibilityMediaUrl } from '../shared/content/mediaResolution';
import type { MediaPathResolver } from '../shared/content/mediaRenderResolution';
/** Standalone previews keep explicit compatibility; App supplies its current scoped lookup. */
export const MediaPathResolverContext = createContext<MediaPathResolver>(compatibilityMediaUrl);
export function toMediaUrl(relativePath: string): string {
  return typeof relativePath === 'string' ? compatibilityMediaUrl(relativePath) ?? '' : '';
}

export function resolvePassiveOverlays(overlays: OverlayItem[], definitions?: BubbleTemplate[], visualScope = '', resolve: (path: string) => string = toMediaUrl): OverlayItem[] {
  return overlays.map(overlay => {
    const custom = definitions?.find(d => `BD_CUSTOM_${d.templateName}` === overlay.bubbleDefId);
    return { ...overlay,
      ...(custom && !overlay.textRect ? { textRect: custom.defaultTextRect } : {}),
      customImageSrc: overlay.customImageSrc ? visualMediaUrl(resolve(overlay.customImageSrc), visualScope) : custom ? visualMediaUrl(resolve(custom.imageSrc), visualScope) : undefined,
    };
  });
}
