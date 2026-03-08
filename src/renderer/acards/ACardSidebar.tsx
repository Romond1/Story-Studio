import React from 'react';
import { useCardSystem } from '../store/CardStore';

interface ACardSidebarProps {
    selectedACardId: string | null;
    selectedBCardId: string | null;
    onSelectACard: (id: string | null) => void;
    onSelectBCard: (id: string | null) => void;
    appMode: 'teach' | 'edit';
}

export function ACardSidebar({ selectedACardId, selectedBCardId, onSelectACard, onSelectBCard, appMode }: ACardSidebarProps) {
    const { aCardLibrary, bCardLibrary, createACard, createBCard, duplicateBCard, deleteACard, deleteBCard } = useCardSystem();

    const cards = Object.values(aCardLibrary);
    const bCards = Object.values(bCardLibrary);

    // Auto-select first card if selection is invalid
    React.useEffect(() => {
        if (cards.length > 0) {
            if (selectedACardId && aCardLibrary[selectedACardId]) {
                return;
            }
            if (!selectedBCardId) {
                onSelectACard(cards[0].id);
            }
        } else if (selectedACardId) {
            onSelectACard(null);
        }
    }, [cards.length, selectedACardId, selectedBCardId, aCardLibrary, onSelectACard]);

    React.useEffect(() => {
        if (selectedBCardId && !bCardLibrary[selectedBCardId]) {
            onSelectBCard(bCards[0]?.id || null);
            return;
        }
        if (!selectedACardId && !selectedBCardId && cards.length === 0 && bCards.length > 0) {
            onSelectBCard(bCards[0].id);
        }
    }, [selectedACardId, selectedBCardId, bCardLibrary, bCards, cards.length, onSelectBCard]);

    const handleCreate = () => {
        const nextNum = cards.length + 1;
        const newCard = createACard(`ACard ${nextNum}`, 'full');
        onSelectACard(newCard.id);
        onSelectBCard(null);
    };

    const handleDelete = (cardId: string, cardName: string) => {
        if (window.confirm(`Delete board '${cardName}'?`)) {
            deleteACard(cardId);
            // Selection will auto-fix via the useEffect above
        }
    };

    const handleCreateBCard = () => {
        const nextNum = bCards.length + 1;
        const newCard = createBCard(`BCard ${nextNum}`);
        onSelectBCard(newCard.id);
        onSelectACard(null);
    };

    return (
        <>
            <h3 style={{ marginBottom: 12 }}>Stages (ACards)</h3>

            {cards.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {cards.map(card => {
                        const isSelected = selectedACardId === card.id;
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
                                onClick={() => {
                                    onSelectACard(card.id);
                                    onSelectBCard(null);
                                }}
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

            <h3 style={{ margin: '18px 0 12px 0' }}>BCard Library</h3>

            {bCards.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {bCards.map((card) => {
                        const isSelected = selectedBCardId === card.id;
                        return (
                            <li
                                key={card.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '6px 8px',
                                    background: isSelected ? '#27404a' : '#222',
                                    border: isSelected ? '1px solid #7be8df' : '1px solid #333',
                                    cursor: 'pointer',
                                    borderRadius: 4,
                                    gap: 6,
                                }}
                                onClick={() => {
                                    onSelectBCard(card.id);
                                    onSelectACard(null);
                                }}
                            >
                                <span style={{ flex: 1, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {card.name}
                                </span>
                                {appMode === 'edit' && (
                                    <>
                                        <button
                                            style={{ padding: '2px 6px', background: 'transparent', border: 'none', color: '#9fd8ff', cursor: 'pointer', fontSize: '0.8rem' }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const duplicated = duplicateBCard(card.id);
                                                if (duplicated) {
                                                    onSelectBCard(duplicated.id);
                                                    onSelectACard(null);
                                                }
                                            }}
                                        >
                                            Dup
                                        </button>
                                        <button
                                            style={{ padding: '2px 6px', background: 'transparent', border: 'none', color: '#f66', cursor: 'pointer', fontSize: '0.8rem' }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.confirm(`Delete BCard '${card.name}'?`)) {
                                                    deleteBCard(card.id);
                                                }
                                            }}
                                        >
                                            Del
                                        </button>
                                    </>
                                )}
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p style={{ color: '#666', fontSize: '0.85rem', textAlign: 'center' }}>No BCards yet.</p>
            )}

            {appMode === 'edit' && (
                <button
                    className="section-break-btn"
                    style={{ width: '100%', marginTop: '12px' }}
                    onClick={handleCreateBCard}
                >
                    + New BCard
                </button>
            )}
        </>
    );
}
