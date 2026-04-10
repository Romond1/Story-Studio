import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useMemo } from 'react';
import { SparkConfig, BadgeConfig, SparkStudent } from '../../shared/types';
import { removeBadgeStudent } from '../../shared/badgeStudents';

export type SparkVariant = 'gold' | 'blue' | 'pink';

export interface BurstInfo {
    id: string;
    variant: SparkVariant;
    studentName: string;
    delta: number;
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
    shapeByVariant: {
        gold: 'star',
        blue: 'star',
        pink: 'star',
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

const variantToField: Record<SparkVariant, 'yellowSparks' | 'blueSparks' | 'pinkSparks'> = {
    gold: 'yellowSparks',
    blue: 'blueSparks',
    pink: 'pinkSparks',
};

const createStudent = (name: string): SparkStudent => ({
    id: crypto.randomUUID(),
    name,
    yellowSparks: 0,
    blueSparks: 0,
    pinkSparks: 0,
    stars: 0,
    badgeVisible: true,
    badgeSparkVariant: 'gold',
});

export const getStudentSparkTotal = (student: Pick<SparkStudent, 'yellowSparks' | 'blueSparks' | 'pinkSparks'> | null | undefined): number => {
    if (!student) return 0;
    return (student.yellowSparks || 0) + (student.blueSparks || 0) + (student.pinkSparks || 0);
};

interface SparkContextType {
    totalSparks: number;
    activeSparkCounts: {
        yellow: number;
        blue: number;
        pink: number;
    };
    students: SparkStudent[];
    activeStudentId: string | null;
    activeStudent: SparkStudent | null;
    setActiveStudentId: (studentId: string) => void;
    addStudent: (name?: string) => void;
    updateStudent: (studentId: string, updates: Partial<Omit<SparkStudent, 'id'>>) => void;
    removeStudent: (studentId: string) => void;
    activeBursts: BurstInfo[];
    triggerSpark: (variant: SparkVariant) => void;
    showFinalSparkBadge: () => void;
    hideFinalSparkBadge: () => void;
    isBadgeVisible: boolean;
    isFinalScoreRevealed: boolean;
    sparkConfig: SparkConfig;
    setSparkConfig: (updates: Partial<SparkConfig>) => void;
    resetSparkConfig: () => void;
    badgeConfig: BadgeConfig;
    setBadgeConfig: (updates: Partial<BadgeConfig>) => void;
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
    students?: SparkStudent[];
    activeStudentId?: string;
    onStudentsChange?: (students: SparkStudent[]) => void;
    onActiveStudentChange?: (studentId: string) => void;
    isBadgeVisible?: boolean;
    isFinalScoreRevealed?: boolean;
    onBadgeVisibilityChange?: (visible: boolean) => void;
    onFinalScoreRevealedChange?: (revealed: boolean) => void;
}

export const SparkProvider: React.FC<SparkProviderProps> = ({
    children,
    config,
    onConfigChange,
    badgeConfig,
    onBadgeConfigChange,
    students,
    activeStudentId,
    onStudentsChange,
    onActiveStudentChange,
    isBadgeVisible: controlledBadgeVisible,
    isFinalScoreRevealed: controlledFinalScoreRevealed,
    onBadgeVisibilityChange,
    onFinalScoreRevealedChange,
}) => {
    const [activeBursts, setActiveBursts] = useState<BurstInfo[]>([]);
    const [localIsBadgeVisible, setLocalIsBadgeVisible] = useState(false);
    const [localIsFinalScoreRevealed, setLocalIsFinalScoreRevealed] = useState(false);
    const [localSparkConfig, setLocalSparkConfig] = useState<SparkConfig>(DEFAULT_SPARK_CONFIG);
    const [localBadgeConfig, setLocalBadgeConfig] = useState<BadgeConfig>(DEFAULT_BADGE_CONFIG);
    const [localStudents, setLocalStudents] = useState<SparkStudent[]>(() => {
        const firstStudent = createStudent('Student 1');
        return [firstStudent];
    });
    const [localActiveStudentId, setLocalActiveStudentId] = useState<string>(() => localStudents[0].id);

    const currentConfig = config || localSparkConfig;
    const currentBadgeConfig = badgeConfig || localBadgeConfig;
    const currentStudents = students ?? localStudents;
    const currentActiveStudentId = activeStudentId ?? localActiveStudentId;
    const currentIsBadgeVisible = controlledBadgeVisible ?? localIsBadgeVisible;
    const currentIsFinalScoreRevealed = controlledFinalScoreRevealed ?? localIsFinalScoreRevealed;

    const commitStudents = useCallback((nextStudents: SparkStudent[]) => {
        if (onStudentsChange) {
            onStudentsChange(nextStudents);
        } else {
            setLocalStudents(nextStudents);
        }
    }, [onStudentsChange]);

    const commitActiveStudentId = useCallback((studentId: string) => {
        if (onActiveStudentChange) {
            onActiveStudentChange(studentId);
        } else {
            setLocalActiveStudentId(studentId);
        }
    }, [onActiveStudentChange]);

    useEffect(() => {
        if (currentStudents.length === 0) {
            const firstStudent = createStudent('Student 1');
            commitStudents([firstStudent]);
            commitActiveStudentId(firstStudent.id);
            return;
        }

        const hasActive = currentStudents.some((student) => student.id === currentActiveStudentId);
        if (!hasActive) {
            commitActiveStudentId(currentStudents[0].id);
        }
    }, [currentStudents, currentActiveStudentId, commitStudents, commitActiveStudentId]);

    const activeStudent = useMemo(
        () => currentStudents.find((student) => student.id === currentActiveStudentId) ?? null,
        [currentStudents, currentActiveStudentId],
    );

    const totalSparks = getStudentSparkTotal(activeStudent);
    const activeSparkCounts = {
        yellow: activeStudent?.yellowSparks || 0,
        blue: activeStudent?.blueSparks || 0,
        pink: activeStudent?.pinkSparks || 0,
    };

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

    const addStudent = useCallback((name?: string) => {
        const trimmed = name?.trim();
        const nextName = trimmed || `Student ${currentStudents.length + 1}`;
        const nextStudent = createStudent(nextName);
        commitStudents([...currentStudents, nextStudent]);
        commitActiveStudentId(nextStudent.id);
    }, [currentStudents, commitStudents, commitActiveStudentId]);

    const updateStudent = useCallback((studentId: string, updates: Partial<Omit<SparkStudent, 'id'>>) => {
        commitStudents(currentStudents.map((student) => (
            student.id === studentId ? { ...student, ...updates } : student
        )));
    }, [currentStudents, commitStudents]);

    const removeStudent = useCallback((studentId: string) => {
        const result = removeBadgeStudent({
            students: currentStudents,
            activeStudentId: currentActiveStudentId,
            studentIdToRemove: studentId,
            badgeConfig: currentBadgeConfig,
        });
        if (result.students === currentStudents) return;
        commitStudents(result.students);
        if (result.badgeConfig) {
            setBadgeConfig(result.badgeConfig);
        }
        if (result.activeStudentId && result.activeStudentId !== currentActiveStudentId) {
            commitActiveStudentId(result.activeStudentId);
        }
    }, [currentStudents, currentActiveStudentId, currentBadgeConfig, commitStudents, commitActiveStudentId, setBadgeConfig]);

    const triggerSpark = useCallback((variant: SparkVariant) => {
        if (!activeStudent) return;

        const id = crypto.randomUUID();
        const field = variantToField[variant];
        const studentName = activeStudent.name?.trim() || 'Student';

        const nextStudents = currentStudents.map((student) => {
            if (student.id !== activeStudent.id) return student;
            const nextValue = (student[field] || 0) + 1;
            const nextStudent = {
                ...student,
                [field]: nextValue,
            };
            return {
                ...nextStudent,
                stars: getStudentSparkTotal(nextStudent),
            };
        });
        commitStudents(nextStudents);

        setActiveBursts((prev) => [...prev, { id, variant, studentName, delta: 1 }]);
        setTimeout(() => {
            setActiveBursts((prev) => prev.filter((b) => b.id !== id));
        }, (currentConfig?.burstDurationMs ?? 800) + 200);
    }, [activeStudent, currentStudents, commitStudents, currentConfig?.burstDurationMs]);

    const showFinalSparkBadge = useCallback(() => {
        if (onBadgeVisibilityChange) {
            onBadgeVisibilityChange(true);
        } else {
            setLocalIsBadgeVisible(true);
        }
        if (onFinalScoreRevealedChange) {
            onFinalScoreRevealedChange(true);
        } else {
            setLocalIsFinalScoreRevealed(true);
        }
    }, [onBadgeVisibilityChange, onFinalScoreRevealedChange]);

    const hideFinalSparkBadge = useCallback(() => {
        if (onBadgeVisibilityChange) {
            onBadgeVisibilityChange(false);
        } else {
            setLocalIsBadgeVisible(false);
        }
    }, [onBadgeVisibilityChange]);

    const resetSparks = useCallback(() => {
        if (!activeStudent) return;
        const nextStudents = currentStudents.map((student) => {
            if (student.id !== activeStudent.id) return student;
            return {
                ...student,
                yellowSparks: 0,
                blueSparks: 0,
                pinkSparks: 0,
                stars: 0,
            };
        });
        commitStudents(nextStudents);
        setActiveBursts([]);
    }, [activeStudent, currentStudents, commitStudents]);

    return (
        <SparkContext.Provider
            value={{
                totalSparks,
                activeSparkCounts,
                students: currentStudents,
                activeStudentId: activeStudent?.id ?? null,
                activeStudent,
                setActiveStudentId: commitActiveStudentId,
                addStudent,
                updateStudent,
                removeStudent,
                activeBursts,
                triggerSpark,
                showFinalSparkBadge,
                hideFinalSparkBadge,
                isBadgeVisible: currentIsBadgeVisible,
                isFinalScoreRevealed: currentIsFinalScoreRevealed,
                sparkConfig: currentConfig,
                setSparkConfig,
                resetSparkConfig,
                badgeConfig: currentBadgeConfig,
                setBadgeConfig,
                resetSparks,
            }}
        >
            {children}
        </SparkContext.Provider>
    );
};
