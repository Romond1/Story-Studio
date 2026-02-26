import React, { useRef, useState, useEffect } from "react";
import { Slide, LanguageBoardTemplate, LayoutItem } from "../../shared/types";
import "./languageStyles.css";

interface LanguageBoardViewProps {
    slide: Slide | null;
    template: LanguageBoardTemplate | null;
    onUpdateSlide: (updates: Partial<Slide>) => void;
    onUpdateTemplate: (updates: Partial<LanguageBoardTemplate>) => void;
    isEditMode: boolean;
    isTemplateMode: boolean;
    selectedItemId: string | null;
    onSelectItemId: (id: string | null) => void;
    viewMode: "slide" | "split" | "board";
    toMediaUrl: (relPath: string) => string;
}

export function LanguageBoardView({
    slide,
    template,
    onUpdateSlide,
    onUpdateTemplate,
    isEditMode,
    isTemplateMode,
    selectedItemId,
    onSelectItemId,
    viewMode,
    toMediaUrl,
}: LanguageBoardViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ id: string; startX: number; startY: number; elX: number; elY: number; elW: number; elH: number; elFS?: number; handle?: string } | null>(null);

    // In-place editing state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [editModeInternal, setEditModeInternal] = useState<"text" | "front" | "back">("text");

    const layoutItems = template?.layoutItems || [];
    const contentItems = slide?.languageContent?.items || [];

    // Reset selection and editing when slide or mode changes to prevent "stuck" states
    useEffect(() => {
        setEditingId(null);
        onSelectItemId(null);
    }, [slide?.id, isTemplateMode, viewMode]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isEditMode || !selectedItemId || editingId) return;

            if (e.key === "Delete") {
                if (isTemplateMode) {
                    onUpdateTemplate({ layoutItems: layoutItems.filter(i => i.id !== selectedItemId) });
                    onUpdateSlide({ languageContent: { items: contentItems.filter(c => c.layoutId !== selectedItemId) } });
                } else {
                    onUpdateSlide({ languageContent: { items: contentItems.filter(c => c.layoutId !== selectedItemId) } });
                }
                onSelectItemId(null);
            }

            if (e.ctrlKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
                const layout = layoutItems.find(i => i.id === selectedItemId);
                if (layout && (layout.type === "textSlot" || layout.type === "flashcardSlot")) {
                    const delta = e.key === "ArrowRight" ? 2 : -2;
                    const curSize = layout.styleDefaults?.fontSize || 24;
                    const newSize = Math.max(8, Math.min(144, curSize + delta));

                    if (isTemplateMode) {
                        onUpdateTemplate({
                            layoutItems: layoutItems.map(i => i.id === selectedItemId
                                ? { ...i, styleDefaults: { ...i.styleDefaults, fontSize: newSize } }
                                : i)
                        });
                    }
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isEditMode, selectedItemId, editingId, layoutItems, isTemplateMode, contentItems]);

    if (!template || viewMode === "slide") return null;

    const updateContentItem = (layoutId: string, itemUpdates: any) => {
        const existing = contentItems.find(c => c.layoutId === layoutId);
        let newItems;
        if (existing) {
            newItems = contentItems.map(c => c.layoutId === layoutId ? { ...c, ...itemUpdates } : c);
        } else {
            newItems = [...contentItems, { layoutId, ...itemUpdates }];
        }
        onUpdateSlide({ languageContent: { items: newItems } });
    };

    const commitEdit = () => {
        if (!editingId) return;
        const updates: any = {};
        if (editModeInternal === "text") updates.text = editValue;
        else if (editModeInternal === "front") updates.frontText = editValue;
        else if (editModeInternal === "back") updates.backText = editValue;

        if (isTemplateMode) {
            // If in template mode, we update the template's layout item with these as defaults
            const newLayoutItems = layoutItems.map(i => {
                if (i.id === editingId) {
                    return { ...i, ...updates };
                }
                return i;
            });
            onUpdateTemplate({ layoutItems: newLayoutItems });
        } else {
            updateContentItem(editingId, updates);
        }
        setEditingId(null);
    };

    const handlePointerDown = (e: React.PointerEvent, layout: LayoutItem, handle?: string) => {
        if (!isEditMode) return;

        // If we are currently editing this specific box, stop propagation so the container doesn't close it
        if (editingId === layout.id) {
            e.stopPropagation();
            return;
        }

        // If we were editing something else, commit it first
        if (editingId && editingId !== layout.id) {
            commitEdit();
        }

        e.stopPropagation();
        onSelectItemId(layout.id);

        if (isTemplateMode) {
            const sd = layout.styleDefaults || {};
            // Check for Alt+Drag duplication
            if (e.altKey && !handle) {
                const nextSeq = template.nextItemSeq || 1;
                const newId = `T${nextSeq.toString().padStart(3, "0")}`;
                const newLayout = { ...layout, id: newId };

                onUpdateTemplate({
                    layoutItems: [...layoutItems, newLayout],
                    nextItemSeq: nextSeq + 1
                });
                onSelectItemId(newId);

                // Duplicate slide content if it exists
                const existingContent = contentItems.find(c => c.layoutId === layout.id);
                if (existingContent) {
                    onUpdateSlide({ languageContent: { items: [...contentItems, { ...existingContent, layoutId: newId }] } });
                }

                // Start drag with the new item instead
                dragRef.current = {
                    id: newId,
                    startX: e.clientX,
                    startY: e.clientY,
                    elX: layout.x,
                    elY: layout.y,
                    elW: layout.width,
                    elH: layout.height,
                    elFS: sd.fontSize || (layout.type === "flashcardSlot" ? 20 : 24),
                    handle
                };
            } else {
                dragRef.current = {
                    id: layout.id,
                    startX: e.clientX,
                    startY: e.clientY,
                    elX: layout.x,
                    elY: layout.y,
                    elW: layout.width,
                    elH: layout.height,
                    elFS: sd.fontSize || (layout.type === "flashcardSlot" ? 20 : 24),
                    handle
                };
            }
            const target = e.currentTarget as HTMLElement;
            target.setPointerCapture(e.pointerId);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isEditMode || !isTemplateMode || !dragRef.current) return;
        const { id, startX, startY, elX, elY, elW, elH, handle } = dragRef.current;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (handle === "rotate") {
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            // Item center in pixels (roughly)
            const centerX = elX + elW / 2;
            const centerY = elY + elH / 2;

            // Pointer position relative to container
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const angle = Math.atan2(mouseY - centerY, mouseX - centerX) * (180 / Math.PI) + 90;
            const newItems = layoutItems.map(i => i.id === id ? { ...i, rotationDeg: Math.round(angle) } : i);
            onUpdateTemplate({ layoutItems: newItems });
        } else if (handle) {
            let newX = elX;
            let newY = elY;
            let newW = elW;
            let newH = elH;

            if (handle.includes("left")) {
                newW = Math.max(40, elW - dx);
                newX = elX + (elW - newW);
            } else if (handle.includes("right")) {
                newW = Math.max(40, elW + dx);
            }

            if (handle.includes("top")) {
                newH = Math.max(20, elH - dy);
                newY = elY + (elH - newH);
            } else if (handle.includes("bottom")) {
                newH = Math.max(20, elH + dy);
            }

            const newItems = layoutItems.map(i => {
                if (i.id === id) {
                    let fsUpdates = {};
                    if (dragRef.current?.elFS) {
                        const scale = newW / elW;
                        const newFS = Math.round(dragRef.current.elFS * scale);
                        fsUpdates = { styleDefaults: { ...i.styleDefaults, fontSize: Math.max(8, newFS) } };
                    }
                    return { ...i, x: newX, y: newY, width: newW, height: newH, ...fsUpdates };
                }
                return i;
            });
            onUpdateTemplate({ layoutItems: newItems });
        } else {
            // Drag move
            const newX = elX + dx;
            const newY = elY + dy;
            const newItems = layoutItems.map(i => i.id === id ? { ...i, x: newX, y: newY } : i);
            onUpdateTemplate({ layoutItems: newItems });
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (dragRef.current) {
            const target = e.currentTarget as HTMLElement;
            target.releasePointerCapture(e.pointerId);
            dragRef.current = null;
        }
    };

    const handleDoubleClick = (layout: LayoutItem, content: any) => {
        if (!isEditMode) return;
        setEditingId(layout.id);
        if (layout.type === "textSlot" || layout.type === "shapeSlot") {
            setEditModeInternal("text");
            // If template mode, use layout.text, else fallback to template text
            setEditValue(isTemplateMode ? (layout.text || "") : (content?.text ?? layout.text ?? ""));
        } else if (layout.type === "flashcardSlot") {
            if (content?.flippedInTeach) {
                setEditModeInternal("back");
                setEditValue(isTemplateMode ? (layout.backText || "") : (content?.backText ?? layout.backText ?? ""));
            } else {
                setEditModeInternal("front");
                setEditValue(isTemplateMode ? (layout.frontText || "") : (content?.frontText ?? layout.frontText ?? ""));
            }
        }
    };

    const bgStyle: React.CSSProperties = {
        backgroundColor: template.background.color || "#eeeeee",
        backgroundImage: template.background.imageSrc ? `url(${toMediaUrl(template.background.imageSrc)})` : "none",
        backgroundPosition: `${(template.background.posX || 0) * 100}% ${(template.background.posY || 0) * 100}%`,
        backgroundSize: template.background.scale ? `${template.background.scale * 100}%` : "cover",
        filter: template.background.blur ? `blur(${template.background.blur}px)` : "none",
        position: "absolute",
        inset: 0,
        zIndex: 0,
    };

    return (
        <div
            className="language-board-container"
            ref={containerRef}
            onPointerDown={() => {
                if (editingId) commitEdit();
                if (isEditMode) onSelectItemId(null);
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{
                height: "100%",
                flex: "1 1 0",
                minHeight: 0,
                marginTop: viewMode === "board" ? 0 : 12,
                borderRadius: viewMode === "board" ? 0 : 8,
                borderTop: viewMode === "board" ? "none" : "2px solid #333",
                position: "relative",
                overflow: "hidden"
            }}
        >
            <div style={bgStyle} />

            {layoutItems.map(layout => {
                const content = contentItems.find(c => c.layoutId === layout.id);
                if (!isEditMode && content && content.visibleInTeach === false) return null;

                const isSelected = isEditMode && selectedItemId === layout.id;
                const isEditing = editingId === layout.id;
                const sd = layout.styleDefaults || {};

                const itemStyle: React.CSSProperties = {
                    position: "absolute",
                    left: layout.x,
                    top: layout.y,
                    width: layout.width,
                    height: layout.height,
                    transform: layout.rotationDeg ? `rotate(${layout.rotationDeg}deg)` : "none",
                    boxSizing: "border-box",
                    cursor: (isEditMode && isTemplateMode) ? "move" : (isEditMode ? "pointer" : "initial"),
                    // Make outlines VERY visible in Edit Mode
                    outline: isSelected ? (isTemplateMode ? "3px solid #55aaff" : "3px dashed #aaff55") : (isEditMode ? "1px solid rgba(0,0,0,0.4)" : "none"),
                    boxShadow: isSelected ? "0 0 0 6px rgba(85, 170, 255, 0.4)" : "none",
                    zIndex: isEditing ? 1010 : (isSelected ? 10 : 1),
                    backgroundColor: isEditMode && !isEditing ? "rgba(255,255,255,0.05)" : "transparent",
                };

                const renderHandles = () => {
                    if (!isSelected || !isTemplateMode) return null;
                    const handleStyle: React.CSSProperties = {
                        position: "absolute",
                        width: 10,
                        height: 10,
                        background: "#fff",
                        border: "2px solid #55aaff",
                        borderRadius: "50%",
                        zIndex: 20,
                    };
                    return (
                        <>
                            <div style={{ ...handleStyle, top: -5, left: -5, cursor: "nwse-resize" }} onPointerDown={e => { e.stopPropagation(); handlePointerDown(e, layout, "top-left"); }} />
                            <div style={{ ...handleStyle, top: -5, right: -5, cursor: "nesw-resize" }} onPointerDown={e => { e.stopPropagation(); handlePointerDown(e, layout, "top-right"); }} />
                            <div style={{ ...handleStyle, bottom: -5, left: -5, cursor: "nesw-resize" }} onPointerDown={e => { e.stopPropagation(); handlePointerDown(e, layout, "bottom-left"); }} />
                            <div style={{ ...handleStyle, bottom: -5, right: -5, cursor: "nwse-resize" }} onPointerDown={e => { e.stopPropagation(); handlePointerDown(e, layout, "bottom-right"); }} />
                            {/* Rotation Handle */}
                            <div style={{ ...handleStyle, top: -30, left: "50%", marginLeft: -5, background: "#ffaa55", cursor: "crosshair" }} onPointerDown={e => { e.stopPropagation(); handlePointerDown(e, layout, "rotate"); }}>
                                <div style={{ position: "absolute", top: 10, left: 4, width: 2, height: 18, background: "#ffaa55" }} />
                            </div>
                        </>
                    );
                };

                if (layout.type === "textSlot") {
                    return (
                        <div
                            key={layout.id}
                            style={{
                                ...itemStyle,
                                color: sd.color || "#000",
                                fontFamily: sd.fontFamily || "inherit",
                                fontSize: sd.fontSize || 24,
                                fontWeight: sd.fontWeight || 400,
                                fontStyle: sd.italic ? "italic" : "normal",
                                textAlign: sd.align || "left",
                                alignItems: sd.verticalAlign === "top" ? "flex-start" : sd.verticalAlign === "bottom" ? "flex-end" : "center",
                                justifyContent: "center",
                                padding: 0,
                                border: isEditing ? "2px solid #55aaff" : "none",
                            }}
                            onPointerDown={e => handlePointerDown(e, layout)}
                            onDoubleClick={() => handleDoubleClick(layout, content)}
                        >
                            {renderHandles()}
                            {isEditing ? (
                                <textarea
                                    autoFocus
                                    className="canvas-edit-textarea"
                                    value={editValue}
                                    onChange={e => {
                                        setEditValue(e.target.value);
                                        e.target.style.height = "auto";
                                        e.target.style.height = e.target.scrollHeight + "px";
                                    }}
                                    // Save on blur
                                    onBlur={commitEdit}
                                    // Stop propagation so clicking inside doesn't close the editor
                                    onPointerDown={e => e.stopPropagation()}
                                    onKeyDown={e => {
                                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEdit(); }
                                        if (e.key === "Escape") { setEditingId(null); }
                                    }}
                                    ref={el => {
                                        if (el) {
                                            el.style.height = "auto";
                                            el.style.height = el.scrollHeight + "px";
                                        }
                                    }}
                                    style={{
                                        width: "100%",
                                        height: "auto",
                                        background: "transparent",
                                        color: sd.color || "#000",
                                        border: "none",
                                        outline: "none",
                                        resize: "none",
                                        fontSize: sd.fontSize || 24,
                                        fontWeight: sd.fontWeight || 400,
                                        fontStyle: sd.italic ? "italic" : "normal",
                                        fontFamily: sd.fontFamily || "inherit",
                                        textAlign: sd.align || "left",
                                        padding: 0,
                                        lineHeight: "1.2",
                                        boxSizing: "border-box",
                                        overflow: "hidden"
                                    }}
                                />
                            ) : (
                                <div style={{
                                    width: "100%",
                                    pointerEvents: "auto",
                                    whiteSpace: "pre-wrap",
                                    lineHeight: "1.2",
                                    textAlign: sd.align || "left",
                                    padding: 0,
                                    margin: 0
                                }}>
                                    {isTemplateMode ? (layout.text || "") : (content?.text ?? layout.text ?? "")}
                                </div>
                            )}
                        </div>
                    );
                }



                if (layout.type === "flashcardSlot") {
                    const isFlipped = content?.flippedInTeach;
                    const anim = sd.flipAnimation || "flip";
                    const speed = sd.flipSpeed || 0.6;

                    const fAlign = sd.frontAlign || sd.align || "center";
                    const bAlign = sd.backAlign || sd.align || "center";
                    const fVAlign = sd.frontVerticalAlign || sd.verticalAlign || "center";
                    const bVAlign = sd.backVerticalAlign || sd.verticalAlign || "center";
                    const fFS = sd.frontFontSize || sd.fontSize || 20;
                    const bFS = sd.backFontSize || sd.fontSize || 20;
                    const fFW = sd.frontFontWeight || sd.fontWeight || 400;
                    const bFW = sd.backFontWeight || sd.fontWeight || 400;
                    const fItalic = sd.frontItalic !== undefined ? sd.frontItalic : (sd.italic || false);
                    const bItalic = sd.backItalic !== undefined ? sd.backItalic : (sd.italic || false);

                    const cardShadow = sd.shadowBlur ? `0 ${sd.shadowBlur / 4}px ${sd.shadowBlur}px rgba(0,0,0,${sd.shadowOpacity ?? 0.3})` : "none";
                    const cardBorder = sd.borderWidth ? `${sd.borderWidth}px solid ${sd.borderColor || "#000000"}` : "none";

                    const commonFaceStyle: React.CSSProperties = {
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        padding: 12,
                        display: "flex",
                        borderRadius: sd.borderRadius ?? 8,
                        backfaceVisibility: "hidden",
                        border: cardBorder,
                        boxShadow: cardShadow,
                        boxSizing: "border-box",
                    };

                    const frontStyle: React.CSSProperties = {
                        ...commonFaceStyle,
                        backgroundColor: sd.frontColor || "#ffffff",
                        color: sd.frontTextColor || "#000000",
                        alignItems: fVAlign === "top" ? "flex-start" : fVAlign === "bottom" ? "flex-end" : "center",
                        justifyContent: fAlign === "left" ? "flex-start" : fAlign === "right" ? "flex-end" : "center",
                        textAlign: fAlign,
                    };

                    const backStyle: React.CSSProperties = {
                        ...commonFaceStyle,
                        backgroundColor: sd.backColor || "#ffffff",
                        color: sd.backTextColor || "#000000",
                        transform: anim === "flip" ? "rotateY(180deg)" : "none",
                        alignItems: bVAlign === "top" ? "flex-start" : bVAlign === "bottom" ? "flex-end" : "center",
                        justifyContent: bAlign === "left" ? "flex-start" : bAlign === "right" ? "flex-end" : "center",
                        textAlign: bAlign,
                    };

                    const renderTextarea = (val: string, side: "front" | "back") => {
                        const s_align = side === "back" ? bAlign : fAlign;
                        const s_fs = side === "back" ? bFS : fFS;
                        const s_fw = side === "back" ? bFW : fFW;
                        const s_italic = side === "back" ? bItalic : fItalic;

                        return (
                            <textarea
                                autoFocus
                                className="canvas-edit-textarea"
                                value={editValue}
                                onChange={e => {
                                    setEditValue(e.target.value);
                                    e.target.style.height = "auto";
                                    e.target.style.height = e.target.scrollHeight + "px";
                                }}
                                onBlur={commitEdit}
                                onPointerDown={e => e.stopPropagation()}
                                onKeyDown={e => {
                                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEdit(); }
                                    if (e.key === "Escape") { setEditingId(null); }
                                }}
                                style={{
                                    width: "100%",
                                    height: "auto",
                                    background: "transparent",
                                    color: side === "back" ? (sd.backTextColor || "#000000") : (sd.frontTextColor || "#000000"),
                                    border: "none",
                                    outline: "none",
                                    resize: "none",
                                    fontSize: s_fs,
                                    fontWeight: s_fw,
                                    fontStyle: s_italic ? "italic" : "normal",
                                    fontFamily: sd.fontFamily || "inherit",
                                    textAlign: s_align,
                                    padding: 0,
                                    lineHeight: "1.2",
                                    boxSizing: "border-box",
                                    overflow: "hidden"
                                }}
                                ref={el => {
                                    if (el) {
                                        el.style.height = "auto";
                                        el.style.height = el.scrollHeight + "px";
                                    }
                                }}
                            />
                        );
                    };

                    return (
                        <div
                            key={layout.id}
                            style={{
                                ...itemStyle,
                                borderRadius: sd.borderRadius ?? 8,
                                boxShadow: "none", // Shadow is handled by faces for 3D realism
                                userSelect: "none",
                                perspective: "1000px",
                            }}
                            onPointerDown={e => handlePointerDown(e, layout)}
                            onDoubleClick={() => handleDoubleClick(layout, content)}
                            onClick={() => {
                                if (!isEditMode) {
                                    updateContentItem(layout.id, { flippedInTeach: !isFlipped });
                                }
                            }}
                        >
                            {renderHandles()}
                            <div
                                className={anim === "flip" ? `flashcard-inner ${isFlipped ? 'is-flipped' : ''}` : ""}
                                style={{
                                    position: "relative",
                                    width: "100%",
                                    height: "100%",
                                    transition: anim === "none" ? "none" : `transform ${speed}s, opacity ${speed}s`,
                                    transformStyle: "preserve-3d",
                                    borderRadius: sd.borderRadius ?? 8
                                }}
                            >
                                <div
                                    style={{
                                        ...frontStyle,
                                        opacity: anim === "fade" ? (isFlipped ? 0 : 1) : 1,
                                        visibility: (anim === "none" && isFlipped) ? "hidden" : "visible",
                                        transition: `opacity ${speed}s`
                                    }}
                                >
                                    {(isEditing && editModeInternal === "front") ? (
                                        renderTextarea(editValue || "", "front")
                                    ) : (
                                        <div style={{
                                            width: "100%",
                                            pointerEvents: "auto",
                                            whiteSpace: "pre-wrap",
                                            fontSize: fFS,
                                            fontWeight: fFW,
                                            fontStyle: fItalic ? "italic" : "normal",
                                            fontFamily: sd.fontFamily || "inherit",
                                            lineHeight: "1.2",
                                            textAlign: fAlign,
                                            padding: 0,
                                            margin: 0
                                        }}>
                                            {isTemplateMode ? (layout.frontText || "") : (content?.frontText ?? layout.frontText ?? "")}
                                        </div>
                                    )}
                                </div>

                                <div
                                    style={{
                                        ...backStyle,
                                        opacity: anim === "fade" ? (isFlipped ? 1 : 0) : 1,
                                        visibility: (anim === "none" && !isFlipped) ? "hidden" : "visible",
                                        transition: `opacity ${speed}s`,
                                        pointerEvents: isFlipped ? "auto" : "none"
                                    }}
                                >
                                    {(isEditing && editModeInternal === "back") ? (
                                        renderTextarea(editValue || "", "back")
                                    ) : (
                                        <div style={{
                                            width: "100%",
                                            pointerEvents: "auto",
                                            whiteSpace: "pre-wrap",
                                            fontSize: bFS,
                                            fontWeight: bFW,
                                            fontStyle: bItalic ? "italic" : "normal",
                                            fontFamily: sd.fontFamily || "inherit",
                                            lineHeight: "1.2",
                                            textAlign: bAlign,
                                            padding: 0,
                                            margin: 0
                                        }}>
                                            {isTemplateMode ? (layout.backText || "") : (content?.backText ?? layout.backText ?? "")}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                }

                if (layout.type === "shapeSlot") {
                    const st = sd.shapeType || "rectangle";
                    const fill = sd.noFill ? "none" : (sd.fillColor || "#55aaff");
                    const stroke = sd.borderColor || "#000000";
                    const sw = sd.borderWidth ?? 2;
                    const pad = sd.padding ?? 0;
                    const opacity = sd.opacity ?? 1;

                    const renderShape = () => {
                        const w = layout.width;
                        const h = layout.height;
                        const innerW = Math.max(1, w - pad * 2);
                        const innerH = Math.max(1, h - pad * 2);

                        switch (st) {
                            case "circle":
                            case "oval":
                                return <ellipse cx={w / 2} cy={h / 2} rx={innerW / 2} ry={innerH / 2} fill={fill} stroke={stroke} strokeWidth={sw} />;
                            case "square":
                            case "rectangle":
                                return <rect x={pad} y={pad} width={innerW} height={innerH} fill={fill} stroke={stroke} strokeWidth={sw} />;
                            case "diamond":
                                return <path d={`M ${w / 2} ${pad} L ${w - pad} ${h / 2} L ${w / 2} ${h - pad} L ${pad} ${h / 2} Z`} fill={fill} stroke={stroke} strokeWidth={sw} />;
                            case "star":
                                return (
                                    <path
                                        d={`M ${w / 2} ${pad} L ${w * 0.65} ${h * 0.35} L ${w - pad} ${h * 0.4} L ${w * 0.7} ${h * 0.65} L ${w * 0.8} ${h - pad} L ${w / 2} ${h * 0.8} L ${w * 0.2} ${h - pad} L ${w * 0.3} ${h * 0.65} L ${pad} ${h * 0.4} L ${w * 0.35} ${h * 0.35} Z`}
                                        fill={fill} stroke={stroke} strokeWidth={sw}
                                    />
                                );
                            case "heart":
                                return (
                                    <path
                                        d={`M ${w / 2} ${h * 0.9} C ${w * 0.1} ${h * 0.7} ${pad} ${h * 0.3} ${w * 0.3} ${h * 0.1} C ${w * 0.5} ${h * 0.1} ${w / 2} ${h * 0.3} ${w / 2} ${h * 0.3} C ${w / 2} ${h * 0.3} ${w * 0.5} ${h * 0.1} ${w * 0.7} ${h * 0.1} C ${w * 0.9} ${h * 0.3} ${w - pad} ${h * 0.7} ${w / 2} ${h * 0.9} Z`}
                                        fill={fill} stroke={stroke} strokeWidth={sw}
                                    />
                                );
                            default:
                                return null;
                        }
                    };

                    return (
                        <div
                            key={layout.id}
                            style={{ ...itemStyle, opacity }}
                            onPointerDown={e => handlePointerDown(e, layout)}
                            onDoubleClick={() => handleDoubleClick(layout, content)}
                        >
                            {renderHandles()}
                            <svg width="100%" height="100%" style={{ overflow: "visible" }}>
                                {renderShape()}
                            </svg>
                            <div style={{
                                position: "absolute",
                                inset: 0,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: sd.align === "center" ? "center" : sd.align === "right" ? "flex-end" : "flex-start",
                                justifyContent: sd.verticalAlign === "top" ? "flex-start" : sd.verticalAlign === "bottom" ? "flex-end" : "center",
                                padding: pad + 4,
                                pointerEvents: "none"
                            }}>
                                {isEditing ? (
                                    <textarea
                                        autoFocus
                                        className="canvas-edit-textarea"
                                        value={editValue}
                                        onChange={e => {
                                            setEditValue(e.target.value);
                                            e.target.style.height = "auto";
                                            e.target.style.height = e.target.scrollHeight + "px";
                                        }}
                                        onBlur={commitEdit}
                                        onPointerDown={e => e.stopPropagation()}
                                        onKeyDown={e => {
                                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEdit(); }
                                            if (e.key === "Escape") { setEditingId(null); }
                                        }}
                                        ref={el => {
                                            if (el) {
                                                el.style.height = "auto";
                                                el.style.height = el.scrollHeight + "px";
                                            }
                                        }}
                                        style={{
                                            width: "100%",
                                            height: "auto",
                                            background: "transparent",
                                            color: sd.color || "#000",
                                            border: "none",
                                            outline: "none",
                                            resize: "none",
                                            fontSize: sd.fontSize || 24,
                                            fontWeight: sd.fontWeight || 400,
                                            fontStyle: sd.italic ? "italic" : "normal",
                                            fontFamily: sd.fontFamily || "inherit",
                                            textAlign: sd.align || "center",
                                            padding: 0,
                                            lineHeight: "1.2",
                                            boxSizing: "border-box",
                                            overflow: "hidden",
                                            pointerEvents: "auto"
                                        }}
                                    />
                                ) : (
                                    <div style={{
                                        width: "100%",
                                        pointerEvents: "auto",
                                        whiteSpace: "pre-wrap",
                                        lineHeight: "1.2",
                                        color: sd.color || "#000",
                                        fontSize: sd.fontSize || 24,
                                        fontWeight: sd.fontWeight || 400,
                                        fontStyle: sd.italic ? "italic" : "normal",
                                        fontFamily: sd.fontFamily || "inherit",
                                        textAlign: sd.align || "center",
                                        padding: 0,
                                        margin: 0
                                    }}>
                                        {isTemplateMode ? (layout.text || "") : (content?.text ?? layout.text ?? "")}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                }

                return null;
            })}
        </div>
    );
}

