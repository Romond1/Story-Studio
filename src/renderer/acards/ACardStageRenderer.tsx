import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BCardInstance, BCardTeachState } from '../../shared/types';
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
    stageBackgroundMode?: 'cardBackground' | 'transparent';
    onInstanceChange?: (instanceId: string, updates: Partial<BCardInstance>) => void;
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
    stageBackgroundMode = 'cardBackground',
    onInstanceChange,
}: ACardStageRendererProps) {
    const { aCardLibrary } = useCardSystem();
    const contentRef = useRef<HTMLDivElement | null>(null);
    const timerStartRef = useRef(Date.now());
    const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
    const [timerNow, setTimerNow] = useState(() => Date.now());

    const aCard = aCardLibrary[aCardId];
    if (!aCard) {
        return (
            <div className="acard-stage-container" style={{ color: '#ff6666' }}>
                ACard not found
            </div>
        );
    }

    // Calculate Background Styles
    const showBackground = stageBackgroundMode !== 'transparent';
    const stageMode = aCard.stageMode === 'half' ? 'half' : 'full';
    const isHalfStage = stageMode === 'half';

    const background = aCard.background || { offsetX: 50, offsetY: 50, scale: 1, blur: 0 };
    const backgroundMode = background.mode || (background.imageId ? 'image' : 'solid');

    const bgStyle = useMemo(() => {
        const bgUrl = background.imageId ? resolveImageUrl(background.imageId) : null;
        const base: React.CSSProperties = {
            backgroundColor: background.color || '#1a1a1a',
            backgroundPosition: `${background.offsetX ?? 50}% ${background.offsetY ?? 50}%`,
            backgroundSize: `${(background.scale ?? 1) * 100}%`,
            filter: `blur(${background.blur ?? 0}px)`,
        };

        if (backgroundMode === 'gradient') {
            return {
                ...base,
                backgroundImage: `linear-gradient(${background.gradientDirection || '135deg'}, ${background.gradientStart || '#162238'}, ${background.gradientEnd || '#301b3f'})`,
            };
        }

        if (backgroundMode === 'image' && bgUrl) {
            return {
                ...base,
                backgroundImage: `url("${bgUrl}")`,
            };
        }

        return {
            ...base,
            backgroundImage: 'none',
        };
    }, [background, backgroundMode, resolveImageUrl]);

    const visibleBackground = showBackground && backgroundMode !== 'transparent';
    const textPositionClass = `is-${aCard.position || 'center'}`;
    const textAlign = aCard.align || 'center';
    const titleText = aCard.title || '';
    const questionsText = aCard.questions || '';
    const hasText = Boolean(titleText.trim() || questionsText.trim());
    const hasTimer = !!aCard.timer;
    const timerDisplay = useMemo(() => {
        if (!hasTimer) return '';
        const elapsedSec = Math.floor((timerNow - timerStartRef.current) / 1000);
        const duration = aCard.timerDuration ?? 300;
        const value = aCard.timerMode === 'countup' ? elapsedSec : Math.max(0, duration - elapsedSec);
        const minutes = Math.floor(value / 60);
        const seconds = value % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, [aCard.timerDuration, aCard.timerMode, hasTimer, timerNow]);

    useLayoutEffect(() => {
        if (!hasTimer) return;
        const id = window.setInterval(() => setTimerNow(Date.now()), 500);
        return () => window.clearInterval(id);
    }, [hasTimer]);

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
        <div
            className={`acard-stage-container acard-mode-${stageMode} ${visibleBackground ? '' : 'is-transparent'}`}
            style={isHalfStage ? { background: 'transparent' } : undefined}
        >
            {/* Background Layer */}
            <div
                className={`acard-stage-bg ${visibleBackground ? '' : 'is-hidden'}`}
                style={isHalfStage ? { ...bgStyle, top: '50%', left: 0, width: '100%', height: '50%' } : bgStyle}
            />

            {(hasText || hasTimer) && (
                <div
                    className={`acard-stage-text-layer ${textPositionClass}`}
                    style={{
                        fontFamily: aCard.font || 'Arial',
                        color: aCard.textColor || '#ffffff',
                        textAlign,
                        fontWeight: aCard.isBold ? 700 : 400,
                        fontStyle: aCard.isItalic ? 'italic' : 'normal',
                    }}
                >
                    {titleText.trim() && (
                        <div className="acard-stage-title" style={{ fontSize: aCard.titleFontSize || 44 }}>
                            {titleText}
                        </div>
                    )}
                    {questionsText.trim() && (
                        <div className="acard-stage-questions" style={{ fontSize: aCard.fontSize || 30 }}>
                            {questionsText}
                        </div>
                    )}
                    {hasTimer && (
                        <div className="acard-stage-timer" style={{ fontSize: aCard.timerSize || 42 }}>
                            {timerDisplay}
                        </div>
                    )}
                </div>
            )}

            {/* Interactive Content Layer */}
            <div
                className="acard-stage-content"
                ref={contentRef}
                style={isHalfStage ? { position: 'absolute', top: '50%', left: 0, width: '100%', height: '50%' } : undefined}
            >
                {aCard.bCardInstances.map(instance => (
                    <StageInteractable
                        key={instance.id}
                        instance={instance}
                        teachState={teachStates[instance.id]}
                        resolveImageUrl={resolveImageUrl}
                        onClick={onInstanceClick}
                        isSelected={selectedInstanceId === instance.id}
                        mode={mode}
                        stageSize={stageSize}
                        movementAnimation={movementAnimation}
                        onInstanceChange={onInstanceChange}
                    />
                ))}
            </div>
        </div>
    );
}
