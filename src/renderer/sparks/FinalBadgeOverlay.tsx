import React, { useEffect } from 'react';
import { useSparks } from './SparkProvider';
import './sparkStyles.css';

import { AssetItem } from '../../shared/types';

interface FinalBadgeOverlayProps {
    assets?: AssetItem[];
    getMediaUrl?: (path: string) => string;
}

export const FinalBadgeOverlay: React.FC<FinalBadgeOverlayProps> = ({ assets = [], getMediaUrl = (s) => s }) => {
    const { isBadgeVisible, hideFinalSparkBadge, totalSparks, badgeChildName, badgeConfig } = useSparks();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                hideFinalSparkBadge();
            }
        };
        if (isBadgeVisible) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isBadgeVisible, hideFinalSparkBadge]);

    useEffect(() => {
        if (isBadgeVisible && badgeConfig.celebrationDurationMs) {
            const timer = setTimeout(() => {
                hideFinalSparkBadge();
            }, badgeConfig.celebrationDurationMs);
            return () => clearTimeout(timer);
        }
    }, [isBadgeVisible, badgeConfig.celebrationDurationMs, hideFinalSparkBadge]);

    if (!isBadgeVisible) return null;

    // Generate confetti particles based on config
    const confettiCount = badgeConfig.confettiCount ?? 30;
    const confetti = Array.from({ length: confettiCount }).map((_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 2}s`,
        color: ['#FFD700', '#00BFFF', '#FF69B4', '#FFFFFF'][Math.floor(Math.random() * 4)],
    }));

    const congratsText = (badgeConfig.congratsText || "Today you generated {n} Sparks").replace('{n}', String(totalSparks));

    // Background config
    const bg = badgeConfig.background || {};
    const bgAsset = assets.find(a => a.id === bg.assetId);
    const bgUrl = bgAsset ? getMediaUrl(bgAsset.relativePath) : null;

    // Animation config
    const anim = badgeConfig.animation || {};
    const motionType = anim.motionType || 'zoomPop';

    const overlayStyle = {
        '--badge-anim-duration': `${anim.durationMs ?? 1000}ms`,
        '--badge-rotation': `${anim.rotationDeg ?? 0}deg`,
        '--badge-glow-intensity': (anim.glowIntensity ?? 100) / 100,
        '--badge-color-intensity': `${anim.colorIntensity ?? 100}%`,
        '--badge-motion-intensity': (anim.motionIntensity ?? 100) / 100,

        '--badge-bg-blur': bg.blur ?? 0,
        '--badge-bg-brightness': `${bg.brightness ?? 100}%`,
        '--badge-bg-scale': bg.scale ?? 1,
        '--badge-bg-posX': `${bg.posX ?? 50}%`,
        '--badge-bg-posY': `${bg.posY ?? 50}%`,
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
                            style={{
                                left: c.left,
                                animationDelay: c.delay,
                                backgroundColor: c.color,
                            } as any}
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
                                {totalSparks}
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
                                SPARKS
                            </text>
                        </svg>
                    </div>

                    <div className="badge-text-content">
                        {badgeConfig.showStudentName !== false && (
                            <h2 className="badge-student-name">{badgeChildName || 'Student'}</h2>
                        )}
                        <h1 className="badge-congrats" style={{ fontSize: `${badgeConfig.fontSize || 2.2}rem` }}>
                            {congratsText}
                        </h1>
                    </div>
                </div>
            </div>
        </div>
    );
};
