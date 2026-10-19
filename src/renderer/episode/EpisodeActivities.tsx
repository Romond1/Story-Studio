import { useEffect, useState } from 'react';
import type { EpisodeProject } from '../../shared/episode/model';
import type { EpisodeActivity, ModuleType } from '../../shared/modules/model';
import { createModuleTemplate } from '../../shared/modules/templates';
import { parseEpisodeActivity } from '../../shared/modules/validation';
import type { MediaRegistryView } from '../../shared/content/mediaRegistry';

export function EpisodeActivities({ project, moduleType, registry, selectedId, onSelect, onSave, disabled }: {
  project: EpisodeProject; moduleType: Exclude<ModuleType, 'activation-cards'>; registry: MediaRegistryView;
  selectedId: string; onSelect: (id: string) => void; onSave: (activity: EpisodeActivity) => void; disabled: boolean;
}) {
  const activities = (project.activities ?? []).filter(activity => activity.moduleType === moduleType);
  const activity = activities.find(item => item.id === selectedId) ?? activities[0];
  const [draft, setDraft] = useState(''), [error, setError] = useState(''), [cardId, setCardId] = useState('');
  useEffect(() => { setDraft(activity ? JSON.stringify(activity.config, null, 2) : ''); setError(''); }, [activity]);
  const commit = (value: EpisodeActivity) => { setError(''); try { onSave(parseEpisodeActivity(value)); } catch (reason) { setError(String(reason)); } };
  const imageOptions = <><option value="">No image</option>{registry.images().map(image => <option key={image.id} value={`asset:${image.id}`}>{image.label}</option>)}</>;
  const videoOptions = <><option value="">No video</option>{registry.list().filter(asset => asset.mediaType === 'video').map(asset => <option key={asset.id} value={`asset:${asset.id}`}>{asset.originalName || asset.filename}</option>)}</>;
  return <section className="lesson-panel-content" aria-label="Episode activity authoring">
    
    <p>Settings save with this episode. Open the game for its full editor.</p>
    <label className="lesson-field">Episode activity<select disabled={disabled} value={activity?.id ?? ''} onChange={event => onSelect(event.target.value)}><option value="">Choose activity</option>{activities.map((item, index) => <option value={item.id} key={item.id}>{moduleType === 'language-snake' ? 'Language Snake' : 'Final Boss'} {index + 1}</option>)}</select></label>
    <button disabled={disabled} onClick={() => { const id = crypto.randomUUID(); commit({ id, moduleType, moduleVersion: 1, configVersion: 1, config: createModuleTemplate(moduleType) } as EpisodeActivity); onSelect(id); }}>Create activity from bundled template</button>
    {activity && <>
      {activity.moduleType === 'language-snake' && <details><summary>Questions and background</summary>
        <label className="lesson-field">Activity questions<textarea disabled={disabled} rows={5} value={activity.config.questionText} onChange={event => commit({ ...activity, config: { ...activity.config, questionText: event.target.value } })} /></label>
        <label className="lesson-field">Snake background<select disabled={disabled} value={activity.config.backgroundImage} onChange={event => commit({ ...activity, config: { ...activity.config, backgroundImage: event.target.value } })}>{imageOptions}</select></label>
      </details>}
      {activity.moduleType === 'final-boss-hero' && <>
        <label className="lesson-field">Encounter name<input disabled={disabled} value={activity.config.encounter.name} onChange={event => commit({ ...activity, config: { ...activity.config, encounter: { ...activity.config.encounter, name: event.target.value } } })} /></label>
        <details><summary>Card images</summary><label className="lesson-field">Boss card<select value={cardId} onChange={event => setCardId(event.target.value)}><option value="">Choose card</option>{activity.config.cardLibrary.map(card => <option key={card.id} value={card.id}>{card.title}</option>)}</select></label>
        {activity.config.cardLibrary.some(card => card.id === cardId) && <label className="lesson-field">Boss card image<select disabled={disabled} value={activity.config.cardLibrary.find(card => card.id === cardId)?.image ?? ''} onChange={event => commit({ ...activity, config: { ...activity.config, cardLibrary: activity.config.cardLibrary.map(card => card.id === cardId ? { ...card, image: event.target.value } : card) } })}>{imageOptions}<option value={activity.config.cardLibrary.find(card => card.id === cardId)?.image}>Current image</option></select></label>}
        {activity.config.cardLibrary.some(card => card.id === cardId) && (['frontImage', 'backImage'] as const).map(field => <label className="lesson-field" key={field}>{field === 'frontImage' ? 'Card front image' : 'Card back image'}<select disabled={disabled} value={activity.config.cardLibrary.find(card => card.id === cardId)?.[field] ?? ''} onChange={event => commit({ ...activity, config: { ...activity.config, cardLibrary: activity.config.cardLibrary.map(card => card.id === cardId ? { ...card, [field]: event.target.value } : card) } })}>{imageOptions}</select></label>)}
        </details><details><summary>Hero and villain media</summary>{(['hero', 'villain'] as const).map(side => <div key={side}><label className="lesson-field">{side === 'hero' ? 'Hero portrait' : 'Villain portrait'}<select disabled={disabled} value={activity.config.encounter[side].portrait} onChange={event => commit({ ...activity, config: { ...activity.config, encounter: { ...activity.config.encounter, [side]: { ...activity.config.encounter[side], portrait: event.target.value } } } })}>{imageOptions}</select></label><label className="lesson-field">{side === 'hero' ? 'Hero video' : 'Villain video'}<select disabled={disabled} value={activity.config.encounter[side].video ?? ''} onChange={event => commit({ ...activity, config: { ...activity.config, encounter: { ...activity.config.encounter, [side]: { ...activity.config.encounter[side], video: event.target.value } } } })}>{videoOptions}</select></label></div>)}
        </details><details><summary>Cutscene media</summary>{activity.config.encounter.cutscenes.map(clip => <label className="lesson-field" key={clip.id}>{clip.name}<select disabled={disabled} value={clip.mediaSource} onChange={event => { const asset = registry.get(event.target.value.slice(6)); if (!asset || asset.mediaType === 'audio') return; commit({ ...activity, config: { ...activity.config, encounter: { ...activity.config.encounter, cutscenes: activity.config.encounter.cutscenes.map(item => item.id === clip.id ? { ...item, mediaSource: event.target.value, mediaType: asset.mediaType as 'image' | 'video' } : item) } } }); }}><option value={clip.mediaSource}>Current media</option>{registry.list().filter(asset => asset.mediaType !== 'audio').map(asset => <option key={asset.id} value={`asset:${asset.id}`}>{asset.originalName || asset.filename}</option>)}</select></label>)}</details>
      </>}
      <details><summary>Permanent reward mapping</summary>
        <p>Choose the adventure reward that each game reward may request. A teacher still approves each grant.</p>
        {!project.adventureDefinition && <p>Add adventure reward definitions in Edit first.</p>}
        {(activity.moduleType === 'language-snake' ? [{ id: 'hero-crown', name: 'Hero crown' }] : activity.moduleType === 'final-boss-hero' ? activity.config.encounter.rewards : []).map(reward => <label className="lesson-field" key={reward.id}>{reward.name}<select disabled={disabled || !project.adventureDefinition} value={activity.rewardBindings?.[reward.id] ?? ''} onChange={event => { const bindings = { ...activity.rewardBindings }; if (event.target.value) bindings[reward.id] = event.target.value; else delete bindings[reward.id]; commit({ ...activity, rewardBindings: bindings }); }}><option value="">Teacher chooses when approving</option>{project.adventureDefinition?.rewards.map(definition => <option key={definition.id} value={definition.id}>{definition.name}</option>)}</select></label>)}
      </details>
      <details><summary>All authored settings</summary><p>Edit the complete versioned configuration. Media references use stable <code>asset:</code> identifiers; runtime saves and student data are rejected.</p><textarea aria-label="Activity configuration JSON" disabled={disabled} rows={16} style={{ width: '100%' }} value={draft} onChange={event => setDraft(event.target.value)} /><button disabled={disabled} onClick={() => { try { commit({ ...activity, config: JSON.parse(draft) }); } catch (reason) { setError(String(reason)); } }}>Apply activity settings</button></details>
    </>}
    {error && <p role="alert" className="lesson-error">{error}</p>}
  </section>;
}
