import React, { useState } from 'react';
import { useCardSystem } from '../store/CardStore';
import { AssetItem, BCardInstance, BCardSideConfig } from '../../shared/types';
import { getAssetDisplayLabel } from '../../shared/mediaReferences';
import './acard.css';

interface ACardEditorProps {
    aCardId: string;
    onSelectInstance: (instanceId: string) => void;
    selectedInstanceId?: string | null;
    assets?: AssetItem[];
    resolveImageUrl?: (imageId: string) => string | null;
}

const ANIMATION_PRESET_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'none', label: 'None' },
    { value: 'flip', label: 'Flip' },
    { value: 'fade', label: 'Fade' },
    { value: 'pop', label: 'Pop' },
    { value: 'slide-left', label: 'Slide Left' },
    { value: 'slide-right', label: 'Slide Right' },
    { value: 'zoom-in', label: 'Zoom In' },
];

function Section({
    title,
    defaultOpen = true,
    tone,
    children,
}: {
    title: string;
    defaultOpen?: boolean;
    tone?: 'library' | 'selection';
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <section className="acard-editor-section" data-tone={tone}>
            <button className="acard-editor-section-toggle" onClick={() => setOpen((v) => !v)}>
                <span className="acard-editor-section-title">{title}</span>
                <span className="chevron">{open ? 'v' : '>'}</span>
            </button>
            {open && <div className="acard-editor-section-body">{children}</div>}
        </section>
    );
}

function ImagePicker({
    label,
    currentImageId,
    assets,
    resolveImageUrl,
    onChange,
}: {
    label: string;
    currentImageId?: string | null;
    assets?: AssetItem[];
    resolveImageUrl?: (id: string) => string | null;
    onChange: (imageId: string | null) => void;
}) {
    const [showPicker, setShowPicker] = useState(false);
    const imageAssets = (assets || []).filter((a) => /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(a.originalName || a.relativePath));
    const previewUrl = currentImageId && resolveImageUrl ? resolveImageUrl(currentImageId) : null;
    const currentAsset = imageAssets.find((a) => a.id === currentImageId);

    const handleImportFromFile = async () => {
        try {
            const result = await (window as any).appApi.importMedia();
            if (result?.importedAssets?.length > 0) {
                onChange(result.importedAssets[0].id);
            }
        } catch (err) {
            console.error('Import failed', err);
        }
    };

    return (
        <div className="acard-editor-image-picker">
            <label className="acard-editor-label">{label}</label>
            {previewUrl && <img src={previewUrl} alt={`${label} preview`} className="acard-editor-image-preview" />}
            <div className="acard-editor-image-name">
                {currentAsset ? getAssetDisplayLabel(currentAsset, 'edit') : (currentImageId || 'None')}
            </div>
            <div className="acard-editor-grid-auto">
                {imageAssets.length > 0 && (
                    <button className="acard-editor-btn" onClick={() => setShowPicker((v) => !v)}>
                        {showPicker ? 'Hide Library' : 'Project Library'}
                    </button>
                )}
                <button className="acard-editor-btn" onClick={handleImportFromFile}>
                    Import File
                </button>
                {currentImageId && (
                    <button className="acard-editor-btn acard-editor-btn-danger" onClick={() => onChange(null)}>
                        Clear
                    </button>
                )}
            </div>
            {showPicker && (
                <div className="acard-editor-image-library">
                    {imageAssets.map((asset) => {
                        const isActive = asset.id === currentImageId;
                        const thumb = resolveImageUrl ? resolveImageUrl(asset.id) : null;
                        return (
                            <button
                                key={asset.id}
                                className={`acard-editor-image-item ${isActive ? 'active' : ''}`}
                                onClick={() => {
                                    onChange(asset.id);
                                    setShowPicker(false);
                                }}
                            >
                                {thumb && <img src={thumb} alt="" />}
                                <span>{getAssetDisplayLabel(asset, 'edit') || asset.id}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export function ACardEditor({ aCardId, onSelectInstance, selectedInstanceId, assets, resolveImageUrl }: ACardEditorProps) {
    const { aCardLibrary, updateACard, bCardLibrary, createBCard, duplicateBCard, updateBCard, deleteBCard } = useCardSystem();
    const aCard = aCardLibrary[aCardId];

    if (!aCard) return null;

    const selectedInstance = aCard.bCardInstances.find((i) => i.id === selectedInstanceId);
    const selectedBCard = selectedInstance ? bCardLibrary[selectedInstance.bCardId] : null;
    const audioAssets = (assets || []).filter((asset) => asset.mediaType === 'audio');

    const handleUpdate = (updates: Partial<typeof aCard>) => {
        updateACard({ ...aCard, ...updates });
    };

    const handleBgUpdate = (bgUpdates: Partial<typeof aCard.background>) => {
        handleUpdate({ background: { ...aCard.background, ...bgUpdates } });
    };

    const handleAddInstance = (bCardId: string) => {
        const offset = (aCard.bCardInstances.length * 5) % 30;
        const newInstance: BCardInstance = {
            id: crypto.randomUUID(),
            bCardId,
            position: { x: 40 + offset, y: 40 + offset },
            size: { width: 160, height: 220 },
            zIndex: aCard.bCardInstances.length + 1,
        };
        handleUpdate({ bCardInstances: [...aCard.bCardInstances, newInstance] });
        onSelectInstance(newInstance.id);
    };

    const handleCreateNewBCard = () => {
        const nextNum = Object.keys(bCardLibrary).length + 1;
        const newBCard = createBCard(`BCard ${nextNum}`);
        handleAddInstance(newBCard.id);
    };

    const handleDeleteInstance = (instanceId: string) => {
        handleUpdate({ bCardInstances: aCard.bCardInstances.filter((i) => i.id !== instanceId) });
        if (selectedInstanceId === instanceId) onSelectInstance('');
    };

    const handleDeleteFromLibrary = (bCardId: string) => {
        const usedIn: string[] = [];
        for (const ac of Object.values(aCardLibrary)) {
            if (ac.bCardInstances.some((i) => i.bCardId === bCardId)) usedIn.push(ac.name);
        }

        if (usedIn.length > 0) {
            const ok = window.confirm(`This BCard is used in: ${usedIn.join(', ')}.\n\nAll placed instances will be removed. Continue?`);
            if (!ok) return;
        }

        if (selectedInstance && selectedInstance.bCardId === bCardId) onSelectInstance('');
        deleteBCard(bCardId);
    };

    const handleBCardUpdate = (updates: Partial<typeof selectedBCard>) => {
        if (!selectedBCard) return;
        updateBCard({ ...selectedBCard, ...updates } as any);
    };

    const handleSideUpdate = (side: 'front' | 'back', updates: Partial<BCardSideConfig>) => {
        if (!selectedBCard) return;
        handleBCardUpdate({ [side]: { ...selectedBCard[side], ...updates } });
    };

    const handleSideStyleUpdate = (
        side: 'front' | 'back',
        styleUpdates: Partial<NonNullable<BCardSideConfig['textStyle']>>,
    ) => {
        if (!selectedBCard) return;
        const currentSide = selectedBCard[side];
        const currentStyle = currentSide.textStyle || {
            fontFamily: 'Arial',
            fontSize: 24,
            color: '#ffffff',
            textAlign: 'center' as const,
            verticalAlign: 'middle' as const,
        };
        handleSideUpdate(side, { textStyle: { ...currentStyle, ...styleUpdates } });
    };

    const handleInstanceUpdate = (updates: Partial<BCardInstance>) => {
        if (!selectedInstance) return;
        handleUpdate({
            bCardInstances: aCard.bCardInstances.map((inst) => (inst.id === selectedInstance.id ? { ...inst, ...updates } : inst)),
        });
    };

    const handleDuplicateSelectedToStage = () => {
        if (!selectedBCard || !selectedInstance) return;
        const dup = duplicateBCard(selectedBCard.id);
        if (!dup) return;

        const highestZ = aCard.bCardInstances.reduce((max, inst) => Math.max(max, inst.zIndex || 0), 0);
        const newInstance: BCardInstance = {
            ...selectedInstance,
            id: crypto.randomUUID(),
            bCardId: dup.id,
            position: {
                x: Math.max(5, Math.min(95, selectedInstance.position.x + 4)),
                y: Math.max(5, Math.min(95, selectedInstance.position.y + 4)),
            },
            zIndex: highestZ + 1,
        };

        handleUpdate({ bCardInstances: [...aCard.bCardInstances, newInstance] });
        onSelectInstance(newInstance.id);
    };

    const renderSideStyleEditor = (side: 'front' | 'back') => {
        if (!selectedBCard) return null;
        const config = selectedBCard[side];
        const ts = config.textStyle;
        return (
            <>
                <label className="acard-editor-label">
                    Text
                    <textarea
                        rows={2}
                        value={config.text || ''}
                        onChange={(e) => handleSideUpdate(side, { text: e.target.value })}
                        className="acard-editor-textarea"
                    />
                </label>
                <div className="acard-editor-grid-2">
                    <label className="acard-editor-label">
                        Fill Color
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
                            value={ts?.color || '#ffffff'}
                            onChange={(e) => handleSideStyleUpdate(side, { color: e.target.value })}
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
                            value={ts?.fontSize || 24}
                            onChange={(e) => handleSideStyleUpdate(side, { fontSize: parseInt(e.target.value, 10) || 24 })}
                            className="acard-editor-input"
                        />
                    </label>
                    <label className="acard-editor-label">
                        Text Align
                        <select
                            value={ts?.textAlign || 'center'}
                            onChange={(e) => handleSideStyleUpdate(side, { textAlign: e.target.value as any })}
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
                        value={ts?.verticalAlign || 'middle'}
                        onChange={(e) => handleSideStyleUpdate(side, { verticalAlign: e.target.value as any })}
                        className="acard-editor-select"
                    >
                        <option value="top">Top</option>
                        <option value="middle">Middle</option>
                        <option value="bottom">Bottom</option>
                    </select>
                </label>
            </>
        );
    };

    return (
        <div
            className="acard-editor-panel"
            onWheelCapture={(e) => {
                // Keep panel scroll independent from any stage wheel handlers.
                e.stopPropagation();
            }}
            onTouchMoveCapture={(e) => {
                e.stopPropagation();
            }}
        >
            <Section title="ACard Stage / Identity" defaultOpen={true}>
                <label className="acard-editor-label">
                    Stage Name
                    <input
                        type="text"
                        value={aCard.name}
                        onChange={(e) => handleUpdate({ name: e.target.value })}
                        className="acard-editor-input"
                    />
                </label>
                <label className="acard-editor-label">
                    Stage Mode
                    <select
                        value={aCard.stageMode}
                        onChange={(e) => handleUpdate({ stageMode: e.target.value as 'half' | 'full' })}
                        className="acard-editor-select"
                    >
                        <option value="full">Full Stage</option>
                        <option value="half">Half Stage</option>
                    </select>
                </label>
                <p className="acard-editor-empty" style={{ textAlign: 'left', padding: 0 }}>
                    {aCard.bCardInstances.length} placed card(s)
                </p>
            </Section>

            <Section title="Background" defaultOpen={false}>
                <ImagePicker
                    label="Background Image"
                    currentImageId={aCard.background.imageId}
                    assets={assets}
                    resolveImageUrl={resolveImageUrl}
                    onChange={(id) => handleBgUpdate({ imageId: id || undefined })}
                />
                <label className="acard-editor-label">
                    Scale ({aCard.background.scale.toFixed(1)}x)
                    <input
                        type="range"
                        min="0.5"
                        max="3"
                        step="0.1"
                        value={aCard.background.scale}
                        onChange={(e) => handleBgUpdate({ scale: parseFloat(e.target.value) })}
                        className="acard-editor-range"
                    />
                </label>
                <label className="acard-editor-label">
                    Blur ({aCard.background.blur}px)
                    <input
                        type="range"
                        min="0"
                        max="20"
                        step="1"
                        value={aCard.background.blur}
                        onChange={(e) => handleBgUpdate({ blur: parseFloat(e.target.value) })}
                        className="acard-editor-range"
                    />
                </label>
            </Section>

            <Section title="BCard Library" defaultOpen={true} tone="library">
                <button onClick={handleCreateNewBCard} className="acard-editor-btn acard-editor-btn-primary">
                    + New BCard
                </button>
                {Object.values(bCardLibrary).length > 0 ? (
                    <div className="acard-editor-list">
                        {Object.values(bCardLibrary).map((bc) => {
                            const isLinkedToSelection = !!selectedBCard && selectedBCard.id === bc.id;
                            return (
                                <div key={bc.id} className={`acard-editor-list-row ${isLinkedToSelection ? 'is-selected' : ''}`}>
                                    <span className="acard-editor-row-name">{bc.name}</span>
                                    <button className="acard-editor-btn" onClick={() => handleAddInstance(bc.id)} title="Place on stage">Place</button>
                                    <button className="acard-editor-btn acard-editor-btn-ghost" onClick={() => duplicateBCard(bc.id)} title="Duplicate in library">Dup</button>
                                    <button className="acard-editor-btn acard-editor-btn-danger" onClick={() => handleDeleteFromLibrary(bc.id)} title="Remove from library">Del</button>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="acard-editor-empty">No BCards yet.</p>
                )}
            </Section>

            <Section title={`Placed Cards (${aCard.bCardInstances.length})`} defaultOpen={true}>
                {aCard.bCardInstances.length > 0 ? (
                    <div className="acard-editor-list">
                        {aCard.bCardInstances.map((inst) => {
                            const bCardDef = bCardLibrary[inst.bCardId];
                            const isSelected = selectedInstanceId === inst.id;
                            return (
                                <div
                                    key={inst.id}
                                    className={`acard-editor-list-row ${isSelected ? 'is-selected' : ''}`}
                                    onClick={() => onSelectInstance(inst.id)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <span className="acard-editor-row-name">
                                        {bCardDef ? bCardDef.name : 'Missing BCard'}
                                    </span>
                                    <button
                                        className="acard-editor-btn acard-editor-btn-danger"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteInstance(inst.id);
                                        }}
                                    >
                                        Remove
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="acard-editor-empty">No cards placed yet.</p>
                )}
            </Section>

            <Section title={selectedBCard ? `Selected BCard: ${selectedBCard.name}` : 'Selected BCard'} defaultOpen={true} tone="selection">
                {selectedBCard && selectedInstance ? (
                    <>
                        <p className="acard-editor-help">Changes here update the global BCard definition and affect every instance.</p>

                        <div className="acard-editor-subsection">
                            <h5 className="acard-editor-subtitle">Identity</h5>
                            <label className="acard-editor-label">
                                Card Name
                                <input
                                    type="text"
                                    value={selectedBCard.name}
                                    onChange={(e) => handleBCardUpdate({ name: e.target.value })}
                                    className="acard-editor-input"
                                />
                            </label>
                        </div>

                        <div className="acard-editor-subsection">
                            <h5 className="acard-editor-subtitle">Layout / Size</h5>
                            <div className="acard-editor-grid-2">
                                <label className="acard-editor-label">
                                    Width
                                    <input
                                        type="number"
                                        min={40}
                                        value={selectedInstance.size.width}
                                        onChange={(e) => handleInstanceUpdate({ size: { ...selectedInstance.size, width: parseInt(e.target.value, 10) || 100 } })}
                                        className="acard-editor-input"
                                    />
                                </label>
                                <label className="acard-editor-label">
                                    Height
                                    <input
                                        type="number"
                                        min={40}
                                        value={selectedInstance.size.height}
                                        onChange={(e) => handleInstanceUpdate({ size: { ...selectedInstance.size, height: parseInt(e.target.value, 10) || 100 } })}
                                        className="acard-editor-input"
                                    />
                                </label>
                            </div>
                            <label className="acard-editor-label">
                                Z Index
                                <input
                                    type="number"
                                    min={1}
                                    value={selectedInstance.zIndex}
                                    onChange={(e) => handleInstanceUpdate({ zIndex: parseInt(e.target.value, 10) || 1 })}
                                    className="acard-editor-input"
                                />
                            </label>
                        </div>

                        <div className="acard-editor-subsection">
                            <h5 className="acard-editor-subtitle">Front Face</h5>
                            {renderSideStyleEditor('front')}
                        </div>

                        <div className="acard-editor-subsection">
                            <h5 className="acard-editor-subtitle">Back Face</h5>
                            {renderSideStyleEditor('back')}
                        </div>

                        <div className="acard-editor-subsection">
                            <h5 className="acard-editor-subtitle">Media</h5>
                            <ImagePicker
                                label="Front Image"
                                currentImageId={selectedBCard.front.imageId}
                                assets={assets}
                                resolveImageUrl={resolveImageUrl}
                                onChange={(id) => handleSideUpdate('front', { imageId: id || undefined })}
                            />
                            <ImagePicker
                                label="Back Image"
                                currentImageId={selectedBCard.back.imageId}
                                assets={assets}
                                resolveImageUrl={resolveImageUrl}
                                onChange={(id) => handleSideUpdate('back', { imageId: id || undefined })}
                            />
                        </div>

                        <div className="acard-editor-subsection">
                            <h5 className="acard-editor-subtitle">Teach / Display options</h5>
                            <label className="acard-editor-label">
                                Animation Preset
                                <select
                                    value={selectedBCard.animationPreset || 'none'}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        handleBCardUpdate({ animationPreset: value === 'none' ? null : value });
                                    }}
                                    className="acard-editor-select"
                                >
                                    {ANIMATION_PRESET_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                    {!!selectedBCard.animationPreset && !ANIMATION_PRESET_OPTIONS.some((opt) => opt.value === selectedBCard.animationPreset) && (
                                        <option value={selectedBCard.animationPreset}>
                                            Custom ({selectedBCard.animationPreset})
                                        </option>
                                    )}
                                </select>
                            </label>
                            <label className="acard-editor-label">
                                Audio Reference
                                <select
                                    value={selectedBCard.audioRefId || ''}
                                    onChange={(e) => handleBCardUpdate({ audioRefId: e.target.value || null })}
                                    className="acard-editor-select"
                                >
                                    <option value="">None</option>
                                    {audioAssets.map((asset) => (
                                        <option key={asset.id} value={asset.id}>
                                            {getAssetDisplayLabel(asset, 'edit') || asset.filename}
                                        </option>
                                    ))}
                                    {!!selectedBCard.audioRefId && !audioAssets.some((asset) => asset.id === selectedBCard.audioRefId) && (
                                        <option value={selectedBCard.audioRefId}>
                                            Missing ({selectedBCard.audioRefId})
                                        </option>
                                    )}
                                </select>
                            </label>
                        </div>

                        <div className="acard-editor-subsection">
                            <h5 className="acard-editor-subtitle">Actions</h5>
                            <div className="acard-editor-grid-2">
                                <button className="acard-editor-btn" onClick={handleDuplicateSelectedToStage}>
                                    Duplicate to Stage
                                </button>
                                <button className="acard-editor-btn acard-editor-btn-danger" onClick={() => handleDeleteInstance(selectedInstance.id)}>
                                    Remove from Stage
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <p className="acard-editor-empty">Select a placed card to edit BCard settings.</p>
                )}
            </Section>
        </div>
    );
}
