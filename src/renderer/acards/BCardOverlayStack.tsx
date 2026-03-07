import React from 'react';
import { Rnd } from 'react-rnd';
import { BCardRefItem, BCardTeachState } from '../../shared/types';
import { useCardSystem } from '../store/CardStore';
import { BCardFace } from './BCardFace';
import './acard.css';

export type BCardOverlayClickAction = 'none' | 'flip' | 'blur' | 'cover' | 'zoom';

interface BCardOverlayStackProps {
    refs: BCardRefItem[];
    mode: 'edit' | 'teach';
    resolveImageUrl: (imageId: string) => string | null;
    interactive?: boolean;
    selectedRefId?: string | null;
    onSelectRef?: (id: string) => void;
    teachStates?: Record<string, BCardTeachState>;
    clickAction?: BCardOverlayClickAction;
    onTeachStateChange?: (refId: string, next: BCardTeachState) => void;
    onRefPositionChange?: (refId: string, position: { x: number; y: number }) => void;
}

const DEFAULT_TEACH_STATE: BCardTeachState = {
    isFlipped: false,
    isBlurred: false,
    isCovered: false,
    isZoomed: false,
};

const DEFAULT_CARD_SIZE = { width: 270, height: 390 };

function getDefaultPosition(index: number) {
    return {
        x: 420 + ((index % 4) * 42),
        y: 120 + (Math.floor(index / 4) * 42),
    };
}

export function BCardOverlayStack({
    refs,
    mode,
    resolveImageUrl,
    interactive = mode === 'teach',
    selectedRefId,
    onSelectRef,
    teachStates = {},
    clickAction = 'none',
    onTeachStateChange,
    onRefPositionChange,
}: BCardOverlayStackProps) {
    const { bCardLibrary } = useCardSystem();

    const getState = (refId: string) => teachStates[refId] || DEFAULT_TEACH_STATE;

    const updateState = (refId: string, updates: Partial<BCardTeachState>) => {
        if (!onTeachStateChange) return;
        onTeachStateChange(refId, { ...getState(refId), ...updates });
    };

    const applyClickAction = (refId: string) => {
        if (!interactive || mode !== 'teach' || clickAction === 'none') return;
        const mapping: Record<Exclude<BCardOverlayClickAction, 'none'>, keyof BCardTeachState> = {
            flip: 'isFlipped',
            blur: 'isBlurred',
            cover: 'isCovered',
            zoom: 'isZoomed',
        };
        const key = mapping[clickAction as Exclude<BCardOverlayClickAction, 'none'>];
        const current = getState(refId);
        updateState(refId, { [key]: !current[key] });
    };

    if (!refs.length) return null;

    return (
        <div className="bcard-overlay-layer">
            {refs.map((refItem, index) => {
                const bCard = bCardLibrary[refItem.bCardId];
                const state = getState(refItem.id);
                const isSelected = selectedRefId === refItem.id;
                const boardMode = (refItem.stageMode || 'overlay') === 'board';
                const position = refItem.position || getDefaultPosition(index);

                if (!bCard) {
                    return (
                        <div
                            key={refItem.id}
                            className="bcard-overlay-item missing"
                            style={{ left: `${50 + ((index % 4) * 4 - 6)}%`, top: `${50 + (Math.floor(index / 4) * 4)}%` }}
                        >
                            Missing BCard reference
                        </div>
                    );
                }

                return (
                    <div key={refItem.id} className="bcard-overlay-rnd-wrap">
                        <Rnd
                            bounds="parent"
                            size={DEFAULT_CARD_SIZE}
                            position={position}
                            enableResizing={false}
                            disableDragging={false}
                            onDragStop={(_, data) => onRefPositionChange?.(refItem.id, { x: data.x, y: data.y })}
                            style={{ zIndex: isSelected ? 4 : 3, pointerEvents: interactive || mode === 'edit' ? 'auto' : 'none' }}
                        >
                            {boardMode && (
                                <div
                                    className="bcard-overlay-board-shell"
                                    style={{ left: -35, top: -35, width: DEFAULT_CARD_SIZE.width + 70, height: DEFAULT_CARD_SIZE.height + 70, transform: 'none', zIndex: 0, pointerEvents: 'none' }}
                                />
                            )}
                            <div
                                className={`bcard-overlay-item ${state.isCovered ? 'is-covered' : ''} ${isSelected ? 'is-selected' : ''}`}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    position: 'relative',
                                    left: 0,
                                    top: 0,
                                    zIndex: 2,
                                    transform: `${state.isZoomed ? 'scale(1.22)' : 'scale(1)'}`,
                                    filter: state.isBlurred ? 'blur(7px) brightness(0.72)' : undefined,
                                }}
                                onClick={() => {
                                    onSelectRef?.(refItem.id);
                                    applyClickAction(refItem.id);
                                }}
                            >
                                <div className={`bcard-body ${state.isFlipped ? 'flipped' : ''}`}>
                                    <BCardFace side="front" config={bCard.front} resolveImageUrl={resolveImageUrl} />
                                    <BCardFace side="back" config={bCard.back} resolveImageUrl={resolveImageUrl} />
                                </div>
                                <div className="bcard-solid-cover">
                                    <span>?</span>
                                </div>
                            </div>
                        </Rnd>
                    </div>
                );
            })}
        </div>
    );
}
