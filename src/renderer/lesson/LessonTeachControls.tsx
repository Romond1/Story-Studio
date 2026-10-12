import type { Dispatch, SetStateAction } from 'react';
import type { LessonProject, LessonSession, LessonScene } from '../../shared/lesson/model';
import { cardAction, type CardAction } from '../../shared/lesson/session';
import { LessonRewardControls } from './LessonRewardControls';
import { CameraControls } from '../camera/CameraControls';

export function LessonTeachControls({ project, scene, session, onSession, selectedId, onSelect, drawing, onDrawing, onPlayAudio, onStopAudio }: {
  project: LessonProject; scene?: LessonScene; session: LessonSession; onSession: Dispatch<SetStateAction<LessonSession>>;
  selectedId: string | null; onSelect: (id: string) => void; drawing: boolean; onDrawing: (value: boolean) => void;
  onPlayAudio: () => void; onStopAudio: () => void;
}) {
  const cards = scene?.objects.filter(object => object.kind === 'card') ?? [];
  const selected = cards.find(object => object.id === selectedId) ?? cards[0];
  const definition = selected?.kind === 'card' ? project.cards[selected.cardId] : undefined;
  const act = (action: CardAction | { faceId: string }) => { if (selected) onSession(current => cardAction(project, current, selected.id, action)); };
  const viewport = session.viewport;
  const setViewport = (zoom: number, x: number, y: number) => onSession(current => ({ ...current, revision: current.revision + 1, viewport: { zoom, pan: { x, y } } }));
  return <aside className="lesson-teach-controls lesson-side" aria-label="Teaching controls">
    <h2>Live controls</h2><p>Changes here affect the student presentation.</p>
    <CameraControls />
    <section><h3>Cards</h3>
      {!cards.length ? <p>No cards in this scene.</p> : <><label>Card<select value={selected?.id ?? ''} onChange={e => onSelect(e.target.value)}>{cards.map(object => <option key={object.id} value={object.id}>{object.kind === 'card' ? project.cards[object.cardId]?.label : ''}</option>)}</select></label>
      <label>Show face<select value={selected?.kind === 'card' ? session.cards[selected.id]?.faceId ?? selected.initialFaceId : ''} onChange={e => act({ faceId: e.target.value })}>{definition?.faces.map(face => <option key={face.id} value={face.id}>{face.label}</option>)}</select></label>
      <div className="lesson-toolbar"><button onClick={() => act('previous')}>Previous face</button><button onClick={() => act('next')}>Next face</button><button onClick={() => act('conceal')}>Conceal</button><button onClick={() => act('reveal')}>Reveal</button><button onClick={() => act('reset')}>Reset card</button></div></>}
    </section>
    <section><h3>Draw and explore</h3><button aria-pressed={drawing} onClick={() => onDrawing(!drawing)}>{drawing ? 'Finish drawing' : 'Draw on scene'}</button>
      <label>Zoom<input aria-label="Live zoom" type="range" min="1" max="4" step="0.1" value={viewport.zoom} onChange={e => setViewport(Number(e.target.value), viewport.pan.x, viewport.pan.y)} /></label>
      <div className="lesson-toolbar"><button onClick={() => setViewport(viewport.zoom, viewport.pan.x + 60, viewport.pan.y)}>Pan right</button><button onClick={() => setViewport(viewport.zoom, viewport.pan.x - 60, viewport.pan.y)}>Pan left</button><button onClick={() => setViewport(viewport.zoom, viewport.pan.x, viewport.pan.y + 60)}>Pan down</button><button onClick={() => setViewport(viewport.zoom, viewport.pan.x, viewport.pan.y - 60)}>Pan up</button><button onClick={() => setViewport(1, 0, 0)}>Reset view</button></div>
    </section>
    <section><h3>Scene audio</h3><button disabled={!scene?.audio.length} onClick={onPlayAudio}>Play scene audio</button><button onClick={onStopAudio}>Stop scene audio</button></section>
    <LessonRewardControls session={session} onSession={onSession} />
  </aside>;
}
