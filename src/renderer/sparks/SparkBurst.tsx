import React, { useMemo } from 'react';
import { SparkVariant, useSparks } from './SparkProvider';

interface SparkBurstProps {
    variant: SparkVariant;
}

export const SparkBurst: React.FC<SparkBurstProps> = ({ variant }) => {
    const { sparkConfig } = useSparks();

    const COLORS_RGB = {
        gold: '255, 215, 0',
        blue: '0, 191, 255',
        pink: '255, 105, 180',
    };

    const mainColor = `rgba(${COLORS_RGB[variant]}, ${sparkConfig.colorIntensity / 100})`;
    const glowColor = `rgba(${COLORS_RGB[variant]}, ${sparkConfig.glowIntensity / 100})`;
    const selectedShape = sparkConfig.shapeByVariant?.[variant] || 'star';

    // Randomize particles on mount, but limited by sparkConfig.particleCount
    const particles = useMemo(() => {
        const count = sparkConfig.particleCount;
        return Array.from({ length: count }).map((_, i) => {
            const angle = (i / count) * Math.PI * 2 + (Math.random() * 0.5);
            const dist = 60 + Math.random() * 60;
            return {
                id: i,
                dx: `${Math.cos(angle) * dist}px`,
                dy: `${Math.sin(angle) * dist}px`,
            };
        });
    }, [variant, sparkConfig.particleCount]);

    return (
        <div
            className="spark-burst-container"
            style={{
                '--spark-color': mainColor,
                '--spark-glow': glowColor,
                '--spark-burst-duration': `${sparkConfig.burstDurationMs}ms`,
                '--spark-pop-intensity': sparkConfig.scalePopIntensity,
                '--spark-size': `${sparkConfig.sparkSize}px`,
            } as any}
        >
            <svg
                className="spark-svg-main"
                viewBox="0 0 24 24"
                fill={mainColor}
                data-shape={selectedShape}
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* TODO(phase-2): render alternative spark paths for non-star shapes. */}
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>

            {particles.map((p) => (
                <div
                    key={p.id}
                    className="spark-particle"
                    style={{ '--dx': p.dx, '--dy': p.dy } as any}
                />
            ))}
        </div>
    );
};
