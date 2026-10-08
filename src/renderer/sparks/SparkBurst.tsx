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
}

export const SparkBurst: React.FC<SparkBurstProps> = ({
  variant,
  customImageUrl,
  sparkConfig,
  eventId,
  age,
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
      const dist = 60 + random() * 60;
      return {
        id: i,
        dx: `${Math.cos(angle) * dist}px`,
        dy: `${Math.sin(angle) * dist}px`,
      };
    });
  }, [eventId, variant, sparkConfig.particleCount]);

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
          "--spark-size": `${sparkConfig.sparkSize}px`,
        } as any
      }
    >
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
          fill={mainColor}
          data-shape={selectedShape}
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d={getRewardShapePath(selectedShape)} />
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
