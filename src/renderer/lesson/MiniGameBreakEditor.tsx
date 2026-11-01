import { useState } from 'react';
import { QuestionMediaPicker } from './QuestionMediaPicker';
import type { LessonScene, LessonProject } from '../../shared/lesson/model';
import { isMiniGameConfig, miniGameRegistry, setBreakMode, selectBreakGame, type MiniGameConfig, type JsonValue } from '../../shared/lesson/miniGameBreak';
import { createGameConfig, readWheelSettings, addWheelActivity, removeWheelActivity, activityLabel } from '../../shared/lesson/spinningWheel';
import { prepareMiniGame } from '../../shared/lesson/miniGameSetup';
import './miniGameEditor.css';

export function MiniGameBreakEditor({ scene, project, onChange, onEditQuestion, onImportMedia, resolveAsset }: {
  scene: LessonScene; project: LessonProject; onChange: (scene: LessonScene) => void;
  onEditQuestion: (activityId: string, createNew: boolean) => void; onImportMedia?: () => void; resolveAsset?: (id: string) => string | undefined;
}) {
  const experience = scene.breakExperience;
  const selected = experience?.mode === 'minigame' ? experience : undefined;
  const editable = selected && isMiniGameConfig(selected) && miniGameRegistry.has(selected.gameType) &&
    (selected.configVersion === 1 && miniGameRegistry.get(selected.gameType)!.validate(selected) || readWheelSettings(selected))
    ? createGameConfig(selected.gameType, selected) : undefined;
  const update = (config: MiniGameConfig) => onChange({ ...scene, breakExperience: { ...config, ...(experience?.savedMiniGames ? { savedMiniGames: experience.savedMiniGames } : {}) } });
  return <details className="lesson-inspector-section mini-game-editor" open>
    <summary>Break experience</summary><div>
      <label className="lesson-field">Mode<select aria-label="Mode" value={selected ? 'minigame' : 'classic'} onChange={e => onChange({ ...scene, breakExperience: setBreakMode(experience, e.target.value as 'classic' | 'minigame') })}><option value="classic">Classic Break</option><option value="minigame">Mini-Game Break</option></select></label>
      {!selected && Array.isArray(experience?.savedMiniGames) && experience.savedMiniGames.length > 0 && <p className="lesson-hint">Your game setup is saved. Switch back any time.</p>}
      {selected && <><label className="lesson-field">Game<select aria-label="Game" value={typeof selected.gameType === 'string' ? selected.gameType : ''} onChange={e => onChange({ ...scene, breakExperience: selectBreakGame(experience, e.target.value) })}>
        {!miniGameRegistry.has(selected.gameType) && <option value={typeof selected.gameType === 'string' ? selected.gameType : ''}>Unavailable game</option>}
        {[...miniGameRegistry.values()].map(game => <option key={game.id} value={game.id}>{game.name}</option>)}
      </select></label>
      {editable ? <CommonGameEditor key={editable.gameType} config={editable} project={project} onChange={update} onEditQuestion={onEditQuestion} onImportMedia={onImportMedia} resolveAsset={resolveAsset} /> : <p className="lesson-hint" role="status">This game cannot be edited here. Its saved content has been kept.</p>}</>}
    </div>
  </details>;
}

function CommonGameEditor({ config, project, onChange, onEditQuestion, onImportMedia, resolveAsset }: {
  config: MiniGameConfig; project: LessonProject; onChange: (config: MiniGameConfig) => void;
  onEditQuestion: (id: string, fresh: boolean) => void; onImportMedia?: () => void; resolveAsset?: (id: string) => string | undefined;
}) {
  const s = readWheelSettings(config)!;
  const [quickQuestion, setQuickQuestion] = useState('');
  const prepared = prepareMiniGame(config, project);
  const change = (patch: Record<string, JsonValue>) => onChange({ ...config, settings: { ...s, ...patch } });
  const updateActivity = (id: string, patch: Partial<MiniGameConfig['activities'][number]>) => onChange({ ...config, activities: config.activities.map(a => a.id === id ? { ...a, ...patch } : a) });
  const label = (id: string) => { const a = config.activities.find(a => a.id === id); return a ? activityLabel(a, (a.contentRef ? project.cards[a.contentRef]?.label : undefined) || (typeof a.config?.prompt === 'string' ? a.config.prompt.trim().slice(0, 80) : undefined)) : 'Choose an activity'; };
  const full = config.activities.length >= 1000 || s.segments.length >= 1000;
  const addQuestion = () => {
    if (!quickQuestion.trim() || full) return;
    const next = addWheelActivity(config, 'question');
    if (next === config) return;
    const last = next.activities[next.activities.length - 1];
    onChange({ ...next, activities: next.activities.map(a => a.id === last.id ? { ...a, config: { ...a.config, prompt: quickQuestion.trim() } } : a) });
    setQuickQuestion('');
  };
  return <div className="wheel-editor" aria-label={`${miniGameRegistry.get(config.gameType)?.name ?? 'Mini-game'} setup`}>
    <label className="lesson-field">Game title<input value={s.title} maxLength={200} onChange={e => change({ title: e.target.value })} /></label>
    <label className="wheel-auto-session"><input type="checkbox" checked={s.autoSession === true} onChange={e => change({ autoSession: e.target.checked })} />Use all ready activities</label>
    <p className="lesson-hint" role="status">{prepared.readyCount} ready{prepared.draftCount ? ` · ${prepared.draftCount} drafts saved for later` : ''}</p>
    {config.gameType === 'magic-hat' && <label className="lesson-field">Reveal style<select aria-label="Reveal style" value={typeof s.revealStyle === 'string' ? s.revealStyle : 'varied'} onChange={e => change({ revealStyle: e.target.value })}><option value="varied">A little of everything</option><option value="bounce">Bouncing reveal</option><option value="starlight">Starlight</option><option value="portal">Magic portal</option></select></label>}
    {config.gameType === 'mystery-cards' && <div className="wheel-fields"><label className="lesson-field">Cards on the table<select aria-label="Cards on the table" value={typeof s.visibleCards === 'number' ? s.visibleCards : 3} onChange={e => change({ visibleCards: Number(e.target.value) })}>{[3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</select></label><label className="lesson-field">Shuffle<select aria-label="Shuffle" value={typeof s.shuffleBehavior === 'string' ? s.shuffleBehavior : 'each-turn'} onChange={e => change({ shuffleBehavior: e.target.value })}><option value="each-turn">Before each turn</option><option value="manual">When I choose</option></select></label></div>}
    <details className="wheel-round-options"><summary>Round options</summary><fieldset className="wheel-fields" disabled={s.autoSession === true}><legend>Custom round</legend>
      <label className="lesson-field">Activities to play<input type="number" min={1} max={1000} value={s.playCount} onChange={e => { const n = e.target.valueAsNumber; if (Number.isInteger(n) && n >= 1 && n <= 1000) change({ playCount: n, questionCount: Math.min(s.questionCount, n) }); }} /></label>
      <label className="lesson-field">Questions to play<input type="number" min={0} max={s.playCount} value={s.questionCount} onChange={e => { const n = e.target.valueAsNumber; if (Number.isInteger(n) && n >= 0 && n <= s.playCount) change({ questionCount: n }); }} /></label>
      <p className="lesson-hint">{s.playCount - s.questionCount} events to play</p>
      <label className="lesson-field">Activity sequence<select aria-label="Activity sequence" value={s.sequenceMode} onChange={e => change({ sequenceMode: e.target.value })}><option value="alternating">Alternating questions and events</option><option value="randomized">Randomized</option><option value="teacher-selected">Teacher-selected</option></select></label>
    </fieldset></details>
    <section aria-label="Activity pool" className="wheel-pool"><h4>Questions & events <span>{config.activities.length}</span></h4>
      <form className="wheel-quick-question" onSubmit={e => { e.preventDefault(); addQuestion(); }}><label className="lesson-field">Ask a question<input aria-label="Quick question" maxLength={2000} placeholder="What can you see in the picture?" value={quickQuestion} onChange={e => setQuickQuestion(e.target.value)} /></label><button type="submit" disabled={!quickQuestion.trim() || full}>Add question</button></form>
      <div className="lesson-actions"><button disabled={full} onClick={() => onChange(addWheelActivity(config, 'question'))}>Add Card or media question</button><button disabled={full} onClick={() => onChange(addWheelActivity(config, 'event'))}>Add event</button></div>
      {!config.activities.length && <p className="lesson-empty">Type a question above, or add a Card, media question or event.</p>}
      {config.activities.map((a, index) => <details className="wheel-activity" key={a.id}><summary><span>{index + 1}. {label(a.id)}</span><small>{a.kind === 'question' ? 'Question' : 'Event'}</small></summary><div>
        <label className="lesson-field">Activity label (optional)<input maxLength={200} value={typeof a.config?.label === 'string' ? a.config.label : ''} onChange={e => updateActivity(a.id, { config: { ...a.config, label: e.target.value } })} /></label>
        {a.kind === 'question' ? <>
          <label className="lesson-field">Question text<textarea aria-label="Question text" rows={2} maxLength={2000} value={typeof a.config?.prompt === 'string' ? a.config.prompt : ''} onChange={e => updateActivity(a.id, { config: { ...a.config, prompt: e.target.value } })} /></label>
          <QuestionMediaPicker assets={project.assets} resolveAsset={resolveAsset} value={typeof a.config?.mediaAssetId === 'string' ? a.config.mediaAssetId : ''} onChange={value => { const next = { ...a.config }; if (value) next.mediaAssetId = value; else delete next.mediaAssetId; updateActivity(a.id, { config: next }); }} />
          {onImportMedia && <button onClick={onImportMedia}>Import question media</button>}
          <label className="lesson-field">Question Card (optional)<select aria-label="Question Card" value={a.contentRef ?? ''} onChange={e => { const { contentRef: _old, ...rest } = a; onChange({ ...config, activities: config.activities.map(item => item.id === a.id ? { ...rest, ...(e.target.value ? { contentRef: e.target.value } : {}) } : item) }); }}><option value="">Choose an existing Card…</option>{a.contentRef && !project.cards[a.contentRef] && <option value={a.contentRef}>Missing Card</option>}{Object.values(project.cards).map(card => <option key={card.id} value={card.id}>{card.label || card.faces[0]?.text?.slice(0, 60) || 'Untitled Card'}</option>)}</select></label>
          <div className="lesson-actions"><button disabled={!a.contentRef || !project.cards[a.contentRef]} onClick={() => onEditQuestion(a.id, false)}>Edit Card</button><button onClick={() => onEditQuestion(a.id, true)}>New Card</button></div>
          <p className="lesson-hint">Use a Card, text, media, or combine them. Editing a shared Card updates its other uses.</p>
        </> : <>
          <label className="lesson-field">Teacher instructions<textarea aria-label="Teacher instructions" rows={3} maxLength={2000} value={typeof a.config?.instructions === 'string' ? a.config.instructions : ''} onChange={e => updateActivity(a.id, { config: { ...a.config, instructions: e.target.value } })} /></label>
          <label className="lesson-field">Surprise style<select aria-label="Surprise style" value={typeof a.config?.surpriseStyle === 'string' && ['portal', 'chest', 'sprite'].includes(a.config.surpriseStyle) ? a.config.surpriseStyle : 'portal'} onChange={e => updateActivity(a.id, { config: { ...a.config, surpriseStyle: e.target.value } })}><option value="portal">Magic portal</option><option value="chest">Treasure chest</option><option value="sprite">Friendly magic</option></select></label>
          <label className="lesson-field">Student message (optional)<textarea rows={2} maxLength={2000} value={typeof a.config?.studentText === 'string' ? a.config.studentText : ''} onChange={e => updateActivity(a.id, { config: { ...a.config, studentText: e.target.value } })} /></label>
        </>}
        <button onClick={() => onChange(removeWheelActivity(config, a.id))}>Remove {a.kind}</button>
      </div></details>)}
    </section>
    {config.gameType === 'spinning-wheel' && <details className="wheel-segments"><summary>Wheel segments · {s.segments.length}</summary><div>
      <p className="lesson-hint">Segments point to your saved questions and events. Extra segments do not add plays.</p>
      {s.segments.map((segment, index) => <fieldset className="wheel-fields" key={segment.id}><legend>Segment {index + 1}</legend><label className="lesson-field">Segment activity<select aria-label="Segment activity" value={segment.activityId} onChange={e => change({ segments: s.segments.map(item => item.id === segment.id ? { ...item, activityId: e.target.value } : item) })}>{config.activities.map(a => <option key={a.id} value={a.id}>{label(a.id)}</option>)}</select></label><label className="lesson-field">Segment label (optional)<input maxLength={200} value={segment.label} onChange={e => change({ segments: s.segments.map(item => item.id === segment.id ? { ...item, label: e.target.value } : item) })} /></label><button onClick={() => change({ segments: s.segments.filter(item => item.id !== segment.id) })}>Remove segment</button></fieldset>)}
      <button disabled={!config.activities.length || s.segments.length >= 1000} onClick={() => change({ segments: [...s.segments, { id: crypto.randomUUID(), activityId: config.activities[0].id, label: '' }] })}>Add segment</button>
    </div></details>}
    <p className="lesson-hint">Test your game here, then open Teach when you are ready to play with the class.</p>
  </div>;
}
