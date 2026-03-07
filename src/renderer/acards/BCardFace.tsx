import React from 'react';
import { BCardSideConfig } from '../../shared/types';
import './acard.css';

interface BCardFaceProps {
    config: BCardSideConfig;
    resolveImageUrl: (imageId: string) => string | null;
    side: 'front' | 'back';
}

export function BCardFace({ config, resolveImageUrl, side }: BCardFaceProps) {
    const imageUrl = config.imageId ? resolveImageUrl(config.imageId) : null;

    const textAlign = config.textStyle?.textAlign || 'center';
    const verticalAlign = config.textStyle?.verticalAlign || 'middle';

    let justifyContent = 'center';
    if (verticalAlign === 'top') justifyContent = 'flex-start';
    if (verticalAlign === 'bottom') justifyContent = 'flex-end';

    const textStyles: React.CSSProperties = {
        fontFamily: config.textStyle?.fontFamily || 'Arial, sans-serif',
        fontSize: `${config.textStyle?.fontSize || 24}px`,
        color: config.textStyle?.color || '#ffffff',
        textAlign: textAlign as any,
    };

    const bgColor = config.backgroundColor || (imageUrl ? '#000' : '#2a2a35');

    return (
        <div className={`bcard-face bcard-face-${side}`} style={{ backgroundColor: bgColor }}>
            {imageUrl && (
                <img
                    src={imageUrl}
                    alt="Card Face"
                    className="bcard-face-image"
                    draggable={false}
                />
            )}

            {config.text && (
                <div
                    className="bcard-face-text"
                    style={{ ...textStyles, flex: 1, display: 'flex', flexDirection: 'column', justifyContent }}
                >
                    {config.text}
                </div>
            )}

            {config.emoji && (
                <div style={{ position: 'absolute', bottom: '10px', right: '10px', fontSize: '2rem', zIndex: 2 }}>
                    {config.emoji}
                </div>
            )}
        </div>
    );
}
