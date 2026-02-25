import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { SparkConfig, BadgeConfig } from '../../shared/types';

export type SparkVariant = 'gold' | 'blue' | 'pink';

export interface BurstInfo {
    id: string;
    variant: SparkVariant;
}


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
};

export const DEFAULT_BADGE_CONFIG: BadgeConfig = {
    congratsText: "Today you generated {n} Sparks",
    showStudentName: true,
    showFinalScore: false,
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
    }
};

interface SparkContextType {
    totalSparks: number;
    activeBursts: BurstInfo[];
    triggerSpark: (variant: SparkVariant) => void;
    showFinalSparkBadge: () => void;
    hideFinalSparkBadge: () => void;
    isBadgeVisible: boolean;
    sparkConfig: SparkConfig;
    setSparkConfig: (updates: Partial<SparkConfig>) => void;
    resetSparkConfig: () => void;
    badgeConfig: BadgeConfig;
    setBadgeConfig: (updates: Partial<BadgeConfig>) => void;
    badgeChildName: string;
    setBadgeChildName: (name: string) => void;
    resetSparks: () => void;
}

const SparkContext = createContext<SparkContextType | undefined>(undefined);

export const useSparks = () => {
    const context = useContext(SparkContext);
    if (!context) {
        throw new Error('useSparks must be used within a SparkProvider');
    }
    return context;
};

interface SparkProviderProps {
    children: ReactNode;
    config?: SparkConfig;
    onConfigChange?: (updates: Partial<SparkConfig>) => void;
    badgeConfig?: BadgeConfig;
    onBadgeConfigChange?: (updates: Partial<BadgeConfig>) => void;
}

export const SparkProvider: React.FC<SparkProviderProps> = ({ children, config, onConfigChange, badgeConfig, onBadgeConfigChange }) => {
    const [totalSparks, setTotalSparks] = useState(0);
    const [activeBursts, setActiveBursts] = useState<BurstInfo[]>([]);
    const [isBadgeVisible, setIsBadgeVisible] = useState(false);
    const [localSparkConfig, setLocalSparkConfig] = useState<SparkConfig>(DEFAULT_SPARK_CONFIG);
    const [localBadgeConfig, setLocalBadgeConfig] = useState<BadgeConfig>(DEFAULT_BADGE_CONFIG);
    const badgeChildNameState = useState('Student');
    const [badgeChildName, setBadgeChildName] = badgeChildNameState;

    const currentConfig = config || localSparkConfig;
    const currentBadgeConfig = badgeConfig || localBadgeConfig;

    const setSparkConfig = useCallback((updates: Partial<SparkConfig>) => {
        if (onConfigChange) {
            onConfigChange(updates);
        } else {
            setLocalSparkConfig(prev => ({ ...prev, ...updates }));
        }
    }, [onConfigChange]);

    const resetSparkConfig = useCallback(() => {
        if (onConfigChange) {
            onConfigChange(DEFAULT_SPARK_CONFIG);
        } else {
            setLocalSparkConfig(DEFAULT_SPARK_CONFIG);
        }
    }, [onConfigChange]);

    const setBadgeConfig = useCallback((updates: Partial<BadgeConfig>) => {
        if (onBadgeConfigChange) {
            onBadgeConfigChange(updates);
        } else {
            setLocalBadgeConfig(prev => ({ ...prev, ...updates }));
        }
    }, [onBadgeConfigChange]);

    const triggerSpark = useCallback((variant: SparkVariant) => {
        const id = crypto.randomUUID();

        // Add burst
        setActiveBursts((prev) => [...prev, { id, variant }]);
        setTotalSparks((prev) => prev + 1);

        // Auto cleanup burst after animation duration (+ some buffer)
        setTimeout(() => {
            setActiveBursts((prev) => prev.filter((b) => b.id !== id));
        }, (currentConfig?.burstDurationMs ?? 800) + 200);
    }, [currentConfig?.burstDurationMs]);

    const showFinalSparkBadge = useCallback(() => {
        setIsBadgeVisible(true);
    }, []);

    const hideFinalSparkBadge = useCallback(() => {
        setIsBadgeVisible(false);
    }, []);

    const resetSparks = useCallback(() => {
        setTotalSparks(0);
        setActiveBursts([]);
    }, []);

    return (
        <SparkContext.Provider
            value={{
                totalSparks,
                activeBursts,
                triggerSpark,
                showFinalSparkBadge,
                hideFinalSparkBadge,
                isBadgeVisible,
                sparkConfig: currentConfig,
                setSparkConfig,
                resetSparkConfig,
                badgeConfig: currentBadgeConfig,
                setBadgeConfig,
                badgeChildName,
                setBadgeChildName,
                resetSparks,
            }}
        >
            {children}
        </SparkContext.Provider>
    );
};
