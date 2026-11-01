import React, { useMemo } from "react";
import type {
  SparkAwardVariant as SparkVariant,
  SparkConfig,
} from "../../shared/types";
import { rewardRandom } from "../../shared/rewardPresentation";
import {
  getRewardShapePath,
  REWARD_DEFINITIONS,
} from "../../shared/sparkRewards";

interface SparkBurstProps {
  variant: SparkVariant;
  customImageUrl?: string;
  sparkConfig: SparkConfig;
  eventId: string;
  age: number;
  intensity?: number;
}

export const SparkBurst: React.FC<SparkBurstProps> = ({
  variant,
  customImageUrl,
  sparkConfig,
  eventId,
  age,
  intensity = 1,
}) => {
  const definition = REWARD_DEFINITIONS[variant];
  const mainColor = `rgba(${definition.colorRgb}, ${sparkConfig.colorIntensity / 100})`;
  const glowColor = `rgba(${definition.colorRgb}, ${sparkConfig.glowIntensity / 100})`;
  const selectedShape =
    sparkConfig.shapeByVariant?.[variant] || definition.defaultShape;

  // Randomize particles on mount, but limited by sparkConfig.particleCount
  const particles = useMemo(() => {
    const count = sparkConfig.particleCount;
    const random = rewardRandom(eventId);
    return Array.from({ length: count }).map((_, i) => {
      const angle = (i / count) * Math.PI * 2 + random() * 0.5;
      const dist = (90 + random() * 100) * (0.6 + intensity * 0.5);
      return {
        id: i,
        dx: `${Math.cos(angle) * dist}px`,
        dy: `${Math.sin(angle) * dist}px`,
      };
    });
  }, [eventId, variant, sparkConfig.particleCount, intensity]);

  return (
    <div
      className="spark-burst-container"
      style={
        {
          "--spark-color": mainColor,
          "--reward-age": `-${age}ms`,
          "--spark-glow": glowColor,
          "--spark-burst-duration": `${sparkConfig.burstDurationMs}ms`,
          "--spark-pop-intensity": sparkConfig.scalePopIntensity,
          "--spark-size": `${sparkConfig.sparkSize * 1.65}px`,
          "--spark-energy": intensity,
        } as any
      }
    >
      <div className="spark-halo" aria-hidden="true" />
      <div className="spark-shockwave" aria-hidden="true" />
      {customImageUrl ? (
        <img
          className={`spark-main-visual ${variant === "crown" ? "spark-main-visual--crown" : ""}`}
          src={customImageUrl}
          alt=""
        />
      ) : (
        <svg
          className={`spark-main-visual ${variant === "crown" ? "spark-main-visual--crown" : ""}`}
          viewBox="0 0 24 24"
          fill={`url(#reward-gem-${eventId.replace(/[^a-zA-Z0-9]/g, "")})`}
          data-shape={selectedShape}
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs><linearGradient id={`reward-gem-${eventId.replace(/[^a-zA-Z0-9]/g, "")}`} x1="0" y1="0" x2=".8" y2="1">
            <stop offset="0" stopColor="#fffde5" /><stop offset=".32" stopColor={mainColor} /><stop offset=".72" stopColor={mainColor} /><stop offset="1" stopColor="#fff4b4" />
          </linearGradient></defs>
          <path d={getRewardShapePath(selectedShape)} stroke="#fff9df" strokeWidth=".7" strokeLinejoin="round" />
          <path d={getRewardShapePath(selectedShape)} fill="none" stroke="white" strokeOpacity=".45" strokeWidth=".35" transform="translate(3 3) scale(.75)" />
        </svg>
      )}

      {particles.map((p) => (
        <div
          key={p.id}
          className="spark-particle"
          style={{ "--dx": p.dx, "--dy": p.dy } as any}
        />
      ))}
    </div>
  );
};
