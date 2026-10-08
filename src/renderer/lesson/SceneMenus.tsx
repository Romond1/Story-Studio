import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { EditorSelection, LessonProject, LessonScene } from '../../shared/lesson/model';
import { makeId } from '../../shared/lesson/model';
import { addObject } from '../../shared/lesson/commands';
import { copyCardSnapshot, pasteCard, copyCardToScene, moveCardToScene, type CardClipboardSnapshot } from '../../shared/lesson/cardClipboard';
import type { DrawingTool } from './DrawingToolbar';

interface Props {
  project: LessonProject | null; scene?: LessonScene; selection: EditorSelection; mode: 'edit' | 'teach';
  apply: (project: LessonProject) => void; select: (selection: EditorSelection) => void; setNotice: (text: string) => void; setError: (text: string) => void;
  add: (kind: 'card' | 'bubble' | 'text') => void; duplicate: () => void; remove: () => void;
  navigate: (direction: -1 | 1) => void; reset: () => void; chooseTool: (tool: DrawingTool | 'navigate') => void; importImages: () => Promise<void>;
}
function trapFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab') return;
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select, input, [tabindex="0"]'));
  const index = items.indexOf(document.activeElement as HTMLElement), next = event.shiftKey ? index - 1 : index + 1;
  if (next < 0 || next >= items.length) { event.preventDefault(); items[event.shiftKey ? items.length - 1 : 0]?.focus(); }
}
export function useSceneMenus(p: Props) {
  const [context, setContext] = useState<{ x: number; y: number; objectId: string | null } | null>(null);
  const [clipboard, setClipboard] = useState<CardClipboardSnapshot | null>(null);
  const [transfer, setTransfer] = useState<{ objectId: string; move: boolean } | null>(null);
  const [destination, setDestination] = useState('');
  const [imagePicker, setImagePicker] = useState(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  const close = () => { setContext(null); setTransfer(null); setImagePicker(false); previousFocus.current?.focus(); };
  useEffect(() => { close(); }, [p.mode, p.selection.entryId]);
  useEffect(() => { setClipboard(null); close(); }, [p.project?.id]);
  useEffect(() => { const key = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') close(); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, []);
  const attempt = (work: () => void) => { try { work(); } catch (error) { p.setError(String(error)); } };
  const copy = () => { if (!p.project || !p.scene || !p.selection.objectId) return; setClipboard(copyCardSnapshot(p.project, p.scene.id, p.selection.objectId)); p.setNotice('Card copied. Select a scene and paste with Ctrl+V.'); };
  const paste = () => attempt(() => { if (!p.project || !clipboard || !p.selection.entryId) return; const result = pasteCard(p.project, { sequence: p.selection.sequence, entryId: p.selection.entryId }, clipboard); p.apply(result.project); p.select(result.selection); });
  const dropCard = (objectId: string, entryId: string, move = false) => attempt(() => {
    if (!p.project || !p.scene) return;
    const sequence = (['story', 'activation'] as const).find(kind => p.project!.sequences[kind].some(entry => entry.id === entryId)); if (!sequence) return;
    const result = (move ? moveCardToScene : copyCardToScene)(p.project, p.scene.id, objectId, { sequence, entryId });
    p.apply(result.project); p.select(result.selection); close(); p.setNotice(move ? 'Card moved. Undo restores its source.' : 'Independent Card copied to the destination.');
  });
  const addImage = (assetId: string) => attempt(() => {
    if (!p.project || !p.scene) return;
    const objectId = makeId(); p.apply(addObject(p.project, p.scene.id, { id: objectId, kind: 'image', assetId, visible: true, box: { x: 60, y: 60, width: 400, height: 300 } })); p.select({ ...p.selection, objectId }); close();
  });
  const object = p.scene?.objects.find(item => item.id === p.selection.objectId);
  const action = (work: () => void) => () => { work(); setContext(null); };
  const focus = (node: HTMLDivElement | null) => { node?.querySelector<HTMLElement>('button:not(:disabled), select')?.focus(); };
  const content = <>
    {context && p.project && <><div className="lesson-menu-backdrop" onPointerDown={close} /><div ref={focus} role="menu" aria-label={`${p.mode === 'edit' ? 'Edit' : 'Teach'} context menu`} onKeyDown={trapFocus} className="lesson-context-menu" style={{ left: Math.max(0, Math.min(context.x, window.innerWidth - 245)), top: Math.max(0, Math.min(context.y, window.innerHeight - 470)) }}>
      {p.mode === 'edit' ? <>
        <button role="menuitem" onClick={action(() => p.add('card'))}>Add Card</button><button role="menuitem" onClick={action(() => p.add('bubble'))}>Add Bubble</button><button role="menuitem" onClick={action(() => p.add('text'))}>Add Text</button><button role="menuitem" onClick={action(() => setImagePicker(true))}>Add Image</button>
        {context.objectId && <><button role="menuitem" onClick={action(p.duplicate)}>Duplicate</button><button role="menuitem" onClick={action(p.remove)}>Delete</button></>}
        {object?.kind === 'card' && <><button role="menuitem" onClick={action(copy)}>Copy Card</button><button role="menuitem" onClick={action(() => { setTransfer({ objectId: object.id, move: false }); setDestination(''); })}>Copy to Scene...</button><button role="menuitem" onClick={action(() => { setTransfer({ objectId: object.id, move: true }); setDestination(''); })}>Move to Scene...</button></>}
        <button role="menuitem" disabled={!clipboard} onClick={action(paste)}>Paste Card</button>
      </> : <><button role="menuitem" onClick={action(() => p.navigate(-1))}>Previous scene</button><button role="menuitem" onClick={action(() => p.navigate(1))}>Next scene</button><button role="menuitem" onClick={action(p.reset)}>Reset scene</button></>}
      <button role="menuitem" onClick={action(() => p.chooseTool('navigate'))}>Navigate - middle-drag</button>
      {(['pen', 'highlighter', 'eraser'] as const).map(tool => <button role="menuitem" key={tool} onClick={action(() => p.chooseTool(tool))}>{tool === 'pen' ? 'Pen' : tool === 'highlighter' ? 'Highlighter' : 'Eraser'}</button>)}
    </div></>}
    {transfer && p.project && <div className="lesson-dialog-backdrop"><div ref={focus} role="dialog" aria-modal="true" aria-label="Card destination" onKeyDown={trapFocus} className="lesson-dialog"><h2>{transfer.move ? 'Move' : 'Copy'} Card to Scene</h2><label>Destination scene<select aria-label="Destination scene" value={destination} onChange={event => setDestination(event.target.value)}><option value="">Choose a scene</option>{(['story', 'activation'] as const).flatMap(sequence => p.project!.sequences[sequence].map(entry => <option key={entry.id} value={entry.id}>{sequence === 'story' ? 'Story' : 'Activation'} / {entry.section ? `${entry.section} / ` : ''}{p.project!.scenes[entry.sceneId]?.title}</option>))}</select></label><p>Copied Cards have independent editable content.</p><button disabled={!destination} onClick={() => dropCard(transfer.objectId, destination, transfer.move)}>{transfer.move ? 'Move Card' : 'Copy Card'}</button><button onClick={close}>Cancel</button></div></div>}
    {imagePicker && p.project && <div className="lesson-dialog-backdrop"><div ref={focus} role="dialog" aria-modal="true" aria-label="Add Image" onKeyDown={trapFocus} className="lesson-dialog"><h2>Add Image</h2><p>Choose an image from the Media Pool.</p>{p.project.assets.filter(asset => asset.mediaType === 'image').map(asset => <button key={asset.id} onClick={() => addImage(asset.id)}>{asset.originalName}</button>)}<button onClick={() => void p.importImages()}>Import images</button><button onClick={close}>Cancel</button></div></div>}
  </>;
  return { copy, paste, canPaste: !!clipboard, dropCard, content, openContext: (value: NonNullable<typeof context>) => { previousFocus.current = document.activeElement as HTMLElement; setContext(value); } };
}
