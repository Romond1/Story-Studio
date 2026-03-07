import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { BCardTeachState } from '../../shared/types';

interface TeachStateStore {
    states: Record<string, BCardTeachState>;
    toggleState: (instanceId: string, property: keyof BCardTeachState) => void;
    resetState: (instanceId: string) => void;
    resetAll: () => void;
}

const TeachStateContext = createContext<TeachStateStore | null>(null);

const DEFAULT_STATE: BCardTeachState = {
    isFlipped: false,
    isBlurred: false,
    isCovered: false,
    isZoomed: false,
};

export function TeachStateProvider({ children }: { children: React.ReactNode }) {
    const [states, setStates] = useState<Record<string, BCardTeachState>>({});

    const toggleState = useCallback((instanceId: string, property: keyof BCardTeachState) => {
        setStates(prev => {
            const current = prev[instanceId] || { ...DEFAULT_STATE };
            return {
                ...prev,
                [instanceId]: {
                    ...current,
                    [property]: !current[property]
                }
            };
        });
    }, []);

    const resetState = useCallback((instanceId: string) => {
        setStates(prev => {
            const next = { ...prev };
            delete next[instanceId];
            return next;
        });
    }, []);

    const resetAll = useCallback(() => {
        setStates({});
    }, []);

    const store = useMemo(
        () => ({ states, toggleState, resetState, resetAll }),
        [states, toggleState, resetState, resetAll]
    );

    return (
        <TeachStateContext.Provider value={store}>
            {children}
        </TeachStateContext.Provider>
    );
}

export function useTeachState() {
    const context = useContext(TeachStateContext);
    if (!context) {
        throw new Error('useTeachState must be used within a TeachStateProvider');
    }
    return context;
}
