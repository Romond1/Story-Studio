import React, { useEffect, useState } from 'react';
import { useSparks } from './SparkProvider';
import { SparkBurst } from './SparkBurst';
import './sparkStyles.css';

export const SparkOverlay: React.FC = () => {
    const { activeBursts, totalSparks, sparkConfig } = useSparks();
    const [showCounter, setShowCounter] = useState(false);
    const [lastTotal, setLastTotal] = useState(0);

    useEffect(() => {
        if (totalSparks > 0) {
            setShowCounter(false); // Reset animation
            setLastTotal(totalSparks);
            // Brief delay to restart CSS animation properly
            const timer = setTimeout(() => setShowCounter(true), 10);
            return () => clearTimeout(timer);
        }
    }, [totalSparks]);

    // Handle counter cleanup based on config
    useEffect(() => {
        if (showCounter) {
            const timer = setTimeout(() => setShowCounter(false), sparkConfig.counterVisibleMs);
            return () => clearTimeout(timer);
        }
    }, [showCounter, totalSparks, sparkConfig.counterVisibleMs]);

    const latestVariant = activeBursts.length > 0 ? activeBursts[activeBursts.length - 1].variant : 'gold';

    const COLORS_RGB = {
        gold: '255, 215, 0',
        blue: '0, 191, 255',
        pink: '255, 105, 180',
    };
    const glowVar = `rgba(${COLORS_RGB[latestVariant]}, ${sparkConfig.glowIntensity / 100})`;

    return (
        <div className="spark-overlay">
            <div
                className="spark-anchor"
                style={{
                    top: sparkConfig.positionTop,
                    right: sparkConfig.positionRight,
                }}
            >
                {activeBursts.map((burst) => (
                    <SparkBurst key={burst.id} variant={burst.variant} />
                ))}

                {showCounter && (
                    <div
                        className="spark-counter"
                        style={{
                            '--spark-glow': glowVar,
                            '--spark-counter-duration': `${sparkConfig.counterVisibleMs}ms`,
                            '--spark-pop-intensity': sparkConfig.scalePopIntensity,
                            '--spark-counter-size': `${sparkConfig.counterSize}rem`,
                        } as any}
                    >
                        {lastTotal}
                    </div>
                )}
            </div>
        </div>
    );
};
