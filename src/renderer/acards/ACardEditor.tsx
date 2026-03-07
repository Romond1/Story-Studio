import React, { useState } from 'react';
import { useCardSystem } from '../store/CardStore';
import { BCardInstance, BCardSideConfig, AssetItem } from '../../shared/types';

interface ACardEditorProps {
    aCardId: string;
    onSelectInstance: (instanceId: string) => void;
    selectedInstanceId?: string | null;
    assets?: AssetItem[];
    resolveImageUrl?: (imageId: string) => string | null;
}

// Collapsible section wrapper
function Section({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div style={{ borderBottom: '1px solid #333' }}>
            <button
                onClick={() => setOpen(!open)}
                style={{
                    width: '100%', padding: '8px 0', background: 'none', border: 'none',
                    color: '#aaa', cursor: 'pointer', textAlign: 'left', fontSize: '0.8rem',
                    fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
            >
                {title}
                <span style={{ fontSize: '0.7rem' }}>{open ? '▼' : '▶'}</span>
            </button>
            {open && <div style={{ paddingBottom: '12px' }}>{children}</div>}
        </div>
    );
}

const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem', color: '#aaa' };
const inputStyle: React.CSSProperties = { background: '#111', color: '#fff', border: '1px solid #444', padding: '4px 6px', borderRadius: 3, fontSize: '0.8rem' };
const btnStyle: React.CSSProperties = { padding: '5px 10px', background: '#3a3a4c', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: 4, fontSize: '0.75rem' };

// Image picker component — pick from project assets or import from file
function ImagePicker({
    label, currentImageId, assets, resolveImageUrl, onChange
}: {
    label: string;
    currentImageId?: string | null;
    assets?: AssetItem[];
    resolveImageUrl?: (id: string) => string | null;
    onChange: (imageId: string | null) => void;
}) {
    const [showPicker, setShowPicker] = useState(false);
    const imageAssets = (assets || []).filter(a => /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(a.originalName || a.relativePath));
    const previewUrl = currentImageId && resolveImageUrl ? resolveImageUrl(currentImageId) : null;
    const currentAsset = imageAssets.find(a => a.id === currentImageId);

    const handleImportFromFile = async () => {
        try {
            const result = await (window as any).appApi.importMedia();
            if (result && result.importedAssets && result.importedAssets.length > 0) {
                onChange(result.importedAssets[0].id);
            }
        } catch (err) {
            console.error('Import failed', err);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.75rem', color: '#aaa' }}>{label}</span>

            {previewUrl && (
                <img src={previewUrl} alt="Preview" style={{ width: '100%', maxHeight: 60, objectFit: 'cover', borderRadius: 4, border: '1px solid #444' }} />
            )}

            <div style={{ fontSize: '0.7rem', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentAsset ? currentAsset.originalName : (currentImageId ? currentImageId : 'None')}
            </div>

            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {imageAssets.length > 0 && (
                    <button onClick={() => setShowPicker(!showPicker)} style={{ ...btnStyle, padding: '3px 8px', fontSize: '0.65rem' }}>
                        {showPicker ? 'Hide' : 'Project'}
                    </button>
                )}
                <button onClick={handleImportFromFile} style={{ ...btnStyle, padding: '3px 8px', fontSize: '0.65rem' }}>
                    File…
                </button>
                {currentImageId && (
                    <button onClick={() => onChange(null)} style={{ ...btnStyle, padding: '3px 8px', fontSize: '0.65rem', background: '#4a2a2a', color: '#faa' }}>
                        Clear
                    </button>
                )}
            </div>

            {showPicker && (
                <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4, background: '#111', borderRadius: 4, padding: 4, border: '1px solid #333' }}>
                    {imageAssets.map(a => {
                        const isActive = a.id === currentImageId;
                        return (
                            <button
                                key={a.id}
                                onClick={() => { onChange(a.id); setShowPicker(false); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '3px 6px', background: isActive ? '#2a3a4c' : 'transparent',
                                    border: isActive ? '1px solid #00ffd5' : '1px solid transparent',
                                    color: '#ddd', cursor: 'pointer', borderRadius: 3,
                                    fontSize: '0.7rem', textAlign: 'left'
                                }}
                            >
                                {resolveImageUrl && resolveImageUrl(a.id) && (
                                    <img src={resolveImageUrl(a.id)!} alt="" style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 2 }} />
                                )}
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {a.originalName || a.id}
                                </span>
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

    const handleUpdate = (updates: Partial<typeof aCard>) => {
        updateACard({ ...aCard, ...updates });
    };

    const handleBgUpdate = (bgUpdates: Partial<typeof aCard.background>) => {
        handleUpdate({ background: { ...aCard.background, ...bgUpdates } });
    };

    const handleAddInstance = (bCardId: string) => {
        // Place = add one instance of the selected library BCard
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
        handleUpdate({
            bCardInstances: aCard.bCardInstances.filter(i => i.id !== instanceId)
        });
        // Clear editor if the deleted card was selected
        if (selectedInstanceId === instanceId) {
            onSelectInstance('');
        }
    };

    const handleDeleteFromLibrary = (bCardId: string) => {
        // Check if this BCard is placed in any ACard
        const usedIn: string[] = [];
        for (const ac of Object.values(aCardLibrary)) {
            if (ac.bCardInstances.some(i => i.bCardId === bCardId)) {
                usedIn.push(ac.name);
            }
        }
        if (usedIn.length > 0) {
            const ok = window.confirm(`This BCard is used in: ${usedIn.join(', ')}.\n\nAll placed instances will be removed. Continue?`);
            if (!ok) return;
        }
        // Clear selection if selected instance uses this bCard
        if (selectedInstance && selectedInstance.bCardId === bCardId) {
            onSelectInstance('');
        }
        deleteBCard(bCardId);
    };

    // Find the selected instance and its BCard definition
    const selectedInstance = aCard.bCardInstances.find(i => i.id === selectedInstanceId);
    const selectedBCard = selectedInstance ? bCardLibrary[selectedInstance.bCardId] : null;

    const handleBCardUpdate = (updates: Partial<typeof selectedBCard>) => {
        if (!selectedBCard) return;
        updateBCard({ ...selectedBCard, ...updates } as any);
    };

    const handleSideUpdate = (side: 'front' | 'back', updates: Partial<BCardSideConfig>) => {
        if (!selectedBCard) return;
        const currentSide = selectedBCard[side];
        handleBCardUpdate({ [side]: { ...currentSide, ...updates } });
    };

    const handleSideStyleUpdate = (side: 'front' | 'back', styleUpdates: Partial<BCardSideConfig['textStyle']>) => {
        if (!selectedBCard) return;
        const currentSide = selectedBCard[side];
        const currentStyle = currentSide.textStyle || { fontFamily: 'Arial', fontSize: 24, color: '#ffffff', textAlign: 'center' as const, verticalAlign: 'middle' as const };
        handleSideUpdate(side, { textStyle: { ...currentStyle, ...styleUpdates } as BCardSideConfig['textStyle'] });
    };

    const handleInstanceUpdate = (updates: Partial<BCardInstance>) => {
        if (!selectedInstance) return;
        const newInstances = aCard.bCardInstances.map(inst =>
            inst.id === selectedInstance.id ? { ...inst, ...updates } : inst
        );
        handleUpdate({ bCardInstances: newInstances });
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

    const renderSideFaceEditor = (side: 'front' | 'back') => {
        if (!selectedBCard) return null;
        const config = selectedBCard[side];
        const ts = config.textStyle;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={labelStyle}>
                    Text
                    <textarea
                        rows={2}
                        value={config.text || ''}
                        onChange={(e) => handleSideUpdate(side, { text: e.target.value })}
                        style={{ ...inputStyle, resize: 'vertical', minHeight: 36 }}
                    />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <label style={labelStyle}>
                        BG Color
                        <input
                            type="color"
                            value={config.backgroundColor || '#2a2a35'}
                            onChange={(e) => handleSideUpdate(side, { backgroundColor: e.target.value })}
                            style={{ width: 32, height: 24, border: 'none', cursor: 'pointer', background: 'transparent' }}
                        />
                    </label>
                    <label style={labelStyle}>
                        Text Color
                        <input
                            type="color"
                            value={ts?.color || '#ffffff'}
                            onChange={(e) => handleSideStyleUpdate(side, { color: e.target.value })}
                            style={{ width: 32, height: 24, border: 'none', cursor: 'pointer', background: 'transparent' }}
                        />
                    </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <label style={labelStyle}>
                        Font Size
                        <input
                            type="number"
                            min={8}
                            max={120}
                            value={ts?.fontSize || 24}
                            onChange={(e) => handleSideStyleUpdate(side, { fontSize: parseInt(e.target.value, 10) || 24 })}
                            style={inputStyle}
                        />
                    </label>
                    <label style={labelStyle}>
                        Align
                        <select
                            value={ts?.textAlign || 'center'}
                            onChange={(e) => handleSideStyleUpdate(side, { textAlign: e.target.value as any })}
                            style={inputStyle}
                        >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                        </select>
                    </label>
                </div>

                <label style={labelStyle}>
                    V-Align
                    <select
                        value={ts?.verticalAlign || 'middle'}
                        onChange={(e) => handleSideStyleUpdate(side, { verticalAlign: e.target.value as any })}
                        style={inputStyle}
                    >
                        <option value="top">Top</option>
                        <option value="middle">Middle</option>
                        <option value="bottom">Bottom</option>
                    </select>
                </label>

                <ImagePicker
                    label={`${side === 'front' ? 'Front' : 'Back'} Image`}
                    currentImageId={config.imageId}
                    assets={assets}
                    resolveImageUrl={resolveImageUrl}
                    onChange={(id) => handleSideUpdate(side, { imageId: id || undefined })}
                />
            </div>
        );
    };

    return (
        <div style={{
            width: '300px', backgroundColor: '#222', padding: '12px',
            display: 'flex', flexDirection: 'column', gap: 0, color: '#eee',
            overflowY: 'auto', fontSize: '0.85rem',
            maxHeight: '100%', height: '100%'
        }}>

            {/* ─── ACard ─── */}
            <Section title="ACard Stage" defaultOpen={true}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={labelStyle}>
                        Name
                        <input
                            type="text"
                            value={aCard.name}
                            onChange={(e) => handleUpdate({ name: e.target.value })}
                            style={inputStyle}
                        />
                    </label>
                    <label style={labelStyle}>
                        Mode
                        <select
                            value={aCard.stageMode}
                            onChange={(e) => handleUpdate({ stageMode: e.target.value as 'half' | 'full' })}
                            style={inputStyle}
                        >
                            <option value="full">Full Stage</option>
                            <option value="half">Half Stage</option>
                        </select>
                    </label>
                </div>
            </Section>

            {/* ─── Background ─── */}
            <Section title="Background" defaultOpen={false}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <ImagePicker
                        label="Background Image"
                        currentImageId={aCard.background.imageId}
                        assets={assets}
                        resolveImageUrl={resolveImageUrl}
                        onChange={(id) => handleBgUpdate({ imageId: id || undefined })}
                    />
                    <label style={labelStyle}>
                        Scale ({aCard.background.scale.toFixed(1)}x)
                        <input type="range" min="0.5" max="3" step="0.1"
                            value={aCard.background.scale}
                            onChange={(e) => handleBgUpdate({ scale: parseFloat(e.target.value) })}
                        />
                    </label>
                    <label style={labelStyle}>
                        Blur ({aCard.background.blur}px)
                        <input type="range" min="0" max="20" step="1"
                            value={aCard.background.blur}
                            onChange={(e) => handleBgUpdate({ blur: parseFloat(e.target.value) })}
                        />
                    </label>
                </div>
            </Section>

            {/* ─── BCard Library ─── */}
            <Section title="BCard Library" defaultOpen={true}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button onClick={handleCreateNewBCard} style={{ ...btnStyle, background: '#4CAF50', width: '100%' }}>
                        + New BCard
                    </button>

                    {Object.values(bCardLibrary).length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 150, overflowY: 'auto' }}>
                            {Object.values(bCardLibrary).map(bc => {
                                return (
                                    <div key={bc.id} style={{
                                        display: 'flex', alignItems: 'center', gap: 4,
                                        padding: '4px 6px', background: '#1a1a24', borderRadius: 4,
                                        border: '1px solid #333', fontSize: '0.75rem'
                                    }}>
                                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {bc.name}
                                        </span>
                                        <button
                                            onClick={() => handleAddInstance(bc.id)}
                                            style={{ ...btnStyle, padding: '2px 6px', fontSize: '0.65rem' }}
                                            title="Place on stage"
                                        >
                                            Place
                                        </button>
                                        <button
                                            onClick={() => duplicateBCard(bc.id)}
                                            style={{ ...btnStyle, padding: '2px 6px', fontSize: '0.65rem' }}
                                            title="Duplicate in library"
                                        >
                                            Dup
                                        </button>
                                        <button
                                            onClick={() => handleDeleteFromLibrary(bc.id)}
                                            style={{ ...btnStyle, padding: '2px 6px', fontSize: '0.65rem', background: '#4a2222', color: '#faa' }}
                                            title="Remove from library"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div style={{ color: '#666', fontSize: '0.75rem', textAlign: 'center' }}>No BCards yet</div>
                    )}
                </div>
            </Section>

            {/* ─── Placed Cards ─── */}
            <Section title={`Placed Cards (${aCard.bCardInstances.length})`} defaultOpen={true}>
                {aCard.bCardInstances.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {aCard.bCardInstances.map(inst => {
                            const bCardDef = bCardLibrary[inst.bCardId];
                            const isSelected = selectedInstanceId === inst.id;
                            return (
                                <div
                                    key={inst.id}
                                    style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '6px 8px',
                                        backgroundColor: isSelected ? '#2a3a4c' : '#1a1a24',
                                        border: isSelected ? '1px solid #00ffd5' : '1px solid #333',
                                        cursor: 'pointer', borderRadius: 4, fontSize: '0.75rem'
                                    }}
                                    onClick={() => onSelectInstance(inst.id)}
                                >
                                    <span>{bCardDef ? bCardDef.name : '⚠ Missing BCard'}</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteInstance(inst.id); }}
                                        style={{ background: 'transparent', color: '#ff6666', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div style={{ color: '#666', fontSize: '0.75rem', textAlign: 'center' }}>No cards placed yet</div>
                )}
            </Section>

            {/* ─── Selected BCard Editor ─── */}
            <Section title={selectedBCard ? `Edit: ${selectedBCard.name}` : 'Selected BCard'} defaultOpen={true}>
                {selectedBCard && selectedInstance ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <p style={{ fontSize: '0.7rem', color: '#fcad03', margin: 0 }}>
                            ⚠ Edits apply to ALL instances of this card.
                        </p>

                        <label style={labelStyle}>
                            Card Name
                            <input
                                type="text"
                                value={selectedBCard.name}
                                onChange={(e) => handleBCardUpdate({ name: e.target.value })}
                                style={inputStyle}
                            />
                        </label>

                        {/* Instance size */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                            <label style={labelStyle}>
                                Width
                                <input type="number" min={40} value={selectedInstance.size.width}
                                    onChange={(e) => handleInstanceUpdate({ size: { ...selectedInstance.size, width: parseInt(e.target.value, 10) || 100 } })}
                                    style={inputStyle} />
                            </label>
                            <label style={labelStyle}>
                                Height
                                <input type="number" min={40} value={selectedInstance.size.height}
                                    onChange={(e) => handleInstanceUpdate({ size: { ...selectedInstance.size, height: parseInt(e.target.value, 10) || 100 } })}
                                    style={inputStyle} />
                            </label>
                        </div>

                        <div style={{ borderTop: '1px solid #444', paddingTop: 8 }}>
                            <h5 style={{ margin: '0 0 6px', color: '#8af', fontSize: '0.75rem', textTransform: 'uppercase' }}>Front Face</h5>
                            {renderSideFaceEditor('front')}
                        </div>

                        <div style={{ borderTop: '1px solid #444', paddingTop: 8 }}>
                            <h5 style={{ margin: '0 0 6px', color: '#fa8', fontSize: '0.75rem', textTransform: 'uppercase' }}>Back Face</h5>
                            {renderSideFaceEditor('back')}
                        </div>

                        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                            <button
                                onClick={handleDuplicateSelectedToStage}
                                style={{ ...btnStyle, flex: 1 }}
                            >
                                Duplicate Card
                            </button>
                            <button
                                onClick={() => handleDeleteInstance(selectedInstance.id)}
                                style={{ ...btnStyle, flex: 1, background: '#5a2a2a', color: '#faa' }}
                            >
                                Remove from Stage
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{ color: '#666', fontSize: '0.75rem', textAlign: 'center', padding: '12px 0' }}>
                        Click a placed card on the stage to edit it.
                    </div>
                )}
            </Section>
        </div>
    );
}
