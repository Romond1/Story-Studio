import { useEffect, useRef, useState, type CSSProperties } from 'react';

const clamp = (value: number) => Math.max(.4, Math.min(1.8, Math.round(value * 100) / 100));
const preference = 'story-studio.media-pool-zoom';

/** A local viewing preference, never an authored project change. */
export function useMediaPoolZoom() {
  const ref = useRef<HTMLElement>(null);
  const [zoom, setZoom] = useState(() => {
    try { const value = Number(localStorage.getItem(preference)); return Number.isFinite(value) && value > 0 ? clamp(value) : 1; } catch { return 1; }
  });
  useEffect(() => { try { localStorage.setItem(preference, String(zoom)); } catch { /* Storage may be unavailable. */ } }, [zoom]);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || !event.deltaY || (event.target as HTMLElement).closest('dialog')) return;
      event.preventDefault(); event.stopPropagation();
      setZoom(value => clamp(value - Math.sign(event.deltaY) * .05));
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  }, []);
  return { ref, zoom, setZoom: (value: number) => setZoom(clamp(value)), style: { '--pool-zoom': zoom } as CSSProperties };
}

export function MediaPoolZoom({ zoom, onChange }: { zoom: number; onChange: (value: number) => void }) {
  return <label className="media-pool-zoom" title="Media Pool zoom · Alt + mouse wheel">
    <span aria-hidden="true">Zoom</span><input aria-label="Media Pool zoom" type="range" min=".4" max="1.8" step=".05" value={zoom} onChange={event => onChange(Number(event.target.value))} />
    <output>{Math.round(zoom * 100)}%</output>
  </label>;
}
