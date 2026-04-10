import React, { useState } from 'react';
import { useSparks } from './SparkProvider';
import { ProjectState } from '../../shared/types';
import { decorateImportedAssetsForContext } from '../../shared/mediaReferences';

interface BadgePanelProps {
    isEditMode: boolean;
    project: ProjectState | null;
    onUpdateProject: (updates: Partial<ProjectState>) => void;
    show?: 'content' | 'settings' | 'both';
}

export const BadgePanel: React.FC<BadgePanelProps> = ({ isEditMode, project, onUpdateProject, show = 'both' }) => {
    const {
        totalSparks,
        activeSparkCounts,
        activeStudent,
        activeStudentId,
        students,
        setActiveStudentId,
        addStudent,
        updateStudent,
        removeStudent,
        showFinalSparkBadge,
        hideFinalSparkBadge,
        resetSparks,
        triggerSpark,
        badgeConfig,
        setBadgeConfig,
        sparkConfig,
        setSparkConfig,
    } = useSparks();

    const [isTabBgOpen, setIsTabBgOpen] = useState(true);
    const [isBgOpen, setIsBgOpen] = useState(false);
    const [isSpritesOpen, setIsSpritesOpen] = useState(true);
    const [isAnimOpen, setIsAnimOpen] = useState(false);

    const bg = badgeConfig.background || {};
    const tabBg = badgeConfig.tabBackground || {};
    const anim = badgeConfig.animation || {};

    const updateBg = (updates: Record<string, unknown>) => {
        setBadgeConfig({
            background: { ...bg, ...updates }
        });
    };

    const updateTabBg = (updates: Record<string, unknown>) => {
        setBadgeConfig({
            tabBackground: { ...tabBg, ...updates }
        });
    };

    const updateAnim = (updates: Record<string, unknown>) => {
        setBadgeConfig({
            animation: { ...anim, ...updates }
        });
    };

    const checkedStudents = students.filter((student) => student.badgeVisible !== false);
    const spriteMotion = badgeConfig.badgeSpriteMotion ?? 'spin';
    const spriteDurationMs = badgeConfig.badgeSpriteAnimDurationMs ?? 3200;
    const spriteIntensity = badgeConfig.badgeSpriteAnimIntensity ?? 100;

    const ensureBadgeSpritesForCheckedStudents = () => {
        const existingSprites = badgeConfig.badgeSprites || [];
        const nextSprites = [...existingSprites];

        const variants: Array<'gold' | 'blue' | 'pink'> = ['gold', 'blue', 'pink'];

        checkedStudents.forEach((student, index) => {
            const baseX = 70 + (index * 420);
            const baseY = 100 + ((index % 2) * 40);

            variants.forEach((variant, variantIndex) => {
                const existingIndex = nextSprites.findIndex(
                    (sprite) => sprite.studentId === student.id && (sprite.variant || 'gold') === variant,
                );
                if (existingIndex >= 0) {
                    nextSprites[existingIndex] = {
                        ...nextSprites[existingIndex],
                        variant,
                    };
                    return;
                }

                nextSprites.push({
                    id: crypto.randomUUID(),
                    studentId: student.id,
                    x: baseX + (variantIndex * 130),
                    y: baseY + (variantIndex === 1 ? -28 : 18),
                    width: 140,
                    height: 170,
                    zIndex: 20 + (index * 3) + variantIndex,
                    variant,
                });
            });
        });

        return nextSprites;
    };

    const importSparkPngForVariant = async (variant: 'gold' | 'blue' | 'pink') => {
        if (!project) return;
        const res = await (window as any).appApi.importMedia();
        if (!res || res.importedAssets.length === 0) return;

        const normalizedImportedAssets = decorateImportedAssetsForContext(
            project.data,
            res.importedAssets,
        );
        const importedImage = normalizedImportedAssets.find((asset) => asset.mediaType === 'image');
        if (!importedImage) return;

        const nextSprites = ensureBadgeSpritesForCheckedStudents();
        const nextBadgeConfig = {
            ...badgeConfig,
            badgeSprites: nextSprites,
            badgeSparkAssetIds: {
                ...(badgeConfig.badgeSparkAssetIds || {}),
                [variant]: importedImage.id,
            }
        };

        setBadgeConfig({
            badgeSprites: nextSprites,
            badgeSparkAssetIds: {
                ...(badgeConfig.badgeSparkAssetIds || {}),
                [variant]: importedImage.id,
            }
        });

        onUpdateProject({
            data: {
                ...project.data,
                badgeConfig: nextBadgeConfig,
                assets: [...project.data.assets, ...normalizedImportedAssets],
            }
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
        onUpdate: (upd: Record<string, unknown>) => void,
        configKey: 'background' | 'tabBackground'
    ) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
                onClick={async () => {
                    if (!project) return;
                    const res = await (window as any).appApi.importMedia();
                    if (res && res.importedAssets.length > 0) {
                        const normalizedImportedAssets = decorateImportedAssetsForContext(
                            project.data,
                            res.importedAssets,
                        );
                        const newAssetId = res.importedAssets[0].id;
                        const nextBadgeConfig = {
                            ...badgeConfig,
                            [configKey]: {
                                ...(badgeConfig[configKey] || {}),
                                assetId: newAssetId
                            }
                        };

                        onUpdate({ assetId: newAssetId });
                        onUpdateProject({
                            data: {
                                ...project.data,
                                badgeConfig: nextBadgeConfig,
                                assets: [...project.data.assets, ...normalizedImportedAssets]
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
                        if (!project) return;
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
                                ...project.data,
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
            <section style={{ border: '1px solid #334', borderRadius: 8, padding: 10, background: '#181824' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: '#ffd700' }}>Students</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                            onClick={() => addStudent()}
                            title="Add student"
                            aria-label="Add student"
                            style={{ width: 28, height: 28, background: '#2b4b2b', border: '1px solid #3f6f3f', color: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: '1rem', fontWeight: 700, lineHeight: 1 }}
                        >
                            +
                        </button>
                        <button
                            onClick={() => activeStudentId && removeStudent(activeStudentId)}
                            title="Remove selected student"
                            aria-label="Remove selected student"
                            disabled={!isEditMode || students.length <= 1 || !activeStudentId}
                            style={{
                                width: 28,
                                height: 28,
                                background: !isEditMode || students.length <= 1 || !activeStudentId ? '#3a2424' : '#5b2323',
                                border: '1px solid #7a3333',
                                color: !isEditMode || students.length <= 1 || !activeStudentId ? '#c08f8f' : '#fff',
                                borderRadius: 4,
                                cursor: !isEditMode || students.length <= 1 || !activeStudentId ? 'not-allowed' : 'pointer',
                                fontSize: '1rem',
                                fontWeight: 700,
                                lineHeight: 1,
                            }}
                        >
                            -
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {students.map((student, index) => {
                        const isActive = student.id === activeStudentId;
                        return (
                            <div
                                key={student.id}
                                onClick={() => setActiveStudentId(student.id)}
                                style={{
                                    border: isActive ? '2px solid #ffd700' : '1px solid #3a3a4d',
                                    background: isActive ? '#303044' : '#232334',
                                    borderRadius: 8,
                                    padding: 8,
                                    cursor: 'pointer',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                    <input
                                        type="text"
                                        value={student.name}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => updateStudent(student.id, { name: e.target.value })}
                                        placeholder={`Student ${index + 1}`}
                                        style={{ ...inputStyle, flex: 1, padding: '4px 6px', fontSize: '0.85rem' }}
                                    />
                                    <label
                                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', color: '#9fb5ff' }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={student.badgeVisible !== false}
                                            onChange={(e) => updateStudent(student.id, { badgeVisible: e.target.checked })}
                                        />
                                        Badge
                                    </label>
                                </div>

                                <div style={{ display: 'flex', gap: 6, fontSize: '0.72rem', color: '#cfd5ff', flexWrap: 'wrap' }}>
                                    <span>Y: {student.yellowSparks || 0}</span>
                                    <span>B: {student.blueSparks || 0}</span>
                                    <span>P: {student.pinkSparks || 0}</span>
                                    <span>Stars: {student.stars || 0}</span>
                                    {isActive && <span style={{ color: '#ffd700', marginLeft: 'auto' }}>ACTIVE</span>}
                                </div>
                            </div>
                        );
                    })}
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
                    Show Final Badge
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
                    Show Scores After Final Reveal
                </label>
            </section>

            <section style={{ background: '#1a1a24', padding: '12px', borderRadius: '8px', border: '1px solid #334', marginTop: 10 }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>Current Active Student</div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold', margin: '4px 0 0 0', color: '#ffd700' }}>{activeStudent?.name || 'Student'}</div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
                        <span style={{ fontSize: '0.72rem', color: '#f5d86e' }}>Y {activeSparkCounts.yellow}</span>
                        <span style={{ fontSize: '0.72rem', color: '#7ac7ff' }}>B {activeSparkCounts.blue}</span>
                        <span style={{ fontSize: '0.72rem', color: '#ffa1c7' }}>P {activeSparkCounts.pink}</span>
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '2px 0' }}>{totalSparks}</div>
                    <div style={{ fontSize: '0.7rem', color: '#ffd700' }}>TOTAL SPARKS</div>
                </div>
            </section>

            {isEditMode && (
                <button
                    onClick={resetSparks}
                    style={{ padding: '6px', background: '#442222', color: '#ffaaaa', border: '1px solid #663333', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                    Reset Active Student Sparks
                </button>
            )}
        </div>
    );

    const renderSettings = () => (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="collapsible-group">
                <div style={sectionHeaderStyle} onClick={() => setIsTabBgOpen(!isTabBgOpen)}>
                    <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#66f' }}>Background</h3>
                    <span>{isTabBgOpen ? '-' : '+'}</span>
                </div>
                {isTabBgOpen && renderBackgroundControls(tabBg, updateTabBg, 'tabBackground')}
            </div>

            <div className="collapsible-group">
                <div style={sectionHeaderStyle} onClick={() => setIsBgOpen(!isBgOpen)}>
                    <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#ffd700' }}>Final Badge BG</h3>
                    <span>{isBgOpen ? '-' : '+'}</span>
                </div>
                {isBgOpen && renderBackgroundControls(bg, updateBg, 'background')}
            </div>

            <div className="collapsible-group">
                <div style={sectionHeaderStyle} onClick={() => setIsSpritesOpen(!isSpritesOpen)}>
                    <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#6fa' }}>Student Badge PNG</h3>
                    <span>{isSpritesOpen ? '-' : '+'}</span>
                </div>

                {isSpritesOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <button
                            onClick={() => {
                                const nextSprites = ensureBadgeSpritesForCheckedStudents();
                                setBadgeConfig({ badgeSprites: nextSprites });
                            }}
                            style={{ padding: '8px', background: '#2f4d7a', border: '1px solid #42679e', color: '#fff', borderRadius: 4, cursor: 'pointer' }}
                        >
                            Place/Refresh Checked Student Stars
                        </button>

                        <div style={{ fontSize: '0.75rem', color: '#8ea3d1', lineHeight: 1.4 }}>
                            Checked students: {checkedStudents.length} / {students.length}. Each checked student gets 3 stars (Yellow, Blue, Pink). Import one PNG per spark color below.
                        </div>

                        <button
                            onClick={() => importSparkPngForVariant('gold')}
                            style={{ padding: '8px', background: '#5c4a1d', border: '1px solid #b08b3a', color: '#fff', borderRadius: 4, cursor: 'pointer' }}
                        >
                            Import Yellow Star PNG {badgeConfig.badgeSparkAssetIds?.gold ? '✓' : ''}
                        </button>

                        <button
                            onClick={() => importSparkPngForVariant('blue')}
                            style={{ padding: '8px', background: '#1f3f63', border: '1px solid #2f79c6', color: '#fff', borderRadius: 4, cursor: 'pointer' }}
                        >
                            Import Blue Star PNG {badgeConfig.badgeSparkAssetIds?.blue ? '✓' : ''}
                        </button>

                        <button
                            onClick={() => importSparkPngForVariant('pink')}
                            style={{ padding: '8px', background: '#603051', border: '1px solid #c060a0', color: '#fff', borderRadius: 4, cursor: 'pointer' }}
                        >
                            Import Pink Star PNG {badgeConfig.badgeSparkAssetIds?.pink ? '✓' : ''}
                        </button>

                        <label style={labelStyle}>
                            Motion
                            <select
                                value={spriteMotion}
                                onChange={e => setBadgeConfig({ badgeSpriteMotion: e.target.value as 'spin' | 'breathe' | 'zoom' })}
                                style={inputStyle}
                            >
                                <option value="spin">Spin</option>
                                <option value="breathe">Breathe</option>
                                <option value="zoom">Zoom</option>
                            </select>
                        </label>

                        <label style={labelStyle}>
                            Motion Duration ({spriteDurationMs}ms)
                            <input
                                type="range"
                                min={600}
                                max={10000}
                                step={100}
                                value={spriteDurationMs}
                                onChange={e => setBadgeConfig({ badgeSpriteAnimDurationMs: Number(e.target.value) })}
                            />
                        </label>

                        <label style={labelStyle}>
                            Motion Intensity ({spriteIntensity}%)
                            <input
                                type="range"
                                min={20}
                                max={250}
                                step={5}
                                value={spriteIntensity}
                                onChange={e => setBadgeConfig({ badgeSpriteAnimIntensity: Number(e.target.value) })}
                            />
                        </label>
                    </div>
                )}
            </div>

            <div className="collapsible-group">
                <div style={sectionHeaderStyle} onClick={() => setIsAnimOpen(!isAnimOpen)}>
                    <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#ffd700' }}>Final Badge Settings</h3>
                    <span>{isAnimOpen ? '-' : '+'}</span>
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
                            <input
                                type="range"
                                min={1000}
                                max={60000}
                                step={500}
                                value={badgeConfig.celebrationDurationMs ?? 5000}
                                disabled={badgeConfig.alwaysDisplay === true}
                                onChange={e => setBadgeConfig({ celebrationDurationMs: Number(e.target.value) })}
                            />
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#aaa', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={badgeConfig.alwaysDisplay === true}
                                onChange={e => setBadgeConfig({ alwaysDisplay: e.target.checked })}
                            />
                            Always display (manual hide only)
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
                            Rotation ({anim.rotationDeg ?? 0}deg)
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
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>Spark Shapes (saved for future renderer support)</div>

                        <label style={labelStyle}>
                            Yellow Shape
                            <select
                                value={sparkConfig.shapeByVariant?.gold ?? 'star'}
                                onChange={(e) => setSparkConfig({
                                    shapeByVariant: {
                                        ...(sparkConfig.shapeByVariant || {}),
                                        gold: e.target.value as 'star' | 'diamond' | 'circle' | 'heart',
                                    }
                                })}
                                style={inputStyle}
                            >
                                <option value="star">Star (current)</option>
                                <option value="diamond">Diamond (coming soon)</option>
                                <option value="circle">Circle (coming soon)</option>
                                <option value="heart">Heart (coming soon)</option>
                            </select>
                        </label>

                        <label style={labelStyle}>
                            Blue Shape
                            <select
                                value={sparkConfig.shapeByVariant?.blue ?? 'star'}
                                onChange={(e) => setSparkConfig({
                                    shapeByVariant: {
                                        ...(sparkConfig.shapeByVariant || {}),
                                        blue: e.target.value as 'star' | 'diamond' | 'circle' | 'heart',
                                    }
                                })}
                                style={inputStyle}
                            >
                                <option value="star">Star (current)</option>
                                <option value="diamond">Diamond (coming soon)</option>
                                <option value="circle">Circle (coming soon)</option>
                                <option value="heart">Heart (coming soon)</option>
                            </select>
                        </label>

                        <label style={labelStyle}>
                            Pink Shape
                            <select
                                value={sparkConfig.shapeByVariant?.pink ?? 'star'}
                                onChange={(e) => setSparkConfig({
                                    shapeByVariant: {
                                        ...(sparkConfig.shapeByVariant || {}),
                                        pink: e.target.value as 'star' | 'diamond' | 'circle' | 'heart',
                                    }
                                })}
                                style={inputStyle}
                            >
                                <option value="star">Star (current)</option>
                                <option value="diamond">Diamond (coming soon)</option>
                                <option value="circle">Circle (coming soon)</option>
                                <option value="heart">Heart (coming soon)</option>
                            </select>
                        </label>

                        <div style={{ borderTop: '1px solid #333', margin: '5px 0' }} />
                        <div style={{ fontSize: '0.7rem', color: '#666', textAlign: 'center' }}>Test Triggers</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px' }}>
                            <button style={{ fontSize: '0.7rem', background: '#442', color: '#fff', border: 'none', borderRadius: 4, padding: 4 }} onClick={() => triggerSpark('gold')}>Yellow</button>
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
                {(show === 'settings' || show === 'both') && renderSettings()}
            </div>
        </div>
    );
};
