import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ACardStageRenderer } from './ACardStageRenderer';
import { TeachStateProvider, useTeachState } from './TeachStateProvider';
import { TeachActionToolbar } from './TeachActionToolbar';
import { ACardEditor } from './ACardEditor';
import { useCardSystem } from '../store/CardStore';
import { AssetItem, BCardInstance } from '../../shared/types';

interface ACardSystemProps {
    aCardId: string;
    mode: 'teach' | 'edit';
    resolveImageUrl: (imageId: string) => string | null;
    assets?: AssetItem[];
    teachPanelHost?: HTMLElement | null;
}

interface ShuffleConfig {
    durationMs: number;
    acceleration: number;
}

function ACardSystemInner({ aCardId, mode, resolveImageUrl, assets, teachPanelHost }: ACardSystemProps) {
    const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
    const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
    const [shuffleConfig, setShuffleConfig] = useState<ShuffleConfig>({ durationMs: 900, acceleration: 0.3 });
    const [clickAction, setClickAction] = useState<'none' | 'flip' | 'blur' | 'cover' | 'zoom'>('none');
    const [movementAnimation, setMovementAnimation] = useState<{ durationMs: number; easing: string; key: number } | null>(null);
    const { states, toggleState, resetState } = useTeachState();
    const { aCardLibrary, updateACard } = useCardSystem();
    const aCard = aCardLibrary[aCardId];

    const getEasingFromAcceleration = (acceleration: number) => {
        if (acceleration >= 0.6) return 'cubic-bezier(0.18, 0.84, 0.36, 1)';
        if (acceleration >= 0.2) return 'cubic-bezier(0.22, 0.68, 0.32, 1)';
        if (acceleration <= -0.6) return 'cubic-bezier(0.7, 0, 0.84, 0.1)';
        if (acceleration <= -0.2) return 'cubic-bezier(0.55, 0.08, 0.68, 0.28)';
        return 'cubic-bezier(0.4, 0, 0.2, 1)';
    };

    const handleInstanceClick = (instanceId: string) => {
        if (mode === 'teach' && clickAction !== 'none') {
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

    const buildNonOverlappingPositions = (instances: BCardInstance[]) => {
        if (stageSize.w <= 0 || stageSize.h <= 0) return null;
        const placed: { id: string; x: number; y: number; width: number; height: number }[] = [];
        const margin = 8;
        const sorted = [...instances].sort((a, b) => (b.size.width * b.size.height) - (a.size.width * a.size.height));
        const result = new Map<string, { x: number; y: number }>();

        const overlaps = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
            !(a.x + a.width + margin < b.x || b.x + b.width + margin < a.x || a.y + a.height + margin < b.y || b.y + b.height + margin < a.y);

        for (const inst of sorted) {
            let found = false;
            const maxX = Math.max(0, stageSize.w - inst.size.width);
            const maxY = Math.max(0, stageSize.h - inst.size.height);

            for (let i = 0; i < 350; i++) {
                const x = Math.random() * maxX;
                const y = Math.random() * maxY;
                const rect = { id: inst.id, x, y, width: inst.size.width, height: inst.size.height };
                if (!placed.some(p => overlaps(rect, p))) {
                    placed.push(rect);
                    result.set(inst.id, {
                        x: ((x + inst.size.width / 2) / stageSize.w) * 100,
                        y: ((y + inst.size.height / 2) / stageSize.h) * 100,
                    });
                    found = true;
                    break;
                }
            }

            if (!found) {
                result.set(inst.id, inst.position);
            }
        }
        return result;
    };

    const handleShuffle = () => {
        if (!aCard || aCard.bCardInstances.length < 2) return;
        const nextPositions = buildNonOverlappingPositions(aCard.bCardInstances);
        if (!nextPositions) return;

        const nextInstances = aCard.bCardInstances.map(inst => ({
            ...inst,
            position: nextPositions.get(inst.id) || inst.position,
        }));

        setMovementAnimation({
            durationMs: shuffleConfig.durationMs,
            easing: getEasingFromAcceleration(shuffleConfig.acceleration),
            key: Date.now(),
        });
        updateACard({ ...aCard, bCardInstances: nextInstances });
    };

    const teachToolsContent = useMemo(() => {
        if (mode !== 'teach') return null;
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
    }, [mode, selectedInstanceId, states, toggleState, resetState, handleShuffle, shuffleConfig, clickAction]);

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
                    teachStates={states}
                    resolveImageUrl={resolveImageUrl}
                    onInstanceClick={(instanceId) => handleInstanceClick(instanceId)}
                    selectedInstanceId={selectedInstanceId}
                    mode={mode}
                    onStageSizeChange={setStageSize}
                    movementAnimation={movementAnimation}
                />
            </div>

            {/* Edit Mode: single unified editor panel */}
            {mode === 'edit' && (
                <div style={{ borderLeft: '1px solid #444', height: '100%', display: 'flex', flexDirection: 'column' }}>
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

            {mode === 'teach' && teachPanelHost && teachToolsContent && createPortal(teachToolsContent, teachPanelHost)}
        </div>
    );
}

// Wrapper injects the volatile TeachState context
export function ACardSystem(props: ACardSystemProps) {
    return (
        <TeachStateProvider>
            <ACardSystemInner {...props} />
        </TeachStateProvider>
    );
}
