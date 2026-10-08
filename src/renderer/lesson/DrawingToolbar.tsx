export type DrawingTool = 'pen' | 'highlighter' | 'eraser';
export function DrawingToolbar({ active, tool, color, size, onActive, onTool, onColor, onSize, onUndo, onRedo, onClear, canUndo, canRedo }: {
  active: boolean; tool: DrawingTool; color: string; size: number; onActive: (value: boolean) => void; onTool: (tool: DrawingTool) => void;
  onColor: (value: string) => void; onSize: (value: number) => void; onUndo: () => void; onRedo: () => void; onClear: () => void; canUndo: boolean; canRedo: boolean;
}) {
  return <div className="lesson-toolbar lesson-drawing-tools" aria-label="Drawing toolbox">
    <button aria-pressed={!active} onClick={() => onActive(false)} title="Middle-mouse drag pans with every tool">Navigate</button>
    {(['pen', 'highlighter', 'eraser'] as const).map(value => <button key={value} aria-pressed={active && tool === value} onClick={() => { onTool(value); onActive(true); }}>{value === 'pen' ? 'Pen' : value === 'highlighter' ? 'Highlighter' : 'Eraser'}</button>)}
    <label>Color<input aria-label="Drawing color" type="color" value={color} onChange={event => onColor(event.target.value)} /></label>
    <label>Brush size<input aria-label="Brush size" type="range" min="1" max="60" value={size} onChange={event => onSize(Number(event.target.value))} /><output>{size}</output></label>
    <button disabled={!canUndo} onClick={onUndo}>Undo drawing</button><button disabled={!canRedo} onClick={onRedo}>Redo drawing</button><button onClick={onClear}>Clear drawing</button>
    <small>Middle-drag to pan · Alt + wheel to zoom</small>
  </div>;
}
