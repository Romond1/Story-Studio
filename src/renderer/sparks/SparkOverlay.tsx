import React, { useEffect, useRef, useState } from 'react';
import { useSparks } from './SparkProvider';
import { SparkBurst } from './SparkBurst';
import type { AssetItem } from '../../shared/types';
import { REWARD_DEFINITIONS, resolveRewardAppearance } from '../../shared/sparkRewards';
import './sparkStyles.css';

interface SparkOverlayProps {
    assets?: AssetItem[];
    getMediaUrl?: (path: string) => string;
}

export const SparkOverlay: React.FC<SparkOverlayProps> = ({ assets = [], getMediaUrl = (path) => path }) => {
    const { activeBursts, sparkConfig, badgeConfig } = useSparks();
    const [showCounter, setShowCounter] = useState(false);
    const [displayBurst, setDisplayBurst] = useState<(typeof activeBursts)[number] | null>(null);
    const prevBurstCountRef = useRef(0);

    useEffect(() => {
        const currentCount = activeBursts.length;
        const prevCount = prevBurstCountRef.current;
        prevBurstCountRef.current = currentCount;
        if (currentCount === 0 || currentCount <= prevCount) return;
        const latest = activeBursts[currentCount - 1];
        if (!latest) return;
        setDisplayBurst(latest);
        setShowCounter(false); // Reset animation
        // Brief delay to restart CSS animation properly
        const timer = setTimeout(() => setShowCounter(true), 10);
        return () => clearTimeout(timer);
    }, [activeBursts]);

    // Handle counter cleanup based on config
    useEffect(() => {
        if (showCounter) {
            const timer = setTimeout(() => setShowCounter(false), sparkConfig.counterVisibleMs);
            return () => clearTimeout(timer);
        }
    }, [showCounter, sparkConfig.counterVisibleMs]);

    const latestBurst = displayBurst;
    const latestVariant = latestBurst?.variant ?? 'gold';

    const assetIds = new Set(assets.map((asset) => asset.id));
    const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
    const glowVar = `rgba(${REWARD_DEFINITIONS[latestVariant].colorRgb}, ${sparkConfig.glowIntensity / 100})`;

    return (
        <div className="spark-overlay">
            <div
                className="spark-anchor"
                style={{
                    top: sparkConfig.positionTop,
                    right: sparkConfig.positionRight,
                }}
            >
                {activeBursts.map((burst) => {
                    const appearance = resolveRewardAppearance(burst.variant, sparkConfig, badgeConfig, assetIds);
                    const asset = appearance.assetId ? assetsById.get(appearance.assetId) : undefined;
                    return (
                        <SparkBurst
                            key={burst.id}
                            variant={burst.variant}
                            customImageUrl={asset ? getMediaUrl(asset.relativePath) : undefined}
                        />
                    );
                })}

                {showCounter && latestBurst && (
                    <div
                        className="spark-counter"
                        style={{
                            '--spark-glow': glowVar,
                            '--spark-counter-duration': `${sparkConfig.counterVisibleMs}ms`,
                            '--spark-pop-intensity': sparkConfig.scalePopIntensity,
                            '--spark-counter-size': `${sparkConfig.counterSize}rem`,
                        } as any}
                    >
                        <div className="spark-counter-main">{latestBurst.studentName}</div>
                        <div className="spark-counter-plus">+{latestBurst.delta}</div>
                    </div>
                )}
            </div>
        </div>
    );
};
