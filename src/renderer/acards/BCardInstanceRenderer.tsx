import React from 'react';
import { BCardInstance, BCardTeachState } from '../../shared/types';
import { useCardSystem } from '../store/CardStore';
import { BCardFace } from './BCardFace';
import './acard.css';

interface BCardInstanceRendererProps {
    instance: BCardInstance;
    teachState?: BCardTeachState;
    resolveImageUrl: (imageId: string) => string | null;
    onClick?: (instanceId: string, bCardId: string) => void;
    isSelected?: boolean;
}

export function BCardInstanceRenderer({
    instance,
    teachState,
    resolveImageUrl,
    onClick,
    isSelected
}: BCardInstanceRendererProps) {
    const { bCardLibrary } = useCardSystem();

    const bCard = bCardLibrary[instance.bCardId];

    // Construct positional data
    const styleWrapper: React.CSSProperties = {
        left: `${instance.position.x}%`,
        top: `${instance.position.y}%`,
        width: `${instance.size.width}px`,
        height: `${instance.size.height}px`,
        transform: 'translate(-50%, -50%)',
        zIndex: instance.zIndex,
        border: isSelected ? '2px dashed #00ffd5' : 'none',
        cursor: onClick ? 'pointer' : 'default',
    };

    // Missing BCard fallback
    if (!bCard) {
        return (
            <div
                className="bcard-instance-wrap"
                style={styleWrapper}
                onClick={() => onClick && onClick(instance.id, instance.bCardId)}
            >
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
            </div>
        );
    }

    // Volatile State
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
        <div
            className={wrapperClasses}
            style={styleWrapper}
            onClick={() => onClick && onClick(instance.id, bCard.id)}
        >
            <div className={`bcard-body ${isFlipped ? 'flipped' : ''}`}>
                <BCardFace side="front" config={bCard.front} resolveImageUrl={resolveImageUrl} />
                <BCardFace side="back" config={bCard.back} resolveImageUrl={resolveImageUrl} />
            </div>

            <div className="bcard-solid-cover">
                <span>?</span>
            </div>
        </div>
    );
}
