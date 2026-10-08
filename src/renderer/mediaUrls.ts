import { visualMediaUrl } from '../shared/visualMedia';
import type { OverlayItem, BubbleTemplate } from '../shared/types';
export function toMediaUrl(relativePath: string): string {
  if (!relativePath || typeof relativePath !== 'string') return "";
  const normalizedRelative = relativePath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  const encodedRelative = normalizedRelative
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `media://${encodedRelative}`;
}

export function resolvePassiveOverlays(overlays: OverlayItem[], definitions?: BubbleTemplate[], visualScope = ''): OverlayItem[] {
  return overlays.map(overlay => {
    const custom = definitions?.find(d => `BD_CUSTOM_${d.templateName}` === overlay.bubbleDefId);
    return { ...overlay,
      ...(custom && !overlay.textRect ? { textRect: custom.defaultTextRect } : {}),
      customImageSrc: overlay.customImageSrc ? visualMediaUrl(toMediaUrl(overlay.customImageSrc), visualScope) : custom ? visualMediaUrl(toMediaUrl(custom.imageSrc), visualScope) : undefined,
    };
  });
}
