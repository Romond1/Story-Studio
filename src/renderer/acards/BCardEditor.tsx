import React from 'react';
import { AssetItem, BCard, BCardSideConfig } from '../../shared/types';
import { getAssetDisplayLabel } from '../../shared/mediaReferences';
import { useCardSystem } from '../store/CardStore';
import './acard.css';

interface BCardEditorProps {
    bCardId: string;
    assets?: AssetItem[];
    resolveImageUrl?: (imageId: string) => string | null;
}

const DEFAULT_TEXT_STYLE = {
    fontFamily: 'Arial',
    fontSize: 24,
    color: '#ffffff',
    textAlign: 'center' as const,
    verticalAlign: 'middle' as const,
};

function ImageSelector({
    label,
    currentImageId,
    assets,
    resolveImageUrl,
    onChange,
}: {
    label: string;
    currentImageId?: string | null;
    assets: AssetItem[];
    resolveImageUrl?: (imageId: string) => string | null;
    onChange: (imageId: string | null) => void;
}) {
    const imageAssets = assets.filter((asset) => asset.mediaType === 'image');
    const previewUrl = currentImageId && resolveImageUrl ? resolveImageUrl(currentImageId) : null;

    return (
        <label className="acard-editor-label">
            {label}
            <select
                value={currentImageId || ''}
                onChange={(e) => onChange(e.target.value || null)}
                className="acard-editor-select"
            >
                <option value="">None</option>
                {imageAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                        {getAssetDisplayLabel(asset, 'edit') || asset.filename}
                    </option>
                ))}
            </select>
            {previewUrl && <img src={previewUrl} alt="" className="acard-editor-image-preview" />}
        </label>
    );
}

export function BCardEditor({ bCardId, assets = [], resolveImageUrl }: BCardEditorProps) {
    const { bCardLibrary, updateBCard } = useCardSystem();
    const bCard = bCardLibrary[bCardId];
    const audioAssets = assets.filter((asset) => asset.mediaType === 'audio');

    if (!bCard) return null;

    const handleUpdate = (updates: Partial<BCard>) => {
        updateBCard({ ...bCard, ...updates });
    };

    const handleSideUpdate = (side: 'front' | 'back', updates: Partial<BCardSideConfig>) => {
        handleUpdate({
            [side]: {
                ...bCard[side],
                ...updates,
            },
        });
    };

    const handleTextStyleUpdate = (side: 'front' | 'back', updates: Partial<NonNullable<BCardSideConfig['textStyle']>>) => {
        const base = bCard[side].textStyle || DEFAULT_TEXT_STYLE;
        handleSideUpdate(side, { textStyle: { ...base, ...updates } });
    };

    const renderSide = (side: 'front' | 'back') => {
        const config = bCard[side];
        const textStyle = config.textStyle || DEFAULT_TEXT_STYLE;

        return (
            <section className="acard-editor-section" data-tone="selection">
                <button className="acard-editor-section-toggle">
                    <span className="acard-editor-section-title">{side} Face</span>
                </button>
                <div className="acard-editor-section-body">
                    <label className="acard-editor-label">
                        Text
                        <textarea
                            rows={3}
                            value={config.text || ''}
                            onChange={(e) => handleSideUpdate(side, { text: e.target.value })}
                            className="acard-editor-textarea"
                        />
                    </label>

                    <div className="acard-editor-grid-2">
                        <label className="acard-editor-label">
                            Background
                            <input
                                type="color"
                                value={config.backgroundColor || '#2a2a35'}
                                onChange={(e) => handleSideUpdate(side, { backgroundColor: e.target.value })}
                                className="acard-editor-color"
                            />
                        </label>
                        <label className="acard-editor-label">
                            Text Color
                            <input
                                type="color"
                                value={textStyle.color}
                                onChange={(e) => handleTextStyleUpdate(side, { color: e.target.value })}
                                className="acard-editor-color"
                            />
                        </label>
                    </div>

                    <div className="acard-editor-grid-2">
                        <label className="acard-editor-label">
                            Font Size
                            <input
                                type="number"
                                min={8}
                                max={120}
                                value={textStyle.fontSize}
                                onChange={(e) => handleTextStyleUpdate(side, { fontSize: parseInt(e.target.value, 10) || 24 })}
                                className="acard-editor-input"
                            />
                        </label>
                        <label className="acard-editor-label">
                            Text Align
                            <select
                                value={textStyle.textAlign}
                                onChange={(e) => handleTextStyleUpdate(side, { textAlign: e.target.value as 'left' | 'center' | 'right' })}
                                className="acard-editor-select"
                            >
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                            </select>
                        </label>
                    </div>

                    <label className="acard-editor-label">
                        Vertical Align
                        <select
                            value={textStyle.verticalAlign}
                            onChange={(e) => handleTextStyleUpdate(side, { verticalAlign: e.target.value as 'top' | 'middle' | 'bottom' })}
                            className="acard-editor-select"
                        >
                            <option value="top">Top</option>
                            <option value="middle">Middle</option>
                            <option value="bottom">Bottom</option>
                        </select>
                    </label>

                    <ImageSelector
                        label="Image"
                        currentImageId={config.imageId}
                        assets={assets}
                        resolveImageUrl={resolveImageUrl}
                        onChange={(imageId) => handleSideUpdate(side, { imageId })}
                    />

                    <label className="acard-editor-label">
                        Emoji / Sticker
                        <input
                            type="text"
                            maxLength={8}
                            value={config.emoji || ''}
                            onChange={(e) => handleSideUpdate(side, { emoji: e.target.value || null })}
                            className="acard-editor-input"
                        />
                    </label>
                </div>
            </section>
        );
    };

    return (
        <div className="acard-editor-panel" style={{ width: '100%', maxWidth: '100%', borderLeft: 'none' }}>
            <section className="acard-editor-section" data-tone="library">
                <button className="acard-editor-section-toggle">
                    <span className="acard-editor-section-title">BCard Definition</span>
                </button>
                <div className="acard-editor-section-body">
                    <label className="acard-editor-label">
                        Name
                        <input
                            type="text"
                            value={bCard.name}
                            onChange={(e) => handleUpdate({ name: e.target.value })}
                            className="acard-editor-input"
                        />
                    </label>
                    <p className="acard-editor-help">This editor updates the reusable BCard definition used by every placed instance.</p>
                    <label className="acard-editor-label">
                        Animation Preset
                        <input
                            type="text"
                            value={bCard.animationPreset || ''}
                            onChange={(e) => handleUpdate({ animationPreset: e.target.value || null })}
                            className="acard-editor-input"
                            placeholder="Optional preset name"
                        />
                    </label>
                    <label className="acard-editor-label">
                        Audio Reference
                        <select
                            value={bCard.audioRefId || ''}
                            onChange={(e) => handleUpdate({ audioRefId: e.target.value || null })}
                            className="acard-editor-select"
                        >
                            <option value="">None</option>
                            {audioAssets.map((asset) => (
                                <option key={asset.id} value={asset.id}>
                                    {getAssetDisplayLabel(asset, 'edit') || asset.filename}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </section>

            {renderSide('front')}
            {renderSide('back')}
        </div>
    );
}
