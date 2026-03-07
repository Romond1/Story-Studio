import React from 'react';
import { useCardSystem } from '../store/CardStore';
import { BCard, BCardSideConfig } from '../../shared/types';

interface BCardEditorProps {
    bCardId: string;
}

export function BCardEditor({ bCardId }: BCardEditorProps) {
    const { bCardLibrary, updateBCard } = useCardSystem();
    const bCard = bCardLibrary[bCardId];

    if (!bCard) return null;

    const handleUpdate = (updates: Partial<BCard>) => {
        updateBCard({ ...bCard, ...updates });
    };

    const handleSideUpdate = (side: 'front' | 'back', updates: Partial<BCardSideConfig>) => {
        const currentSide = bCard[side];
        handleUpdate({
            [side]: { ...currentSide, ...updates }
        });
    };

    const renderSideEditor = (side: 'front' | 'back', config: BCardSideConfig) => (
        <div style={{ border: '1px solid #444', padding: '12px', borderRadius: '8px', marginBottom: '16px', background: '#1a1a24' }}>
            <h4 style={{ margin: '0 0 12px 0', textTransform: 'capitalize' }}>{side} Face</h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem' }}>
                    Image ID / URL
                    <input
                        type="text"
                        value={config.imageId || ''}
                        onChange={(e) => handleSideUpdate(side, { imageId: e.target.value })}
                        placeholder="e.g. cat.png"
                        style={{ padding: '4px', background: '#111', color: '#fff', border: '1px solid #333' }}
                    />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem' }}>
                    Text Override
                    <textarea
                        rows={2}
                        value={config.text || ''}
                        onChange={(e) => handleSideUpdate(side, { text: e.target.value })}
                        style={{ padding: '4px', background: '#111', color: '#fff', border: '1px solid #333' }}
                    />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem' }}>
                    Emoji Badge
                    <input
                        type="text"
                        maxLength={2}
                        value={config.emoji || ''}
                        onChange={(e) => handleSideUpdate(side, { emoji: e.target.value })}
                        style={{ padding: '4px', background: '#111', color: '#fff', border: '1px solid #333', width: '50px' }}
                    />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem' }}>
                        Color
                        <input
                            type="color"
                            value={config.textStyle?.color || '#ffffff'}
                            onChange={(e) => handleSideUpdate(side, { textStyle: { ...config.textStyle, color: e.target.value, fontFamily: config.textStyle?.fontFamily || 'Arial', fontSize: config.textStyle?.fontSize || 24, textAlign: config.textStyle?.textAlign || 'center', verticalAlign: config.textStyle?.verticalAlign || 'middle' } })}
                        />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem' }}>
                        Font Size
                        <input
                            type="number"
                            value={config.textStyle?.fontSize || 24}
                            onChange={(e) => handleSideUpdate(side, { textStyle: { ...config.textStyle, fontSize: parseInt(e.target.value, 10), color: config.textStyle?.color || '#ffffff', fontFamily: config.textStyle?.fontFamily || 'Arial', textAlign: config.textStyle?.textAlign || 'center', verticalAlign: config.textStyle?.verticalAlign || 'middle' } })}
                            style={{ background: '#111', color: '#fff', border: '1px solid #333' }}
                        />
                    </label>
                </div>
            </div>
        </div>
    );

    return (
        <div style={{ width: '300px', backgroundColor: '#222', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', color: '#eee', overflowY: 'auto' }}>
            <h3>Edit BCard Definition</h3>
            <p style={{ fontSize: '0.8rem', color: '#fcad03', margin: 0 }}>
                Warning: Edits here apply to ALL instances of this card globally.
            </p>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                Card Internal Name
                <input
                    type="text"
                    value={bCard.name}
                    onChange={(e) => handleUpdate({ name: e.target.value })}
                    style={{ background: '#111', color: '#fff', border: '1px solid #444', padding: '6px' }}
                />
            </label>

            {renderSideEditor('front', bCard.front)}
            {renderSideEditor('back', bCard.back)}

        </div>
    );
}
