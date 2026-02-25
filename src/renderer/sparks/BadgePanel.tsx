import React, { useState } from 'react';
import { useSparks } from './SparkProvider';
import { ProjectState } from '../../shared/types';

interface BadgePanelProps {
    isEditMode: boolean;
    project: ProjectState | null;
    onUpdateProject: (updates: Partial<ProjectState>) => void;
    show?: 'content' | 'settings' | 'both';
}

export const BadgePanel: React.FC<BadgePanelProps> = ({ isEditMode, project, onUpdateProject, show = 'both' }) => {
    const {
        totalSparks,
        badgeChildName,
        setBadgeChildName,
        showFinalSparkBadge,
        hideFinalSparkBadge,
        resetSparks,
        triggerSpark,
        badgeConfig,
        setBadgeConfig
    } = useSparks();

    const [isTabBgOpen, setIsTabBgOpen] = useState(true);
    const [isBgOpen, setIsBgOpen] = useState(false); // Final Badge BG
    const [isPreviewOpen, setIsPreviewOpen] = useState(true);
    const [isAnimOpen, setIsAnimOpen] = useState(false);

    const bg = badgeConfig.background || {};
    const tabBg = badgeConfig.tabBackground || {};
    const anim = badgeConfig.animation || {};

    const updateBg = (updates: any) => {
        setBadgeConfig({
            background: { ...bg, ...updates }
        });
    };

    const updateTabBg = (updates: any) => {
        setBadgeConfig({
            tabBackground: { ...tabBg, ...updates }
        });
    };

    const updatePreviewShield = (updates: any) => {
        setBadgeConfig({
            previewShield: { ...(badgeConfig.previewShield || {}), ...updates }
        });
    };

    const updateAnim = (updates: any) => {
        setBadgeConfig({
            animation: { ...anim, ...updates }
        });
    };

    const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem', color: '#aaa' };
    const inputStyle: React.CSSProperties = { background: '#111', border: '1px solid #444', color: '#fff', padding: '6px', borderRadius: 4 };
    const sectionHeaderStyle: React.CSSProperties = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer',
        padding: '8px 0',
        borderBottom: '1px solid #334',
        marginBottom: 10
    };

    const renderBackgroundControls = (
        currentBg: any,
        onUpdate: (upd: any) => void,
        configKey: 'background' | 'tabBackground'
    ) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
                onClick={async () => {
                    const res = await (window as any).appApi.importMedia();
                    if (res && res.importedAssets.length > 0) {
                        const newAssetId = res.importedAssets[0].id;
                        const nextBadgeConfig = {
                            ...badgeConfig,
                            [configKey]: {
                                ...(badgeConfig[configKey] || {}),
                                assetId: newAssetId
                            }
                        };

                        // Local update
                        onUpdate({ assetId: newAssetId });

                        // Persistence update
                        onUpdateProject({
                            data: {
                                ...project!.data,
                                badgeConfig: nextBadgeConfig,
                                assets: [...project!.data.assets, ...res.importedAssets]
                            }
                        });
                    }
                }}
                style={{ padding: '8px', background: '#334', border: '1px solid #446', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}
            >
                {currentBg.assetId ? 'Change Image' : 'Select Image'}
            </button>

            {currentBg.assetId && (
                <button
                    onClick={() => {
                        const nextBadgeConfig = {
                            ...badgeConfig,
                            [configKey]: {
                                ...(badgeConfig[configKey] || {}),
                                assetId: undefined
                            }
                        };
                        onUpdate({ assetId: undefined });
                        onUpdateProject({
                            data: {
                                ...project!.data,
                                badgeConfig: nextBadgeConfig
                            }
                        });
                    }}
                    style={{ fontSize: '0.7rem', color: '#f66', background: 'transparent', border: 'none', cursor: 'pointer', alignSelf: 'flex-start' }}
                >
                    Remove Image
                </button>
            )}

            <label style={labelStyle}>
                PosX ({currentBg.posX ?? 50}%)
                <input type="range" min={0} max={100} value={currentBg.posX ?? 50} onChange={e => onUpdate({ posX: Number(e.target.value) })} />
            </label>
            <label style={labelStyle}>
                PosY ({currentBg.posY ?? 50}%)
                <input type="range" min={0} max={100} value={currentBg.posY ?? 50} onChange={e => onUpdate({ posY: Number(e.target.value) })} />
            </label>
            <label style={labelStyle}>
                Scale ({currentBg.scale ?? 1}x)
                <input type="range" min={0.5} max={3} step={0.1} value={currentBg.scale ?? 1} onChange={e => onUpdate({ scale: Number(e.target.value) })} />
            </label>
            <label style={labelStyle}>
                Blur ({currentBg.blur ?? 0}px)
                <input type="range" min={0} max={20} value={currentBg.blur ?? 0} onChange={e => onUpdate({ blur: Number(e.target.value) })} />
            </label>
            <label style={labelStyle}>
                Brightness ({currentBg.brightness ?? 100}%)
                <input type="range" min={0} max={200} value={currentBg.brightness ?? 100} onChange={e => onUpdate({ brightness: Number(e.target.value) })} />
            </label>
        </div>
    );

    const renderContent = () => (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#ffd700' }}>Student Settings</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={labelStyle}>Student Name</label>
                    <input
                        type="text"
                        value={badgeChildName}
                        onChange={(e) => setBadgeChildName(e.target.value)}
                        placeholder="Enter name..."
                        style={inputStyle}
                    />
                </div>
            </section>

            <section>
                <label style={labelStyle}>
                    Congrats Text (use {'{n}'} for sparks)
                    <input
                        type="text"
                        value={badgeConfig.congratsText}
                        onChange={e => setBadgeConfig({ congratsText: e.target.value })}
                        style={inputStyle}
                    />
                </label>
            </section>

            <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                    onClick={showFinalSparkBadge}
                    style={{ padding: '10px', background: '#2a5a2a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                    🏆 Show Final Badge
                </button>

                <button
                    onClick={hideFinalSparkBadge}
                    style={{ padding: '6px', background: '#3a3a4c', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                    Hide Badge
                </button>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: '#6fa', cursor: 'pointer', marginTop: 5 }}>
                    <input
                        type="checkbox"
                        checked={badgeConfig.showFinalScore || false}
                        onChange={e => setBadgeConfig({ showFinalScore: e.target.checked })}
                    />
                    Display Final Score
                </label>
            </section>

            <section style={{ background: '#1a1a24', padding: '12px', borderRadius: '8px', border: '1px solid #334', marginTop: 10 }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>Current Total</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '2px 0' }}>{totalSparks}</div>
                    <div style={{ fontSize: '0.7rem', color: '#ffd700' }}>SPARKS</div>
                </div>
            </section>

            {isEditMode && (
                <button
                    onClick={resetSparks}
                    style={{ padding: '6px', background: '#442222', color: '#ffaaaa', border: '1px solid #663333', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                    Reset All Sparks
                </button>
            )}
        </div>
    );

    const renderSettings = () => (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* TAB BACKGROUND GROUP */}
            <div className="collapsible-group">
                <div style={sectionHeaderStyle} onClick={() => setIsTabBgOpen(!isTabBgOpen)}>
                    <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#66f' }}>Background</h3>
                    <span>{isTabBgOpen ? '▼' : '▶'}</span>
                </div>
                {isTabBgOpen && renderBackgroundControls(tabBg, updateTabBg, 'tabBackground')}
            </div>

            {/* FINAL BADGE BG GROUP */}
            <div className="collapsible-group">
                <div style={sectionHeaderStyle} onClick={() => setIsBgOpen(!isBgOpen)}>
                    <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#ffd700' }}>Final Badge BG</h3>
                    <span>{isBgOpen ? '▼' : '▶'}</span>
                </div>
                {isBgOpen && renderBackgroundControls(bg, updateBg, 'background')}
            </div>

            {/* PREVIEW SHIELD SETTINGS */}
            <div className="collapsible-group">
                <div style={sectionHeaderStyle} onClick={() => setIsPreviewOpen(!isPreviewOpen)}>
                    <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#6fa' }}>Spinning Shield</h3>
                    <span>{isPreviewOpen ? '▼' : '▶'}</span>
                </div>

                {isPreviewOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#aaa', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={badgeConfig.previewShield?.visible !== false}
                                onChange={e => updatePreviewShield({ visible: e.target.checked })}
                            />
                            Visible on Tab
                        </label>

                        <label style={labelStyle}>
                            Size ({badgeConfig.previewShield?.size ?? 200}px)
                            <input type="range" min={50} max={600} step={10} value={badgeConfig.previewShield?.size ?? 200} onChange={e => updatePreviewShield({ size: Number(e.target.value) })} />
                        </label>

                        <label style={labelStyle}>
                            PosX ({badgeConfig.previewShield?.posX ?? 50}%)
                            <input type="range" min={0} max={100} value={badgeConfig.previewShield?.posX ?? 50} onChange={e => updatePreviewShield({ posX: Number(e.target.value) })} />
                        </label>

                        <label style={labelStyle}>
                            PosY ({badgeConfig.previewShield?.posY ?? 50}%)
                            <input type="range" min={0} max={100} value={badgeConfig.previewShield?.posY ?? 50} onChange={e => updatePreviewShield({ posY: Number(e.target.value) })} />
                        </label>

                        <label style={labelStyle}>
                            Spin Direction
                            <select
                                value={badgeConfig.previewShield?.spinDirection ?? 'cw'}
                                onChange={e => updatePreviewShield({ spinDirection: e.target.value as any })}
                                style={inputStyle}
                            >
                                <option value="cw">Clockwise</option>
                                <option value="ccw">Counter-Clockwise</option>
                            </select>
                        </label>

                        <label style={labelStyle}>
                            Spin Intensity ({badgeConfig.previewShield?.spinIntensity ?? 100}%)
                            <input type="range" min={0} max={500} step={10} value={badgeConfig.previewShield?.spinIntensity ?? 100} onChange={e => updatePreviewShield({ spinIntensity: Number(e.target.value) })} />
                        </label>
                    </div>
                )}
            </div>

            {/* FINAL BADGE GROUP */}
            <div className="collapsible-group">
                <div style={sectionHeaderStyle} onClick={() => setIsAnimOpen(!isAnimOpen)}>
                    <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#ffd700' }}>Final Badge Settings</h3>
                    <span>{isAnimOpen ? '▼' : '▶'}</span>
                </div>

                {isAnimOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#aaa', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={badgeConfig.showStudentName}
                                onChange={e => setBadgeConfig({ showStudentName: e.target.checked })}
                            />
                            Show Student Name
                        </label>

                        <label style={labelStyle}>
                            Text Size ({badgeConfig.fontSize}rem)
                            <input type="range" min={1} max={6} step={0.1} value={badgeConfig.fontSize} onChange={e => setBadgeConfig({ fontSize: Number(e.target.value) })} />
                        </label>

                        <label style={labelStyle}>
                            Confetti ({badgeConfig.confettiCount})
                            <input type="range" min={0} max={200} step={10} value={badgeConfig.confettiCount} onChange={e => setBadgeConfig({ confettiCount: Number(e.target.value) })} />
                        </label>

                        <label style={labelStyle}>
                            Duration ({(badgeConfig.celebrationDurationMs ?? 5000) / 1000}s)
                            <input type="range" min={1000} max={15000} step={500} value={badgeConfig.celebrationDurationMs ?? 5000} onChange={e => setBadgeConfig({ celebrationDurationMs: Number(e.target.value) })} />
                        </label>

                        <div style={{ borderTop: '1px solid #333', margin: '10px 0' }} />
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>Animation Config</div>

                        <label style={labelStyle}>
                            Anim Duration ({anim.durationMs ?? 1000}ms)
                            <input type="range" min={500} max={3000} step={100} value={anim.durationMs ?? 1000} onChange={e => updateAnim({ durationMs: Number(e.target.value) })} />
                        </label>

                        <label style={labelStyle}>
                            Motion Type
                            <select
                                value={anim.motionType ?? 'zoomPop'}
                                onChange={e => updateAnim({ motionType: e.target.value })}
                                style={inputStyle}
                            >
                                <option value="zoomPop">Zoom Pop</option>
                                <option value="slideUp">Slide Up</option>
                                <option value="fadeIn">Fade In</option>
                                <option value="spinPop">Spin Pop</option>
                            </select>
                        </label>

                        <label style={labelStyle}>
                            Rotation ({anim.rotationDeg ?? 0}°)
                            <input type="range" min={-45} max={45} value={anim.rotationDeg ?? 0} onChange={e => updateAnim({ rotationDeg: Number(e.target.value) })} />
                        </label>

                        <label style={labelStyle}>
                            Glow Intensity ({anim.glowIntensity ?? 100}%)
                            <input type="range" min={0} max={200} value={anim.glowIntensity ?? 100} onChange={e => updateAnim({ glowIntensity: Number(e.target.value) })} />
                        </label>

                        <label style={labelStyle}>
                            Color Intensity ({anim.colorIntensity ?? 100}%)
                            <input type="range" min={0} max={200} value={anim.colorIntensity ?? 100} onChange={e => updateAnim({ colorIntensity: Number(e.target.value) })} />
                        </label>

                        <label style={labelStyle}>
                            Motion Amplitude ({anim.motionIntensity ?? 100}%)
                            <input type="range" min={0} max={200} value={anim.motionIntensity ?? 100} onChange={e => updateAnim({ motionIntensity: Number(e.target.value) })} />
                        </label>

                        <div style={{ borderTop: '1px solid #333', margin: '5px 0' }} />
                        <div style={{ fontSize: '0.7rem', color: '#666', textAlign: 'center' }}>Test Triggers</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px' }}>
                            <button style={{ fontSize: '0.7rem', background: '#442', color: '#fff', border: 'none', borderRadius: 4, padding: 4 }} onClick={() => triggerSpark('gold')}>Gold</button>
                            <button style={{ fontSize: '0.7rem', background: '#244', color: '#fff', border: 'none', borderRadius: 4, padding: 4 }} onClick={() => triggerSpark('blue')}>Blue</button>
                            <button style={{ fontSize: '0.7rem', background: '#424', color: '#fff', border: 'none', borderRadius: 4, padding: 4 }} onClick={() => triggerSpark('pink')}>Pink</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="badge-panel" style={{ color: '#fff', height: '100%', overflowY: 'auto' }}>
            <div style={{ padding: '4px', display: 'flex', gap: '20px', flexDirection: show === 'both' ? 'row' : 'column' }}>
                {(show === 'content' || show === 'both') && renderContent()}
                {(show === 'settings' || show === 'both') && isEditMode && renderSettings()}
            </div>
        </div>
    );
};
