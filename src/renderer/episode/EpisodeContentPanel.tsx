import { useEffect, useMemo, useRef, useState } from 'react';
import type { LessonProject } from '../../shared/lesson/model';
import type { ContentEntity, DerivedImage, EpisodeProject } from '../../shared/episode/model';
import { putCatalogCollection, putCatalogEntity, putDerivedImage } from '../../shared/episode/commands';
import type { MediaRegistryView } from '../../shared/content/mediaRegistry';
import { renderDerivedImage } from './renderDerivedImage';

const newDerived = (): DerivedImage => ({ id: crypto.randomUUID(), label: '', kind: 'derived-image', sourceAssetId: '', transform: { version: 1, crop: { x: 0, y: 0, width: 1, height: 1 } }, presentation: { fit: 'contain' } });
const tags = (value: string) => [...new Set(value.split(',').map(tag => tag.trim()).filter(Boolean))];

export function EpisodeContentPanel({ project, registry, resolve, onChange, onConvert, onInsert, busy }: {
  project: LessonProject; registry: MediaRegistryView; resolve: (id: string) => string | undefined;
  onChange: (project: EpisodeProject) => void; onConvert: (adventure: { id: string; version: string }) => Promise<void>;
  onInsert: (ids: string[]) => void; busy: boolean;
}) {
  const [adventureId, setAdventureId] = useState(''), [adventureVersion, setAdventureVersion] = useState('1');
  const [draft, setDraft] = useState<DerivedImage>(newDerived), [error, setError] = useState(''), [preview, setPreview] = useState(''), [rendering, setRendering] = useState(false);
  const [entityId, setEntityId] = useState(''), [entityName, setEntityName] = useState(''), [entityKind, setEntityKind] = useState<ContentEntity['kind']>('character'), [entityTags, setEntityTags] = useState(''), [entityAssets, setEntityAssets] = useState<string[]>([]);
  const [filterEntity, setFilterEntity] = useState(''), [filterTag, setFilterTag] = useState(''), [filterType, setFilterType] = useState('all'), [filterUsage, setFilterUsage] = useState('all');
  const [collectionId, setCollectionId] = useState(''), [collectionName, setCollectionName] = useState(''), [collectionEntities, setCollectionEntities] = useState<string[]>([]);
  const [filterKind, setFilterKind] = useState(''), [filterCollection, setFilterCollection] = useState('');
  const previewGeneration = useRef(0);
  useEffect(() => () => { ++previewGeneration.current; }, []);
  const episode = project.format === 'story-studio-episode' ? project : null;
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const physicalImages = registry.list('image');
  const media = useMemo(() => [...registry.list().map(asset => ({ id: asset.id, label: asset.originalName || asset.filename, mediaType: asset.mediaType })), ...(episode?.derivedImages ?? []).map(image => ({ id: image.id, label: image.label || image.id, mediaType: 'image' as const }))], [registry, episode?.derivedImages]);
  const entities = episode?.catalog.entities.filter(entity => entity.adventureId === episode.adventure.id) ?? [];
  const collections = episode?.catalog.collections?.filter(collection => collection.adventureId === episode.adventure.id) ?? [];
  const filtered = media.filter(asset => (filterType === 'all' || asset.mediaType === filterType)
    && (!filterEntity || entities.find(entity => entity.id === filterEntity)?.assetIds.includes(asset.id))
    && (!filterTag || entities.some(entity => entity.tags.includes(filterTag) && entity.assetIds.includes(asset.id)))
    && (!filterKind || entities.some(entity => entity.kind === filterKind && entity.assetIds.includes(asset.id)))
    && (!filterCollection || entities.some(entity => collections.find(collection => collection.id === filterCollection)?.entityIds.includes(entity.id) && entity.assetIds.includes(asset.id)))
    && (filterUsage === 'all' || (filterUsage === 'used') === (registry.usages(asset.id).length > 0)));
  const run = (operation: () => void) => { setError(''); try { operation(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } };
  const selectEntity = (id: string) => {
    const entity = entities.find(item => item.id === id); setEntityId(id); setEntityName(entity?.name ?? ''); setEntityKind(entity?.kind ?? 'character'); setEntityTags(entity?.tags.join(', ') ?? ''); setEntityAssets(entity?.assetIds ?? []);
  };
  const selectCollection = (id: string) => {
    const collection = collections.find(item => item.id === id);
    setCollectionId(id); setCollectionName(collection?.name ?? ''); setCollectionEntities(collection?.entityIds ?? []);
  };
  const previewDraft = async () => {
    const generation = ++previewGeneration.current;
    setError(''); setRendering(true);
    try {
      const url = resolve(draft.sourceAssetId); if (!url) throw new Error('Choose an available source image.');
      const png = await renderDerivedImage(url, draft);
      if (generation !== previewGeneration.current) return;
      setPreview(URL.createObjectURL(new Blob([png as BlobPart], { type: 'image/png' })));
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { if (generation === previewGeneration.current) setRendering(false); }
  };
  return <details className="lesson-panel-content episode-content"><summary>Episode content</summary>
    {error && <p className="lesson-error" role="alert">{error}</p>}
    {!episode ? <form onSubmit={event => { event.preventDefault(); void onConvert({ id: adventureId.trim(), version: adventureVersion.trim() }); }}>
      <p>Create an episode copy to add reusable image variations and a content catalog. Your original lesson stays available.</p>
      <div className="lesson-field-grid"><label className="lesson-field">Adventure ID<input value={adventureId} onChange={event => setAdventureId(event.target.value)} required maxLength={200} /></label><label className="lesson-field">Adventure version<input value={adventureVersion} onChange={event => setAdventureVersion(event.target.value)} required maxLength={100} /></label></div>
      <button disabled={busy || !adventureId.trim()}>Convert to episode copy</button>
    </form> : <>
      <p>Adventure: <strong>{episode.adventure.id}</strong> · {episode.adventure.version}</p>
      <details><summary>Derived images</summary>
        <label className="lesson-field">Edit derived image<select value={episode.derivedImages.some(image => image.id === draft.id) ? draft.id : ''} onChange={event => { setDraft(episode.derivedImages.find(image => image.id === event.target.value) ?? newDerived()); setPreview(''); }}><option value="">New derived image</option>{episode.derivedImages.map(image => <option key={image.id} value={image.id}>{image.label || image.id}</option>)}</select></label>
        <form onSubmit={event => { event.preventDefault(); run(() => { onChange(putDerivedImage(episode, draft)); setPreview(''); }); }}>
          <div className="lesson-field-grid"><label className="lesson-field">Source image<select value={draft.sourceAssetId} required onChange={event => setDraft({ ...draft, sourceAssetId: event.target.value })}><option value="">Choose physical image…</option>{physicalImages.map(image => <option key={image.id} value={image.id}>{image.originalName || image.filename}</option>)}</select></label><label className="lesson-field">Derived image name<input value={draft.label ?? ''} maxLength={200} required onChange={event => setDraft({ ...draft, label: event.target.value })} /></label></div>
          <div className="lesson-field-grid">{(['x', 'y', 'width', 'height'] as const).map(key => <label className="lesson-field" key={key}>{`Crop ${{ x: 'left', y: 'top', width: 'width', height: 'height' }[key]}`}<input type="number" min={key === 'width' || key === 'height' ? .001 : 0} max={1} step="any" value={draft.transform.crop?.[key] ?? (key === 'width' || key === 'height' ? 1 : 0)} onChange={event => setDraft({ ...draft, transform: { ...draft.transform, crop: { x: 0, y: 0, width: 1, height: 1, ...draft.transform.crop, [key]: event.target.valueAsNumber } } })} /></label>)}</div>
          <div className="lesson-field-grid"><label className="lesson-field">Rotation<select value={draft.transform.rotation ?? 0} onChange={event => setDraft({ ...draft, transform: { ...draft.transform, rotation: Number(event.target.value) as 0 | 90 | 180 | 270 } })}>{[0, 90, 180, 270].map(value => <option key={value} value={value}>{value}°</option>)}</select></label><label className="lesson-check"><input type="checkbox" checked={draft.transform.flipX ?? false} onChange={event => setDraft({ ...draft, transform: { ...draft.transform, flipX: event.target.checked } })} />Flip horizontally</label></div>
          <div className="lesson-field-grid">{(['brightness', 'contrast', 'saturation'] as const).map(key => <label className="lesson-field" key={key}>{key[0].toUpperCase() + key.slice(1)}<input type="number" min={0} max={2} step="any" value={draft.transform[key] ?? 1} onChange={event => setDraft({ ...draft, transform: { ...draft.transform, [key]: event.target.valueAsNumber } })} /></label>)}<label className="lesson-field">Fit<select value={draft.presentation.fit} onChange={event => setDraft({ ...draft, presentation: { ...draft.presentation, fit: event.target.value as 'contain' | 'cover' } })}><option value="contain">Contain</option><option value="cover">Cover</option></select></label><label className="lesson-field">Aspect ratio<input type="number" min={.01} max={100} step="any" placeholder="Keep source ratio" value={draft.presentation.aspectRatio ?? ''} onChange={event => setDraft({ ...draft, presentation: { ...draft.presentation, aspectRatio: event.target.value ? event.target.valueAsNumber : undefined } })} /></label></div>
          <div className="lesson-field-grid">{(['focalX', 'focalY'] as const).map(key => <label className="lesson-field" key={key}>{key === 'focalX' ? 'Focal X' : 'Focal Y'}<input type="number" min={0} max={1} step="any" value={draft.presentation[key] ?? .5} onChange={event => setDraft({ ...draft, presentation: { ...draft.presentation, [key]: event.target.valueAsNumber } })} /></label>)}</div>
          <div className="lesson-actions"><button type="button" disabled={rendering || busy} onClick={() => void previewDraft()}>{rendering ? 'Rendering…' : 'Preview derived image'}</button><button disabled={busy || rendering || !draft.sourceAssetId}>Save derived image</button><button type="button" onClick={() => { setDraft(newDerived()); setPreview(''); }}>New derived image</button></div>
          {preview && <img src={preview} alt="Derived image preview" style={{ display: 'block', maxWidth: '100%', maxHeight: 240, objectFit: 'contain', marginBlock: 8 }} />}
        </form>
      </details>
      <details><summary>Content identities and tags</summary>
        <label className="lesson-field">Entity<select value={entityId} onChange={event => selectEntity(event.target.value)}><option value="">New entity</option>{entities.map(entity => <option key={entity.id} value={entity.id}>{entity.name} · {entity.kind}</option>)}</select></label>
        <form onSubmit={event => { event.preventDefault(); run(() => { const id = entityId || crypto.randomUUID(); onChange(putCatalogEntity(episode, { id, adventureId: episode.adventure.id, name: entityName.trim(), kind: entityKind, tags: tags(entityTags), assetIds: entityAssets, tagAnnotations: tags(entityTags).map(tag => ({ tag, source: 'manual' as const })) })); setEntityId(id); }); }}>
          <div className="lesson-field-grid"><label className="lesson-field">Entity name<input value={entityName} maxLength={200} required onChange={event => setEntityName(event.target.value)} /></label><label className="lesson-field">Entity kind<select value={entityKind} onChange={event => setEntityKind(event.target.value as ContentEntity['kind'])}>{['character', 'location', 'item', 'other'].map(kind => <option key={kind} value={kind}>{kind}</option>)}</select></label><label className="lesson-field">Entity tags<input placeholder="Separate tags with commas" value={entityTags} maxLength={2000} onChange={event => setEntityTags(event.target.value)} /></label></div>
          <fieldset><legend>Associated media</legend><div style={{ maxHeight: 180, overflow: 'auto' }}>{media.map(asset => <label className="lesson-check" key={asset.id}><input type="checkbox" checked={entityAssets.includes(asset.id)} onChange={event => setEntityAssets(event.target.checked ? [...entityAssets, asset.id] : entityAssets.filter(id => id !== asset.id))} />{asset.label}</label>)}</div></fieldset>
          <button disabled={busy || !entityName.trim()}>Save entity</button>
        </form>
      </details>
      <details><summary>Content collections</summary>
        <label className="lesson-field">Collection<select value={collectionId} onChange={event => selectCollection(event.target.value)}><option value="">New collection</option>{collections.map(collection => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></label>
        <form onSubmit={event => { event.preventDefault(); run(() => { const id = collectionId || crypto.randomUUID(); onChange(putCatalogCollection(episode, { id, adventureId: episode.adventure.id, name: collectionName.trim(), entityIds: collectionEntities })); setCollectionId(id); }); }}>
          <label className="lesson-field">Collection name<input value={collectionName} maxLength={200} required onChange={event => setCollectionName(event.target.value)} /></label>
          <fieldset><legend>Collection entities</legend><div style={{ maxHeight: 180, overflow: 'auto' }}>{entities.map(entity => <label className="lesson-check" key={entity.id}><input type="checkbox" checked={collectionEntities.includes(entity.id)} onChange={event => setCollectionEntities(event.target.checked ? [...collectionEntities, entity.id] : collectionEntities.filter(id => id !== entity.id))} />{entity.name} · {entity.kind}</label>)}</div>{!entities.length && <p>Create an entity to add it to this collection.</p>}</fieldset>
          <button disabled={busy || !collectionName.trim()}>Save collection</button>
        </form>
      </details>
      <div className="lesson-field-grid"><label className="lesson-field">Filter by entity kind<select value={filterKind} onChange={event => setFilterKind(event.target.value)}><option value="">All kinds</option>{['character', 'location', 'item', 'other'].map(kind => <option key={kind} value={kind}>{kind}</option>)}</select></label><label className="lesson-field">Filter by collection<select value={filterCollection} onChange={event => setFilterCollection(event.target.value)}><option value="">All collections</option>{collections.map(collection => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></label></div>
      <div className="lesson-field-grid"><label className="lesson-field">Filter by entity<select value={filterEntity} onChange={event => setFilterEntity(event.target.value)}><option value="">All entities</option>{entities.map(entity => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label><label className="lesson-field">Filter by tag<input value={filterTag} onChange={event => setFilterTag(event.target.value)} /></label><label className="lesson-field">Filter media type<select value={filterType} onChange={event => setFilterType(event.target.value)}>{['all', 'image', 'video', 'audio'].map(type => <option key={type} value={type}>{type}</option>)}</select></label><label className="lesson-field">Filter content usage<select value={filterUsage} onChange={event => setFilterUsage(event.target.value)}><option value="all">All</option><option value="used">Referenced</option><option value="unused">No known references</option></select></label></div>
      <div className="lesson-pool-assets" aria-label="Adventure content">{filtered.map(asset => <button className="lesson-pool-asset" key={asset.id} disabled={asset.mediaType === 'audio'} title={`Add ${asset.label} to sequence`} onClick={() => onInsert([asset.id])}>{asset.mediaType === 'image' && <span className="lesson-pool-thumb"><img src={resolve(asset.id)} alt="" /></span>}<span className="lesson-asset-name">{asset.label}</span><small>{asset.mediaType}</small></button>)}</div>
      {!filtered.length && <p className="lesson-empty">No media matches these filters.</p>}
    </>}
  </details>;
}
