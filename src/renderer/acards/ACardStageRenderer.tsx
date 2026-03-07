import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BCardTeachState } from '../../shared/types';
import { useCardSystem } from '../store/CardStore';
import { StageInteractable } from './StageInteractable';
import './acard.css';

interface ACardStageRendererProps {
    aCardId: string;
    teachStates?: Record<string, BCardTeachState>;
    resolveImageUrl: (imageId: string) => string | null;
    onInstanceClick?: (instanceId: string, bCardId: string) => void;
    selectedInstanceId?: string | null;
    mode?: 'teach' | 'edit'; // Added explicit mode passing for future editor logic boundaries
    onStageSizeChange?: (size: { w: number; h: number }) => void;
    movementAnimation?: { durationMs: number; easing: string; key: number } | null;
}

export function ACardStageRenderer({
    aCardId,
    teachStates = {},
    resolveImageUrl,
    onInstanceClick,
    selectedInstanceId,
    mode = 'teach',
    onStageSizeChange,
    movementAnimation = null,
}: ACardStageRendererProps) {
    const { aCardLibrary } = useCardSystem();
    const contentRef = useRef<HTMLDivElement | null>(null);
    const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

    const aCard = aCardLibrary[aCardId];
    if (!aCard) {
        return (
            <div className="acard-stage-container" style={{ color: '#ff6666' }}>
                ACard not found
            </div>
        );
    }

    // Calculate Background Styles
    const bgStyle = useMemo(() => {
        const bgUrl = aCard.background?.imageId ? resolveImageUrl(aCard.background.imageId) : null;
        return {
            backgroundImage: bgUrl ? `url("${bgUrl}")` : 'none',
            backgroundPosition: `${aCard.background.offsetX}% ${aCard.background.offsetY}%`,
            backgroundSize: `${aCard.background.scale * 100}%`,
            filter: `blur(${aCard.background.blur}px)`,
        };
    }, [aCard, resolveImageUrl]);

    useLayoutEffect(() => {
        const updateSize = () => {
            const el = contentRef.current;
            if (!el) return;
            const size = { w: el.clientWidth, h: el.clientHeight };
            setStageSize(size);
            onStageSizeChange?.(size);
        };

        updateSize();
        const el = contentRef.current;
        if (!el) return;
        const observer = new ResizeObserver(updateSize);
        observer.observe(el);
        window.addEventListener('resize', updateSize);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', updateSize);
        };
    }, [aCardId, mode, onStageSizeChange]);

    return (
        <div className={`acard-stage-container acard-mode-${aCard.stageMode}`}>
            {/* Background Layer */}
            <div className="acard-stage-bg" style={bgStyle} />

            {/* Interactive Content Layer */}
            <div className="acard-stage-content" ref={contentRef}>
                {aCard.bCardInstances.map(instance => (
                    <StageInteractable
                        key={instance.id}
                        aCardId={aCardId}
                        instance={instance}
                        teachState={teachStates[instance.id]}
                        resolveImageUrl={resolveImageUrl}
                        onClick={onInstanceClick}
                        isSelected={selectedInstanceId === instance.id}
                        mode={mode}
                        stageSize={stageSize}
                        movementAnimation={movementAnimation}
                    />
                ))}
            </div>
        </div>
    );
}
