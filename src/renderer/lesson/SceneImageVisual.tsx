import type { ImageAppearance } from '../../shared/lesson/imageAppearance';
export function SceneImageVisual({ src, appearance = {} }: { src: string; appearance?: ImageAppearance }) {
  return <div data-image-appearance="true" style={{ width: '100%', height: '100%', overflow: 'hidden', boxSizing: 'border-box', background: appearance.background ?? 'transparent', border: appearance.border ? `${appearance.border}px solid #fff` : undefined }}>
    <img src={src} draggable={false} alt="" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', transform: `scale(${appearance.scale ?? 1})`, filter: appearance.blur ? `blur(${appearance.blur}px)` : undefined, opacity: appearance.opacity ?? 1, maskImage: appearance.feather ? `radial-gradient(ellipse at center, #000 ${Math.max(0, 100 - appearance.feather)}%, transparent 100%)` : undefined }} />
  </div>;
}
