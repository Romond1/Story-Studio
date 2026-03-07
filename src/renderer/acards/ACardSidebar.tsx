import React from 'react';
import { useCardSystem } from '../store/CardStore';

interface ACardSidebarProps {
    selectedId: string | null;
    onSelect: (id: string) => void;
    appMode: 'teach' | 'edit';
}

export function ACardSidebar({ selectedId, onSelect, appMode }: ACardSidebarProps) {
    const { aCardLibrary, createACard, deleteACard } = useCardSystem();

    const cards = Object.values(aCardLibrary);

    // Auto-select first card if selection is invalid
    React.useEffect(() => {
        if (cards.length > 0) {
            if (!selectedId || !aCardLibrary[selectedId]) {
                onSelect(cards[0].id);
            }
        } else if (selectedId) {
            onSelect('');
        }
    }, [cards.length, selectedId, aCardLibrary]);

    const handleCreate = () => {
        const nextNum = cards.length + 1;
        const newCard = createACard(`ACard ${nextNum}`, 'full');
        onSelect(newCard.id);
    };

    const handleDelete = (cardId: string, cardName: string) => {
        if (window.confirm(`Delete board '${cardName}'?`)) {
            deleteACard(cardId);
            // Selection will auto-fix via the useEffect above
        }
    };

    return (
        <>
            <h3 style={{ marginBottom: 12 }}>Stages (ACards)</h3>

            {cards.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {cards.map(card => {
                        const isSelected = selectedId === card.id;
                        return (
                            <li
                                key={card.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '6px 8px',
                                    background: isSelected ? '#2a3a4c' : '#222',
                                    border: isSelected ? '1px solid #66f' : '1px solid #333',
                                    cursor: 'pointer',
                                    borderRadius: 4
                                }}
                                onClick={() => onSelect(card.id)}
                            >
                                <span style={{ flex: 1, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {card.name}
                                </span>

                                {appMode === 'edit' && (
                                    <button
                                        style={{ padding: '2px 6px', background: 'transparent', border: 'none', color: '#f66', cursor: 'pointer', fontSize: '0.85rem' }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(card.id, card.name);
                                        }}
                                    >
                                        ✕
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p style={{ color: '#666', fontSize: '0.85rem', textAlign: 'center' }}>No boards yet.<br />Create your first ACard below.</p>
            )}

            {appMode === 'edit' && (
                <button
                    className="section-break-btn"
                    style={{ width: '100%', marginTop: '12px' }}
                    onClick={handleCreate}
                >
                    + New ACard
                </button>
            )}
        </>
    );
}
