import { useEffect, useState } from 'react';
import type { EpisodeProject } from '../../shared/episode/model';
import type { AdventureDefinition } from '../../shared/definitions/model';
import { putAdventureDefinition } from '../../shared/episode/commands';
import type { MediaRegistryView } from '../../shared/content/mediaRegistry';

export function AdventureDefinitionEditor({ project, registry, onChange, busy }: {
  project: EpisodeProject; registry: MediaRegistryView; onChange: (project: EpisodeProject) => void; busy: boolean;
}) {
  const [draft, setDraft] = useState<AdventureDefinition>(() => project.adventureDefinition ?? { ...project.adventure, name: '', description: '', rewards: [], relics: [] });
  const [error, setError] = useState('');
  useEffect(() => { setDraft(project.adventureDefinition ?? { ...project.adventure, name: '', description: '', rewards: [], relics: [] }); setError(''); }, [project.adventureDefinition, project.adventure.id, project.adventure.version]);
  const images = <><option value="">No image</option>{registry.images().map(image => <option key={image.id} value={image.id}>{image.label}</option>)}</>;
  return <details className="lesson-panel-content"><summary>Adventure rewards and relics</summary>
    <p>Define this adventure’s available rewards and relic stages. Student ownership is stored separately.</p>
    <fieldset disabled={busy} style={{ border: 0, padding: 0, minWidth: 0 }}>
      <label className="lesson-field">Adventure name<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
      <label className="lesson-field">Adventure description<textarea value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
      {draft.rewards.map((reward, index) => <div key={reward.id} className="lesson-field">
        <label>Reward name<input value={reward.name} onChange={event => setDraft({ ...draft, rewards: draft.rewards.map((item, i) => i === index ? { ...item, name: event.target.value } : item) })} /></label>
        <label>Reward type<select value={reward.kind} onChange={event => setDraft({ ...draft, rewards: draft.rewards.map((item, i) => i === index ? { ...item, kind: event.target.value as typeof reward.kind } : item) })}><option value="collectible">Collectible</option><option value="currency">Currency</option><option value="badge">Badge</option></select></label>
        <label>Reward image<select value={reward.iconAssetId ?? ''} onChange={event => setDraft({ ...draft, rewards: draft.rewards.map((item, i) => i === index ? { ...item, iconAssetId: event.target.value || undefined } : item) })}>{images}</select></label>
        <button onClick={() => setDraft({ ...draft, rewards: draft.rewards.filter((_, i) => i !== index) })}>Remove reward</button>
      </div>)}
      <button onClick={() => setDraft({ ...draft, rewards: [...draft.rewards, { id: crypto.randomUUID(), name: '', kind: 'collectible' }] })}>Add reward definition</button>
      {draft.relics.map((relic, index) => <div key={relic.id} className="lesson-field">
        <label>Relic name<input value={relic.name} onChange={event => setDraft({ ...draft, relics: draft.relics.map((item, i) => i === index ? { ...item, name: event.target.value } : item) })} /></label>
        <label>Relic image<select value={relic.imageAssetId ?? ''} onChange={event => setDraft({ ...draft, relics: draft.relics.map((item, i) => i === index ? { ...item, imageAssetId: event.target.value || undefined } : item) })}>{images}</select></label>
        {relic.stages.map((stage, stageIndex) => <div key={stage.id}>
          <label className="lesson-field">Stage name<input value={stage.name} onChange={event => setDraft({ ...draft, relics: draft.relics.map((item, i) => i === index ? { ...item, stages: item.stages.map((value, j) => j === stageIndex ? { ...value, name: event.target.value } : value) } : item) })} /></label>
          <label className="lesson-field">Progress required<input type="number" min="1" step="1" value={stage.requiredProgress} onChange={event => setDraft({ ...draft, relics: draft.relics.map((item, i) => i === index ? { ...item, stages: item.stages.map((value, j) => j === stageIndex ? { ...value, requiredProgress: Number(event.target.value) } : value) } : item) })} /></label>
          <label className="lesson-field">Stage image<select value={stage.imageAssetId ?? ''} onChange={event => setDraft({ ...draft, relics: draft.relics.map((item, i) => i === index ? { ...item, stages: item.stages.map((value, j) => j === stageIndex ? { ...value, imageAssetId: event.target.value || undefined } : value) } : item) })}>{images}</select></label>
          <button onClick={() => setDraft({ ...draft, relics: draft.relics.map((item, i) => i === index ? { ...item, stages: item.stages.filter((_, j) => j !== stageIndex) } : item) })}>Remove stage</button>
        </div>)}
        <button onClick={() => setDraft({ ...draft, relics: draft.relics.map((item, i) => i === index ? { ...item, stages: [...item.stages, { id: crypto.randomUUID(), name: '', requiredProgress: (item.stages[item.stages.length - 1]?.requiredProgress ?? 0) + 1 }] } : item) })}>Add relic stage</button>
        <button onClick={() => setDraft({ ...draft, relics: draft.relics.filter((_, i) => i !== index) })}>Remove relic</button>
      </div>)}
      <button onClick={() => setDraft({ ...draft, relics: [...draft.relics, { id: crypto.randomUUID(), name: '', stages: [] }] })}>Add relic definition</button>
      <button onClick={() => { try { onChange(putAdventureDefinition(project, JSON.parse(JSON.stringify(draft)))); setError(''); } catch (reason) { setError(String(reason)); } }}>Apply adventure definitions</button>
    </fieldset>
    {error && <p role="alert" className="lesson-error">{error}</p>}
  </details>;
}
