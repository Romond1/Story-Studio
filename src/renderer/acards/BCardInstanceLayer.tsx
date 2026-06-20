import React, { useLayoutEffect, useRef, useState } from 'react';
import { BCardInstance, BCardTeachState } from '../../shared/types';
import { StageInteractable } from './StageInteractable';
import './acard.css';

export type BCardOverlayClickAction = 'none' | 'flip' | 'blur' | 'cover' | 'zoom';

interface BCardInstanceLayerProps {
    instances: BCardInstance[];
    mode: 'edit' | 'teach';
    resolveImageUrl: (imageId: string) => string | null;
    selectedInstanceId?: string | null;
    onSelectInstance?: (instanceId: string | null) => void;
    onInstanceChange?: (instanceId: string, updates: Partial<BCardInstance>) => void;
    teachStates?: Record<string, BCardTeachState>;
    clickAction?: BCardOverlayClickAction;
    onTeachStateChange?: (instanceId: string, next: BCardTeachState) => void;
    zIndex?: number;
}

const DEFAULT_TEACH_STATE: BCardTeachState = {
    isFlipped: false,
    isBlurred: false,
    isCovered: false,
    isZoomed: false,
};

export function BCardInstanceLayer({
    instances,
    mode,
    resolveImageUrl,
    selectedInstanceId = null,
    onSelectInstance,
    onInstanceChange,
    teachStates = {},
    clickAction = 'flip',
    onTeachStateChange,
    zIndex = 45,
}: BCardInstanceLayerProps) {
    const contentRef = useRef<HTMLDivElement | null>(null);
    const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

    useLayoutEffect(() => {
        const updateSize = () => {
            const el = contentRef.current;
            if (!el) return;
            setStageSize({ w: el.clientWidth, h: el.clientHeight });
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
    }, [instances.length]);

    if (!instances.length) return null;

    const getState = (instanceId: string) => teachStates[instanceId] || DEFAULT_TEACH_STATE;

    const toggleTeachState = (instanceId: string) => {
        if (clickAction === 'none' || !onTeachStateChange) return;

        const current = getState(instanceId);
        const key =
            clickAction === 'flip'
                ? 'isFlipped'
                : clickAction === 'blur'
                    ? 'isBlurred'
                    : clickAction === 'cover'
                        ? 'isCovered'
                        : 'isZoomed';

        onTeachStateChange(instanceId, {
            ...current,
            [key]: !current[key],
        });
    };

    const sorted = [...instances].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    return (
        <div
            className="bcard-overlay-layer"
            style={{ zIndex }}
            onClick={(event) => {
                if (event.target === event.currentTarget) {
                    onSelectInstance?.(null);
                }
            }}
        >
            <div ref={contentRef} style={{ position: 'absolute', inset: 0 }}>
                {sorted.map((instance) => (
                    <StageInteractable
                        key={instance.id}
                        instance={instance}
                        teachState={getState(instance.id)}
                        resolveImageUrl={resolveImageUrl}
                        onClick={(instanceId) => {
                            onSelectInstance?.(instanceId);
                            toggleTeachState(instanceId);
                        }}
                        isSelected={selectedInstanceId === instance.id}
                        mode={mode}
                        stageSize={stageSize}
                        onInstanceChange={onInstanceChange}
                    />
                ))}
            </div>
        </div>
    );
}
