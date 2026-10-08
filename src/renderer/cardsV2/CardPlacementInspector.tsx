import { Children, cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react';
import type { AssetItem } from '../../shared/types';
import { createActivity, removeCardFace, validateCardsV2, type CardsV2Module, type CardFace, type CardStyle, type CardGeometry, type CardInstance } from '../../shared/cardsV2';
import { buildCardV2FacePlan, CARD_V2_PRESETS, CARD_V2_DEFAULT_SIZES } from '../../shared/cardV2Render';
import { CardV2Scene } from './CardV2Scene';
import './CardPlacementInspector.css';

export interface CardPlacementInspectorProps {
  module: CardsV2Module; placementId: string; instanceId: string; assets: AssetItem[];
  onChange: (module: CardsV2Module) => void;
  onDuplicate: (independent: boolean) => void; onRemove: () => void; onIndependent: () => void;
  onCopy: () => void; onOpenLibrary: () => void;
  onPreviewFace?: (faceId: string) => void;
  onActivityCreated?: (placementId: string) => void;
  resolveImageUrl?: (assetId: string) => string | undefined;
}
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const id = () => crypto.randomUUID();
function Field({ label, children }: { label: string; children: ReactNode }) {
  const labelId = useId();
  return <label className="cpi-field"><span id={labelId}>{label}</span>{Children.map(children, child =>
    isValidElement(child) && typeof child.type === 'string' && ['input', 'select', 'textarea'].includes(child.type)
      ? cloneElement(child as ReactElement<{ 'aria-labelledby'?: string }>, { 'aria-labelledby': labelId })
      : child
  )}</label>;
}
function NumberField({ label, value, min = 0, max = 10000, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (value: number) => void }) {
  return <Field label={label}><input type="number" value={value} min={min} max={max} onChange={event => { const n = event.target.valueAsNumber; if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n))); }} /></Field>;
}
function move<T>(items: T[], index: number, delta: number) {
  const next = [...items], target = index + delta;
  if (target >= 0 && target < items.length) [next[index], next[target]] = [next[target], next[index]];
  return next;
}
function bound(g: CardGeometry, frame: { width: number; height: number }): CardGeometry {
  const width = Math.min(frame.width, Math.max(40, Math.round(g.width))), height = Math.min(frame.height, Math.max(40, Math.round(g.height)));
  return { width, height, x: Math.max(0, Math.min(frame.width - width, Math.round(g.x))), y: Math.max(0, Math.min(frame.height - height, Math.round(g.y))) };
}

/** Face content is shared; geometry, reveal behavior and appearance can belong to this instance. */
export function CardPlacementInspector({ module, placementId, instanceId, assets, onChange, onDuplicate, onRemove, onIndependent, onCopy, onOpenLibrary, onPreviewFace, onActivityCreated, resolveImageUrl }: CardPlacementInspectorProps) {
  const placement = module.placements[placementId], activity = placement && module.activities[placement.activityId];
  const instance = activity?.instances.find(item => item.id === instanceId), card = instance && module.cards[instance.cardId];
  const [selectedFace, setSelectedFace] = useState(''), [notice, setNotice] = useState(''), [scope, setScope] = useState<'placement' | 'shared'>('placement');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const face = card?.faces.find(item => item.id === selectedFace) ?? card?.faces[0];
  useEffect(() => { setSelectedFace(''); setScope('placement'); setNotice(''); }, [instanceId, placementId, card?.id]);
  useEffect(() => { textRef.current?.focus(); }, [instanceId, card?.id]);
  useEffect(() => { if (face) onPreviewFace?.(face.id); }, [face?.id, instanceId, onPreviewFace]);
  if (!activity || !instance || !card || !face) return <div className="card-placement-inspector"><p>Select a card to edit its faces and appearance.</p><button onClick={onOpenLibrary}>Cards & Sets library</button></div>;
  const emit = (edit: (next: CardsV2Module) => void): boolean => {
    const next = clone(module); edit(next);
    if (validateCardsV2(next).length) { setNotice('Change not applied. Check content limits and face references.'); return false; }
    onChange(next); setNotice(''); return true;
  };
  const updateFace = (patch: Partial<CardFace>) => emit(next => { Object.assign(next.cards[card.id].faces.find(item => item.id === face.id)!, patch); });
  const updateInstance = (patch: Partial<CardInstance> & { style?: CardStyle }) => emit(next => { Object.assign(next.activities[activity.id].instances.find(item => item.id === instance.id)!, patch); });
  const localStyle = (instance as CardInstance & { style?: CardStyle }).style;
  const style = scope === 'shared' ? card.style : { ...card.style, ...face.style, ...localStyle };
  const updateStyle = (patch: Partial<CardStyle>) => scope === 'shared' ? emit(next => { next.cards[card.id].style = { ...card.style, ...patch }; }) : updateInstance({ style: { ...style, ...patch } });
  const updateShape = (shape: NonNullable<CardStyle['shape']>) => emit(next => {
    const target = next.activities[activity.id].instances.find(item => item.id === instance.id)!;
    target.geometry = bound({ ...instance.geometry, ...CARD_V2_DEFAULT_SIZES[shape] }, activity.frame);
    if (scope === 'shared') next.cards[card.id].style = { ...card.style, shape };
    else target.style = { ...style, shape };
  });
  const usage = Object.values(module.activities).reduce((sum, item) => sum + item.instances.filter(i => i.cardId === card.id).length, 0);
  const referenced = Object.values(module.activities).some(item => item.instances.some(i => i.cardId === card.id && (i.initialFaceId === face.id || i.revealFaceId === face.id)));
  const faceIndex = card.faces.indexOf(face), instanceIndex = activity.instances.indexOf(instance);
  const makeSet = (build: boolean) => {
    const setId = id(); let createdPlacement = '';
    const applied = emit(next => {
      next.sets[setId] = { id: setId, label: `${placement.label.slice(0, 190)} cards`, tags: [], entries: activity.instances.map(item => ({ id: id(), cardId: item.cardId })) };
      if (build) { const made = createActivity(next, setId, id); createdPlacement = id(); next.activities[made.id] = made; next.placements[createdPlacement] = { id: createdPlacement, activityId: made.id, label: made.label }; }
    });
    if (applied) { setNotice(build ? 'Created a Set and a new activity from these cards.' : 'Saved these cards as a new Set.'); if (createdPlacement) onActivityCreated?.(createdPlacement); }
  };
  return <section className="card-placement-inspector" aria-label="Card inspector">
    <div className="cpi-heading"><strong>Card Inspector</strong><button onClick={onOpenLibrary}>Library</button></div>
    {notice && <p role="status" className="cpi-notice">{notice}</p>}
    {usage > 1 && <div className="cpi-sharing"><p>Shared content · {usage} card instances. Editing faces updates every linked card.</p><button onClick={onIndependent}>Make independent copy</button></div>}
    <Field label="Card label (shared)"><input maxLength={200} placeholder="Untitled card" value={card.label} onChange={e => emit(next => { next.cards[card.id].label = e.target.value; })} /></Field>
    <div className="cpi-heading"><strong>Faces</strong><button disabled={card.faces.length >= 32} onClick={() => { const added: CardFace = { id: id(), label: `Face ${card.faces.length + 1}`, layout: 'text', text: '' }; if (emit(next => { next.cards[card.id].faces.push(added); })) setSelectedFace(added.id); }}>+ Add Face</button></div>
    <div className="cpi-tabs" role="tablist" aria-label="Card faces">{card.faces.map(item => <button key={item.id} role="tab" aria-selected={item.id === face.id} onClick={() => setSelectedFace(item.id)}>{item.label || 'Untitled face'}</button>)}</div>
    <Field label="Face name"><input maxLength={200} value={face.label} onChange={e => updateFace({ label: e.target.value })} /></Field>
    {face.layout !== 'image-only' && <Field label={face.layout === 'image-prompt' ? 'Prompt (shared)' : 'Text (shared)'}><textarea ref={textRef} rows={4} maxLength={20000} placeholder="Type card content…" value={face.text ?? ''} onChange={e => updateFace({ text: e.target.value })} /></Field>}
    <div className="cpi-grid"><Field label="Layout"><select value={face.layout} onChange={e => updateFace({ layout: e.target.value as CardFace['layout'] })}><option value="text">Text</option><option value="image-only">Image</option><option value="image-text">Image + text</option><option value="image-prompt">Image + prompt</option><option value="text-support">Text + supporting text</option></select></Field><Field label="Emphasis"><select value={face.emphasis ?? 'normal'} onChange={e => updateFace({ emphasis: e.target.value as CardFace['emphasis'] })}><option value="normal">Normal</option><option value="bold">Bold</option><option value="italic">Italic</option></select></Field></div>
    {face.layout === 'text-support' && <Field label="Supporting text"><textarea rows={2} maxLength={20000} value={face.supportingText ?? ''} onChange={e => updateFace({ supportingText: e.target.value })} /></Field>}
    {face.layout.startsWith('image') && <><Field label="Shared media image"><select value={face.imageAssetId ?? ''} onChange={e => updateFace({ imageAssetId: e.target.value || undefined })}><option value="">Choose an imported image…</option>{assets.filter(item => item.mediaType === 'image').map(item => <option key={item.id} value={item.id}>{item.originalName || item.filename}</option>)}</select></Field><Field label="Image description"><input maxLength={20000} value={face.alt ?? ''} onChange={e => updateFace({ alt: e.target.value })} /></Field>{!assets.some(item => item.mediaType === 'image') && <p className="cpi-muted">Import an image into Shared Media to use it here.</p>}</>}
    <div className="cpi-actions"><button disabled={faceIndex === 0} onClick={() => emit(next => { next.cards[card.id].faces = move(card.faces, faceIndex, -1); })}>Earlier</button><button disabled={faceIndex === card.faces.length - 1} onClick={() => emit(next => { next.cards[card.id].faces = move(card.faces, faceIndex, 1); })}>Later</button><button disabled={card.faces.length >= 32} onClick={() => { const added = { ...clone(face), id: id(), label: `${face.label.slice(0, 195)} copy` }; if (emit(next => { next.cards[card.id].faces.push(added); })) setSelectedFace(added.id); }}>Duplicate face</button><button disabled={card.faces.length === 1 || referenced} title={referenced ? 'Used as an initial or reveal face. Change those references before removing.' : undefined} onClick={() => { if (emit(next => { removeCardFace(next, card.id, face.id); })) setSelectedFace(''); }}>Remove face</button></div>
    {referenced && card.faces.length > 1 && <p className="cpi-muted">This face is an initial or reveal target. Change those references before removing it.</p>}
    <div className="cpi-preview"><CardV2Scene plan={{ engine: 'card-v2', version: 1, frame: { width: instance.geometry.width, height: instance.geometry.height }, cards: [buildCardV2FacePlan(localStyle ? { ...card, style: { ...card.style, ...localStyle }, faces: card.faces.map(item => ({ ...item, style: { ...card.style, ...item.style, ...localStyle } })) } : card, face.id, { ...instance.geometry, x: 0, y: 0 }, resolveImageUrl)] }} showWarnings /></div>
    <details className="cpi-section" open><summary>Appearance</summary><Field label="Apply appearance to"><select value={scope} onChange={e => setScope(e.target.value as typeof scope)}><option value="placement">This placement</option><option value="shared">Shared card</option></select></Field><div className="cpi-grid">
      <Field label="Preset"><select value={style.preset} onChange={e => updateStyle({ preset: e.target.value as CardStyle['preset'] })}>{Object.keys(CARD_V2_PRESETS).map(value => <option key={value} value={value}>{value.replaceAll('-', ' ')}</option>)}</select></Field>
      <Field label="Shape"><select value={style.shape ?? (style.preset === 'sentence-strip' ? 'strip' : 'landscape')} onChange={e => updateShape(e.target.value as NonNullable<CardStyle['shape']>)}>{['landscape', 'portrait', 'square', 'strip', 'pill'].map(value => <option key={value}>{value}</option>)}</select></Field>
      <Field label="Alignment"><select value={style.align ?? 'center'} onChange={e => updateStyle({ align: e.target.value as CardStyle['align'] })}><option value="center">Center</option><option value="left">Left</option></select></Field>
      <Field label="Text fitting"><select value={style.fit ?? 'auto'} onChange={e => updateStyle({ fit: e.target.value as CardStyle['fit'] })}><option value="auto">Automatic</option><option value="manual">Manual</option></select></Field>
      <NumberField label="Min font size" value={style.minFontSize ?? 18} min={8} max={style.maxFontSize ?? 160} onChange={n => updateStyle({ minFontSize: n })} /><NumberField label="Max font size" value={style.maxFontSize ?? 52} min={style.minFontSize ?? 8} max={160} onChange={n => updateStyle({ maxFontSize: n })} />
      {style.fit === 'manual' && <NumberField label="Font size" value={style.fontSize ?? 32} min={8} max={160} onChange={n => updateStyle({ fontSize: n })} />}
      <NumberField label="Padding" value={style.padding ?? CARD_V2_PRESETS[style.preset].padding} max={80} onChange={n => updateStyle({ padding: n })} /><NumberField label="Corners" value={style.radius ?? CARD_V2_PRESETS[style.preset].radius} max={80} onChange={n => updateStyle({ radius: n })} />
      <Field label="Accent"><input type="color" value={style.accent ?? CARD_V2_PRESETS[style.preset].accent} onChange={e => updateStyle({ accent: e.target.value })} /></Field>
    </div>{scope === 'placement' && localStyle && <button onClick={() => updateInstance({ style: undefined })}>Use shared appearance</button>}</details>
    <details className="cpi-section"><summary>Position & layer</summary><div className="cpi-grid">{(['x', 'y', 'width', 'height'] as const).map(key => <NumberField key={key} label={{ x: 'Left', y: 'Top', width: 'Width', height: 'Height' }[key]} value={instance.geometry[key]} min={key === 'width' || key === 'height' ? 40 : 0} max={key === 'x' || key === 'width' ? activity.frame.width : activity.frame.height} onChange={n => updateInstance({ geometry: bound({ ...instance.geometry, [key]: n }, activity.frame) })} />)}</div><div className="cpi-actions"><button disabled={instanceIndex === 0} onClick={() => emit(next => { next.activities[activity.id].instances = move(activity.instances, instanceIndex, -1); })}>Layer down</button><button disabled={instanceIndex === activity.instances.length - 1} onClick={() => emit(next => { next.activities[activity.id].instances = move(activity.instances, instanceIndex, 1); })}>Layer up</button></div></details>
    <details className="cpi-section"><summary>Reveal & interaction</summary><div className="cpi-grid"><Field label="Initial face"><select value={instance.initialFaceId} onChange={e => updateInstance({ initialFaceId: e.target.value })}>{card.faces.map(item => <option key={item.id} value={item.id}>{item.label || 'Untitled face'}</option>)}</select></Field><Field label="Reveal face"><select value={instance.revealFaceId ?? ''} onChange={e => updateInstance({ revealFaceId: e.target.value || undefined })}><option value="">Current face</option>{card.faces.map(item => <option key={item.id} value={item.id}>{item.label || 'Untitled face'}</option>)}</select></Field></div><label className="cpi-check"><input type="checkbox" checked={instance.initiallyConcealed} onChange={e => updateInstance({ initiallyConcealed: e.target.checked })} />Start concealed</label>{([['allowCycling', 'Next / previous face'], ['allowDirectFace', 'Named face selection'], ['circularCycling', 'Cycle from last face to first']] as const).map(([key, label]) => <label className="cpi-check" key={key}><input type="checkbox" checked={activity[key]} onChange={e => emit(next => { next.activities[activity.id][key] = e.target.checked; })} />{label} (activity)</label>)}</details>
    <details className="cpi-section"><summary>Linked card & Sets</summary><Field label="Change linked card"><select value={card.id} onChange={e => { const target = module.cards[e.target.value]; if (target) updateInstance({ cardId: target.id, initialFaceId: target.faces[0].id, revealFaceId: target.faces[1]?.id }); }}>{Object.values(module.cards).map(item => <option key={item.id} value={item.id}>{item.label || 'Untitled card'}</option>)}</select></Field><p className="cpi-muted">Each placement links to a reusable card. Face edits are shared; position and reveal settings belong to this placement.</p><Field label="Save current cards to existing Set"><select value="" onChange={e => { const target = e.target.value; if (target && emit(next => { next.sets[target].entries.push(...activity.instances.map(item => ({ id: id(), cardId: item.cardId }))); })) setNotice('Added all current cards to the Set.'); }}><option value="">Choose Set…</option>{Object.values(module.sets).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field><div className="cpi-actions"><button onClick={() => makeSet(false)}>Create Set from current cards</button><button onClick={() => makeSet(true)}>Build Activity from current cards</button><button onClick={onOpenLibrary}>Open Cards & Sets</button></div></details>
    <div className="cpi-actions cpi-footer"><button onClick={() => onDuplicate(true)}>Duplicate independent</button><button onClick={() => onDuplicate(false)}>Duplicate linked</button><button onClick={onCopy}>Copy</button><button onClick={onIndependent}>Make independent</button><button className="cpi-remove" onClick={onRemove}>Remove card</button></div>
  </section>;
}
