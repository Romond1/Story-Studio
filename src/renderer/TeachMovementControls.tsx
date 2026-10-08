import type { MovementConfig, MovementEventConfig } from '../shared/types';
import type { MovementPresentation } from '../shared/movementPresentation';

/** A command surface only; Core still owns selection, timing and sound. */
export function TeachMovementControls({ config, active, onTrigger, onRandom, onStop }: {
 config: MovementConfig;
 active: MovementPresentation | null;
 onTrigger: (event: MovementEventConfig) => void;
 onRandom: () => void;
 onStop: () => void;
}) {
 const events = config.events.filter(event => event.enabled);
 return <section className="teach-live-card teach-movement-controls" aria-label="Quick Movement">
  <div className="teach-live-heading"><h3>Movement</h3><button type="button" disabled={!config.randomEnabled || !events.length} onClick={onRandom}>Random</button></div>
  <div className="teach-movement-events">
   {events.map(event => <button key={event.id} type="button" title={event.instruction} onClick={() => onTrigger(event)}>{event.name}</button>)}
  </div>
  {!events.length && <p className="teach-live-empty">Enable movement activities in Edit.</p>}
  <div className="teach-live-actions"><span role="status">{active ? `Active: ${active.event.name}` : 'Ready for a movement break'}</span>
   <button type="button" disabled={!active} onClick={onStop}>Stop movement</button>
  </div>
 </section>;
}
