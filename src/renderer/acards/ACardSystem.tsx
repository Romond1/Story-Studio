import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ACardStageRenderer } from './ACardStageRenderer';
import type { CardBinding } from '../useCardRuntime';
import { emptyCardState } from '../../shared/cardRuntime';
import { TeachActionToolbar } from './TeachActionToolbar';
import { ACardEditor } from './ACardEditor';
import { useCardSystem } from '../store/CardStore';
import { AssetItem, BCardInstance } from '../../shared/types';

interface ACardSystemProps {
    aCardId: string;
    runtime: CardBinding;
    mode: 'teach' | 'edit';
    resolveImageUrl: (imageId: string) => string | null;
    assets?: AssetItem[];
    teachPanelHost?: HTMLElement | null;
}

interface ShuffleConfig {
    durationMs: number;
    acceleration: number;
}

export function ACardSystem({ aCardId, mode, resolveImageUrl, assets, teachPanelHost, runtime }: ACardSystemProps) {
    const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
    const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
    const [shuffleConfig, setShuffleConfig] = useState<ShuffleConfig>({ durationMs: 900, acceleration: 0.3 });
    const [clickAction, setClickAction] = useState<'none' | 'flip' | 'blur' | 'cover' | 'zoom'>('flip');

    const states = runtime.state.states;
    const toggleState = runtime.toggle;
    const resetState = (id: string) => runtime.setState(id, emptyCardState());
    const { aCardLibrary, updateACard } = useCardSystem();
    const aCard = aCardLibrary[aCardId];

    const updateInstance = (instanceId: string, updates: Partial<BCardInstance>) => {
        if (!aCard) return;
        if (mode === 'teach') { runtime.move(instanceId, updates); return; }
        updateACard({
            ...aCard,
            bCardInstances: aCard.bCardInstances.map((inst) =>
                inst.id === instanceId ? { ...inst, ...updates } : inst,
            ),
        });
    };

    const getEasingFromAcceleration = (acceleration: number) => {
        if (acceleration >= 0.6) return 'cubic-bezier(0.18, 0.84, 0.36, 1)';
        if (acceleration >= 0.2) return 'cubic-bezier(0.22, 0.68, 0.32, 1)';
        if (acceleration <= -0.6) return 'cubic-bezier(0.7, 0, 0.84, 0.1)';
        if (acceleration <= -0.2) return 'cubic-bezier(0.55, 0.08, 0.68, 0.28)';
        return 'cubic-bezier(0.4, 0, 0.2, 1)';
    };

    const handleInstanceClick = (instanceId: string) => {
        if (clickAction !== 'none') {
            const mapping = {
                flip: 'isFlipped',
                blur: 'isBlurred',
                cover: 'isCovered',
                zoom: 'isZoomed',
            } as const;
            toggleState(instanceId, mapping[clickAction]);
        }
        setSelectedInstanceId(instanceId);
    };

    const handleShuffle = () => {
        if (!aCard || stageSize.w <= 0 || stageSize.h <= 0) return;
        runtime.shuffle({ width: stageSize.w, height: stageSize.h }, { durationMs: shuffleConfig.durationMs, easing: getEasingFromAcceleration(shuffleConfig.acceleration), key: Date.now(), startedAt: Date.now() });
        if (mode === "edit") updateACard({ ...aCard, bCardInstances: runtime.state.instances });
    };

    const bCardToolsContent = useMemo(() => {
        if (!selectedInstanceId) return null;
        const selectedState = states[selectedInstanceId] || {
            isFlipped: false,
            isBlurred: false,
            isCovered: false,
            isZoomed: false,
        };
        return (
            <TeachActionToolbar
                instanceId={selectedInstanceId}
                state={selectedState}
                onClose={() => setSelectedInstanceId(null)}
                onToggle={(property) => toggleState(selectedInstanceId, property)}
                onReset={() => resetState(selectedInstanceId)}
                onShuffle={handleShuffle}
                shuffleConfig={shuffleConfig}
                onShuffleConfigChange={(updates) => setShuffleConfig(prev => ({ ...prev, ...updates }))}
                clickAction={clickAction}
                onClickActionChange={setClickAction}
            />
        );
    }, [selectedInstanceId, states, toggleState, resetState, handleShuffle, shuffleConfig, clickAction]);

    return (
        <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
            {/* Main Stage Area */}
            <div
                style={{ flex: 1, position: 'relative' }}
                onClick={(e) => {
                    if (mode === 'edit' && e.target === e.currentTarget) {
                        setSelectedInstanceId(null);
                    }
                }}
            >
                <ACardStageRenderer
                    aCardId={aCardId}
                    card={aCard && mode === 'teach' ? { ...aCard, bCardInstances: runtime.state.instances } : aCard}
                    startedAt={runtime.state.startedAt}
                    teachStates={states}
                    resolveImageUrl={resolveImageUrl}
                    onInstanceClick={(instanceId) => handleInstanceClick(instanceId)}
                    selectedInstanceId={selectedInstanceId}
                    mode={mode}
                    onStageSizeChange={setStageSize}
                    movementAnimation={runtime.state.movement}
                    onInstanceChange={updateInstance}
                />
            </div>

            {/* Edit Mode: single unified editor panel */}
            {mode === 'edit' && (
                <div style={{ borderLeft: '1px solid #444', height: '100%', minHeight: 0, width: 330, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {bCardToolsContent && (
                        <div style={{ padding: 10, borderBottom: '1px solid #334' }}>
                            {bCardToolsContent}
                        </div>
                    )}
                    <ACardEditor
                        aCardId={aCardId}
                        selectedInstanceId={selectedInstanceId}
                        onSelectInstance={(id) => {
                            setSelectedInstanceId(id || null);
                        }}
                        assets={assets}
                        resolveImageUrl={resolveImageUrl}
                    />
                </div>
            )}

            {mode === 'teach' && teachPanelHost && bCardToolsContent && createPortal(bCardToolsContent, teachPanelHost)}
        </div>
    );
}
