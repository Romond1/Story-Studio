import { useEffect, useState, useRef, type CSSProperties } from "react";
import { LogicalSceneFrame } from "./StaticScene";
import { rewardAnchorStyle } from '../shared/rewardAppearance';
import { SparkBurst } from "./sparks/SparkBurst";
import { FinalBadgeVisual } from "./sparks/FinalBadgeOverlay";
import { getRewardShapePath, REWARD_DEFINITIONS } from "../shared/sparkRewards";
import {
  rewardAge,
  RewardAnimationClock,
  rewardRemaining,
  type RewardPresentation,
  type RelicVisual,
  type BadgeBaseVisual,
} from "../shared/rewardPresentation";
import "./sparks/sparkStyles.css";
import "./rewards.css";
import "./relics/relics.css";

export function RewardSurface({
  presentation,
  onRelicOffsetChange,
  onHideRelicReward,
  onFinalBadgeScroll,
}: {
  presentation: RewardPresentation;
  onRelicOffsetChange?: (offset: { x: number; y: number }) => void;
  onHideRelicReward?: () => void;
  onFinalBadgeScroll?: (scrollTop: number) => void;
}) {
  return (
    <div
      data-reward-surface
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 10000,
        pointerEvents: "none",
      }}
    >
      <LogicalSceneFrame transparent frame={presentation.frame}>
        <RewardScene
          presentation={presentation}
          onRelicOffsetChange={onRelicOffsetChange}
          onHideRelicReward={onHideRelicReward}
          onFinalBadgeScroll={onFinalBadgeScroll}
        />
      </LogicalSceneFrame>
    </div>
  );
}
export function RewardScene({
  presentation: p,
  onRelicOffsetChange,
  onHideRelicReward,
  onFinalBadgeScroll,
}: {
  presentation: RewardPresentation;
  onRelicOffsetChange?: (offset: { x: number; y: number }) => void;
  onHideRelicReward?: () => void;
  onFinalBadgeScroll?: (scrollTop: number) => void;
}) {
  const [now, update] = useState(Date.now);
  const boundaries = [
    ...p.sparks.flatMap((s) => [
      s.expiresAt,
      s.startedAt +
        s.config.burstDurationMs * (s.variant === "crown" ? 1.35 : 1),
      s.startedAt + s.config.counterVisibleMs,
    ]),
    p.final?.expiresAt,
    p.relic?.visibility.expiresAt,
    p.relic?.event?.expiresAt,
  ].filter((n): n is number => n !== undefined);
  useEffect(() => {
    const next = boundaries
      .filter((n) => n > Date.now())
      .sort((a, b) => a - b)[0];
    if (next === undefined) return;
    const timer = setTimeout(
      () => update(Date.now()),
      Math.max(0, next - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [JSON.stringify(boundaries), now]);
  // Newly received commands can arrive between local expiry wakes.
  const time = Math.max(now, Date.now());
  const latest = p.sparks[p.sparks.length - 1];
  return (
    <div
      className="reward-scene"
      style={
        {
          position: "absolute",
          inset: 0,
          "--reward-height": `${p.frame.height}px`,
          "--reward-width": `${p.frame.width}px`,
        } as CSSProperties
      }
    >
      {p.base && <BadgeBase key={p.base.startedAt} scene={p.base} />}
      {p.relic && (
        <RelicScene
          scene={p.relic}
          now={time}
          onOffsetChange={onRelicOffsetChange}
          onHideReward={onHideRelicReward}
        />
      )}
      <div className="spark-overlay">
        {p.sparks
          .filter(
            (s) =>
              time <
              s.startedAt +
                s.config.burstDurationMs * (s.variant === "crown" ? 1.35 : 1),
          )
          .map((s) => (
            <div
              className="spark-anchor"
              key={s.id}
              style={rewardAnchorStyle(s.appearance, s.config)}
            >
              <AnchoredBurst visual={s} />
            </div>
          ))}
        {latest && time < latest.startedAt + latest.config.counterVisibleMs && (
          <div
            className="spark-anchor"
            style={rewardAnchorStyle(latest.appearance, latest.config)}
          >
            <AnchoredCounter key={latest.id} visual={latest} />
          </div>
        )}
      </div>
      {p.final && rewardRemaining(p.final, time) > 0 && (
        <AnchoredFinal key={p.final.id} visual={p.final} onScroll={onFinalBadgeScroll} />
      )}
    </div>
  );
}
function AnchoredBurst({
  visual: s,
}: {
  visual: RewardPresentation["sparks"][number];
}) {
  const [age] = useState(() => rewardAge(s, Date.now()));
  return (
    <SparkBurst
      variant={s.variant}
      customImageUrl={s.image}
      sparkConfig={s.config}
      eventId={s.id}
      age={age}
    />
  );
}
function AnchoredCounter({
  visual: s,
}: {
  visual: RewardPresentation["sparks"][number];
}) {
  const [age] = useState(() => rewardAge(s, Date.now()));
  return (
    <div
      className="spark-counter"
      style={
        {
          "--reward-age": `-${age}ms`,
          "--spark-glow": `rgba(${REWARD_DEFINITIONS[s.variant].colorRgb}, ${s.config.glowIntensity / 100})`,
          "--spark-counter-duration": `${s.config.counterVisibleMs}ms`,
          "--spark-pop-intensity": s.config.scalePopIntensity,
          "--spark-counter-size": `${s.config.counterSize}rem`,
        } as CSSProperties
      }
    >
      <div className="spark-counter-main">{s.studentName}</div>
      <div className="spark-counter-plus">+{s.delta}</div>
    </div>
  );
}
function AnchoredFinal({
  visual,
  onScroll,
}: {
  visual: NonNullable<RewardPresentation["final"]>;
  onScroll?: (scrollTop: number) => void;
}) {
  const [age] = useState(() => rewardAge(visual, Date.now()));
  return <FinalBadgeVisual visual={visual} age={age} onScroll={onScroll} />;
}
export function BadgeBase({ scene: b }: { scene: BadgeBaseVisual }) {
  const [age] = useState(() => Math.max(0, Date.now() - b.startedAt));
  return (
    <div className="badge-stage" style={{ position: "absolute", inset: 0 }}>
      {b.background && (
        <div
          className="tab-background-layer"
          style={
            {
              zIndex: 0,
              "--tab-bg-blur": b.background.blur,
              "--tab-bg-brightness": `${b.background.brightness}%`,
              "--tab-bg-scale": b.background.scale,
              "--tab-bg-posX": `${b.background.posX}%`,
              "--tab-bg-posY": `${b.background.posY}%`,
            } as CSSProperties
          }
        >
          <img src={b.background.image} className="tab-background-img" alt="" />
        </div>
      )}
      <div className="badge-bg-layer">
        {b.image && (
          <img
            src={b.image}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
            }}
            alt=""
          />
        )}
      </div>
      <div className="badge-shield-layer">
        <div className="badge-student-sprite-layer">
          {b.sprites.map((s) => (
            <div
              key={s.id}
              className="badge-sprite-editor-box"
              style={{
                position: "absolute",
                left: s.x,
                top: s.y,
                width: s.width,
                height: s.height,
                zIndex: s.zIndex,
                pointerEvents: "none",
              }}
            >
              <div
                className={`badge-sprite-frame badge-sprite-motion-${b.motion}`}
                style={
                  {
                    "--badge-sprite-dur": `${b.durationMs}ms`,
                    "--badge-sprite-intensity": b.intensity / 100,
                    animationDelay: `-${age}ms`,
                  } as CSSProperties
                }
              >
                {s.image ? (
                  <img src={s.image} className="badge-student-sprite" alt="" />
                ) : (
                  <svg
                    className="badge-student-sprite badge-student-sprite--builtin"
                    viewBox="0 0 24 24"
                  >
                    <path d={getRewardShapePath(s.shape)} />
                  </svg>
                )}
                <div className="badge-sprite-score">
                  <div className="badge-sprite-student-name">{s.name}</div>
                  <div className="badge-sprite-score-value">{s.score}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function RelicScene({
  scene: r,
  now,
  onOffsetChange,
  onHideReward,
}: {
  scene: RelicVisual;
  now: number;
  onOffsetChange?: (offset: { x: number; y: number }) => void;
  onHideReward?: () => void;
}) {
  const ages = useRef(new Map<string, number>());
  const age = (anchor: { id: string; startedAt: number }) => {
    if (!ages.current.has(anchor.id))
      ages.current.set(anchor.id, rewardAge(anchor, Date.now()));
    return ages.current.get(anchor.id)!;
  };
  const animationClock = useRef(new RewardAnimationClock());
  const lastEvent = useRef("");
  if (r.event) lastEvent.current = r.event.id;
  const names =
    r.names.length <= 2
      ? r.names.join(" & ")
      : `${r.names.slice(0, -1).join(", ")} & ${r.names[r.names.length - 1]}`;
  const event =
    r.visible && r.event && rewardRemaining(r.event, now) > 0
      ? r.event
      : undefined;
  const shown = r.visible || rewardRemaining(r.visibility, now) > 0;
  const animationAnchor = event ?? r.visibility;
  const animationAge = animationClock.current.age(
    `${r.visibility.id}:${event?.id ?? "visibility"}`,
    animationAnchor.startedAt,
    Date.now(),
  );
  return (
    <>
      {shown && (
        <div
          className={`relic-stage-widget-shell relic-stage-widget--${r.position}`}
          style={{
            transform:
              r.position === "centerBottom"
                ? `translate(calc(-50% + ${r.x}px), ${r.y}px) scale(${r.scale})`
                : `translate(${r.x}px, ${r.y}px) scale(${r.scale})`,
            pointerEvents: onOffsetChange ? "auto" : "none",
          }}
          onPointerDown={
            onOffsetChange
              ? (e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  const node = e.currentTarget,
                    startX = e.clientX,
                    startY = e.clientY;
                  const parent = node.closest(".reward-scene") as HTMLElement;
                  const scale =
                    parent.getBoundingClientRect().width / parent.offsetWidth;
                  const commit = onOffsetChange;
                  node.setPointerCapture(e.pointerId);
                  const move = (ev: PointerEvent) =>
                    commit({
                      x: Math.round(r.x + (ev.clientX - startX) / scale),
                      y: Math.round(r.y + (ev.clientY - startY) / scale),
                    });
                  const end = () => {
                    node.removeEventListener("pointermove", move);
                    node.removeEventListener("pointerup", end);
                    node.removeEventListener("pointercancel", end);
                  };
                  node.addEventListener("pointermove", move);
                  node.addEventListener("pointerup", end);
                  node.addEventListener("pointercancel", end);
                }
              : undefined
          }
        >
          <div
            key={`${r.visibility.id}:${lastEvent.current}`}
            className={`relic-stage-widget relic-widget-enter-${r.entrance} ${r.visible ? "" : "relic-widget-exit"} relic-anim-${r.style} ${event ? `relic-event-${event.kind}` : ""}`}
            style={
              {
                "--relic-age": `-${animationAge}ms`,
                "--relic-opacity": r.opacity,
                "--relic-event-duration": `${r.durationMs}ms`,
                "--relic-intensity": r.intensity,
                animationDelay: `-${animationAge}ms`,
              } as CSSProperties
            }
          >
            <div className="relic-stage-widget__eyebrow">Relic Progress</div>
            <div className="relic-stage-widget__student">{names}</div>
            <div className="relic-stage-widget__body">
              <div className="relic-stage-widget__image">
                {r.image ? <img src={r.image} alt="" /> : <span>?</span>}
              </div>
              <div className="relic-stage-widget__copy">
                <div className="relic-stage-widget__title">{r.title}</div>
                <div className="relic-stage-widget__stage">{r.stageTitle}</div>
                {new Set(r.rows.map((s) => s.progress)).size <= 1 ? (
                  <>
                    <div className="relic-stage-widget__bar">
                      <div style={{ width: `${(r.progress / 30) * 100}%` }} />
                    </div>
                    <div className="relic-stage-widget__meter">
                      {r.progressLabel}
                    </div>
                  </>
                ) : (
                  <div className="relic-stage-widget__rows">
                    {r.rows.map((s, i) => (
                      <div className="relic-stage-widget__row" key={i}>
                        <span>{s.name}</span>
                        <div className="relic-stage-widget__mini-bar">
                          <div
                            style={{ width: `${(s.progress / 30) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {r.reward && (
        <div
          key={r.reward.id}
          className="relic-reward-card"
          style={{
            animationDelay: `-${age(r.reward)}ms`,
            pointerEvents: "none",
          }}
        >
          {onHideReward && (
            <button
              className="relic-reward-card__close"
              style={{ pointerEvents: "auto" }}
              onClick={onHideReward}
            >
              Close
            </button>
          )}
          <div className="relic-reward-card__students">{names}</div>
          <div className="relic-reward-card__title">
            {r.progress >= 30 ? "Relic Completed" : "Relic Progress"}
          </div>
          {r.rewardImage && (
            <img
              className="relic-reward-card__image"
              src={r.rewardImage}
              alt=""
            />
          )}
          <div className="relic-reward-card__text">{r.title}</div>
          <div className="relic-reward-card__subtext">
            {r.stageTitle} - {r.progressLabel}
          </div>
        </div>
      )}
    </>
  );
}
