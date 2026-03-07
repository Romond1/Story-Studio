import React from 'react';
import { BCardTeachState } from '../../shared/types';

interface ShuffleConfig {
    durationMs: number;
    acceleration: number;
}

interface TeachActionToolbarProps {
    instanceId: string;
    state: BCardTeachState;
    onClose: () => void;
    onToggle: (property: keyof BCardTeachState) => void;
    onReset: () => void;
    onShuffle: () => void;
    shuffleConfig: ShuffleConfig;
    onShuffleConfigChange: (updates: Partial<ShuffleConfig>) => void;
    clickAction: 'none' | 'flip' | 'blur' | 'cover' | 'zoom';
    onClickActionChange: (value: 'none' | 'flip' | 'blur' | 'cover' | 'zoom') => void;
}

export function TeachActionToolbar({
    state,
    onClose,
    onToggle,
    onReset,
    onShuffle,
    shuffleConfig,
    onShuffleConfigChange,
    clickAction,
    onClickActionChange,
}: TeachActionToolbarProps) {

    const btnStyle = (isActive: boolean): React.CSSProperties => ({
        backgroundColor: isActive ? '#4a4a5c' : 'rgba(42, 42, 53, 0.8)',
        color: isActive ? '#00ffd5' : '#fff',
        border: `1px solid ${isActive ? '#00ffd5' : '#556'}`,
        borderRadius: '10px',
        padding: '6px 10px',
        cursor: 'pointer',
        fontWeight: isActive ? 'bold' : 'normal',
        transition: 'all 0.2s ease',
        textAlign: 'left',
    });

    return (
        <div style={{
            backgroundColor: 'rgba(22, 22, 30, 0.92)',
            backdropFilter: 'blur(10px)',
            padding: '12px',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: '8px',
            minWidth: '170px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
            border: '1px solid #445',
            color: '#fff',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', color: '#aaa' }}>BCard Tools</span>
                <button
                    onClick={onClose}
                    style={{ backgroundColor: 'transparent', color: '#ff6666', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.9rem', lineHeight: 1 }}
                    title="Close panel"
                >
                    X
                </button>
            </div>
            <button onClick={() => onToggle('isFlipped')} style={btnStyle(state.isFlipped)}>Flip</button>
            <button onClick={() => onToggle('isBlurred')} style={btnStyle(state.isBlurred)}>Blur</button>
            <button onClick={() => onToggle('isCovered')} style={btnStyle(state.isCovered)}>Cover</button>
            <button onClick={() => onToggle('isZoomed')} style={btnStyle(state.isZoomed)}>Zoom</button>
            <button onClick={onReset} style={{ ...btnStyle(false), color: '#ffcc00', borderColor: '#ffcc0055' }}>Reset</button>

            <div style={{ borderTop: '1px solid #334', marginTop: 2, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={onShuffle} style={{ ...btnStyle(false), backgroundColor: 'rgba(35, 48, 70, 0.85)', borderColor: '#5f84d9' }}>
                    Shuffle
                </button>

                <label style={{ fontSize: '0.72rem', color: '#98a2b3', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    Speed ({shuffleConfig.durationMs}ms)
                    <input
                        type="range"
                        min={200}
                        max={2200}
                        step={50}
                        value={shuffleConfig.durationMs}
                        onChange={(e) => onShuffleConfigChange({ durationMs: Number(e.target.value) })}
                    />
                </label>

                <label style={{ fontSize: '0.72rem', color: '#98a2b3', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    Acceleration ({shuffleConfig.acceleration.toFixed(1)})
                    <input
                        type="range"
                        min={-1}
                        max={1}
                        step={0.1}
                        value={shuffleConfig.acceleration}
                        onChange={(e) => onShuffleConfigChange({ acceleration: Number(e.target.value) })}
                    />
                </label>
            </div>

            <div style={{ borderTop: '1px solid #334', marginTop: 2, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '0.72rem', color: '#98a2b3' }}>Click Action</label>
                <select
                    value={clickAction}
                    onChange={(e) => onClickActionChange(e.target.value as 'none' | 'flip' | 'blur' | 'cover' | 'zoom')}
                    style={{ background: '#1d2230', color: '#fff', border: '1px solid #445', borderRadius: 6, padding: '6px 8px' }}
                >
                    <option value="none">None</option>
                    <option value="flip">Flip</option>
                    <option value="blur">Blur</option>
                    <option value="cover">Cover</option>
                    <option value="zoom">Zoom</option>
                </select>
            </div>
        </div>
    );
}
