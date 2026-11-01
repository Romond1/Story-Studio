import {useTeacherChange,notifyTeacher} from './teacherNotifications';
import {prepareMiniGame} from '../../shared/lesson/miniGameSetup';
import {gameCommand} from './miniGameCommands';
import { WheelFeedbackControls } from './WheelFeedbackControls';
import { useGameEffectSound } from './useWheelSounds';
import { useWheelSounds } from './useWheelSounds';
import { audioController } from '../audio/AudioController';
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { LessonProject, LessonSession } from '../../shared/lesson/model';
import type { MiniGameConfig } from '../../shared/lesson/miniGameBreak';
import { actOnMiniGame, stepScene } from '../../shared/lesson/session';
import { initializeWheel, restoreWheel, eligibleWheelSegments, wheelSessionProblems, type WheelAction } from '../../shared/lesson/wheelRuntime';
import { readWheelSettings, activityLabel } from '../../shared/lesson/spinningWheel';
import './wheelRuntime.css';

export function WheelTeachControls({ participantIds, config, project, session, onSession, manualGroupScoring=false }: { manualGroupScoring?:boolean; participantIds?:string[]; config: MiniGameConfig; project: LessonProject; session: LessonSession; onSession: Dispatch<SetStateAction<LessonSession>> }) {
  const setup=prepareMiniGame(config,project); config=setup.config;
  const state = restoreWheel(config, session.miniGame) ?? initializeWheel(config)!, settings = readWheelSettings(config)!;
  useTeacherChange(state.phase,({ready:'Game reset and ready',selecting:'Choose the next activity',revealed:'Drawing an activity…',active:'Activity revealed','activity-complete':'Activity complete · choose Next','session-complete':'Game complete'})[state.phase],true,'game-phase');
  useTeacherChange(state.questionFaceId,`Card flipped · face ${(()=>{const a=config.activities.find(a=>a.id===state.currentActivityId),faces=a?.contentRef?project.cards[a.contentRef]?.faces:undefined;return Math.max(0,faces?.findIndex(f=>f.id===state.questionFaceId)??0)+1;})()}`,state.phase==='active','card-face');
  const [autoReveal,setAutoReveal]=useState(true),[revealReady,setRevealReady]=useState(false);
  const [sounds,setSounds] = useState(false);
  const [soundStatus,setSoundStatus] = useState('');
  const testGameSound = () => {
    void audioController.activateGameSounds().then(() => {
      audioController.playWheelCue('reveal');
      const {muted,volumes,monitoringEnabled}=audioController.getSnapshot().settings;
      const mediaSilent=muted.media || volumes.media===0;
      const monitorSilent=!monitoringEnabled || muted.monitor || volumes.monitor===0;
      const mixSilent=muted.master || muted.mix || volumes.master===0 || volumes.mix===0;
      setSoundStatus(mediaSilent || monitorSilent && mixSilent ? 'Game audio is muted in the mixer. Check Media and output volume in Audio settings.' : 'Test cue played through the audio mixer. Check the selected output in Audio settings if silent.');
    }).catch(() => setSoundStatus('Could not start game audio. Check Audio settings, then try Test game sound.'));
  };
  useGameEffectSound(state.effect,sounds);
  useWheelSounds(['revealed','active'].includes(state.phase) ? state.spin : undefined,settings.segments.length,sounds);
  const [picked, setPicked] = useState(''), [confirmation, setConfirmation] = useState<WheelAction | null>(null);
  useEffect(() => { setConfirmation(null); setPicked(''); }, [state.revision, session.id, session.visit, session.cursor?.entryId]);
  const problems = wheelSessionProblems(config, id => !!project.cards[id]?.faces.length,id=>project.assets.some(a=>a.id===id && ['image','video','audio'].includes(a.mediaType)));
  const candidates = eligibleWheelSegments(config, state);
  const entries = session.cursor ? project.sequences[session.cursor.sequence] : [];
  const hasNextScene = !!session.cursor && entries.findIndex(entry => entry.id === session.cursor!.entryId) < entries.length - 1;
  const activity = config.activities.find(a => a.id === state.currentActivityId);
  const command = (type:WheelAction['type']):WheelAction => gameCommand(config,session,type,{sound:sounds,...(type==='select' && config.gameType!=='mystery-cards' && settings.sequenceMode==='teacher-selected'?{segmentId:picked}:{})});
  const send = (value: WheelAction) => onSession(current => actOnMiniGame(project, current, value));
  useEffect(()=>{
    if(state.phase !== 'revealed' || !state.spin || problems.length) return;
    setRevealReady(false);
    const action=command('show');
    const timer=window.setTimeout(()=>{setRevealReady(true);if(autoReveal)send({...action,atMs:Date.now()});},Math.max(0,state.spin.startedAt+state.spin.durationMs-Date.now())+40);
    return ()=>window.clearTimeout(timer);
  },[state.revision,state.spin?.id,session.id,session.visit,session.cursor?.entryId,problems.length,onSession,sounds,autoReveal]);
  const questionMedia=activity?.kind==='question'?project.assets.find(a=>a.id===activity.config?.mediaAssetId):undefined;
  const faces = activity?.kind === 'question' && activity.contentRef ? project.cards[activity.contentRef]?.faces ?? [] : [];
  const control = (type: WheelAction['type'], label: string, disabled = false) => <button className={['start','select','show','complete','next','shuffle'].includes(type) ? 'teacher-primary-action' : undefined} key={type} disabled={disabled} onClick={event => { if (event.detail > 1) return; send(command(type)); }}>{label}</button>;
  return <section className="wheel-teach-controls" aria-label={`${config.gameType==='magic-hat'?'Magic Hat':config.gameType==='mystery-cards'?'Mystery Cards':'Spinning Wheel'} controls`} onKeyDownCapture={event => { if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault(); }}>
    <h3>{settings.title || 'Spinning Wheel'}</h3>
    <p className="lesson-hint">{state.usedActivityIds.length} completed of {settings.playCount} activities · {state.skippedActivityIds.length} skipped</p>
    {state.phase==='ready' && <p role="status">{setup.sample?'No activities are ready yet. Try a sample round, then add your own questions.':`${setup.readyCount} ready activities${setup.draftCount?` · ${setup.draftCount} unfinished drafts left out`:''}. Play ${settings.playCount} this round.`}</p>}
    {problems.length > 0 && <div role="status">{problems.map(problem => <p key={problem}>{problem}</p>)}</div>}
    {activity && <p><strong>{activityLabel(activity, activity.contentRef ? project.cards[activity.contentRef]?.label : undefined)}</strong> · {activity.kind === 'question' ? 'Question' : 'Event'}</p>}
    {activity?.kind === 'event' && typeof activity.config?.instructions === 'string' && <aside className="wheel-teacher-note"><strong>Teacher only</strong><p>{activity.config.instructions || 'No teacher instructions.'}</p></aside>}
    {state.phase === 'selecting' && config.gameType!=='mystery-cards' && settings.sequenceMode === 'teacher-selected' && <label className="lesson-field">Choose an activity<select aria-label="Choose an activity" value={picked} onChange={event => setPicked(event.target.value)}><option value="">Choose an available outcome…</option>{candidates.map(segment => {
      const item = config.activities.find(a => a.id === segment.activityId)!;
      return <option key={segment.id} value={segment.id}>{segment.label || activityLabel(item, item.contentRef ? project.cards[item.contentRef]?.label : undefined)} · {item.kind} · segment {settings.segments.findIndex(s => s.id === segment.id) + 1}</option>;
    })}</select></label>}
    <label><input type="checkbox" checked={autoReveal} onChange={event=>setAutoReveal(event.target.checked)}/> Reveal automatically</label>
    <label><input type="checkbox" checked={sounds} onChange={event=>{setSounds(event.target.checked);if(event.target.checked)testGameSound();else setSoundStatus('');notifyTeacher(event.target.checked?'Game sounds on':'Game sounds off','game-sounds');}} /> Game sounds</label>
    {sounds && soundStatus && <p className="lesson-hint" role="status">{soundStatus}</p>}
    {state.phase === 'revealed' && state.spin && <p role="status">{config.gameType==='magic-hat'?'Drawing a surprise…':config.gameType==='mystery-cards'?'Revealing your card…':'Spinning… The activity will appear when the wheel lands.'}</p>}
    {state.phase === 'active' && faces.length > 1 && <label className="lesson-field">Card face<select aria-label="Card face" value={state.questionFaceId ?? faces[0].id} onChange={event=>send({...command('face'),faceId:event.target.value})}>{faces.map((face,index)=><option key={face.id} value={face.id}>Face {index+1}{index ? ' — show to class' : ' — question'}</option>)}</select></label>}
    {state.phase==='active' && questionMedia && ['video','audio'].includes(questionMedia.mediaType) && <div className="lesson-toolbar" aria-label="Question media playback">{control(state.questionPlayback?.playing?'media-pause':'media-play',state.questionPlayback?.playing?'Pause question media':'Play question media')}{control('media-restart','Restart question media')}</div>}
    <div className="lesson-toolbar">
      {state.phase === 'ready' && control('start', setup.sample?'Start sample game':'Start Game')}
      {state.phase === 'selecting' && config.gameType!=='mystery-cards' && control('select', config.gameType==='magic-hat'?'Draw from Hat':'Spin Wheel', !!problems.length || !candidates.length || settings.sequenceMode === 'teacher-selected' && !candidates.some(s => s.id === picked))}
      {state.phase==='selecting' && config.gameType==='mystery-cards' && <>{control('shuffle','Shuffle Cards')}{state.dealtSegmentIds?.map((id,index)=><button className="teacher-primary-action" key={id} onClick={()=>send({...command('select'),cardIndex:index})}>Choose Card {index+1}</button>)}</>}
      {state.phase === 'revealed' && control('show', 'Reveal', !!problems.length || !!state.spin && !revealReady)}
      {state.phase === 'active' && control('complete', 'Complete Activity', !!problems.length)}
      {state.phase === 'activity-complete' && control('next', 'Next Activity', !!problems.length)}
      {['revealed', 'active'].includes(state.phase) && control('skip', 'Skip Activity')}
      {!['ready', 'session-complete'].includes(state.phase) && <button onClick={event => { if (event.detail <= 1) setConfirmation(command('finish')); }}>Finish Game</button>}
      {state.phase !== 'ready' && <button onClick={event => { if (event.detail <= 1 && window.confirm('Reset this game and start a fresh round? Student rewards will be kept.')) send(command('reset')); }}>Reset Game</button>}
      {state.phase === 'session-complete' && <button className="teacher-primary-action" disabled={!hasNextScene} onClick={event => { if (event.detail > 1) return; onSession(current => current.id === session.id && current.visit === session.visit && current.cursor?.entryId === session.cursor?.entryId && current.miniGame?.version === 2 && current.miniGame.revision === state.revision && current.miniGame.phase === 'session-complete' ? stepScene(project, current, 1) : current); }}>Continue lesson</button>}
    </div>
    {manualGroupScoring?<p>Use Team Play points to reward any students. This game does not award group points automatically.</p>:<WheelFeedbackControls participantIds={participantIds} state={state} session={session} onSession={onSession} command={command} send={send}/>}
    {confirmation && <div className="wheel-confirmation" role="alert"><p>{confirmation.type === 'reset' ? 'Reset this game and clear its progress?' : 'Finish this game before all turns are played?'}</p><button onClick={() => { send(confirmation); setConfirmation(null); }}>{confirmation.type === 'reset' ? 'Confirm reset' : 'Confirm finish'}</button><button onClick={() => setConfirmation(null)}>Cancel</button></div>}
    {['revealed', 'active'].includes(state.phase) && <p className="lesson-hint">Skipping uses this turn and its question or event slot.</p>}
    {state.phase === 'session-complete' && <p role="status">{hasNextScene ? 'Game complete. Continue the lesson when you are ready.' : 'Game complete. This is the last activity in this sequence.'}</p>}
  </section>;
}
