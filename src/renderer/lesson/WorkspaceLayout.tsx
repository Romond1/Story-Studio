import { useState, type CSSProperties, type PointerEvent } from 'react';

type Dimensions = { pool: number; inspector: number; timeline: number };
const defaults: Dimensions = { pool: 225, inspector: 330, timeline: 220 };
const bounds = { pool: [160, 420], inspector: [250, 520], timeline: [140, 420] } as const;
const key = 'story-studio.workspace.v1';
const clamp = (name: keyof Dimensions, value: number) => Math.max(bounds[name][0], Math.min(bounds[name][1], value));
export function useWorkspaceLayout() {
  const [sizes, setSizes] = useState<Dimensions>(() => {
    try { const saved = JSON.parse(localStorage.getItem(key) || '{}'); return Object.fromEntries(Object.entries(defaults).map(([name, value]) => [name, typeof saved[name] === 'number' && Number.isFinite(saved[name]) ? clamp(name as keyof Dimensions, saved[name]) : value])) as Dimensions; }
    catch { return defaults; }
  });
  const update = (name: keyof Dimensions, value: number) => setSizes(old => {
    const next = { ...old, [name]: clamp(name, value) };
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Layout remains usable if local storage is unavailable. */ }
    return next;
  });
  const style = Object.fromEntries(Object.entries(sizes).map(([name, value]) => [`--workspace-${name}`, `${value}px`])) as CSSProperties;
  const splitter = (name: keyof Dimensions) => <WorkspaceSplitter key={name} name={name} value={sizes[name]} onChange={value => update(name, value)} onReset={() => update(name, defaults[name])} />;
  return { style, splitter };
}
function WorkspaceSplitter({ name, value, onChange, onReset }: { name: keyof Dimensions; value: number; onChange: (value: number) => void; onReset: () => void }) {
  const [drag, setDrag] = useState<{ coordinate: number; value: number } | null>(null);
  const vertical = name !== 'timeline';
  const end = (event: PointerEvent<HTMLDivElement>) => { setDrag(null); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); };
  return <div className={`lesson-splitter lesson-splitter-${name}`} role="separator" tabIndex={0} aria-label={`Resize ${name === 'pool' ? 'Media Pool' : name}`} aria-orientation={vertical ? 'vertical' : 'horizontal'} aria-valuemin={bounds[name][0]} aria-valuemax={bounds[name][1]} aria-valuenow={Math.round(value)} title="Drag to resize · Double-click to reset · Arrow keys to adjust"
    onDoubleClick={onReset} onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setDrag({ coordinate: vertical ? event.clientX : event.clientY, value }); }}
    onPointerMove={event => { if (drag) onChange(drag.value + ((vertical ? event.clientX : event.clientY) - drag.coordinate) * (name === 'pool' ? 1 : -1)); }}
    onPointerUp={end} onPointerCancel={end} onLostPointerCapture={() => setDrag(null)}
    onKeyDown={event => { if (event.key === 'Home') { event.preventDefault(); onReset(); } else if ((vertical ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown']).includes(event.key)) { event.preventDefault(); onChange(value + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 16 : -16) * (name === 'pool' ? 1 : -1)); } }} />;
}
