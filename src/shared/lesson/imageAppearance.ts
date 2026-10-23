export interface ImageAppearance {
  scale?: number; blur?: number; feather?: number; opacity?: number; background?: string; border?: number;
}
export function isImageAppearance(value: unknown): value is ImageAppearance {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const ranges: Record<string, [number, number]> = { scale: [.25, 3], blur: [0, 40], feather: [0, 100], opacity: [.1, 1], border: [0, 5] };
  return Object.entries(v).every(([key, item]) => key === 'background' ? typeof item === 'string' && /^#[\da-f]{6}$/i.test(item)
    : key in ranges && typeof item === 'number' && Number.isFinite(item) && item >= ranges[key][0] && item <= ranges[key][1]);
}
