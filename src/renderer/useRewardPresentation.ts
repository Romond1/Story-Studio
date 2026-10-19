import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ProjectState,
  SparkAwardVariant,
  StudentRosterEntry,
} from "../shared/types";
import { RewardResultCore, type RelicAction } from "../shared/rewardRuntime";
import {
  cleanBadgeConfig,
  setFinalBadgeScroll,
  cleanSparkConfig,
  parseRewardPresentation,
  sparkLifetime,
  type RewardAnchor,
  type RewardPresentation,
  type SparkVisual,
  type FinalBadgeVisual,
} from "../shared/rewardPresentation";
import {
  getActiveRelicStudentIds,
  getRelicImageAssetIdForProgress,
  getRelicStageTitle,
  getRelicTeacherProgressSummary,
  normalizeRelicSystem,
} from "../shared/relics";
import {
  ensureRewardSprites,
  REWARD_VARIANTS,
  resolveBadgeSpriteAssetId,
  resolveRewardAppearance,
  resetStudentRewards,
} from "../shared/sparkRewards";
import {
  DEFAULT_BADGE_CONFIG,
  DEFAULT_SPARK_CONFIG,
} from "./sparks/SparkProvider";
import { visualMediaUrl } from "../shared/visualMedia";
import {
  claimTeacherKey,
  isPlainTeacherKey,
  shouldIgnoreTeacherKey,
} from "../shared/keyboardShortcuts";

interface Runtime {
  scope: string;
  core: RewardResultCore;
  startedAt: number;
  sparks: SparkVisual[];
  final?: FinalBadgeVisual;
  relicEvent?: RewardAnchor & {
    kind: string;
    durationMs: number;
    intensity: number;
    style: string;
  };
  relicReward?: RewardAnchor;
  visibility: RewardAnchor;
  visible: boolean;
}
export function useRewardPresentation({
  scope,
  resolveAsset,
  project,
  setProject,
  roster,
  setDirty,
  setBadgeVisible,
  setScoresRevealed,
}: {
  scope: string;
  resolveAsset?: (id: string) => string | undefined;
  project: ProjectState | null;
  setProject: (update: (p: ProjectState | null) => ProjectState | null) => void;
  roster: StudentRosterEntry[];
  setDirty: (v: boolean) => void;
  setBadgeVisible: (v: boolean) => void;
  setScoresRevealed: (v: boolean) => void;
}) {
  const [, refresh] = useState(0);
  const runtime = useRef<Runtime>();
  if (!runtime.current || runtime.current.scope !== scope)
    runtime.current = {
      scope,
      core: new RewardResultCore(scope),
      startedAt: Date.now(),
      sparks: [],
      visibility: { id: `${scope}:initial`, startedAt: 0, expiresAt: 0 },
      visible: normalizeRelicSystem(project?.data.relicSystem).showOnStage,
    };
  const current = runtime.current;
  const valid = () => runtime.current === current;
  const notify = () => refresh((n) => n + 1);
  const image = (p: ProjectState, id?: string | null) => {
    if (resolveAsset) return id ? resolveAsset(id) : undefined;
    const asset = p.data.assets.find((a) => a.id === id);
    return asset
      ? visualMediaUrl(
          `media://${asset.relativePath.replace(/\\/g, "/").split("/").map(encodeURIComponent).join("/")}`,
          scope,
        )
      : undefined;
  };
  const visibility = (visible: boolean) => {
    if (current.visible === visible) return;
    const now = Date.now();
    current.visible = visible;
    current.visibility = {
      id: crypto.randomUUID(),
      startedAt: now,
      expiresAt: now + (visible ? 520 : 420),
    };
  };
  const observeVisibility = useCallback(
    (visible: boolean) => {
      if (!valid() || current.visible === visible) return;
      visibility(visible);
      notify();
    },
    [scope],
  );
  const showOnStage = normalizeRelicSystem(
    project?.data.relicSystem,
  ).showOnStage;
  useEffect(() => {
    if (valid() && current.visible !== showOnStage) {
      visibility(showOnStage);
      notify();
    }
  }, [scope, showOnStage]);
  const expiries = [
    ...current.sparks.map((s) => s.expiresAt),
    current.final?.expiresAt,
    current.relicEvent?.expiresAt,
  ].filter((n): n is number => n !== undefined);
  useEffect(() => {
    const next = expiries.sort((a, b) => a - b)[0];
    if (next === undefined) return;
    const timer = setTimeout(
      () => {
        if (!valid()) return;
        const now = Date.now();
        current.sparks = current.sparks.filter((s) => s.expiresAt > now);
        if (
          current.final?.expiresAt !== undefined &&
          current.final.expiresAt <= now
        ) {
          current.final = undefined;
          setBadgeVisible(false);
        }
        if (
          current.relicEvent?.expiresAt !== undefined &&
          current.relicEvent.expiresAt <= now
        )
          current.relicEvent = undefined;
        notify();
      },
      Math.max(0, next - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [scope, JSON.stringify(expiries)]);
  const badgeVisibility = (visible: boolean) => {
    if (!valid()) return;
    if (!visible) current.final = undefined;
    else if (!current.final && project) {
      const now = Date.now(),
        config = cleanBadgeConfig(
          project.data.badgeConfig ?? DEFAULT_BADGE_CONFIG,
        );
      current.final = {
        id: crypto.randomUUID(),
        startedAt: now,
        ...(!config.alwaysDisplay && config.celebrationDurationMs
          ? { expiresAt: now + config.celebrationDurationMs }
          : {}),
        config,
        image: image(project, project.data.badgeConfig?.background?.assetId),
        students: [],
      };
      setScoresRevealed(true);
    }
    setBadgeVisible(visible);
    notify();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        current.final &&
        !shouldIgnoreTeacherKey(e) &&
        isPlainTeacherKey(e) &&
        e.key === "Escape"
      ) {
        claimTeacherKey(e);
        badgeVisibility(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scope, !!current.final]);
  const triggerSpark = (
    studentId: string,
    variant: SparkAwardVariant,
    id: string = crypto.randomUUID(),
  ) => {
    if (!valid()) return;
    setProject((p) => {
      if (!p) return p;
      const config = cleanSparkConfig(
          p.data.sparkConfig ?? DEFAULT_SPARK_CONFIG,
        ),
        now = Date.now();
      const appearance = resolveRewardAppearance(
        variant,
        config,
        p.data.badgeConfig ?? DEFAULT_BADGE_CONFIG,
        new Set(p.data.assets.map((a) => a.id)),
      );
      const resolvedImage = image(p, appearance.assetId);
      const result = current.core.applySpark(
        scope,
        id,
        p.data.sparkStudents ?? [],
        studentId,
        variant,
      );
      if (!result.accepted) return p;
      current.sparks = [
        ...current.sparks,
        {
          id,
          startedAt: now,
          expiresAt: sparkLifetime(
            now,
            config.burstDurationMs,
            config.counterVisibleMs,
            variant,
          ),
          variant,
          studentName: result.student?.name || "Student",
          delta: result.delta,
          config,
          image: resolvedImage,
        },
      ];
      setDirty(true);
      notify();
      return { ...p, data: { ...p.data, sparkStudents: result.students } };
    });
  };
  const resetSparks = (studentId: string) => {
    if (!valid()) return;
    setProject((p) =>
      p
        ? {
            ...p,
            data: {
              ...p.data,
              sparkStudents: resetStudentRewards(
                p.data.sparkStudents ?? [],
                studentId,
              ),
            },
          }
        : p,
    );
    current.sparks = [];
    setDirty(true);
    notify();
  };
  const showRelicReward = (visible: boolean) => {
    if (!valid()) return;
    current.relicReward = visible
      ? (current.relicReward ?? {
          id: crypto.randomUUID(),
          startedAt: Date.now(),
        })
      : undefined;
    notify();
  };
  const relicAction = (
    action: RelicAction,
    id: string = crypto.randomUUID(),
  ) => {
    if (!valid()) return;
    setProject((p) => {
      if (!p) return p;
      const system = normalizeRelicSystem(p.data.relicSystem),
        ids = getActiveRelicStudentIds(system, roster);
      const result = current.core.applyRelic(scope, id, system, ids, action);
      if (!result.accepted) return p;
      visibility(true);
      const kind = result.kind!;
      if (
        (kind === "complete" && system.animateOnComplete) ||
        (kind === "stage" && system.animateOnStageChange) ||
        (kind === "progress" && system.animateOnProgress)
      ) {
        const now = Date.now();
        current.relicEvent = {
          id,
          kind,
          startedAt: now,
          expiresAt: now + system.animationDurationMs + 120,
          durationMs: system.animationDurationMs,
          intensity: system.animationIntensity,
          style: system.animationStyle,
        };
      }
      if (action === "complete") showRelicReward(true);
      setDirty(true);
      notify();
      return { ...p, data: { ...p.data, relicSystem: result.system } };
    });
  };
  const moveRelic = (offset: { x: number; y: number }) => {
    if (!valid() || !Number.isFinite(offset.x) || !Number.isFinite(offset.y))
      return;
    setProject((p) =>
      p
        ? {
            ...p,
            data: {
              ...p.data,
              relicSystem: {
                ...normalizeRelicSystem(p.data.relicSystem),
                widgetOffset: offset,
              },
            },
          }
        : p,
    );
    setDirty(true);
  };
  const reconcileBadge = () => {
    if (!valid()) return;
    setProject((p) => {
      if (!p) return p;
      const config = p.data.badgeConfig ?? DEFAULT_BADGE_CONFIG;
      const sprites = config.badgeSprites ?? [];
      const next = ensureRewardSprites(
        sprites,
        (p.data.sparkStudents ?? []).filter((s) => s.badgeVisible !== false),
        () => crypto.randomUUID(),
      );
      if (next.length === sprites.length) return p;
      setDirty(true);
      return {
        ...p,
        data: { ...p.data, badgeConfig: { ...config, badgeSprites: next } },
      };
    });
  };
  const projectScene = (
    frame: { width: number; height: number },
    baseVisible: boolean,
    scoresRevealed: boolean,
  ): RewardPresentation => {
    const result: RewardPresentation = { frame, sparks: current.sparks };
    if (!project) return result;
    const students = project.data.sparkStudents ?? [],
      badge = project.data.badgeConfig ?? DEFAULT_BADGE_CONFIG,
      spark = project.data.sparkConfig ?? DEFAULT_SPARK_CONFIG,
      ids = new Set(project.data.assets.map((a) => a.id));
    if (current.final)
      result.final = {
        ...current.final,
        students: students.map((s) => ({
          id: s.id,
          name: s.name,
          yellowSparks: s.yellowSparks || 0,
          blueSparks: s.blueSparks || 0,
          pinkSparks: s.pinkSparks || 0,
          crowns: s.crowns || 0,
          stars: s.stars || 0,
        })),
      };
    if (baseVisible) {
      const bg = badge.tabBackground,
        bgImage = image(project, bg?.assetId);
      result.base = {
        image: image(project, project.data.badgeImageAssetId),
        ...(bgImage
          ? {
              background: {
                image: bgImage,
                posX: bg?.posX ?? 50,
                posY: bg?.posY ?? 50,
                scale: bg?.scale ?? 1,
                blur: bg?.blur ?? 0,
                brightness: bg?.brightness ?? 100,
              },
            }
          : {}),
        motion: badge.badgeSpriteMotion ?? "spin",
        durationMs: badge.badgeSpriteAnimDurationMs ?? 3200,
        intensity: badge.badgeSpriteAnimIntensity ?? 100,
        startedAt: current.startedAt,
        sprites: students
          .filter((s) => s.badgeVisible !== false)
          .flatMap((s) =>
            REWARD_VARIANTS.flatMap((variant) => {
              const sprite = badge.badgeSprites?.find(
                (b) =>
                  b.studentId === s.id && (b.variant ?? "gold") === variant,
              );
              if (!sprite) return [];
              const appearance = resolveRewardAppearance(
                variant,
                spark,
                badge,
                ids,
              );
              const count =
                variant === "gold"
                  ? s.yellowSparks
                  : variant === "blue"
                    ? s.blueSparks
                    : variant === "pink"
                      ? s.pinkSparks
                      : s.crowns;
              return [
                {
                  id: sprite.id,
                  name: s.name || "Student",
                  variant,
                  shape: appearance.shape,
                  image: image(
                    project,
                    resolveBadgeSpriteAssetId(sprite, variant, badge, ids),
                  ),
                  score:
                    scoresRevealed && badge.showFinalScore
                      ? String(count || 0)
                      : "?",
                  x: sprite.x,
                  y: sprite.y,
                  width: sprite.width,
                  height: sprite.height,
                  zIndex: sprite.zIndex ?? 20,
                },
              ];
            }),
          ),
      };
    }
    const r = normalizeRelicSystem(project.data.relicSystem),
      active = roster.filter(
        (s) => !s.archived && r.studentProgress[s.id]?.active,
      ),
      progress = Math.min(
        ...active.map((s) => r.studentProgress[s.id].progress),
      );
    if (
      active.length &&
      (r.showOnStage ||
        (current.visibility.expiresAt ?? 0) > Date.now() ||
        current.relicReward)
    ) {
      const event = current.relicEvent;
      result.relic = {
        title: r.relicTitle.trim() || "Relic",
        names: active.map((s) => s.name),
        rows: active.map((s) => ({
          name: s.name,
          progress: r.studentProgress[s.id].progress,
        })),
        progress,
        stageTitle: getRelicStageTitle(r, progress),
        progressLabel: getRelicTeacherProgressSummary(r, progress)
          .progressLabel,
        image: image(project, getRelicImageAssetIdForProgress(r, progress)),
        rewardImage:
          image(project, r.mainImageAssetId) ||
          image(project, getRelicImageAssetIdForProgress(r, progress)),
        position: r.widgetPosition,
        x: r.widgetOffset.x,
        y: r.widgetOffset.y,
        scale: r.widgetScale,
        opacity: r.widgetOpacity,
        entrance: r.widgetEntranceAnimation,
        style: event?.style ?? r.animationStyle,
        durationMs: event?.durationMs ?? r.animationDurationMs,
        intensity: event?.intensity ?? r.animationIntensity,
        visible: r.showOnStage,
        visibility: current.visibility,
        event,
        reward: current.relicReward,
      };
    }
    return parseRewardPresentation(result) ?? { frame, sparks: [] };
  };
  const finalId = current.final?.id;
  const scrollFinalBadge = (scrollTop: number) => {
    if (!valid() || !finalId) return;
    const next = setFinalBadgeScroll(current.final, finalId, scrollTop);
    if (next !== current.final) { current.final = next; notify(); }
  };
  return {
    scrollFinalBadge,
    observeVisibility,
    moveRelic,
    triggerSpark,
    resetSparks,
    badgeVisibility,
    relicAction,
    showRelicReward,
    reconcileBadge,
    projectScene,
  };
}
