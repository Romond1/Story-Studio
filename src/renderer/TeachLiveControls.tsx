import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { AudioClip, Section, Slide } from "../shared/types";
import type { AudioRouteCategory } from "../shared/audioRoutingPlan";
import { REWARD_DEFINITIONS, REWARD_VARIANTS } from "../shared/sparkRewards";
import { useSparks } from "./sparks/SparkProvider";
import { audioController } from "./audio/AudioController";
import { useAudioController } from "./audio/useAudioController";
import { AudioMeter } from "./audio/AudioMeter";
import { AudioStatus } from "./audio/AudioStatus";
import "./TeachLiveControls.css";
import { CameraControls } from './camera/CameraControls';
import { TranslationControls } from './translation/TranslationControls';

export interface TeachLiveControlsProps {
  onOpenAudio: () => void;
  movementControls?: ReactNode;
  section?: Section | null;
  slide?: Slide | null;
}

function LiveClip({ clip, category, label }: { clip: AudioClip; category: AudioRouteCategory; label: string }) {
  const [volume, setVolume] = useState(clip.volume);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const request = useRef(0);
  const liveVolume = useRef(volume);
  const status = useSyncExternalStore(audioController.subscribe, () => (
    audioController.isPlaying(clip.url) ? "Playing" : audioController.getCurrentTime(clip.url) > 0 ? "Paused" : "Stopped"
  ));
  useEffect(() => () => { request.current++; }, []);

  const play = async () => {
    const token = ++request.current;
    setLoading(true);
    setError(false);
    try { await audioController.preload(clip.url); } catch { if (request.current === token) { setLoading(false); setError(true); } return; }
    if (request.current !== token) return;
    setLoading(false);
    if (!audioController.getDuration(clip.url)) { setError(true); return; }
    if (category === "section-bgm") {
      audioController.playSectionMusic(clip.url, liveVolume.current, clip.fadeEnabled);
    } else {
      audioController.playClip(clip.url, liveVolume.current, category === "slide-bgm", { fadeEnabled: !!clip.fadeEnabled }, category);
    }
  };

  return <div className="teach-live-clip">
    <div className="teach-live-heading"><strong>{clip.name || label}</strong><small role="status">{error ? "Unable to load" : loading ? "Loading…" : status}</small></div>
    <div className="teach-live-actions">
      <button type="button" disabled={loading} onClick={() => status === "Playing" ? audioController.pauseClip(clip.url) : void play()}>{status === "Playing" ? "Pause" : "Play"}</button>
      <button type="button" onClick={() => {
        request.current++;
        setLoading(false);
        if (category === "section-bgm") audioController.stopSectionMusic(clip.url, clip.fadeEnabled);
        else audioController.stopClip(clip.url, { fadeEnabled: !!clip.fadeEnabled });
      }}>{clip.fadeEnabled ? "Fade out" : "Stop"}</button>
    </div>
    <label className="teach-live-level"><span>Volume</span><input aria-label={`${clip.name || label} volume`} type="range" min="0" max="1" step="0.01" value={volume} onChange={event => {
      const next = Number(event.target.value);
      liveVolume.current = next;
      setVolume(next);
      audioController.setVolume(clip.url, next);
    }} /><output>{Math.round(volume * 100)}%</output></label>
  </div>;
}

export function TeachLiveControls({ onOpenAudio, section, slide, movementControls }: TeachLiveControlsProps) {
  const sparks = useSparks();
  const { snapshot, controller } = useAudioController();
  const slideClips = [
    ...(slide?.dialogue ?? []).map(clip => ({ clip, category: "dialogue" as const, label: "Dialogue" })),
    ...(slide?.sfx ?? []).map(clip => ({ clip, category: "sfx" as const, label: "Sound effect" })),
    ...(slide?.bgm ? [{ clip: slide.bgm, category: "slide-bgm" as const, label: "Slide music" }] : []),
  ];
  return <div className="teach-live-controls">
    <CameraControls />
    <TranslationControls />
    <section className="teach-live-card" aria-label="Live rewards">
      <div className="teach-live-heading"><h3>Rewards</h3><strong aria-live="polite">{sparks.totalSparks} total</strong></div>
      <label className="teach-live-student">Active student<select aria-label="Active student" value={sparks.activeStudentId ?? ""} disabled={!sparks.students.length} onChange={event => sparks.setActiveStudentId(event.target.value)}>
        {!sparks.students.length && <option value="">No students</option>}
        {sparks.students.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}
      </select></label>
      <div className="teach-live-rewards">{REWARD_VARIANTS.map(variant => {
        const reward = REWARD_DEFINITIONS[variant];
        return <button key={variant} type="button" disabled={!sparks.activeStudent} aria-label={`Award ${reward.label} to ${sparks.activeStudent?.name || "student"}`} style={{ color: `rgb(${reward.colorRgb})` }} onClick={() => sparks.triggerSpark(variant)}>
          <span>{variant === "crown" ? "♛" : "★"} {reward.label}</span><strong>+1 <small>({sparks.activeStudent?.[reward.countField] ?? 0})</small></strong>
        </button>;
      })}</div>
    </section>
    {movementControls}
    <section className="teach-live-card" aria-label="Live audio">
      <div className="teach-live-heading"><h3>Audio</h3><AudioStatus snapshot={snapshot} /></div>
      <div className="teach-live-actions">{(["microphone", "master"] as const).map(bus => <button key={bus} type="button" aria-pressed={snapshot.settings.muted[bus]} onClick={() => controller.setBusMuted(bus, !snapshot.settings.muted[bus])}>{snapshot.settings.muted[bus] ? "Unmute" : "Mute"} {bus === "microphone" ? "mic" : "master"}</button>)}</div>
      <AudioMeter compact label="Microphone" reading={snapshot.meters.microphone} />
      {(["media", "master"] as const).map(bus => <label className="teach-live-level" key={bus}><span>{bus === "media" ? "Media" : "Master"}</span><input aria-label={`${bus} volume`} type="range" min="0" max="1" step="0.01" value={snapshot.settings.volumes[bus]} onChange={event => controller.setBusVolume(bus, Number(event.target.value))} /><output>{Math.round(snapshot.settings.volumes[bus] * 100)}%</output></label>)}
      {snapshot.warnings.length > 0 && <button className="teach-live-warning" type="button" onClick={onOpenAudio}>{snapshot.warnings[0].label}</button>}
      <button type="button" onClick={onOpenAudio}>Open Audio Settings</button>
    </section>
    <section className="teach-live-card" aria-label="Section music"><h3>Section music</h3>
      {section?.bgm?.length ? section.bgm.map((clip, index) => <LiveClip key={`${section.id}:${clip.url}:${index}`} clip={clip} category="section-bgm" label={`Music ${index + 1}`} />) : <p className="teach-live-empty">No music in this section.</p>}
    </section>
    <section className="teach-live-card" aria-label="Slide audio"><h3>Slide audio</h3>
      {slideClips.length ? slideClips.map(({ clip, category, label }, index) => <LiveClip key={`${slide?.id}:${category}:${clip.url}:${index}`} clip={clip} category={category} label={label} />) : <p className="teach-live-empty">No audio clips on this slide.</p>}
    </section>
  </div>;
}
/** Always-visible actions remain reachable while contextual controls scroll. */
export function TeachQuickControls() {
  const sparks = useSparks();
  const {snapshot,controller}=useAudioController();
  return <div className="teach-quick-controls">
    <label>Student <select aria-label="Quick active student" value={sparks.activeStudentId ?? ''} disabled={!sparks.students.length} onChange={e=>sparks.setActiveStudentId(e.target.value)}>
      {!sparks.students.length && <option value="">No students</option>}{sparks.students.map(student=><option key={student.id} value={student.id}>{student.name}</option>)}
    </select></label>
    <button disabled={!sparks.activeStudent} onClick={()=>sparks.triggerSpark('gold')}>+1 Spark · {sparks.totalSparks}</button>
    <button aria-pressed={snapshot.settings.muted.microphone} onClick={()=>controller.setBusMuted('microphone',!snapshot.settings.muted.microphone)}>{snapshot.settings.muted.microphone?'Unmute mic':'Mute mic'}</button>
    <button aria-pressed={snapshot.settings.muted.master} onClick={()=>controller.setBusMuted('master',!snapshot.settings.muted.master)}>{snapshot.settings.muted.master?'Unmute master':'Mute master'}</button>
  </div>;
}
