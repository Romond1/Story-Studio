import { LogicalFrameScaleContext } from '../StaticScene';
import React, { useCallback, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { BCard, BCardInstance, BCardTeachState } from '../../shared/types';
import { useOptionalCardSystem } from '../store/CardStore';
import { BCardFace } from './BCardFace';

interface StageInteractableProps {
    instance: BCardInstance;
    card?: BCard;
    passive?: boolean;
    teachState?: BCardTeachState;
    resolveImageUrl: (imageId: string) => string | null;
    onClick?: (instanceId: string, bCardId: string) => void;
    isSelected?: boolean;
    mode?: 'edit' | 'teach';
    stageSize: { w: number; h: number };
    movementAnimation?: { durationMs: number; easing: string; key: number; startedAt?: number } | null;
    onInstanceChange?: (instanceId: string, updates: Partial<BCardInstance>) => void;
}

function PassiveCardPosition({ style, children, position, size, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture, onClick }: React.ComponentProps<typeof Rnd>) {
    return <div onPointerCancel={onPointerCancel} onLostPointerCapture={onLostPointerCapture} onClick={onClick} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} style={{ ...style, position: 'absolute', left: 0, top: 0, width: size?.width, height: size?.height, transform: `translate(${position?.x ?? 0}px, ${position?.y ?? 0}px)` }}>{children}</div>;
}

export function StageInteractable({
    instance, card, passive = false,
    teachState,
    resolveImageUrl,
    onClick,
    isSelected,
    mode = 'edit',
    stageSize,
    movementAnimation = null,
    onInstanceChange,
}: StageInteractableProps) {
    const Positioner = passive || mode === "teach" ? PassiveCardPosition : Rnd;
    const pointerDrag = useRef<{ pointerId: number; x: number; y: number; startX: number; startY: number; update: (updates: Partial<BCardInstance>) => void } | null>(null);
    const DRAG_CLICK_SUPPRESS_PX = 3;
    const dragStartRef = useRef<{ x: number; y: number } | null>(null);
    const suppressNextClickRef = useRef(false);
    const store = useOptionalCardSystem();
    const bCard = card ?? store?.bCardLibrary[instance.bCardId];
    React.useContext(LogicalFrameScaleContext);
    const hostRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = React.useState(1);
    React.useLayoutEffect(() => {
      const el = hostRef.current; if (!el) return;
      const update = () => setScale(el.getBoundingClientRect().width / Math.max(1, el.clientWidth));
      update(); const observer = new ResizeObserver(update); observer.observe(el);
      window.addEventListener("resize", update);
      return () => { observer.disconnect(); window.removeEventListener("resize", update); };
    });

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
        <div ref={hostRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <Positioner
                            onClick={() => {
                                if (suppressNextClickRef.current) {
                                    suppressNextClickRef.current = false;
                                    return;
                                }
                                !passive && onClick && onClick(instance.id, instance.bCardId);
                            }}
                onPointerDown={(event: React.PointerEvent<HTMLDivElement>) => {
                    if (passive || mode !== 'teach' || !onInstanceChange || event.button !== 0) return;
                    pointerDrag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, startX: clampedX, startY: clampedY, update: handleUpdate };
                    suppressNextClickRef.current = false;
                    event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event: React.PointerEvent<HTMLDivElement>) => {
                    const start = pointerDrag.current;
                    if (!start || start.pointerId !== event.pointerId || !onInstanceChange) return;
                    const dx = event.clientX-start.x, dy = event.clientY-start.y;
                    if (Math.hypot(dx,dy) <= DRAG_CLICK_SUPPRESS_PX && !suppressNextClickRef.current) return;
                    suppressNextClickRef.current = true;
                    const host = hostRef.current;
                    const actualScale = host ? host.getBoundingClientRect().width / Math.max(1, host.clientWidth) : 1;
                    const x = Math.max(0, Math.min(pw-instance.size.width, start.startX+dx/actualScale));
                    const y = Math.max(0, Math.min(ph-instance.size.height, start.startY+dy/actualScale));
                    start.update({ position: { x: (x+instance.size.width/2)/pw*100, y: (y+instance.size.height/2)/ph*100 } });
                }}
                onPointerCancel={() => { pointerDrag.current = null; }}
                onLostPointerCapture={() => { pointerDrag.current = null; }}
                onPointerUp={(event: React.PointerEvent<HTMLDivElement>) => {
                    if (pointerDrag.current?.pointerId === event.pointerId) { pointerDrag.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }
                }}
                scale={scale}
                style={{
                    zIndex: instance.zIndex,
                    borderRadius: '12px',
                    boxSizing: 'border-box',
                    pointerEvents: passive ? 'none' : 'auto',
                    cursor: 'grab',
                    border: isSelected ? '1px solid rgba(0,255,213,0.55)' : '1px solid rgba(255,255,255,0.15)',
                    boxShadow: isSelected ? '0 0 0 1px rgba(0,255,213,0.25), 0 0 22px rgba(0,255,213,0.35)' : '0 4px 14px rgba(0,0,0,0.25)',
                    transition: movementAnimation ? `transform ${Math.max(0, movementAnimation.durationMs - (movementAnimation.startedAt ? Date.now() - movementAnimation.startedAt : 0))}ms ${movementAnimation.easing}` : undefined,
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
                onDragStart={(event) => {
                    const point = "touches" in event ? event.touches[0] : event;
                    dragStartRef.current = { x: point.clientX, y: point.clientY };
                }}
                onDragStop={(e, d) => {
                    if (dragStartRef.current) {
                        const point = "changedTouches" in e ? e.changedTouches[0] : e;
                        const movedX = Math.abs(point.clientX - dragStartRef.current.x);
                        const movedY = Math.abs(point.clientY - dragStartRef.current.y);
                        if (movedX <= DRAG_CLICK_SUPPRESS_PX && movedY <= DRAG_CLICK_SUPPRESS_PX) { dragStartRef.current = null; return; }
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
                disableDragging={passive || !onInstanceChange}
                enableResizing={!passive && mode === 'edit' && !!onInstanceChange}
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

                        >
                            <div className={`bcard-body ${isFlipped ? 'flipped' : ''}`}>
                                <BCardFace side="front" config={bCard.front} resolveImageUrl={resolveImageUrl} />
                                <BCardFace side="back" config={bCard.back} resolveImageUrl={resolveImageUrl} />
                            </div>
                            <div className="bcard-solid-cover">
                                <span>?</span>
                            </div>
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
                        Card unavailable
                    </div>
                )}
            </Positioner>
        </div>
    );
}
