import { type CSSProperties, useEffect, useRef, useState } from "react";
import type { AssetItem, RelicSystem, StudentRosterEntry } from "../../shared/types";
import {
  getRelicImageAssetIdForProgress,
  getRelicStageTitle,
  getRelicTeacherProgressSummary,
} from "../../shared/relics";

interface RelicStageWidgetProps {
  relicSystem: RelicSystem;
  roster: StudentRosterEntry[];
  assetsById: Map<string, AssetItem>;
  toMediaUrl: (relativePath: string) => string;
  rewardVisible: boolean;
  onHideReward: () => void;
  animationSignal: { kind: "progress" | "stage" | "complete"; nonce: number } | null;
  onWidgetOffsetChange: (offset: { x: number; y: number }) => void;
}

function joinNames(names: string[]): string {
  if (names.length <= 2) return names.join(" & ");
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

function positionClass(position: RelicSystem["widgetPosition"]): string {
  return `relic-stage-widget--${position}`;
}

export function RelicStageWidget({
  relicSystem,
  roster,
  assetsById,
  toMediaUrl,
  rewardVisible,
  onHideReward,
  animationSignal,
  onWidgetOffsetChange,
}: RelicStageWidgetProps) {
  const [eventAnimationClass, setEventAnimationClass] = useState("");
  const [isRendered, setIsRendered] = useState(relicSystem.showOnStage);
  const [isHiding, setIsHiding] = useState(false);
  const dragStateRef = useRef<{
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const activeStudents = roster
    .filter((student) => !student.archived && relicSystem.studentProgress[student.id]?.active)
    .map((student) => ({
      student,
      progress: relicSystem.studentProgress[student.id]?.progress ?? 0,
    }));

  const lowestProgress = activeStudents.reduce(
    (lowest, item) => Math.min(lowest, item.progress),
    activeStudents[0]?.progress ?? 0,
  );
  const imageAssetId = getRelicImageAssetIdForProgress(relicSystem, lowestProgress);
  const imageAsset = imageAssetId ? assetsById.get(imageAssetId) : null;
  const imageUrl = imageAsset ? toMediaUrl(imageAsset.relativePath) : null;
  const rewardImageAsset = relicSystem.mainImageAssetId ? assetsById.get(relicSystem.mainImageAssetId) : null;
  const rewardImageUrl = rewardImageAsset ? toMediaUrl(rewardImageAsset.relativePath) : imageUrl;
  const title = relicSystem.relicTitle.trim() || "Relic";
  const names = activeStudents.map((item) => item.student.name);
  const hasDifferentProgress = new Set(activeStudents.map((item) => item.progress)).size > 1;
  const groupSummary = getRelicTeacherProgressSummary(relicSystem, lowestProgress);
  const rewardStageTitle = getRelicStageTitle(relicSystem, lowestProgress);
  const shellTransform = relicSystem.widgetPosition === "centerBottom"
    ? `translate(calc(-50% + ${relicSystem.widgetOffset.x}px), ${relicSystem.widgetOffset.y}px) scale(${relicSystem.widgetScale})`
    : `translate(${relicSystem.widgetOffset.x}px, ${relicSystem.widgetOffset.y}px) scale(${relicSystem.widgetScale})`;
  const eventDuration = `${relicSystem.animationDurationMs}ms`;
  const eventIntensity = relicSystem.animationIntensity;

  useEffect(() => {
    if (!animationSignal) return;
    const className =
      animationSignal.kind === "complete"
        ? "relic-event-complete"
        : animationSignal.kind === "stage"
          ? "relic-event-stage"
          : "relic-event-progress";
    setEventAnimationClass(className);
    const timeout = window.setTimeout(
      () => setEventAnimationClass(""),
      relicSystem.animationDurationMs + 120,
    );
    return () => window.clearTimeout(timeout);
  }, [animationSignal, relicSystem.animationDurationMs]);

  useEffect(() => {
    if (relicSystem.showOnStage) {
      setIsRendered(true);
      setIsHiding(false);
      return;
    }
    setIsHiding(true);
    const timeout = window.setTimeout(() => {
      setIsRendered(false);
      setIsHiding(false);
    }, 420);
    return () => window.clearTimeout(timeout);
  }, [relicSystem.showOnStage]);

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const scale = relicSystem.widgetScale || 1;
      onWidgetOffsetChange({
        x: Math.round(drag.startX + (event.clientX - drag.startClientX) / scale),
        y: Math.round(drag.startY + (event.clientY - drag.startClientY) / scale),
      });
    };
    const handleUp = () => {
      dragStateRef.current = null;
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [onWidgetOffsetChange, relicSystem.widgetScale]);

  if (activeStudents.length === 0) {
    return rewardVisible ? (
      <div className="relic-reward-card">
        <button className="relic-reward-card__close" onClick={onHideReward}>Close</button>
        <div className="relic-reward-card__title">Relic Progress</div>
        <div className="relic-reward-card__text">Turn on at least one active student to show this progress card.</div>
      </div>
    ) : null;
  }

  if (!isRendered && !rewardVisible) {
    return null;
  }

  return (
    <>
      <div
        className={`relic-stage-widget-shell ${positionClass(relicSystem.widgetPosition)}`}
        style={{
          transform: shellTransform,
        }}
        onMouseDown={(event) => {
          event.preventDefault();
          dragStateRef.current = {
            startClientX: event.clientX,
            startClientY: event.clientY,
            startX: relicSystem.widgetOffset.x,
            startY: relicSystem.widgetOffset.y,
          };
        }}
      >
        <div
          className={`relic-stage-widget relic-widget-enter-${relicSystem.widgetEntranceAnimation} ${isHiding ? "relic-widget-exit" : ""} relic-anim-${relicSystem.animationStyle} ${eventAnimationClass}`}
          style={{
            "--relic-opacity": relicSystem.widgetOpacity,
            "--relic-event-duration": eventDuration,
            "--relic-intensity": eventIntensity,
          } as CSSProperties}
        >
          <div className="relic-stage-widget__eyebrow">Relic Progress</div>
          <div className="relic-stage-widget__student">{joinNames(names)}</div>
          <div className="relic-stage-widget__body">
            <div className="relic-stage-widget__image">
              {imageUrl ? <img src={imageUrl} alt="" /> : <span>?</span>}
            </div>
            <div className="relic-stage-widget__copy">
              <div className="relic-stage-widget__title">{title}</div>
              <div className="relic-stage-widget__stage">{getRelicStageTitle(relicSystem, lowestProgress)}</div>
              {!hasDifferentProgress ? (
                <>
                  <div className="relic-stage-widget__bar">
                    <div style={{ width: `${(lowestProgress / 30) * 100}%` }} />
                  </div>
                  <div className="relic-stage-widget__meter">{groupSummary.progressLabel}</div>
                </>
              ) : (
                <div className="relic-stage-widget__rows">
                  {activeStudents.map(({ student, progress }) => (
                    <div className="relic-stage-widget__row" key={student.id}>
                      <span>{student.name}</span>
                      <div className="relic-stage-widget__mini-bar">
                        <div style={{ width: `${(progress / 30) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {rewardVisible && (
        <div className="relic-reward-card">
          <button className="relic-reward-card__close" onClick={onHideReward}>Close</button>
          <div className="relic-reward-card__students">{joinNames(names)}</div>
          <div className="relic-reward-card__title">{lowestProgress >= 30 ? "Relic Completed" : "Relic Progress"}</div>
          {rewardImageUrl && <img className="relic-reward-card__image" src={rewardImageUrl} alt="" />}
          <div className="relic-reward-card__text">{title}</div>
          <div className="relic-reward-card__subtext">{rewardStageTitle} - {groupSummary.progressLabel}</div>
        </div>
      )}
    </>
  );
}
