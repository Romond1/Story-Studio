import React, { createContext, useContext, useCallback, useMemo, useRef, useEffect } from 'react';
import { ACard, ACardLibrary, BCard, BCardLibrary, BCardInstance } from '../../shared/types';

export interface CardSystemStore {
    aCardLibrary: ACardLibrary;
    bCardLibrary: BCardLibrary;

    // ACard CRUD
    createACard: (name: string, stageMode?: 'half' | 'full') => ACard;
    updateACard: (aCard: ACard) => void;
    deleteACard: (aCardId: string) => void;
    duplicateACard: (aCardId: string) => ACard | null;

    // BCard CRUD
    createBCard: (name: string) => BCard;
    updateBCard: (bCard: BCard) => void;
    deleteBCard: (bCardId: string) => void;
    duplicateBCard: (bCardId: string) => BCard | null;
}

const CardSystemContext = createContext<CardSystemStore | null>(null);

function generateId() {
    return crypto.randomUUID();
}

export function CardSystemProvider({
    aCardLibrary = {},
    bCardLibrary = {},
    onChange,
    children
}: {
    aCardLibrary?: ACardLibrary;
    bCardLibrary?: BCardLibrary;
    onChange: (aCardLibrary: ACardLibrary, bCardLibrary: BCardLibrary) => void;
    children: React.ReactNode;
}) {
    // *** THE FIX: Use refs so callbacks always see the latest library state ***
    // Without this, rapid sequential operations (e.g. createBCard then updateACard)
    // would clobber each other because useCallback closures capture stale prop values.
    const aRef = useRef(aCardLibrary);
    const bRef = useRef(bCardLibrary);
    const onChangeRef = useRef(onChange);

    useEffect(() => { aRef.current = aCardLibrary; }, [aCardLibrary]);
    useEffect(() => { bRef.current = bCardLibrary; }, [bCardLibrary]);
    useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

    // Helper that reads latest refs
    const emit = useCallback((nextA: ACardLibrary, nextB: BCardLibrary) => {
        aRef.current = nextA;
        bRef.current = nextB;
        onChangeRef.current(nextA, nextB);
    }, []);

    const createACard = useCallback((name: string, stageMode: 'half' | 'full' = 'full'): ACard => {
        const newCard: ACard = {
            id: generateId(),
            name,
            stageMode,
            background: {
                offsetX: 50,
                offsetY: 50,
                scale: 1,
                blur: 0
            },
            bCardInstances: []
        };
        emit({ ...aRef.current, [newCard.id]: newCard }, bRef.current);
        return newCard;
    }, [emit]);

    const updateACard = useCallback((aCard: ACard) => {
        emit({ ...aRef.current, [aCard.id]: aCard }, bRef.current);
    }, [emit]);

    const deleteACard = useCallback((aCardId: string) => {
        const next = { ...aRef.current };
        delete next[aCardId];
        emit(next, bRef.current);
    }, [emit]);

    const duplicateACard = useCallback((aCardId: string): ACard | null => {
        const existing = aRef.current[aCardId];
        if (!existing) return null;

        const newCard: ACard = {
            ...existing,
            id: generateId(),
            name: `${existing.name} (Copy)`,
            bCardInstances: existing.bCardInstances.map(inst => ({
                ...inst,
                id: generateId()
            }))
        };
        emit({ ...aRef.current, [newCard.id]: newCard }, bRef.current);
        return newCard;
    }, [emit]);

    const createBCard = useCallback((name: string): BCard => {
        const newCard: BCard = {
            id: generateId(),
            name,
            front: {
                text: 'Front',
                backgroundColor: '#2a4a6a',
                textStyle: { fontFamily: 'Arial', fontSize: 28, color: '#ffffff', textAlign: 'center', verticalAlign: 'middle' }
            },
            back: {
                text: 'Back',
                backgroundColor: '#4a2a2a',
                textStyle: { fontFamily: 'Arial', fontSize: 28, color: '#ffffff', textAlign: 'center', verticalAlign: 'middle' }
            }
        };
        emit(aRef.current, { ...bRef.current, [newCard.id]: newCard });
        return newCard;
    }, [emit]);

    const updateBCard = useCallback((bCard: BCard) => {
        emit(aRef.current, { ...bRef.current, [bCard.id]: bCard });
    }, [emit]);

    const deleteBCard = useCallback((bCardId: string) => {
        const nextBLib = { ...bRef.current };
        delete nextBLib[bCardId];

        // Also remove from all aCard instances
        const nextALib = { ...aRef.current };
        let hasChanges = false;
        for (const aId in nextALib) {
            const aCard = nextALib[aId];
            const filteredInstances = aCard.bCardInstances.filter(inst => inst.bCardId !== bCardId);
            if (filteredInstances.length !== aCard.bCardInstances.length) {
                hasChanges = true;
                nextALib[aId] = { ...aCard, bCardInstances: filteredInstances };
            }
        }

        emit(hasChanges ? nextALib : aRef.current, nextBLib);
    }, [emit]);

    const duplicateBCard = useCallback((bCardId: string): BCard | null => {
        const existing = bRef.current[bCardId];
        if (!existing) return null;

        const newCard: BCard = {
            ...existing,
            id: generateId(),
            name: `${existing.name} (Copy)`,
            front: JSON.parse(JSON.stringify(existing.front)),
            back: JSON.parse(JSON.stringify(existing.back))
        };
        emit(aRef.current, { ...bRef.current, [newCard.id]: newCard });
        return newCard;
    }, [emit]);

    const store = useMemo<CardSystemStore>(() => ({
        aCardLibrary,
        bCardLibrary,
        createACard,
        updateACard,
        deleteACard,
        duplicateACard,
        createBCard,
        updateBCard,
        deleteBCard,
        duplicateBCard
    }), [aCardLibrary, bCardLibrary, createACard, updateACard, deleteACard, duplicateACard, createBCard, updateBCard, deleteBCard, duplicateBCard]);

    return (
        <CardSystemContext.Provider value={store}>
            {children}
        </CardSystemContext.Provider>
    );
}

export function useCardSystem() {
    const context = useContext(CardSystemContext);
    if (!context) {
        throw new Error('useCardSystem must be used within a CardSystemProvider');
    }
    return context;
}
