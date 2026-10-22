import type { MediaRegistryView } from '../../shared/content/mediaRegistry';
import { Children, cloneElement, isValidElement, useEffect, useId, useState, type ReactElement, type ReactNode } from 'react';
import type { CardDefinition, CardFace, CardSet, CardStyle } from '../../shared/cardsV2';
import type { LessonProject, LessonScene, SceneObject } from '../../shared/lesson/model';
import { BUBBLE_LIBRARY } from '../../shared/bubbleDefs';
import { CARD_V2_PRESETS } from '../../shared/cardV2Render';

export interface SceneInspectorProps {
  registry: MediaRegistryView; project: LessonProject; scene?: LessonScene; object?: SceneObject;
  onSceneChange: (scene: LessonScene) => void;
  onObjectChange: (object: SceneObject) => void;
  onCardChange: (card: CardDefinition) => void;
  onDelete: () => void; onDuplicate: () => void;
  onLayer: (direction: 'up' | 'down') => void;
  onLibrarySave: () => void;
  onLibraryInsert: (cardId: string, linked: boolean) => void;
  onPreviewFace?: (faceId: string) => void;
  onSelectObject?: (objectId: string | null) => void;
  onSaveSet?: (set: CardSet) => void;
  onInsertSet?: (setId: string) => void;
}

function Field({ label, children, quiet = false }: { label: string; children: ReactNode; quiet?: boolean }) {
  const id = useId();
  return <label className={`lesson-field${quiet ? ' lesson-field-quiet' : ''}`}><span id={id}>{label}</span>{Children.map(children, child =>
    isValidElement(child) && typeof child.type === 'string' && ['input', 'textarea', 'select'].includes(child.type)
      ? cloneElement(child as ReactElement<{ 'aria-labelledby'?: string }>, { 'aria-labelledby': id }) : child)}</label>;
}

function NumberField({ label, value, min = 0, max = 10000, step = 1, onChange }: { label: string; value: number; min?: number; max?: number; step?: number; onChange: (value: number) => void }) {
  return <Field label={label}><input type="number" value={Math.round(value * 100) / 100} min={min} max={max} step={step} onChange={event => { const next = event.target.valueAsNumber; if (Number.isFinite(next)) onChange(Math.max(min, Math.min(max, next))); }} /></Field>;
}

function Section({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return <details className="lesson-inspector-section" open={open}><summary>{title}</summary><div>{children}</div></details>;
}

/** Scene and object properties have the same ownership in either sequence. */
export function SceneInspector(p: SceneInspectorProps) {
  const { project, scene, object } = p;
  const [faceId, setFaceId] = useState('');
  const [linkedInsert, setLinkedInsert] = useState(false);
  const [setName, setSetName] = useState('');
  const [setCards, setSetCards] = useState<Set<string>>(new Set());
  const [selectedSetId, setSelectedSetId] = useState('');
  const [setNotice, setSetNotice] = useState('');
  useEffect(() => { setSetName(''); setSetCards(new Set()); setSelectedSetId(''); setSetNotice(''); }, [project.id]);
  const card = object?.kind === 'card' ? project.cards[object.cardId] : undefined;
  const face = card?.faces.find(item => item.id === faceId) ?? card?.faces[0];
  useEffect(() => { setFaceId(''); }, [object?.id, card?.id]);
  useEffect(() => { if (face) p.onPreviewFace?.(face.id); }, [face?.id, object?.id, p.onPreviewFace]);
  const images = p.registry.images();
  const audioAssets = p.registry.list('audio');
  const libraryCards = project.library.map(id => project.cards[id]).filter((item): item is CardDefinition => !!item);
  const selectedSetCards = libraryCards.filter(item => setCards.has(item.id));
  const selectedSet = project.cardSets.find(item => item.id === selectedSetId);
  const saveSet = () => {
    if (!p.onSaveSet || !setName.trim() || !selectedSetCards.length || selectedSetCards.length > 100) return;
    const set: CardSet = { id: crypto.randomUUID(), label: setName.trim().slice(0, 200), tags: [], entries: selectedSetCards.map(item => ({ id: crypto.randomUUID(), cardId: item.id })) };
    p.onSaveSet(set); setSelectedSetId(set.id); setSetName(''); setSetCards(new Set()); setSetNotice(`Saved “${set.label}” with ${set.entries.length} ${set.entries.length === 1 ? 'Card' : 'Cards'}.`);
  };
  const sceneUsage = scene ? Object.values(project.sequences).flat().filter(entry => entry.sceneId === scene.id).length : 0;
  const cardUsage = card ? Object.values(project.scenes).reduce((count, item) => count + item.objects.filter(placement => placement.kind === 'card' && placement.cardId === card.id).length, 0) : 0;
  const title = object ? object.kind === 'card' ? 'Card' : object.kind === 'bubble' ? 'Speech bubble' : object.kind === 'text' ? 'Text' : 'Image' : 'Scene';
  const updateFace = (patch: Partial<CardFace>) => { if (card && face) p.onCardChange({ ...card, faces: card.faces.map(item => item.id === face.id ? { ...item, ...patch } : item) }); };
  const updateStyle = (patch: Partial<CardStyle>) => { if (card) p.onCardChange({ ...card, style: { ...card.style, ...patch } }); };
  const addFace = () => {
    if (!card || card.faces.length >= 32) return;
    const added: CardFace = { id: crypto.randomUUID(), label: card.faces.length === 1 ? 'Answer' : `Face ${card.faces.length + 1}`, layout: 'text', text: '' };
    p.onCardChange({ ...card, faces: [...card.faces, added] }); setFaceId(added.id);
  };
  const removeFace = () => {
    if (!card || !face || card.faces.length <= 1) return;
    const remaining = card.faces.filter(item => item.id !== face.id);
    p.onCardChange({ ...card, faces: remaining }); setFaceId(remaining[0].id);
  };
  const moveFace = (direction: -1 | 1) => {
    if (!card || !face) return;
    const faces = [...card.faces], index = faces.findIndex(item => item.id === face.id), destination = index + direction;
    if (destination < 0 || destination >= faces.length) return;
    [faces[index], faces[destination]] = [faces[destination], faces[index]];
    p.onCardChange({ ...card, faces });
  };
  const frame = (width: number, height: number) => {
    if (!scene) return;
    const xScale = width / scene.frame.width, yScale = height / scene.frame.height;
    p.onSceneChange({ ...scene, frame: { width, height }, objects: scene.objects.map(item => {
      const objectWidth = Math.min(width, Math.max(40, item.box.width * xScale));
      const objectHeight = Math.min(height, Math.max(40, item.box.height * yScale));
      return { ...item, box: { x: Math.min(width - objectWidth, item.box.x * xScale), y: Math.min(height - objectHeight, item.box.y * yScale), width: objectWidth, height: objectHeight } };
    }), drawings: scene.drawings.map(stroke => ({ ...stroke, points: stroke.points.map(point => ({ ...point, x: point.x * xScale, y: point.y * yScale })) })) });
  };
  const library = <Section title="Card Library">
    <p className="lesson-hint">Reuse is optional. Add a Card on the canvas to write something new.</p>
    {object?.kind === 'card' && <button onClick={p.onLibrarySave} disabled={project.library.includes(object.cardId)}>{project.library.includes(object.cardId) ? 'Saved in Library' : 'Save selected Card to Library'}</button>}
    <label className="lesson-check"><input type="checkbox" checked={linkedInsert} onChange={event => setLinkedInsert(event.target.checked)} /> Link face content to the original</label>
    <p className="lesson-hint">{linkedInsert ? 'Face edits update every linked Card. Each placement keeps its own size and position.' : 'An independent copy can be edited without changing the original.'}</p>
    {libraryCards.length ? <Field label="Add Card from Library"><select disabled={!scene} value="" onChange={event => { if (event.target.value) p.onLibraryInsert(event.target.value, linkedInsert); }}><option value="">Choose a Card…</option>{libraryCards.map(item => <option key={item.id} value={item.id}>{item.label || 'Untitled Card'}</option>)}</select></Field> : <p className="lesson-empty">Your saved Cards will appear here.</p>}
    {(p.onSaveSet || p.onInsertSet) && <Section title="Sets and activities">
      <p className="lesson-hint">Collect saved Cards into a reusable Set. Build an activity by placing the Set in any Adventure or Discovery scene.</p>
      {p.onSaveSet && <>
        <Field label="Set name"><input value={setName} maxLength={200} placeholder="For example, Adventure vocabulary" onChange={event => setSetName(event.target.value)} /></Field>
        {libraryCards.length ? <fieldset className="lesson-set-cards"><legend>Choose saved Cards</legend>{libraryCards.map(item => <label key={item.id} className="lesson-check"><input type="checkbox" checked={setCards.has(item.id)} disabled={!setCards.has(item.id) && selectedSetCards.length >= 100} onChange={event => setSetCards(previous => { const next = new Set(previous); event.target.checked ? next.add(item.id) : next.delete(item.id); return next; })} /><span>{item.label || 'Untitled Card'}</span></label>)}</fieldset> : <p className="lesson-empty">Save a Card to the Library first, then include it in a Set.</p>}
        <button disabled={!setName.trim() || !selectedSetCards.length || selectedSetCards.length > 100} onClick={saveSet}>Save Set{selectedSetCards.length ? ` · ${selectedSetCards.length} Cards` : ''}</button>
      </>}
      {setNotice && <p className="lesson-hint" role="status">{setNotice}</p>}
      {p.onInsertSet && <>
        <Field label="Saved Set"><select value={selectedSet?.id ?? ''} onChange={event => { setSelectedSetId(event.target.value); setSetNotice(''); }}><option value="">Choose a Set…</option>{project.cardSets.map(item => <option key={item.id} value={item.id}>{item.label || 'Untitled Set'} · {item.entries.length} Cards</option>)}</select></Field>
        <button disabled={!scene || !selectedSet?.entries.length || selectedSet.entries.some(entry => !project.cards[entry.cardId]) || scene.objects.length + selectedSet.entries.length > 200} onClick={() => { if (selectedSet && scene) { p.onInsertSet?.(selectedSet.id); setSetNotice(`Added “${selectedSet.label}” to this scene as independent Cards.`); } }}>Build activity in this scene</button>
        <p className="lesson-hint">The activity uses ordinary Cards, with independent content. Move, resize, edit, reveal or delete them using the same controls.</p>
        {scene && selectedSet && scene.objects.length + selectedSet.entries.length > 200 && <p className="lesson-error" role="alert">This Set exceeds the scene’s 200-object limit. Choose a smaller Set or a new scene.</p>}
      </>}
    </Section>}
  </Section>;

  return <section className="lesson-inspector" aria-label="Scene Inspector">
    <header className="lesson-panel-heading"><strong>{title} Inspector</strong>{scene && <span className="lesson-muted" title={scene.title}>{scene.title}</span>}</header>
    <div className="lesson-panel-content">
      {!scene ? <><p className="lesson-empty">Select a scene in the timeline, or add one to begin.</p>{library}</> : <>
        {p.onSelectObject && <div className="lesson-object-list" aria-label="Scene objects">
          <button aria-pressed={!object} onClick={() => p.onSelectObject?.(null)}>Scene properties</button>
          {scene.objects.length > 0 && <div role="listbox" aria-label="Select a scene object">{[...scene.objects].reverse().map(item => <button key={item.id} role="option" aria-selected={item.id === object?.id} onClick={() => p.onSelectObject?.(item.id)}>
            <span>{item.kind === 'card' ? project.cards[item.cardId]?.label || 'Card' : item.kind === 'image' ? project.assets.find(asset => asset.id === item.assetId)?.originalName || 'Image' : `${item.kind === 'bubble' ? 'Bubble' : 'Text'} · ${item.text || 'Empty'}`}</span><small>{item.visible ? '' : 'Hidden'}</small>
          </button>)}</div>}
        </div>}
        {sceneUsage > 1 && <p className="lesson-sharing">Shared scene · {sceneUsage} sequence entries. Changes here update each use. Use Duplicate scene for an independent copy.</p>}
        {object && <div className="lesson-object-actions"><button onClick={p.onDuplicate}>Duplicate</button><button className="lesson-danger" onClick={p.onDelete}>Delete {title.toLowerCase()}</button></div>}

        {object?.kind === 'card' && card && face && <>
          {cardUsage > 1 && <p className="lesson-sharing">Linked Card · {cardUsage} placements share its faces and appearance. Position and visibility belong to this scene. Duplicate creates independent content.</p>}
          <Field label="Card name"><input value={card.label} maxLength={200} onChange={event => p.onCardChange({ ...card, label: event.target.value })} /></Field>
          <div className="lesson-subheading"><strong>Faces</strong><button disabled={card.faces.length >= 32} onClick={addFace}>+ Add face</button></div>
          <div className="lesson-face-tabs" role="tablist" aria-label="Card faces">{card.faces.map(item => <button key={item.id} role="tab" aria-selected={item.id === face.id} onClick={() => setFaceId(item.id)}>{item.label || 'Untitled face'}</button>)}</div>
          <Field label="Face name"><input maxLength={200} value={face.label} onChange={event => updateFace({ label: event.target.value })} /></Field>
          {face.layout !== 'image-only' && <Field label="Card text"><textarea rows={5} placeholder="Type a question, answer or hint…" maxLength={20000} value={face.text ?? ''} onChange={event => updateFace({ text: event.target.value })} /></Field>}
          <Field label="Face layout"><select value={face.layout} onChange={event => updateFace({ layout: event.target.value as CardFace['layout'] })}><option value="text">Text</option><option value="image-only">Image</option><option value="image-text">Image and text</option><option value="image-prompt">Image and prompt</option><option value="text-support">Text and supporting text</option></select></Field>
          {face.layout.startsWith('image') && <><Field label="Face image"><select value={face.imageAssetId ?? ''} onChange={event => updateFace({ imageAssetId: event.target.value || undefined })}><option value="">Choose image from Media Pool…</option>{images.map(asset => <option key={asset.id} value={asset.id}>{asset.label}</option>)}</select></Field><Field label="Image description"><input value={face.alt ?? ''} maxLength={20000} onChange={event => updateFace({ alt: event.target.value })} /></Field>{!images.length && <p className="lesson-hint">Import an image in the Media Pool to use it on this face.</p>}</>}
          {face.layout === 'text-support' && <Field label="Supporting text"><textarea rows={3} maxLength={20000} value={face.supportingText ?? ''} onChange={event => updateFace({ supportingText: event.target.value })} /></Field>}
          <div className="lesson-actions"><button disabled={card.faces[0].id === face.id} onClick={() => moveFace(-1)}>Face earlier</button><button disabled={card.faces[card.faces.length - 1].id === face.id} onClick={() => moveFace(1)}>Face later</button><button disabled={card.faces.length >= 32} onClick={() => { const added = { ...face, id: crypto.randomUUID(), label: `${face.label.slice(0, 190)} copy` }; p.onCardChange({ ...card, faces: [...card.faces, added] }); setFaceId(added.id); }}>Duplicate face</button><button disabled={card.faces.length === 1} onClick={removeFace}>Delete face</button></div>
          <Section title="Card appearance">
            <div className="lesson-field-grid"><Field label="Style"><select value={card.style.preset} onChange={event => updateStyle({ preset: event.target.value as CardStyle['preset'] })}>{Object.keys(CARD_V2_PRESETS).map(preset => <option key={preset} value={preset}>{preset.replaceAll('-', ' ')}</option>)}</select></Field><Field label="Text fitting"><select value={card.style.fit ?? 'auto'} onChange={event => updateStyle({ fit: event.target.value as CardStyle['fit'] })}><option value="auto">Automatic</option><option value="manual">Fixed font size</option></select></Field><Field label="Alignment"><select value={card.style.align ?? 'center'} onChange={event => updateStyle({ align: event.target.value as CardStyle['align'] })}><option value="center">Center</option><option value="left">Left</option></select></Field><Field label="Emphasis"><select value={face.emphasis ?? 'normal'} onChange={event => updateFace({ emphasis: event.target.value as CardFace['emphasis'] })}><option value="normal">Regular</option><option value="bold">Bold</option><option value="italic">Italic</option></select></Field>
              {card.style.fit === 'manual' ? <NumberField label="Font size" value={card.style.fontSize ?? 32} min={8} max={160} onChange={value => updateStyle({ fontSize: value })} /> : <><NumberField label="Minimum font size" value={card.style.minFontSize ?? 18} min={8} max={card.style.maxFontSize ?? 52} onChange={value => updateStyle({ minFontSize: value })} /><NumberField label="Maximum font size" value={card.style.maxFontSize ?? 52} min={card.style.minFontSize ?? 18} max={160} onChange={value => updateStyle({ maxFontSize: value })} /></>}
              <NumberField label="Padding" value={card.style.padding ?? 20} max={80} onChange={value => updateStyle({ padding: value })} /><NumberField label="Corner radius" value={card.style.radius ?? 16} max={80} onChange={value => updateStyle({ radius: value })} /><Field label="Accent color"><input type="color" value={card.style.accent ?? '#2673cc'} onChange={event => updateStyle({ accent: event.target.value })} /></Field>
            </div>
          </Section>
          <Section title="Presentation" open>
            <Field label="Initial face"><select value={object.initialFaceId} onChange={event => p.onObjectChange({ ...object, initialFaceId: event.target.value })}>{card.faces.map(item => <option key={item.id} value={item.id}>{item.label || 'Untitled face'}</option>)}</select></Field>
            <Field label="Card interaction"><select value={object.interaction} onChange={event => p.onObjectChange({ ...object, interaction: event.target.value as typeof object.interaction })}><option value="cycle">Click to move to next face</option><option value="reveal">Click to conceal or reveal</option><option value="manual">Use teacher face controls</option></select></Field>
            <label className="lesson-check"><input type="checkbox" checked={object.initiallyConcealed} onChange={event => p.onObjectChange({ ...object, initiallyConcealed: event.target.checked })} /> Start concealed</label>
            <p className="lesson-hint">Teach controls can show any named face. Each new visit starts from the initial face.</p>
          </Section>
        </>}
        {object?.kind === 'card' && !card && <p className="lesson-error" role="alert">This Card’s content is missing. Delete the placement and add a new Card.</p>}

        {(object?.kind === 'text' || object?.kind === 'bubble') && <>
          <Field label={object.kind === 'bubble' ? 'Bubble text' : 'Text'}><textarea rows={6} maxLength={20000} value={object.text} onChange={event => p.onObjectChange({ ...object, text: event.target.value })} /></Field>
          {object.kind === 'bubble' && <Field label="Bubble style"><select value={object.bubbleDefId ?? 'BD_CLASSIC'} onChange={event => p.onObjectChange({ ...object, bubbleDefId: event.target.value })}>{BUBBLE_LIBRARY.filter(definition => definition.type !== 'text').map(definition => <option key={definition.bubbleDefId} value={definition.bubbleDefId}>{definition.name}</option>)}</select></Field>}
          <div className="lesson-field-grid"><NumberField label="Font size" value={object.fontSize} min={8} max={160} onChange={value => p.onObjectChange({ ...object, fontSize: value })} /><Field label="Text color"><input type="color" value={object.color} onChange={event => p.onObjectChange({ ...object, color: event.target.value })} /></Field><Field label="Text alignment"><select value={object.align} onChange={event => p.onObjectChange({ ...object, align: event.target.value as typeof object.align })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></Field></div>
        </>}
        {object?.kind === 'image' && <Field label="Image"><select value={object.assetId} onChange={event => p.onObjectChange({ ...object, assetId: event.target.value })}>{images.map(asset => <option key={asset.id} value={asset.id}>{asset.label}</option>)}</select></Field>}

        {object && <Section title="Position and layer" open>
          <div className="lesson-field-grid">{(['x', 'y', 'width', 'height'] as const).map(key => <NumberField key={key} label={{ x: 'Left', y: 'Top', width: 'Width', height: 'Height' }[key]} value={object.box[key]} min={key === 'width' || key === 'height' ? 40 : 0} max={key === 'x' ? Math.max(0, scene.frame.width - object.box.width) : key === 'y' ? Math.max(0, scene.frame.height - object.box.height) : key === 'width' ? scene.frame.width - object.box.x : scene.frame.height - object.box.y} onChange={value => p.onObjectChange({ ...object, box: { ...object.box, [key]: value } })} />)}</div>
          <label className="lesson-check"><input type="checkbox" checked={object.visible} onChange={event => p.onObjectChange({ ...object, visible: event.target.checked })} /> Visible in lesson</label>
          <div className="lesson-actions"><button disabled={scene.objects[0]?.id === object.id} onClick={() => p.onLayer('down')}>Layer down</button><button disabled={scene.objects[scene.objects.length - 1]?.id === object.id} onClick={() => p.onLayer('up')}>Layer up</button></div>
        </Section>}

        {!object && <>
          <Field label="Scene title" quiet><input maxLength={200} value={scene.title} onChange={event => p.onSceneChange({ ...scene, title: event.target.value })} /></Field>
          <Field label="Background media" quiet><select value={scene.background.assetId ?? ''} onChange={event => { const { videoTrim: _trim, ...background } = scene.background; p.onSceneChange({ ...scene, background: { ...background, assetId: event.target.value || undefined } }); }}><option value="">Color only</option>{[...images, ...p.registry.list('video').map(asset => ({ id: asset.id, label: asset.originalName || asset.filename, mediaType: asset.mediaType }))].map(asset => <option key={asset.id} value={asset.id}>{asset.label} · {asset.mediaType}</option>)}</select></Field>
          <Field label="Background color"><input type="color" value={scene.background.color} onChange={event => p.onSceneChange({ ...scene, background: { ...scene.background, color: event.target.value } })} /></Field>
          <Section title="Canvas size">
            <Field label="Canvas preset"><select value={`${scene.frame.width}x${scene.frame.height}`} onChange={event => { const [width, height] = event.target.value.split('x').map(Number); frame(width, height); }}><option value={`${scene.frame.width}x${scene.frame.height}`}>Current · {scene.frame.width} × {scene.frame.height}</option><option value="1280x720">Wide · 16:9</option><option value="1024x768">Standard · 4:3</option><option value="900x1200">Portrait · 3:4</option><option value="1080x1080">Square · 1:1</option></select></Field>
            <div className="lesson-field-grid"><NumberField label="Canvas width" value={scene.frame.width} min={320} max={10000} onChange={value => frame(value, scene.frame.height)} /><NumberField label="Canvas height" value={scene.frame.height} min={240} max={10000} onChange={value => frame(scene.frame.width, value)} /></div><p className="lesson-hint">All views use this canvas. Changing its size scales the object positions with it.</p>
          </Section>
          <Section title="Transition">
            <Field label="Scene transition"><select value={scene.transition.kind} onChange={event => p.onSceneChange({ ...scene, transition: { ...scene.transition, kind: event.target.value as 'none' | 'fade' } })}><option value="none">None</option><option value="fade">Fade</option></select></Field>
            {scene.transition.kind === 'fade' && <NumberField label="Duration (milliseconds)" value={scene.transition.durationMs} min={0} max={5000} step={50} onChange={value => p.onSceneChange({ ...scene, transition: { ...scene.transition, durationMs: value } })} />}
          </Section>
          <Section title={`Audio${scene.audio.length ? ` · ${scene.audio.length}` : ''}`} open={scene.audio.length > 0}>
            <Field label="Add scene audio"><select value="" onChange={event => { if (event.target.value) p.onSceneChange({ ...scene, audio: [...scene.audio, { id: crypto.randomUUID(), assetId: event.target.value, volume: 1, loop: false, autoplay: false }] }); }}><option value="">Choose from Media Pool…</option>{audioAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.originalName || asset.filename}</option>)}</select></Field>
            {!audioAssets.length && <p className="lesson-hint">Import audio in the Media Pool, then attach it here.</p>}
            {scene.audio.map(audio => <fieldset key={audio.id} className="lesson-audio-item"><legend>{audioAssets.find(asset => asset.id === audio.assetId)?.originalName || 'Scene audio'}</legend><Field label="Volume"><input type="range" min="0" max="1" step=".05" value={audio.volume} onChange={event => p.onSceneChange({ ...scene, audio: scene.audio.map(item => item.id === audio.id ? { ...item, volume: Number(event.target.value) } : item) })} /></Field><label className="lesson-check"><input type="checkbox" checked={audio.loop} onChange={event => p.onSceneChange({ ...scene, audio: scene.audio.map(item => item.id === audio.id ? { ...item, loop: event.target.checked } : item) })} /> Loop</label><label className="lesson-check"><input type="checkbox" checked={audio.autoplay} onChange={event => p.onSceneChange({ ...scene, audio: scene.audio.map(item => item.id === audio.id ? { ...item, autoplay: event.target.checked } : item) })} /> Play when scene starts</label><button onClick={() => p.onSceneChange({ ...scene, audio: scene.audio.filter(item => item.id !== audio.id) })}>Remove audio</button></fieldset>)}
            <p className="lesson-hint">Audio stops when you move to another scene.</p>
          </Section>
          <Section title="Teacher notes"><Field label="Private notes"><textarea rows={5} value={scene.notes} maxLength={20000} onChange={event => p.onSceneChange({ ...scene, notes: event.target.value })} /></Field><p className="lesson-hint">These notes stay in the teacher workspace.</p></Section>
        </>}
        {library}
      </>}
    </div>
  </section>;
}
