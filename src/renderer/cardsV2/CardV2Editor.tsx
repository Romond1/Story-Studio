import { Children, cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Rnd } from 'react-rnd';
import type { AssetItem } from '../../shared/types';
import { createCardsV2, createCard, createActivity, duplicateCard, duplicateSet, duplicatePlacement, removeCardFace, cardUsageCount, validateCardsV2, type CardsV2Module, type CardDefinition, type CardFace, type CardStyle, type CardTemplate, type CardSet, type CardActivity, type CardInstance, type CardGeometry } from '../../shared/cardsV2';
import { buildCardV2RenderPlan, buildCardV2FacePlan, CARD_V2_DEFAULT_SIZES, CARD_V2_PRESETS } from '../../shared/cardV2Render';
import { CardV2Scene } from './CardV2Scene';
import './cardV2Editor.css';

interface Props {
  module?: CardsV2Module;
  onChange: (module: CardsV2Module) => void;
  assets: AssetItem[];
  resolveImageUrl?: (assetId: string) => string | undefined;
  onAddToBooster?: (placementId: string) => void;
  onClose?: () => void;
  initialPlacementId?: string;
}
const newId = () => crypto.randomUUID();
const templates: [CardTemplate, string][] = [['text', 'Text card'], ['image-text', 'Image + text'], ['picture-recall', 'Picture recall'], ['question-answer-explanation', 'Question / Answer / Explanation'], ['vocabulary', 'Vocabulary']];
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const tags = (value: string) => [...new Set(value.split(',').map(s => s.trim()).filter(Boolean))];
function Field({ label, children }: { label: string; children: ReactNode }) {
  const labelId = useId();
  return <label className="cv2-field"><span id={labelId}>{label}</span>{Children.map(children, child =>
    isValidElement(child) && typeof child.type === 'string' && ['input', 'select', 'textarea'].includes(child.type)
      ? cloneElement(child as ReactElement<{ 'aria-labelledby'?: string }>, { 'aria-labelledby': labelId })
      : child
  )}</label>;
}
function NumberField({ label, value, min = 0, max = 4096, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (n: number) => void }) {
  return <Field label={label}><input type="number" value={value} min={min} max={max} onChange={e => { if (e.target.value !== '' && Number.isFinite(e.target.valueAsNumber)) onChange(Math.max(min, Math.min(max, e.target.valueAsNumber))); }} /></Field>;
}
function move<T>(items: T[], index: number, delta: number): T[] { const next = [...items]; const dest = index + delta; if (dest < 0 || dest >= next.length) return items; [next[index], next[dest]] = [next[dest], next[index]]; return next; }

/** Opening the library is read-only; the optional module is created only by an authoring action. */
export function CardV2Editor({ module, onChange, assets, resolveImageUrl, onAddToBooster, onClose, initialPlacementId }: Props) {
  const [tab, setTab] = useState<'cards' | 'sets' | 'activities'>(initialPlacementId ? 'activities' : 'cards');
  const [selectedCard, setSelectedCard] = useState('');
  const [selectedSet, setSelectedSet] = useState('');
  const [selectedPlacement, setSelectedPlacement] = useState(initialPlacementId ?? '');
  const [selectedFace, setSelectedFace] = useState('');
  const [selectedInstance, setSelectedInstance] = useState('');
  const [search, setSearch] = useState('');
  const [template, setTemplate] = useState<CardTemplate>('question-answer-explanation');
  const [notice, setNotice] = useState('');
  const [customFrame, setCustomFrame] = useState(false);
  const invalid = module ? validateCardsV2(module) : [];
  const data = module && !invalid.length ? module : createCardsV2();
  const card = data.cards[selectedCard] ?? Object.values(data.cards)[0];
  const face = card?.faces.find(f => f.id === selectedFace) ?? card?.faces[0];
  const set = data.sets[selectedSet] ?? Object.values(data.sets)[0];
  const placement = data.placements[selectedPlacement] ?? Object.values(data.placements)[0];
  const activity = placement && data.activities[placement.activityId];
  const instance = activity?.instances.find(i => i.id === selectedInstance) ?? activity?.instances[0];
  const emit = (edit: (next: CardsV2Module) => void) => {
    const next = clone(data); edit(next);
    const errors = validateCardsV2(next);
    if (errors.length) { setNotice('Change not applied. Check the card library limits, face references and layout bounds.'); return; }
    onChange(next); setNotice('');
  };
  const updateCard = (patch: Partial<CardDefinition>) => card && emit(next => { Object.assign(next.cards[card.id], patch); });
  const updateFace = (patch: Partial<CardFace>) => card && face && updateCard({ faces: card.faces.map(f => f.id === face.id ? { ...f, ...patch } : f) });
  const updateStyle = (patch: Partial<CardStyle>) => card && updateCard({ style: { ...card.style, ...patch } });
  const updateSet = (patch: Partial<CardSet>) => set && emit(next => { Object.assign(next.sets[set.id], patch); });
  const updateActivity = (patch: Partial<CardActivity>) => activity && emit(next => { Object.assign(next.activities[activity.id], patch); });
  const updateInstance = (patch: Partial<CardInstance>) => instance && activity && updateActivity({ instances: activity.instances.map(i => i.id === instance.id ? { ...i, ...patch } : i) });
  const addCard = () => { const item = createCard(template, newId); emit(next => { next.cards[item.id] = item; }); setSelectedCard(item.id); setSelectedFace(item.faces[0].id); setTab('cards'); };
  const copyCard = () => { if (!card) return; const copy = duplicateCard(data, card.id, newId); emit(next => { next.cards[copy.id] = copy; }); setSelectedCard(copy.id); setSelectedFace(copy.faces[0].id); };
  const addSet = () => { const item: CardSet = { id: newId(), label: 'New card set', tags: [], entries: [] }; emit(next => { next.sets[item.id] = item; }); setSelectedSet(item.id); setTab('sets'); };
  const addActivity = (setId: string) => {
    const item = createActivity(data, setId, newId);
    const place = { id: newId(), activityId: item.id, label: item.label };
    emit(next => { next.activities[item.id] = item; next.placements[place.id] = place; });
    setSelectedPlacement(place.id); setSelectedInstance(''); setTab('activities');
  };
  const filter = (label: string, itemTags: string[] = []) => `${label} ${itemTags.join(' ')}`.toLowerCase().includes(search.toLowerCase());
  if (invalid.length) return <section className="cv2-editor"><header><h2>Cards & Sets</h2>{onClose && <button onClick={onClose}>Close</button>}</header><p role="alert">This card library has an unsupported version or invalid content and cannot be edited safely.</p><p>The original data has been kept unchanged.</p></section>;
  return <section className="cv2-editor" aria-label="Cards and Sets library">
    <header className="cv2-heading"><div><h2>Cards & Sets</h2><p>Reusable learning content · independent activities</p></div>{onClose && <button onClick={onClose}>Close</button>}</header>
    <div className="cv2-tabs" role="tablist" aria-label="Card library sections">{(['cards', 'sets', 'activities'] as const).map(t => <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setSearch(''); }}>{t === 'cards' ? 'Cards' : t === 'sets' ? 'Sets' : 'Activities'}</button>)}</div>
    {notice && <p className="cv2-notice" role="status">{notice}</p>}
    <div className="cv2-columns">
      <aside className="cv2-library">
        <Field label="Search names or tags"><input type="search" placeholder="Search this library" value={search} onChange={e => setSearch(e.target.value)} /></Field>
        {tab === 'cards' && <><Field label="Starter template"><select value={template} onChange={e => setTemplate(e.target.value as CardTemplate)}>{templates.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field><button className="cv2-primary" onClick={addCard}>+ Create card</button>{Object.values(data.cards).filter(c => filter(c.label, c.tags)).map(c => <button className="cv2-library-item" aria-pressed={card?.id === c.id} key={c.id} onClick={() => { setSelectedCard(c.id); setSelectedFace(''); }}><strong>{c.label || 'Untitled card'}</strong><small>{c.faces.length} {c.faces.length === 1 ? 'face' : 'faces'}{c.tags.length > 0 && ` · ${c.tags.join(', ')}`}</small></button>)}</>}
        {tab === 'sets' && <><button className="cv2-primary" onClick={addSet}>+ Create set</button>{Object.values(data.sets).filter(s => filter(s.label, s.tags)).map(s => <button className="cv2-library-item" aria-pressed={set?.id === s.id} key={s.id} onClick={() => setSelectedSet(s.id)}><strong>{s.label || 'Untitled set'}</strong><small>{s.entries.length} cards · {s.tags.join(', ')}</small></button>)}</>}
        {tab === 'activities' && <>{Object.values(data.placements).filter(p => filter(p.label)).map(p => <button className="cv2-library-item" aria-pressed={placement?.id === p.id} key={p.id} onClick={() => { setSelectedPlacement(p.id); setSelectedInstance(''); setCustomFrame(false); }}><strong>{p.label || 'Untitled activity'}</strong><small>Recall & Reveal</small></button>)}<p className="cv2-muted">Create an activity from a Set. Each activity gets its own card instances.</p><button onClick={() => setTab('sets')}>Choose a Set</button></>}
      </aside>
      <main className="cv2-detail">
        {tab === 'cards' && (!card ? <div className="cv2-empty"><h3>Your first multi-face card</h3><p>Choose a template and create a card. Add it to a Set, then use that Set in Recall & Reveal.</p><button onClick={addCard}>Create first card</button></div> : <>
          <div className="cv2-actions"><h3>Card content</h3><button onClick={copyCard}>Duplicate and edit</button></div>
          <p className="cv2-sharing">Used in {cardUsageCount(data, card.id)} places. Editing updates shared content. Duplicate to edit independently.</p>
          <div className="cv2-grid"><Field label="Card label"><input maxLength={200} value={card.label} onChange={e => updateCard({ label: e.target.value })} /></Field><Field label="Tags (comma separated)"><input key={`card-tags-${card.id}`} defaultValue={card.tags.join(', ')} onBlur={e => updateCard({ tags: tags(e.target.value) })} /></Field></div>
          <div className="cv2-actions"><h4>Faces</h4><button disabled={card.faces.length >= 32} onClick={() => { const added: CardFace = { id: newId(), label: `Face ${card.faces.length + 1}`, layout: 'text', text: '' }; updateCard({ faces: [...card.faces, added] }); setSelectedFace(added.id); }}>+ Add face</button></div>
          <div className="cv2-faces">{card.faces.map(f => <button key={f.id} aria-pressed={face?.id === f.id} onClick={() => setSelectedFace(f.id)}>{f.label || 'Untitled face'}</button>)}</div>
          {face && <>
            <div className="cv2-grid"><Field label="Face label"><input maxLength={200} value={face.label} onChange={e => updateFace({ label: e.target.value })} /></Field><Field label="Content layout"><select value={face.layout} onChange={e => updateFace({ layout: e.target.value as CardFace['layout'] })}><option value="text">Text</option><option value="image-only">Image only</option><option value="image-text">Image + text</option><option value="image-prompt">Image + prompt</option><option value="text-support">Main + supporting text</option></select></Field></div>
            <div className="cv2-actions cv2-face-tools"><button disabled={card.faces[0].id === face.id} onClick={() => updateCard({ faces: move(card.faces, card.faces.indexOf(face), -1) })}>Move earlier</button><button disabled={card.faces.at(-1)?.id === face.id} onClick={() => updateCard({ faces: move(card.faces, card.faces.indexOf(face), 1) })}>Move later</button><button disabled={card.faces.length >= 32} onClick={() => { const copy = { ...clone(face), id: newId(), label: `${face.label.slice(0, 195)} copy` }; updateCard({ faces: [...card.faces, copy] }); setSelectedFace(copy.id); }}>Duplicate face</button><button disabled={card.faces.length === 1} onClick={() => { const next = clone(data); if (!removeCardFace(next, card.id, face.id)) { setNotice('This face is used as an initial or reveal face. Change those activity references before deleting it.'); return; } onChange(next); setSelectedFace(''); setNotice(''); }}>Delete face</button></div>
            {face.layout !== 'image-only' && <Field label={face.layout === 'image-prompt' ? 'Prompt' : 'Main text'}><textarea rows={4} value={face.text ?? ''} onChange={e => updateFace({ text: e.target.value })} placeholder="Type learning content in any language" /></Field>}
            {face.layout === 'text-support' && <Field label="Supporting text"><textarea rows={3} value={face.supportingText ?? ''} onChange={e => updateFace({ supportingText: e.target.value })} /></Field>}
            {face.layout.startsWith('image') && <div className="cv2-grid"><Field label="Image asset"><select value={face.imageAssetId ?? ''} onChange={e => updateFace({ imageAssetId: e.target.value || undefined })}><option value="">Choose an imported image</option>{assets.filter(a => a.mediaType === 'image').map(a => <option key={a.id} value={a.id}>{a.originalName || a.filename}</option>)}</select>{!assets.some(a => a.mediaType === 'image') && <small>Import images into the project first.</small>}</Field><Field label="Image description (alt text)"><input value={face.alt ?? ''} onChange={e => updateFace({ alt: e.target.value })} /></Field></div>}
            <Field label="Text emphasis"><select value={face.emphasis ?? 'normal'} onChange={e => updateFace({ emphasis: e.target.value as CardFace['emphasis'] })}><option value="normal">Normal</option><option value="bold">Bold</option><option value="italic">Italic</option></select></Field>
            <details className="cv2-section" open><summary>Appearance & text fitting</summary><div className="cv2-grid">
              <Field label="Style preset"><select value={card.style.preset} onChange={e => updateStyle({ preset: e.target.value as CardStyle['preset'] })}><option value="classroom">Clear classroom</option><option value="dark">Dark</option><option value="high-contrast">High contrast</option><option value="image-focus">Image focus</option><option value="sentence-strip">Sentence strip</option></select></Field>
              <Field label="Shape"><select value={card.style.shape ?? 'landscape'} onChange={e => updateStyle({ shape: e.target.value as CardStyle['shape'] })}>{['landscape', 'portrait', 'square', 'strip', 'pill'].map(s => <option key={s}>{s}</option>)}</select></Field>
              <Field label="Text fitting"><select value={card.style.fit ?? 'auto'} onChange={e => updateStyle({ fit: e.target.value as 'auto' | 'manual' })}><option value="auto">Automatic</option><option value="manual">Manual size</option></select></Field>
              <Field label="Alignment"><select value={card.style.align ?? 'center'} onChange={e => updateStyle({ align: e.target.value as 'left' | 'center' })}><option value="center">Centered</option><option value="left">Left</option></select></Field>
              <NumberField label="Minimum font size" value={card.style.minFontSize ?? 18} min={8} max={card.style.maxFontSize ?? 48} onChange={n => updateStyle({ minFontSize: n })} />
              <NumberField label="Maximum font size" value={card.style.maxFontSize ?? 48} min={card.style.minFontSize ?? 18} max={160} onChange={n => updateStyle({ maxFontSize: n })} />
              {card.style.fit === 'manual' && <NumberField label="Manual font size" value={card.style.fontSize ?? 32} min={8} max={160} onChange={n => updateStyle({ fontSize: n })} />}
              <Field label="Vertical alignment"><select value={card.style.verticalAlign ?? 'center'} onChange={e => updateStyle({ verticalAlign: e.target.value as 'top' | 'center' })}><option value="center">Middle</option><option value="top">Top</option></select></Field>
              <NumberField label="Padding" value={card.style.padding ?? CARD_V2_PRESETS[card.style.preset].padding} max={80} onChange={n => updateStyle({ padding: n })} />
              <NumberField label="Corner radius" value={card.style.radius ?? CARD_V2_PRESETS[card.style.preset].radius} max={80} onChange={n => updateStyle({ radius: n })} />
              <NumberField label="Border width" value={card.style.borderWidth ?? CARD_V2_PRESETS[card.style.preset].borderWidth} max={12} onChange={n => updateStyle({ borderWidth: n })} />
              <Field label="Accent"><input type="color" value={card.style.accent ?? CARD_V2_PRESETS[card.style.preset].accent} onChange={e => updateStyle({ accent: e.target.value })} /></Field>
            </div></details>
            <h4>Face preview</h4><FacePreview card={card} face={face} resolveImageUrl={resolveImageUrl} />
          </>}
          <div className="cv2-actions"><button onClick={() => { const item: CardSet = { id: newId(), label: `${card.label.slice(0, 196)} set`, tags: [...card.tags], entries: [{ id: newId(), cardId: card.id }] }; emit(next => { next.sets[item.id] = item; }); setSelectedSet(item.id); setTab('sets'); }}>Create Set with this card</button><Field label="Add to an existing Set"><select value="" onChange={e => { const target = e.target.value; if (target) emit(next => { next.sets[target].entries.push({ id: newId(), cardId: card.id }); }); }}><option value="">Choose Set…</option>{Object.values(data.sets).map(s => <option value={s.id} key={s.id}>{s.label}</option>)}</select></Field></div>
        </>)}
        {tab === 'sets' && (!set ? <div className="cv2-empty"><h3>Organize cards into Sets</h3><p>Reuse the same ordered Set in different activities. Each activity starts with independent state.</p><button onClick={addSet}>Create first Set</button></div> : <>
          <div className="cv2-actions"><h3>Card Set</h3><button onClick={() => { const copy = duplicateSet(data, set.id, newId); emit(next => { next.sets[copy.id] = copy; }); setSelectedSet(copy.id); }}>Duplicate Set</button></div>
          <div className="cv2-grid"><Field label="Set label"><input maxLength={200} value={set.label} onChange={e => updateSet({ label: e.target.value })} /></Field><Field label="Tags (comma separated)"><input key={`set-tags-${set.id}`} defaultValue={set.tags.join(', ')} onBlur={e => updateSet({ tags: tags(e.target.value) })} /></Field></div>
          <p className="cv2-muted">Entries link to shared cards. Activity creation copies this order into new instances; later Set edits do not rearrange existing activities.</p>
          <ol className="cv2-entries">{set.entries.map((entry, index) => <li key={entry.id}><strong>{data.cards[entry.cardId]?.label ?? 'Missing card'}</strong><div className="cv2-actions"><button onClick={() => { setSelectedCard(entry.cardId); setTab('cards'); }}>Edit shared card</button><button disabled={index === 0} aria-label={`Move ${data.cards[entry.cardId]?.label} earlier`} onClick={() => updateSet({ entries: move(set.entries, index, -1) })}>↑</button><button disabled={index === set.entries.length - 1} aria-label={`Move ${data.cards[entry.cardId]?.label} later`} onClick={() => updateSet({ entries: move(set.entries, index, 1) })}>↓</button><button onClick={() => updateSet({ entries: set.entries.filter(e => e.id !== entry.id) })}>Remove</button></div></li>)}</ol>
          <Field label="Add existing card"><select value="" onChange={e => { if (e.target.value) updateSet({ entries: [...set.entries, { id: newId(), cardId: e.target.value }] }); }}><option value="">Choose a card…</option>{Object.values(data.cards).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>
          {!Object.keys(data.cards).length && <button onClick={() => setTab('cards')}>Create cards first</button>}
          <button className="cv2-primary" disabled={!set.entries.length} onClick={() => addActivity(set.id)}>Create Recall & Reveal activity</button>
        </>)}
        {tab === 'activities' && (!activity || !placement ? <div className="cv2-empty"><h3>Recall & Reveal</h3><p>Create a Set of cards, then turn it into an activity. Arrange cards and choose which faces to show and reveal.</p><button onClick={() => setTab('sets')}>Choose a Set</button></div> : <>
          <div className="cv2-actions"><h3>Recall & Reveal</h3><button onClick={() => { const copy = duplicatePlacement(data, placement.id, newId); emit(next => { next.activities[copy.activity.id] = copy.activity; next.placements[copy.placement.id] = copy.placement; }); setSelectedPlacement(copy.placement.id); setSelectedInstance(''); }}>Duplicate activity placement</button>{onAddToBooster && <button className="cv2-primary" onClick={() => onAddToBooster(placement.id)}>Add to booster</button>}</div>
          <Field label="Activity label"><input maxLength={200} value={placement.label} onChange={e => emit(next => { next.placements[placement.id].label = e.target.value; next.activities[activity.id].label = e.target.value; })} /></Field>
          <div className="cv2-grid"><Field label="Logical activity frame"><select value={customFrame ? 'custom' : activity.frame.width === 1280 && activity.frame.height === 720 ? 'landscape' : activity.frame.width === 960 && activity.frame.height === 720 ? 'standard' : activity.frame.width === 720 && activity.frame.height === 1280 ? 'portrait' : 'custom'} onChange={e => { setCustomFrame(e.target.value === 'custom'); if (e.target.value === 'custom') return; const frame = e.target.value === 'landscape' ? { width: 1280, height: 720 } : e.target.value === 'standard' ? { width: 960, height: 720 } : e.target.value === 'portrait' ? { width: 720, height: 1280 } : activity.frame; updateActivity(resizeFrame(activity, frame)); }}><option value="landscape">Landscape · 1280 × 720</option><option value="standard">4:3 · 960 × 720</option><option value="portrait">Portrait · 720 × 1280</option><option value="custom">Custom frame</option></select></Field><NumberField label="Frame width" value={activity.frame.width} min={320} onChange={width => updateActivity(resizeFrame(activity, { ...activity.frame, width }))} /><NumberField label="Frame height" value={activity.frame.height} min={240} onChange={height => updateActivity(resizeFrame(activity, { ...activity.frame, height }))} /></div>
          <div className="cv2-checks">{([['allowDirectFace', 'Allow named face selection'], ['allowCycling', 'Allow next / previous face'], ['circularCycling', 'Cycle from last to first face']] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={activity[key]} onChange={e => updateActivity({ [key]: e.target.checked })} />{label}</label>)}</div>
          <p className="cv2-muted">Select, drag or resize cards below. Geometry uses the authored logical frame; Present scales it uniformly.</p>
          <ActivityCanvas data={data} activity={activity} selectedId={instance?.id} onSelect={setSelectedInstance} resolveImageUrl={resolveImageUrl} onGeometry={(id, geometry) => updateActivity({ instances: activity.instances.map(i => i.id === id ? { ...i, geometry } : i) })} />
          <Field label="Selected card instance"><select value={instance?.id ?? ''} onChange={e => setSelectedInstance(e.target.value)}>{activity.instances.map((i, index) => <option key={i.id} value={i.id}>{index + 1}. {data.cards[i.cardId]?.label}</option>)}</select></Field>
          {instance && data.cards[instance.cardId] && <>
            <div className="cv2-actions"><button onClick={() => { const copy = { ...clone(instance), id: newId(), geometry: { ...instance.geometry, x: Math.min(activity.frame.width - instance.geometry.width, instance.geometry.x + 24), y: Math.min(activity.frame.height - instance.geometry.height, instance.geometry.y + 24) } }; updateActivity({ instances: [...activity.instances, copy] }); setSelectedInstance(copy.id); }}>Add another linked instance</button><button onClick={() => { const source = data.cards[instance.cardId]; const copy = duplicateCard(data, source.id, newId); emit(next => { next.cards[copy.id] = copy; const target = next.activities[activity.id].instances.find(i => i.id === instance.id)!; target.cardId = copy.id; target.initialFaceId = copy.faces[source.faces.findIndex(f => f.id === instance.initialFaceId)]?.id ?? copy.faces[0].id; target.revealFaceId = copy.faces[source.faces.findIndex(f => f.id === instance.revealFaceId)]?.id; }); setSelectedCard(copy.id); }}>Make independent copy</button><button onClick={() => { setSelectedCard(instance.cardId); setTab('cards'); }}>Edit shared card</button><button onClick={() => { updateActivity({ instances: activity.instances.filter(i => i.id !== instance.id) }); setSelectedInstance(''); }}>Remove instance</button></div>
            <div className="cv2-grid"><Field label="Initial face"><select value={instance.initialFaceId} onChange={e => updateInstance({ initialFaceId: e.target.value })}>{data.cards[instance.cardId].faces.map(f => <option value={f.id} key={f.id}>{f.label}</option>)}</select></Field><Field label="Reveal target"><select value={instance.revealFaceId ?? ''} onChange={e => updateInstance({ revealFaceId: e.target.value || undefined })}><option value="">Reveal current face only</option>{data.cards[instance.cardId].faces.map(f => <option value={f.id} key={f.id}>{f.label}</option>)}</select></Field></div>
            <label className="cv2-check"><input type="checkbox" checked={instance.initiallyConcealed} onChange={e => updateInstance({ initiallyConcealed: e.target.checked })} />Start concealed</label>
            <div className="cv2-grid cv2-geometry">{(['x', 'y', 'width', 'height'] as const).map(key => <NumberField key={key} label={key === 'x' ? 'Left' : key === 'y' ? 'Top' : key === 'width' ? 'Width' : 'Height'} value={instance.geometry[key]} min={key === 'width' || key === 'height' ? 64 : 0} max={key === 'x' || key === 'width' ? activity.frame.width : activity.frame.height} onChange={n => updateInstance({ geometry: boundGeometry({ ...instance.geometry, [key]: n }, activity.frame) })} />)}</div>
          </>}
          <Field label="Add a linked card instance"><select value="" onChange={e => { const c = data.cards[e.target.value]; if (!c) return; const added: CardInstance = { id: newId(), cardId: c.id, initialFaceId: c.faces[0].id, revealFaceId: c.faces[1]?.id, initiallyConcealed: false, geometry: boundGeometry({ x: 24, y: 24, ...CARD_V2_DEFAULT_SIZES[c.style.shape ?? (c.style.preset === 'sentence-strip' ? 'strip' : 'landscape')] }, activity.frame) }; updateActivity({ instances: [...activity.instances, added] }); setSelectedInstance(added.id); }}><option value="">Choose card…</option>{Object.values(data.cards).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>
        </>)}
      </main>
    </div>
  </section>;
}
function boundGeometry(g: CardGeometry, frame: { width: number; height: number }): CardGeometry {
  const width = Math.min(frame.width, Math.max(64, Math.round(g.width)));
  const height = Math.min(frame.height, Math.max(64, Math.round(g.height)));
  return { width, height, x: Math.max(0, Math.min(frame.width - width, Math.round(g.x))), y: Math.max(0, Math.min(frame.height - height, Math.round(g.y))) };
}
function resizeFrame(activity: CardActivity, frame: CardActivity['frame']): Partial<CardActivity> {
  return { frame, instances: activity.instances.map(i => ({ ...i, geometry: boundGeometry({ x: i.geometry.x * frame.width / activity.frame.width, y: i.geometry.y * frame.height / activity.frame.height, width: i.geometry.width * frame.width / activity.frame.width, height: i.geometry.height * frame.height / activity.frame.height }, frame) })) };
}
function FacePreview({ card, face, resolveImageUrl }: { card: CardDefinition; face: CardFace; resolveImageUrl?: Props['resolveImageUrl'] }) {
  const frame = CARD_V2_DEFAULT_SIZES[card.style.shape ?? (card.style.preset === 'sentence-strip' ? 'strip' : 'landscape')];
  return <div className="cv2-face-preview"><CardV2Scene plan={{ engine: 'card-v2', version: 1, frame, cards: [buildCardV2FacePlan(card, face.id, { x: 0, y: 0, ...frame }, resolveImageUrl)] }} showWarnings /></div>;
}
function ActivityCanvas({ data, activity, selectedId, onSelect, onGeometry, resolveImageUrl }: { data: CardsV2Module; activity: CardActivity; selectedId?: string; onSelect: (id: string) => void; onGeometry: (id: string, geometry: CardGeometry) => void; resolveImageUrl?: Props['resolveImageUrl'] }) {
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => { if (!host.current) return; const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width)); observer.observe(host.current); return () => observer.disconnect(); }, []);
  const scale = width / activity.frame.width;
  // Edit shows authored initial faces even for cards that start concealed during teaching.
  const previewActivity = { ...activity, instances: activity.instances.map(i => ({ ...i, initiallyConcealed: false })) };
  return <div ref={host} className="cv2-canvas-host"><div className="cv2-canvas" style={{ width, height: activity.frame.height * scale }}><CardV2Scene plan={buildCardV2RenderPlan(data, previewActivity, undefined, resolveImageUrl)} selectedInstanceId={selectedId} showWarnings />
    <div className="cv2-drag-layer" style={{ width: activity.frame.width, height: activity.frame.height, transform: `scale(${scale})` }}>{activity.instances.map(i => <Rnd key={i.id} size={{ width: i.geometry.width, height: i.geometry.height }} position={{ x: i.geometry.x, y: i.geometry.y }} scale={scale} bounds="parent" minWidth={64} minHeight={64} dragGrid={[8, 8]} resizeGrid={[8, 8]} onMouseDown={() => onSelect(i.id)} onDragStop={(_, d) => onGeometry(i.id, boundGeometry({ ...i.geometry, x: d.x, y: d.y }, activity.frame))} onResizeStop={(_, __, element, ___, position) => onGeometry(i.id, boundGeometry({ ...position, width: parseFloat(element.style.width), height: parseFloat(element.style.height) }, activity.frame))} className={`cv2-drag-card ${selectedId === i.id ? 'is-selected' : ''}`}><button type="button" aria-label={`Select ${data.cards[i.cardId]?.label ?? 'card'}`} onClick={() => onSelect(i.id)} /></Rnd>)}</div>
  </div></div>;
}
