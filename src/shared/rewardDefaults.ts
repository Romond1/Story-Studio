import type { SparkConfig, BadgeConfig } from './types';

export const DEFAULT_SPARK_CONFIG: SparkConfig = {
    burstDurationMs: 800,
    particleCount: 10,
    glowIntensity: 60,
    colorIntensity: 100,
    counterVisibleMs: 2000,
    scalePopIntensity: 1.2,
    counterSize: 2.5,
    sparkSize: 50,
    positionTop: 120,
    positionRight: 40,
    shapeByVariant: {
        gold: 'star',
        blue: 'star',
        pink: 'star',
        crown: 'crown',
    },
};

export const DEFAULT_BADGE_CONFIG: BadgeConfig = {
    congratsText: "Today you generated {n} Sparks",
    showStudentName: true,
    showFinalScore: false,
    alwaysDisplay: false,
    fontSize: 2.2,
    celebrationDurationMs: 5000,
    confettiCount: 30,
    background: {
        posX: 50,
        posY: 50,
        scale: 1,
        blur: 0,
        brightness: 100,
    },
    tabBackground: {
        posX: 50,
        posY: 50,
        scale: 1,
        blur: 0,
        brightness: 100,
    },
    animation: {
        durationMs: 1000,
        rotationDeg: 0,
        motionType: 'zoomPop',
        colorIntensity: 100,
        glowIntensity: 100,
        motionIntensity: 100,
    },
    previewShield: {
        size: 200,
        posX: 50,
        posY: 50,
        spinDirection: 'cw',
        spinIntensity: 100,
        visible: true,
    },
    badgeSprites: [],
    badgeSpriteMotion: 'spin',
    badgeSpriteAnimDurationMs: 3200,
    badgeSpriteAnimIntensity: 100,
};
