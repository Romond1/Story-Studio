import type { CardsV2Module, CardSession, CardCommand } from '../../shared/cardsV2';

export function CardV2Controls({ module, placementId, state, dispatch, onReturn }: { module: CardsV2Module; placementId: string; state: CardSession | null; dispatch: (command: CardCommand) => boolean; onReturn: () => void }) {
  const activity = module.activities[module.placements[placementId]?.activityId];
  if (!activity) return <p>Card activity is missing.</p>;
  const selected = Object.values(state?.instances ?? {}).find(instance => instance.selected);
  const instance = activity.instances.find(item => item.id === selected?.instanceId);
  const card = instance && module.cards[instance.cardId];
  return <section className="card-v2-controls" aria-label="Recall and Reveal controls" style={{ display: 'grid', gap: 10, padding: 16 }}>
    <strong>{activity.label}{activity.setId ? ' · Recall & Reveal' : ''}</strong>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button onClick={() => dispatch({ type: state ? 'ResetActivity' : 'StartActivity', ...(!state ? { placementId } : {}) } as CardCommand)}>{state ? (activity.setId?'Reset activity':'Reset cards') : 'Start activity'}</button>
      <button disabled={!state} onClick={() => dispatch({ type: 'RevealAll' })}>Reveal all targets</button>
      <button onClick={onReturn}>Return to story</button>
    </div>
    <label>Select card <select aria-label="Select activity card" value={selected?.instanceId ?? ''} disabled={!state} onChange={event => dispatch({ type: 'SelectCard', instanceId: event.target.value })}>
      <option value="">Choose a card</option>{activity.instances.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {module.cards[item.cardId].label}</option>)}
    </select></label>
    {selected && card && instance ? <>
      <label>Show face <select aria-label="Show card face" disabled={!activity.allowDirectFace} value={selected.faceId} onChange={event => dispatch({ type: 'SetFace', instanceId: instance.id, faceId: event.target.value })}>{card.faces.map(face => <option key={face.id} value={face.id}>{face.label}</option>)}</select></label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button disabled={!activity.allowCycling} onClick={() => dispatch({ type: 'PreviousFace', instanceId: instance.id })}>Previous face</button>
        <button disabled={!activity.allowCycling} onClick={() => dispatch({ type: 'NextFace', instanceId: instance.id })}>Next face</button>
        <button onClick={() => dispatch({ type: 'ResetFace', instanceId: instance.id })}>Reset face</button>
        <button onClick={() => dispatch({ type: 'SetConcealment', instanceId: instance.id, concealed: !selected.concealed })}>{selected.concealed ? 'Uncover selected' : 'Conceal selected'}</button>
        <button onClick={() => dispatch({ type: 'RevealSelected' })}>Reveal selected target</button>
        <button disabled={!activity.allowDirectFace} onClick={() => dispatch({ type: 'SetFaceAll', faceId: selected.faceId })}>Show this face on eligible cards</button>
      </div>
      <small>Face changes and concealment are separate. Reveal uses each card’s authored target. Teacher judgment only; no scoring.</small>
    </> : <p>{state ? 'Select a card in the preview or list.' : 'Start to enable teacher controls.'}</p>}
  </section>;
}
