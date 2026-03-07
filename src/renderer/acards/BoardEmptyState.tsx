import React from 'react';
import { useCardSystem } from '../store/CardStore';

interface BoardEmptyStateProps {
    onCreated: (id: string) => void;
}

export function BoardEmptyState({ onCreated }: BoardEmptyStateProps) {
    const { aCardLibrary, createACard } = useCardSystem();

    const handleCreate = () => {
        const nextNum = Object.keys(aCardLibrary).length + 1;
        const newCard = createACard(`ACard ${nextNum}`, 'full');
        onCreated(newCard.id);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', width: '100%', color: '#888', justifyContent: 'center', gap: '16px' }}>
            <h2 style={{ color: '#aaa', margin: 0 }}>No ACard selected</h2>
            <p style={{ margin: 0 }}>Start by creating your first stage/board.</p>
            <button
                style={{ padding: '10px 24px', fontSize: '1rem', background: '#4CAF50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                onClick={handleCreate}
            >
                Create First ACard
            </button>
        </div>
    );
}
