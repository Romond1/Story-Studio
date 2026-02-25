import React, { useState } from "react";
import { Slide, LanguageBoardTemplate, LayoutItem, ContentItem } from "../../shared/types";
import "./languageStyles.css";

interface LanguageToolsPanelProps {
    slide: Slide | null;
    template: LanguageBoardTemplate | null;
    onUpdateSlide: (updates: Partial<Slide>) => void;
    onUpdateTemplate: (updates: Partial<LanguageBoardTemplate>) => void;
    selectedItemId: string | null;
    onSelectItemId: (id: string | null) => void;
    appMode: "edit" | "teach" | "story";
    viewMode: "slide" | "split" | "board";
    onSetViewMode: (mode: "slide" | "split" | "board") => void;
    isTemplateMode: boolean;
    onToggleTemplateMode: () => void;
}

const FONT_FAMILIES = [
    "Arial", "Arial Black", "Calibri", "Cambria", "Comic Sans MS", "Consolas",
    "Courier New", "Georgia", "Impact", "Lucida Console", "Lucida Sans Unicode",
    "Microsoft Sans Serif", "Palatino Linotype", "Segoe UI", "Tahoma",
    "Times New Roman", "Trebuchet MS", "Verdana"
];

export function LanguageToolsPanel({
    slide,
    template,
    onUpdateSlide,
    onUpdateTemplate,
    selectedItemId,
    onSelectItemId,
    appMode,
    viewMode,
    onSetViewMode,
    isTemplateMode,
    onToggleTemplateMode,
}: LanguageToolsPanelProps) {
    const [bgCollapsed, setBgCollapsed] = useState(true);

    if (!slide || !template) {
        return (
            <div className="language-tools">
                <div style={{ color: "#888", textAlign: "center", marginTop: 24 }}>Select a slide to edit language board</div>
            </div>
        );
    }

    const layoutItems = template.layoutItems || [];
    const contentItems = slide.languageContent?.items || [];

    const updateTemplateBg = (updates: any) => {
        onUpdateTemplate({ background: { ...template.background, ...updates } });
    };

    const updateLayoutItem = (id: string, updates: Partial<LayoutItem>) => {
        const newItems = layoutItems.map(i => i.id === id ? { ...i, ...updates } as LayoutItem : i);
        onUpdateTemplate({ layoutItems: newItems });
    };

    const updateLayoutStyle = (id: string, styleUpdates: any) => {
        const newItems = layoutItems.map(i => {
            if (i.id === id) {
                return { ...i, styleDefaults: { ...i.styleDefaults, ...styleUpdates } };
            }
            return i;
        });
        onUpdateTemplate({ layoutItems: newItems });
    }

    const updateContentItem = (layoutId: string, updates: Partial<ContentItem>) => {
        const existing = contentItems.find(c => c.layoutId === layoutId);
        let newItems;
        if (existing) {
            newItems = contentItems.map(c => c.layoutId === layoutId ? { ...c, ...updates } : c);
        } else {
            newItems = [...contentItems, { layoutId, ...updates }];
        }
        onUpdateSlide({ languageContent: { items: newItems } });
    };

    const handleDelete = () => {
        if (!selectedItemId) return;

        if (isTemplateMode) {
            // Delete entire layout slot
            onUpdateTemplate({
                layoutItems: layoutItems.filter(i => i.id !== selectedItemId)
            });

            onUpdateSlide({
                languageContent: {
                    items: contentItems.filter(c => c.layoutId !== selectedItemId)
                }
            });
        } else {
            // Delete content only
            onUpdateSlide({
                languageContent: {
                    items: contentItems.filter(c => c.layoutId !== selectedItemId)
                }
            });
        }

        onSelectItemId(null);
    };

    if (appMode === "teach") {
        return (
            <div className="language-tools">
                <h4 style={{ margin: "0", color: "#66f", fontSize: "1rem" }}>Teacher Controls</h4>
                <div className="lang-tool-group">
                    <button className="lang-btn" style={{ marginBottom: 8 }} onClick={() => onSetViewMode(viewMode === "split" ? "slide" : "split")}>
                        {viewMode !== "slide" ? "Hide Board" : "Show Board"}
                    </button>
                    <button className="lang-btn" style={{ marginBottom: 8 }} onClick={() => onSetViewMode(viewMode === "board" ? "split" : "board")}>
                        {viewMode === "board" ? "Board Fullscreen: ON" : "Board Fullscreen: OFF"}
                    </button>
                    <button className="lang-btn" onClick={() => {
                        let updatedContent = [...contentItems];
                        layoutItems.forEach(l => {
                            if (l.type === "flashcardSlot") {
                                const ex = updatedContent.find(c => c.layoutId === l.id);
                                if (ex) {
                                    ex.flippedInTeach = !ex.flippedInTeach;
                                } else {
                                    updatedContent.push({ layoutId: l.id, flippedInTeach: true });
                                }
                            }
                        });
                        onUpdateSlide({ languageContent: { items: updatedContent } });
                    }}>Flip All Flashcards</button>
                </div>
            </div>
        );
    }

    const handleCreate = (type: "textSlot" | "coverSlot" | "flashcardSlot" | "shapeSlot") => {
        const seq = template.nextItemSeq || 1;
        const id = `T${seq.toString().padStart(3, "0")}`;

        let newLayout: LayoutItem = { id, type, x: 100, y: 100, width: 200, height: 100, styleDefaults: {} };
        if (type === "textSlot") {
            newLayout.styleDefaults = { fontSize: 32, color: "#000000", align: "center" };
        } else if (type === "flashcardSlot") {
            newLayout.width = 240;
            newLayout.height = 160;
            newLayout.styleDefaults = { align: "center" };
        } else if (type === "shapeSlot") {
            newLayout.width = 100;
            newLayout.height = 100;
            newLayout.styleDefaults = {
                shapeType: "rectangle",
                fillColor: "#55aaff",
                borderColor: "#000000",
                borderWidth: 2,
                padding: 0,
                opacity: 1
            };
        }

        onUpdateTemplate({ layoutItems: [...layoutItems, newLayout], nextItemSeq: seq + 1 });
        onSelectItemId(id);
    };

    const handleDuplicate = () => {
        const item = layoutItems.find(i => i.id === selectedItemId);
        if (!item) return;
        const seq = template.nextItemSeq || 1;
        const id = `T${seq.toString().padStart(3, "0")}`;
        const newLayout = { ...item, id, x: item.x + 20, y: item.y + 20 };
        onUpdateTemplate({ layoutItems: [...layoutItems, newLayout], nextItemSeq: seq + 1 });

        // Copy content as well
        const content = contentItems.find(c => c.layoutId === selectedItemId);
        if (content) {
            onUpdateSlide({ languageContent: { items: [...contentItems, { ...content, layoutId: id }] } });
        }

        onSelectItemId(id);
    };



    const selectedLayout = layoutItems.find(i => i.id === selectedItemId);
    const selectedContent = contentItems.find(c => c.layoutId === selectedItemId) || { layoutId: selectedItemId || "" };

    return (
        <div className="language-tools">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <h4 style={{ margin: "0", color: "#66f", fontSize: "1rem" }}>Board Tools</h4>
                <div style={{ display: "flex", gap: 4 }}>
                    <button
                        className="lang-btn"
                        style={{ fontSize: "0.7rem", padding: "2px 8px", background: isTemplateMode ? "#aa5555" : "#334" }}
                        onClick={onToggleTemplateMode}
                    >
                        {isTemplateMode ? "Template Mode ON" : "Template Mode OFF"}
                    </button>
                    <button
                        className="lang-btn"
                        style={{ fontSize: "0.7rem", padding: "2px 8px" }}
                        onClick={() => onSetViewMode(viewMode === "board" ? "split" : "board")}
                    >
                        {viewMode === "board" ? "Full ON" : "Full OFF"}
                    </button>
                </div>
            </div>

            {isTemplateMode && (
                <>
                    <div className="lang-tool-group">
                        <h5>Add Layout Items</h5>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            <button className="lang-btn" style={{ flex: "1 1 30%" }} onClick={() => handleCreate("flashcardSlot")}>Card</button>
                            <button className="lang-btn" style={{ flex: "1 1 30%" }} onClick={() => handleCreate("shapeSlot")}>Shape</button>
                            <button className="lang-btn" style={{ flex: "1 1 30%" }} onClick={() => handleCreate("textSlot")}>Text</button>
                        </div>
                    </div>

                    <div className="lang-tool-group">
                        <h5 onClick={() => setBgCollapsed(!bgCollapsed)} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between" }}>
                            Background <span>{bgCollapsed ? "+" : "?"}</span>
                        </h5>
                        {!bgCollapsed && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                                <label className="lang-label">
                                    Color
                                    <input type="color" value={template.background.color || "#eeeeee"} onChange={e => updateTemplateBg({ color: e.target.value })} />
                                </label>
                                <label className="lang-label">
                                    Image URL/Path
                                    <div style={{ display: "flex", gap: 4 }}>
                                        <input type="text" className="lang-input" value={template.background.imageSrc || ""} onChange={e => updateTemplateBg({ imageSrc: e.target.value })} placeholder="path/to/image.png" style={{ flex: 1 }} />
                                        <button
                                            className="lang-btn"
                                            onClick={async () => {
                                                const res = await (window as any).api.importLanguageBoardBackground();
                                                if (res && res.success && res.relativePath) {
                                                    updateTemplateBg({ imageSrc: res.relativePath });
                                                }
                                            }}
                                            title="Upload Background Image"
                                        >
                                            ??
                                        </button>
                                    </div>
                                </label>
                                <label className="lang-label">
                                    Scale ({template.background.scale || 1})
                                    <input type="range" min="0.5" max="3" step="0.1" value={template.background.scale || 1} onChange={e => updateTemplateBg({ scale: parseFloat(e.target.value) })} />
                                </label>
                                <label className="lang-label">
                                    Blur ({template.background.blur || 0}px)
                                    <input type="range" min="0" max="40" step="1" value={template.background.blur || 0} onChange={e => updateTemplateBg({ blur: parseInt(e.target.value) })} />
                                </label>
                                <label className="lang-label">
                                    Pos X
                                    <input type="range" min="0" max="1" step="0.05" value={template.background.posX || 0} onChange={e => updateTemplateBg({ posX: parseFloat(e.target.value) })} />
                                </label>
                                <label className="lang-label">
                                    Pos Y
                                    <input type="range" min="0" max="1" step="0.05" value={template.background.posY || 0} onChange={e => updateTemplateBg({ posY: parseFloat(e.target.value) })} />
                                </label>
                            </div>
                        )}
                    </div>
                </>
            )}

            {selectedLayout ? (
                <div className="lang-tool-group">
                    <h5>Selected: {selectedLayout.type}</h5>

                    {isTemplateMode && (
                        <div className="lang-row" style={{ marginTop: 8 }}>
                            <button className="lang-btn" onClick={handleDuplicate}>Duplicate</button>
                            <button className="lang-btn" style={{ color: "#faa", borderColor: "#faa" }} onClick={handleDelete}>Delete</button>
                        </div>
                    )}
                    {!isTemplateMode && (
                        <div className="lang-row" style={{ marginTop: 8 }}>
                            <button className="lang-btn" style={{ color: "#faa", borderColor: "#faa" }} onClick={handleDelete}>Clear Content</button>
                        </div>
                    )}

                    <label className="lang-label" style={{ marginTop: 8, flexDirection: "row", alignItems: "center" }}>
                        <input type="checkbox" checked={selectedContent.visibleInTeach !== false} onChange={e => updateContentItem(selectedLayout.id, { visibleInTeach: e.target.checked })} />
                        Visible In Teach
                    </label>

                    {selectedLayout.type === "textSlot" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                            {isTemplateMode && (
                                <>
                                    <label className="lang-label">
                                        Color (Template)
                                        <input type="color" value={selectedLayout.styleDefaults?.color || "#000000"} onChange={e => updateLayoutStyle(selectedLayout.id, { color: e.target.value })} />
                                    </label>
                                    <label className="lang-label">
                                        Font Size (Template) ({selectedLayout.styleDefaults?.fontSize || 24}px)
                                        <input type="range" min="8" max="144" step="1" value={selectedLayout.styleDefaults?.fontSize || 24} onChange={e => updateLayoutStyle(selectedLayout.id, { fontSize: parseInt(e.target.value) })} />
                                    </label>
                                    <label className="lang-label">
                                        Weight (Template) ({selectedLayout.styleDefaults?.fontWeight || 400})
                                        <input type="range" min="400" max="900" step="100" value={selectedLayout.styleDefaults?.fontWeight || 400} onChange={e => updateLayoutStyle(selectedLayout.id, { fontWeight: parseInt(e.target.value) })} />
                                    </label>
                                    <label className="lang-label" style={{ flexDirection: "row", alignItems: "center" }}>
                                        <input type="checkbox" checked={selectedLayout.styleDefaults?.italic || false} onChange={e => updateLayoutStyle(selectedLayout.id, { italic: e.target.checked })} />
                                        Italic (Template)
                                    </label>
                                    <label className="lang-label">
                                        Align (Template)
                                        <select className="lang-input" value={selectedLayout.styleDefaults?.align || "left"} onChange={e => updateLayoutStyle(selectedLayout.id, { align: e.target.value as any })}>
                                            <option value="left">Left</option>
                                            <option value="center">Center</option>
                                            <option value="right">Right</option>
                                        </select>
                                    </label>
                                    <label className="lang-label">
                                        Vertical Align (Template)
                                        <select className="lang-input" value={selectedLayout.styleDefaults?.verticalAlign || "center"} onChange={e => updateLayoutStyle(selectedLayout.id, { verticalAlign: e.target.value as any })}>
                                            <option value="top">Top</option>
                                            <option value="center">Center</option>
                                            <option value="bottom">Bottom</option>
                                        </select>
                                    </label>
                                    <label className="lang-label">
                                        Font Family (Template)
                                        <select
                                            className="lang-input"
                                            value={selectedLayout.styleDefaults?.fontFamily || "inherit"}
                                            onChange={e => updateLayoutStyle(selectedLayout.id, { fontFamily: e.target.value })}
                                            style={{ fontFamily: selectedLayout.styleDefaults?.fontFamily || "inherit" }}
                                        >
                                            <option value="inherit">Default</option>
                                            {FONT_FAMILIES.map(f => (
                                                <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                                            ))}
                                        </select>
                                    </label>
                                </>
                            )}
                        </div>
                    )}



                    {selectedLayout.type === "flashcardSlot" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                            <button
                                className="lang-btn"
                                onClick={() => updateContentItem(selectedLayout.id, { flippedInTeach: !selectedContent.flippedInTeach })}
                                style={{ marginBottom: 4 }}
                            >
                                Showing: {selectedContent.flippedInTeach ? "BACK" : "FRONT"}
                            </button>
                            <label className="lang-label">
                                Front Text
                                <textarea
                                    className="lang-input lang-textarea"
                                    value={isTemplateMode ? (selectedLayout.frontText || "") : (selectedContent.frontText ?? selectedLayout.frontText ?? "")}
                                    onChange={e => isTemplateMode
                                        ? onUpdateTemplate({ layoutItems: layoutItems.map(i => i.id === selectedLayout.id ? { ...i, frontText: e.target.value } : i) })
                                        : updateContentItem(selectedLayout.id, { frontText: e.target.value })
                                    }
                                />
                            </label>
                            <label className="lang-label">
                                Back Text
                                <textarea
                                    className="lang-input lang-textarea"
                                    value={isTemplateMode ? (selectedLayout.backText || "") : (selectedContent.backText ?? selectedLayout.backText ?? "")}
                                    onChange={e => isTemplateMode
                                        ? onUpdateTemplate({ layoutItems: layoutItems.map(i => i.id === selectedLayout.id ? { ...i, backText: e.target.value } : i) })
                                        : updateContentItem(selectedLayout.id, { backText: e.target.value })
                                    }
                                />
                            </label>
                            <div style={{ fontSize: "0.8rem", color: "#88f", marginBottom: 4 }}></div>
                            {isTemplateMode && (
                                <>
                                    <div style={{ color: "#aaa", fontSize: "0.7rem", marginBottom: 4, textAlign: "center", borderTop: "1px solid #333", paddingTop: 8 }}>
                                        Properties below apply to {selectedContent.flippedInTeach ? "BACK" : "FRONT"}
                                    </div>
                                    <label className="lang-label">
                                        Font Size ({(selectedContent.flippedInTeach ? (selectedLayout.styleDefaults?.backFontSize || selectedLayout.styleDefaults?.fontSize) : (selectedLayout.styleDefaults?.frontFontSize || selectedLayout.styleDefaults?.fontSize)) || 20}px)
                                        <input
                                            type="range" min="8" max="144" step="1"
                                            value={(selectedContent.flippedInTeach ? (selectedLayout.styleDefaults?.backFontSize || selectedLayout.styleDefaults?.fontSize) : (selectedLayout.styleDefaults?.frontFontSize || selectedLayout.styleDefaults?.fontSize)) || 20}
                                            onChange={e => updateLayoutStyle(selectedLayout.id, selectedContent.flippedInTeach ? { backFontSize: parseInt(e.target.value) } : { frontFontSize: parseInt(e.target.value) })}
                                        />
                                    </label>
                                    <label className="lang-label">
                                        Weight ({(selectedContent.flippedInTeach ? (selectedLayout.styleDefaults?.backFontWeight || selectedLayout.styleDefaults?.fontWeight) : (selectedLayout.styleDefaults?.frontFontWeight || selectedLayout.styleDefaults?.fontWeight)) || 400})
                                        <input
                                            type="range" min="100" max="900" step="100"
                                            value={(selectedContent.flippedInTeach ? (selectedLayout.styleDefaults?.backFontWeight || selectedLayout.styleDefaults?.fontWeight) : (selectedLayout.styleDefaults?.frontFontWeight || selectedLayout.styleDefaults?.fontWeight)) || 400}
                                            onChange={e => updateLayoutStyle(selectedLayout.id, selectedContent.flippedInTeach ? { backFontWeight: parseInt(e.target.value) } : { frontFontWeight: parseInt(e.target.value) })}
                                        />
                                    </label>
                                    <label className="lang-label">
                                        Font Family
                                        <select
                                            className="lang-input"
                                            value={selectedLayout.styleDefaults?.fontFamily || "inherit"}
                                            onChange={e => updateLayoutStyle(selectedLayout.id, { fontFamily: e.target.value })}
                                            style={{ fontFamily: selectedLayout.styleDefaults?.fontFamily || "inherit" }}
                                        >
                                            <option value="inherit">Default</option>
                                            {FONT_FAMILIES.map(f => (
                                                <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="lang-label">
                                        Vertical Align
                                        <select
                                            className="lang-input"
                                            value={(selectedContent.flippedInTeach ? (selectedLayout.styleDefaults?.backVerticalAlign || selectedLayout.styleDefaults?.verticalAlign) : (selectedLayout.styleDefaults?.frontVerticalAlign || selectedLayout.styleDefaults?.verticalAlign)) || "center"}
                                            onChange={e => updateLayoutStyle(selectedLayout.id, selectedContent.flippedInTeach ? { backVerticalAlign: e.target.value as any } : { frontVerticalAlign: e.target.value as any })}
                                        >
                                            <option value="top">Top</option>
                                            <option value="center">Center</option>
                                            <option value="bottom">Bottom</option>
                                        </select>
                                    </label>
                                    <label className="lang-label">
                                        Horizontal Align
                                        <select
                                            className="lang-input"
                                            value={(selectedContent.flippedInTeach ? (selectedLayout.styleDefaults?.backAlign || selectedLayout.styleDefaults?.align) : (selectedLayout.styleDefaults?.frontAlign || selectedLayout.styleDefaults?.align)) || "center"}
                                            onChange={e => updateLayoutStyle(selectedLayout.id, selectedContent.flippedInTeach ? { backAlign: e.target.value as any } : { frontAlign: e.target.value as any })}
                                        >
                                            <option value="left">Left</option>
                                            <option value="center">Center</option>
                                            <option value="right">Right</option>
                                        </select>
                                    </label>
                                    <label className="lang-label">
                                        Flip Animation
                                        <select className="lang-input" value={selectedLayout.styleDefaults?.flipAnimation || "flip"} onChange={e => updateLayoutStyle(selectedLayout.id, { flipAnimation: e.target.value as any })}>
                                            <option value="none">None (Instant)</option>
                                            <option value="flip">3D Flip</option>
                                            <option value="fade">Fade</option>
                                        </select>
                                    </label>
                                    <label className="lang-label">
                                        Flip Speed ({selectedLayout.styleDefaults?.flipSpeed || 0.6}s)
                                        <input type="range" min="0.1" max="2" step="0.1" value={selectedLayout.styleDefaults?.flipSpeed || 0.6} onChange={e => updateLayoutStyle(selectedLayout.id, { flipSpeed: parseFloat(e.target.value) })} />
                                    </label>
                                    <label className="lang-label">
                                        Rounded Corners ({selectedLayout.styleDefaults?.borderRadius || 8}px)
                                        <input type="range" min="0" max="100" step="1" value={selectedLayout.styleDefaults?.borderRadius || 8} onChange={e => updateLayoutStyle(selectedLayout.id, { borderRadius: parseInt(e.target.value) })} />
                                    </label>
                                    <hr style={{ width: "100%", border: "0.5px solid #444", margin: "4px 0" }} />
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                        <label className="lang-label">
                                            Front Color
                                            <input type="color" value={selectedLayout.styleDefaults?.frontColor || "#ffffff"} onChange={e => updateLayoutStyle(selectedLayout.id, { frontColor: e.target.value })} />
                                        </label>
                                        <label className="lang-label">
                                            Back Color
                                            <input type="color" value={selectedLayout.styleDefaults?.backColor || "#ffffff"} onChange={e => updateLayoutStyle(selectedLayout.id, { backColor: e.target.value })} />
                                        </label>
                                        <label className="lang-label">
                                            Front Text
                                            <input type="color" value={selectedLayout.styleDefaults?.frontTextColor || "#000000"} onChange={e => updateLayoutStyle(selectedLayout.id, { frontTextColor: e.target.value })} />
                                        </label>
                                        <label className="lang-label">
                                            Back Text
                                            <input type="color" value={selectedLayout.styleDefaults?.backTextColor || "#000000"} onChange={e => updateLayoutStyle(selectedLayout.id, { backTextColor: e.target.value })} />
                                        </label>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {selectedLayout.type === "shapeSlot" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                            {isTemplateMode && (
                                <>
                                    <label className="lang-label">
                                        Shape Type
                                        <select className="lang-input" value={selectedLayout.styleDefaults?.shapeType || "rectangle"} onChange={e => updateLayoutStyle(selectedLayout.id, { shapeType: e.target.value })}>
                                            <option value="rectangle">Rectangle</option>
                                            <option value="square">Square</option>
                                            <option value="circle">Circle</option>
                                            <option value="oval">Oval</option>
                                            <option value="star">Star</option>
                                            <option value="diamond">Diamond</option>
                                            <option value="heart">Heart</option>
                                        </select>
                                    </label>
                                    <label className="lang-label" style={{ flexDirection: "row", alignItems: "center" }}>
                                        <input type="checkbox" checked={selectedLayout.styleDefaults?.noFill || false} onChange={e => updateLayoutStyle(selectedLayout.id, { noFill: e.target.checked })} />
                                        No Fill (Transparent)
                                    </label>
                                    <label className="lang-label">
                                        Fill Color
                                        <input type="color" disabled={selectedLayout.styleDefaults?.noFill} value={selectedLayout.styleDefaults?.fillColor || "#55aaff"} onChange={e => updateLayoutStyle(selectedLayout.id, { fillColor: e.target.value })} />
                                    </label>
                                    <label className="lang-label">
                                        Rotation ({selectedLayout.rotationDeg || 0}°)
                                    </label>
                                    <label className="lang-label">
                                        Border Color
                                        <input type="color" value={selectedLayout.styleDefaults?.borderColor || "#000000"} onChange={e => updateLayoutStyle(selectedLayout.id, { borderColor: e.target.value })} />
                                    </label>
                                    <label className="lang-label">
                                        Border Width ({selectedLayout.styleDefaults?.borderWidth ?? 2}px)
                                        <input type="range" min="0" max="20" step="1" value={selectedLayout.styleDefaults?.borderWidth ?? 2} onChange={e => updateLayoutStyle(selectedLayout.id, { borderWidth: parseInt(e.target.value) })} />
                                    </label>
                                    <label className="lang-label">
                                        Padding ({selectedLayout.styleDefaults?.padding ?? 0}px)
                                        <input type="range" min="0" max="50" step="1" value={selectedLayout.styleDefaults?.padding ?? 0} onChange={e => updateLayoutStyle(selectedLayout.id, { padding: parseInt(e.target.value) })} />
                                    </label>
                                    <label className="lang-label">
                                        Opacity ({selectedLayout.styleDefaults?.opacity ?? 1})
                                        <input type="range" min="0" max="1" step="0.1" value={selectedLayout.styleDefaults?.opacity ?? 1} onChange={e => updateLayoutStyle(selectedLayout.id, { opacity: parseFloat(e.target.value) })} />
                                    </label>
                                    <hr style={{ width: "100%", border: "0.5px solid #444", margin: "4px 0" }} />
                                    <label className="lang-label">
                                        Text Color
                                        <input type="color" value={selectedLayout.styleDefaults?.color || "#000000"} onChange={e => updateLayoutStyle(selectedLayout.id, { color: e.target.value })} />
                                    </label>
                                    <label className="lang-label">
                                        Font Size ({selectedLayout.styleDefaults?.fontSize || 24}px)
                                        <input type="range" min="8" max="144" step="1" value={selectedLayout.styleDefaults?.fontSize || 24} onChange={e => updateLayoutStyle(selectedLayout.id, { fontSize: parseInt(e.target.value) })} />
                                    </label>
                                    <label className="lang-label">
                                        Weight ({selectedLayout.styleDefaults?.fontWeight || 400})
                                        <input type="range" min="400" max="900" step="100" value={selectedLayout.styleDefaults?.fontWeight || 400} onChange={e => updateLayoutStyle(selectedLayout.id, { fontWeight: parseInt(e.target.value) })} />
                                    </label>
                                    <label className="lang-label" style={{ flexDirection: "row", alignItems: "center" }}>
                                        <input type="checkbox" checked={selectedLayout.styleDefaults?.italic || false} onChange={e => updateLayoutStyle(selectedLayout.id, { italic: e.target.checked })} />
                                        Italic
                                    </label>
                                    <label className="lang-label">
                                        Font Family
                                        <select
                                            className="lang-input"
                                            value={selectedLayout.styleDefaults?.fontFamily || "inherit"}
                                            onChange={e => updateLayoutStyle(selectedLayout.id, { fontFamily: e.target.value })}
                                            style={{ fontFamily: selectedLayout.styleDefaults?.fontFamily || "inherit" }}
                                        >
                                            <option value="inherit">Default</option>
                                            {FONT_FAMILIES.map(f => (
                                                <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="lang-label">
                                        Align
                                        <select className="lang-input" value={selectedLayout.styleDefaults?.align || "center"} onChange={e => updateLayoutStyle(selectedLayout.id, { align: e.target.value as any })}>
                                            <option value="left">Left</option>
                                            <option value="center">Center</option>
                                            <option value="right">Right</option>
                                        </select>
                                    </label>
                                    <label className="lang-label">
                                        Vertical Align
                                        <select className="lang-input" value={selectedLayout.styleDefaults?.verticalAlign || "center"} onChange={e => updateLayoutStyle(selectedLayout.id, { verticalAlign: e.target.value as any })}>
                                            <option value="top">Top</option>
                                            <option value="center">Center</option>
                                            <option value="bottom">Bottom</option>
                                        </select>
                                    </label>
                                </>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ color: "#888", fontSize: "0.8rem", textAlign: "center" }}>No item selected</div>
            )}
        </div>
    );
}

