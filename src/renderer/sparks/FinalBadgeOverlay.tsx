import React, { useLayoutEffect, useRef } from "react";
import {
  rewardRandom,
  type FinalBadgeVisual as FinalBadgeVisualData,
} from "../../shared/rewardPresentation";
import { getStudentRewardTotal as getStudentSparkTotal } from "../../shared/sparkRewards";
import "./sparkStyles.css";

export function FinalBadgeVisual({
  visual,
  age,
  onScroll,
}: {
  visual: FinalBadgeVisualData;
  age: number;
  onScroll?: (scrollTop: number) => void;
}) {
  const grid = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (grid.current && Math.abs(grid.current.scrollTop - (visual.scrollTop ?? 0)) > 0.5) {
      grid.current.scrollTop = visual.scrollTop ?? 0;
    }
  }, [visual.id, visual.scrollTop, visual.students.length]);
  const badgeConfig = visual.config,
    students = visual.students;
  const random = rewardRandom(visual.id);
  // Generate confetti particles based on config
  const confettiCount = badgeConfig.confettiCount ?? 30;
  const confetti = Array.from({ length: confettiCount }).map((_, i) => ({
    id: i,
    left: `${random() * 100}%`,
    delay: `${random() * 2}s`,
    color: ["#FFD700", "#00BFFF", "#FF69B4", "#FFFFFF"][
      Math.floor(random() * 4)
    ],
  }));

  const classTotal = students.reduce(
    (acc, student) => acc + getStudentSparkTotal(student),
    0,
  );
  const sparkles = Array.from({ length: 22 }).map((_, i) => ({
    id: i,
    left: `${random() * 100}%`,
    top: `${random() * 100}%`,
    delay: `${random() * 1.8}s`,
    duration: `${1.5 + random() * 1.8}s`,
  }));

  // Background config
  const bg = badgeConfig.background || {};
  const bgUrl = visual.image;

  // Animation config
  const anim = badgeConfig.animation || {};
  const motionType = anim.motionType || "zoomPop";

  const overlayStyle = {
    "--reward-age": `-${age}ms`,
    "--badge-anim-duration": `${anim.durationMs ?? 1000}ms`,
    "--badge-rotation": `${anim.rotationDeg ?? 0}deg`,
    "--badge-glow-intensity": (anim.glowIntensity ?? 100) / 100,
    "--badge-color-intensity": `${anim.colorIntensity ?? 100}%`,
    "--badge-motion-intensity": (anim.motionIntensity ?? 100) / 100,

    "--badge-bg-blur": bg.blur ?? 0,
    "--badge-bg-brightness": `${bg.brightness ?? 100}%`,
    "--badge-bg-scale": bg.scale ?? 1,
    "--badge-bg-posX": `${bg.posX ?? 50}%`,
    "--badge-bg-posY": `${bg.posY ?? 50}%`,
  } as React.CSSProperties;

  return (
    <div className="final-badge-backdrop" style={overlayStyle}>
      {bgUrl && (
        <div className="badge-background-layer">
          <img src={bgUrl} className="badge-background-img" alt="" />
        </div>
      )}

      <div className="badge-content-top">
        <div className="confetti-container">
          {confetti.map((c) => (
            <div
              key={c.id}
              className="confetti-particle"
              style={
                {
                  left: c.left,
                  animationDelay: `${parseFloat(c.delay) * 1000 - age}ms`,
                  backgroundColor: c.color,
                } as any
              }
            />
          ))}
        </div>
        <div className="badge-sparkle-layer">
          {sparkles.map((sparkle) => (
            <div
              key={sparkle.id}
              className="badge-sparkle-dot"
              style={{
                left: sparkle.left,
                top: sparkle.top,
                animationDelay: `${parseFloat(sparkle.delay) * 1000 - age}ms`,
                animationDuration: sparkle.duration,
              }}
            />
          ))}
        </div>

        <div className={`badge-shield-container anim-${motionType}`}>
          <div className="badge-shield-wrapper">
            <svg
              className="badge-shield-svg"
              viewBox="0 0 100 120"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M50 5 L90 20 L90 60 C90 85 70 105 50 115 C30 105 10 85 10 60 L10 20 L50 5Z"
                fill="#FFD700"
                stroke="#B8860B"
                strokeWidth="3"
              />
              <path
                d="M50 15 L80 27 L80 60 C80 80 65 95 50 103 C35 95 20 80 20 60 L20 27 L50 15Z"
                fill="#FFF"
                opacity="0.2"
              />
              <text
                x="50"
                y="75"
                textAnchor="middle"
                fill="#5a3e00"
                fontSize="30"
                fontWeight="900"
                fontFamily="Outfit"
              >
                {classTotal}
              </text>
              <text
                x="50"
                y="45"
                textAnchor="middle"
                fill="#5a3e00"
                fontSize="8"
                fontWeight="bold"
                fontFamily="Outfit"
              >
                CLASS
              </text>
            </svg>
          </div>

          <div className="badge-text-content">
            <h1
              className="badge-congrats"
              style={{ fontSize: `${badgeConfig.fontSize || 2.2}rem` }}
            >
              Class Spark Results
            </h1>
          </div>

          <div className="badge-hero-total">
            <div className="badge-hero-total-label">CLASS TOTAL</div>
            <div className="badge-hero-total-value">{classTotal}</div>
          </div>

          <div className="badge-student-grid" ref={grid}
            style={{ pointerEvents: onScroll ? 'auto' : 'none' }}
            onScroll={onScroll ? event => onScroll(event.currentTarget.scrollTop) : undefined}
            onWheel={onScroll ? event => event.stopPropagation() : undefined}>
            {students.map((student) => {
              const total = getStudentSparkTotal(student);
              return (
                <div key={student.id} className="badge-student-card">
                  <h3 className="badge-student-card-name">
                    {student.name || "Student"}
                  </h3>
                  <div className="badge-spark-row">
                    <span className="badge-spark-chip yellow">
                      Yellow: {student.yellowSparks || 0}
                    </span>
                    <span className="badge-spark-chip blue">
                      Blue: {student.blueSparks || 0}
                    </span>
                    <span className="badge-spark-chip pink">
                      Pink: {student.pinkSparks || 0}
                    </span>
                    <span className="badge-spark-chip crown">
                      Crowns: {student.crowns || 0}
                    </span>
                  </div>
                  <div className="badge-student-total-wrap">
                    <span className="badge-student-total-label">
                      Total Sparks
                    </span>
                    <span className="badge-student-total-value">{total}</span>
                  </div>
                  <div className="badge-student-card-meta">
                    <span>Total Rewards: {student.stars ?? total}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
