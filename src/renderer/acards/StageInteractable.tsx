import React, { useCallback, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { BCardInstance, BCardTeachState } from '../../shared/types';
import { useCardSystem } from '../store/CardStore';
import { BCardFace } from './BCardFace';

interface StageInteractableProps {
    instance: BCardInstance;
    teachState?: BCardTeachState;
    resolveImageUrl: (imageId: string) => string | null;
    onClick?: (instanceId: string, bCardId: string) => void;
    isSelected?: boolean;
    mode?: 'edit' | 'teach';
    stageSize: { w: number; h: number };
    movementAnimation?: { durationMs: number; easing: string; key: number } | null;
    onInstanceChange?: (instanceId: string, updates: Partial<BCardInstance>) => void;
}

export function StageInteractable({
    instance,
    teachState,
    resolveImageUrl,
    onClick,
    isSelected,
    mode = 'edit',
    stageSize,
    movementAnimation = null,
    onInstanceChange,
}: StageInteractableProps) {
    const DRAG_CLICK_SUPPRESS_PX = 3;
    const dragStartRef = useRef<{ x: number; y: number } | null>(null);
    const suppressNextClickRef = useRef(false);
    const { bCardLibrary } = useCardSystem();
    const bCard = bCardLibrary[instance.bCardId];

    const handleUpdate = useCallback((partialUpdate: Partial<BCardInstance>) => {
        onInstanceChange?.(instance.id, partialUpdate);
    }, [instance.id, onInstanceChange]);

    const { w: pw, h: ph } = stageSize;
    if (pw <= 0 || ph <= 0) return null;

    // Convert percentage position to pixel top-left for Rnd
    const pxX = (instance.position.x / 100) * pw - instance.size.width / 2;
    const pxY = (instance.position.y / 100) * ph - instance.size.height / 2;

    // Clamp to bounds
    const clampedX = Math.max(0, Math.min(pxX, pw - instance.size.width));
    const clampedY = Math.max(0, Math.min(pxY, ph - instance.size.height));

    const isTeach = mode === 'teach';
    const isFlipped = teachState?.isFlipped || false;
    const isBlurred = teachState?.isBlurred || false;
    const isCovered = teachState?.isCovered || false;
    const isZoomed = teachState?.isZoomed || false;
    const wrapperClasses = [
        'bcard-instance-wrap',
        isBlurred ? 'is-blurred' : '',
        isZoomed ? 'is-zoomed' : '',
        isCovered ? 'is-covered' : ''
    ].filter(Boolean).join(' ');

    return (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <Rnd
                style={{
                    zIndex: instance.zIndex,
                    borderRadius: '12px',
                    boxSizing: 'border-box',
                    pointerEvents: 'auto',
                    cursor: 'grab',
                    border: isSelected ? '1px solid rgba(0,255,213,0.55)' : '1px solid rgba(255,255,255,0.15)',
                    boxShadow: isSelected ? '0 0 0 1px rgba(0,255,213,0.25), 0 0 22px rgba(0,255,213,0.35)' : '0 4px 14px rgba(0,0,0,0.25)',
                    transition: movementAnimation ? `transform ${movementAnimation.durationMs}ms ${movementAnimation.easing}` : undefined,
                }}
                bounds="parent"
                size={{
                    width: instance.size.width,
                    height: instance.size.height,
                }}
                position={{
                    x: clampedX,
                    y: clampedY,
                }}
                onDragStart={(_, data) => {
                    dragStartRef.current = { x: data.x, y: data.y };
                }}
                onDragStop={(e, d) => {
                    if (dragStartRef.current) {
                        const movedX = Math.abs(d.x - dragStartRef.current.x);
                        const movedY = Math.abs(d.y - dragStartRef.current.y);
                        if (movedX > DRAG_CLICK_SUPPRESS_PX || movedY > DRAG_CLICK_SUPPRESS_PX) {
                            suppressNextClickRef.current = true;
                        }
                    }
                    dragStartRef.current = null;
                    const centerX = ((d.x + instance.size.width / 2) / pw) * 100;
                    const centerY = ((d.y + instance.size.height / 2) / ph) * 100;
                    handleUpdate({
                        position: {
                            x: Math.max(5, Math.min(95, centerX)),
                            y: Math.max(5, Math.min(95, centerY))
                        }
                    });
                }}
                onResizeStop={(e, direction, ref, delta, position) => {
                    const newWidth = parseInt(ref.style.width, 10);
                    const newHeight = parseInt(ref.style.height, 10);
                    const centerX = ((position.x + newWidth / 2) / pw) * 100;
                    const centerY = ((position.y + newHeight / 2) / ph) * 100;
                    handleUpdate({
                        size: { width: newWidth, height: newHeight },
                        position: {
                            x: Math.max(5, Math.min(95, centerX)),
                            y: Math.max(5, Math.min(95, centerY))
                        }
                    });
                }}
                disableDragging={false}
                enableResizing={mode === 'edit'}
                minWidth={60}
                minHeight={80}
            >
                {bCard ? (
                    <>
                        {instance.displayMode === 'board' && (
                            <div
                                className="bcard-overlay-board-shell"
                                style={{ left: -35, top: -35, width: instance.size.width + 70, height: instance.size.height + 70, transform: 'none', zIndex: 0, pointerEvents: 'none' }}
                            />
                        )}
                        <div
                            className={wrapperClasses}
                            style={{ width: '100%', height: '100%', position: 'relative', borderRadius: '12px', overflow: 'hidden' }}
                            onClick={() => {
                                if (suppressNextClickRef.current) {
                                    suppressNextClickRef.current = false;
                                    return;
                                }
                                onClick && onClick(instance.id, instance.bCardId);
                            }}
                        >
                            {isTeach ? (
                                <>
                                    <div className={`bcard-body ${isFlipped ? 'flipped' : ''}`}>
                                        <BCardFace side="front" config={bCard.front} resolveImageUrl={resolveImageUrl} />
                                        <BCardFace side="back" config={bCard.back} resolveImageUrl={resolveImageUrl} />
                                    </div>
                                    <div className="bcard-solid-cover">
                                        <span>?</span>
                                    </div>
                                </>
                            ) : (
                                <BCardFace side="front" config={bCard.front} resolveImageUrl={resolveImageUrl} />
                            )}
                        </div>
                    </>
                ) : (
                    <div style={{
                        width: '100%', height: '100%',
                        backgroundColor: '#3a1a1a',
                        borderRadius: 12,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#f88', fontSize: '0.75rem', textAlign: 'center', padding: 8,
                        border: '2px dashed #f44',
                        boxSizing: 'border-box'
                    }}>
                        Missing BCard
                    </div>
                )}
            </Rnd>
        </div>
    );
}
