import {prepareMiniGame} from '../../shared/lesson/miniGameSetup';
import { WheelGraphic } from './WheelGraphic';
import { MagicHatStage } from './MagicHatStage';
import { MysteryCardsStage } from './MysteryCardsStage';
import type { LessonProject } from '../../shared/lesson/model';
import type { MiniGameConfig } from '../../shared/lesson/miniGameBreak';
import { readWheelSettings, activityLabel } from '../../shared/lesson/spinningWheel';
import { LogicalSceneFrame } from '../StaticScene';
import './miniGameEditor.css';
import './wheelRuntime.css';

/** Editor-only composition: no random selection, timers, audio or live-session actions. */
export function SpinningWheelPreview({ config, project, frame }: { config: MiniGameConfig; project: LessonProject; frame: { width: number; height: number } }) {
  const poolCount=config.activities.length;
  config=prepareMiniGame(config,project).config;
  const s = readWheelSettings(config); if (!s) return null;
  if (config.gameType === 'magic-hat' || config.gameType === 'mystery-cards') {
    const isHat = config.gameType === 'magic-hat';
    const count = typeof s.visibleCards === 'number' ? Math.min(5, Math.max(3, s.visibleCards)) : 3;
    const slots = Array.from({ length: count }, (_, index) => ({ id: `preview-${index}`, index, selected: false, used: false }));
    return <div className="wheel-preview" aria-label={`${isHat ? 'Magic Hat' : 'Mystery Cards'} static preview`}>
      <LogicalSceneFrame frame={frame}>
        <div className="wheel-live game-static-preview" style={{ width: frame.width, height: frame.height, fontSize: Math.min(frame.width / 40, frame.height / 22) }}>
          <header><h1><span className="wheel-game-kicker">{isHat ? 'The conjurer’s atelier' : 'The veiled archive'}</span>{s.title || (isHat ? 'Magic Hat' : 'Mystery Cards')}</h1><div className="wheel-hud"><p>Static preview</p></div></header>
          <div className="wheel-live-body" style={{ gridTemplateColumns: frame.width / frame.height < 1.1 ? '1fr' : '50% minmax(0, 1fr)', gridTemplateRows: frame.width / frame.height < 1.1 ? '45% minmax(0, 1fr)' : undefined }}>
            <div className="wheel-dial">{isHat ? <MagicHatStage phase="ready"/> : <MysteryCardsStage phase="ready" slots={slots}/>}</div>
            <section className="wheel-result"><h2>This Break</h2><h3>{s.playCount} activities</h3><p>{s.questionCount} questions · {s.playCount - s.questionCount} events</p><p>{poolCount} outcomes in the pool</p><p>{s.sequenceMode === 'alternating' ? 'Alternating questions and events' : s.sequenceMode === 'randomized' ? 'Randomized order' : 'Teacher-selected order'}</p><p className="game-preview-hint">Choose Test game to try this Break, or Teach to play in Present.</p></section>
          </div>
        </div>
      </LogicalSceneFrame>
    </div>;
  }
  const segments = s.segments, count = segments.length;
  return <div className="wheel-preview" aria-label="Spinning Wheel static preview" data-wheel-segments={count}>
    <LogicalSceneFrame frame={frame}>
      <svg viewBox="0 0 1280 720" width="100%" height="100%" role="img" aria-label={`${s.title || 'Spinning Wheel'}: ${count} segments, ${s.playCount} activities to play`} preserveAspectRatio="xMidYMid meet">
        <rect width="1280" height="720" fill="#172332" />
        <text x="72" y="77" fill="#f3f6fc" fontSize="36" fontWeight="600">{(s.title || 'Spinning Wheel').slice(0, 48)}{s.title.length > 48 ? '…' : ''}</text>
        <text x="72" y="113" fill="#b6c7db" fontSize="19">Static preview</text>
        <WheelGraphic segments={segments.map(segment => { const activity = config.activities.find(a => a.id === segment.activityId); return { id: segment.id, label: segment.label || (activity ? activityLabel(activity, activity.contentRef ? project.cards[activity.contentRef]?.label : undefined) : 'Activity') }; })} />
        {!count && <text x="360" y="470" fill="#b6c7db" textAnchor="middle" fontSize="22">Add outcomes to your wheel</text>}
        <text x="704" y="255" fill="#b6c7db" fontSize="22">THIS BREAK</text>
        <text x="704" y="320" fill="#f3f6fc" fontSize="48">{s.playCount} activities</text>
        <text x="704" y="370" fill="#d2dfed" fontSize="25">{s.questionCount} questions · {s.playCount - s.questionCount} events</text>
        <text x="704" y="430" fill="#b6c7db" fontSize="23">{poolCount} outcomes in the pool</text>
        <text x="704" y="470" fill="#b6c7db" fontSize="23">{count} wheel segments</text>
        <text x="704" y="540" fill="#d2dfed" fontSize="23">{s.sequenceMode === 'alternating' ? 'Alternating questions and events' : s.sequenceMode === 'randomized' ? 'Randomized order' : 'Teacher-selected order'}</text>
        <text x="72" y="701" fill="#b6c7db" fontSize="19">Choose Test game above to spin here, or Teach to run this Break in Present.</text>
      </svg>
    </LogicalSceneFrame>
  </div>;
}
