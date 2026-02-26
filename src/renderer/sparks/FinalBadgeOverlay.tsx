import React, { useEffect } from 'react';
import { useSparks } from './SparkProvider';
import './sparkStyles.css';

import { AssetItem } from '../../shared/types';

interface FinalBadgeOverlayProps {
    assets?: AssetItem[];
    getMediaUrl?: (path: string) => string;
}

export const FinalBadgeOverlay: React.FC<FinalBadgeOverlayProps> = ({ assets = [], getMediaUrl = (s) => s }) => {
    const { isBadgeVisible, hideFinalSparkBadge, sparkCounts, badgeChildName, badgeConfig } = useSparks();
    const pinkCount = sparkCounts?.pink || 0;
    const blueCount = sparkCounts?.blue || 0;
    const goldCount = sparkCounts?.gold || 0;
    const total = pinkCount + blueCount + goldCount;

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

    const congratsText = (badgeConfig.congratsText || "Today you generated {n} Sparks").replace('{n}', String(total));

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

    const SparkIcon = ({ variant }: { variant: 'pink' | 'blue' | 'gold' }) => {
        const colors = {
            pink: '#FF69B4',
            blue: '#00BFFF',
            gold: '#FFD700'
        };
        return (
            <svg
                className={`badge-spark-icon spark-${variant}`}
                viewBox="0 0 24 24"
                fill={colors[variant]}
                xmlns="http://www.w3.org/2000/svg"
            >
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
        );
    };

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

                <div className={`badge-ceremony-container anim-${motionType}`}>
                    {/* Subtle shield background */}
                    <svg className="badge-subtle-shield" viewBox="0 0 100 120">
                        <path
                            d="M50 5 L90 20 L90 60 C90 85 70 105 50 115 C30 105 10 85 10 60 L10 20 L50 5Z"
                            fill="#FFD700"
                            opacity="0.05"
                        />
                    </svg>

                    <div className="badge-spark-rows">
                        <div className="badge-spark-row pink">
                            <SparkIcon variant="pink" />
                            <span className="badge-count">x {pinkCount}</span>
                        </div>
                        <div className="badge-spark-row blue">
                            <SparkIcon variant="blue" />
                            <span className="badge-count">x {blueCount}</span>
                        </div>
                        <div className="badge-spark-row gold">
                            <SparkIcon variant="gold" />
                            <span className="badge-count">x {goldCount}</span>
                        </div>
                    </div>

                    <div className="badge-total-box">
                        <div className="badge-total-label">TOTAL</div>
                        <div className="badge-total-value">{total}</div>
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
