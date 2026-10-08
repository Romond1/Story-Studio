import React, { useEffect, useRef, useState } from 'react';
import { CARD_V2_FONT, type CardV2CardPlan, type CardV2RenderPlan } from '../../shared/cardV2Render';
import './CardV2Scene.css';
import type { CardGeometry } from '../../shared/cardsV2';

export interface CardV2SceneProps { plan: CardV2RenderPlan; onSelect?: (instanceId: string) => void; selectedInstanceId?: string; showWarnings?: boolean; className?: string; onGeometryChange?: (id: string, geometry: CardGeometry) => void }
function Card({ card, onSelect, selected, showWarnings, onGesture }: { onGesture?: (event: React.PointerEvent<SVGGElement>, id: string, resize: boolean) => void; card: CardV2CardPlan; onSelect?: (id: string) => void; selected: boolean; showWarnings?: boolean }) {
  const node = useRef<SVGGElement>(null), previousFace = useRef(card.faceId);
  useEffect(() => {
    const changed = previousFace.current !== card.faceId;
    previousFace.current = card.faceId;
    if (!changed || card.concealed || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // A mount/reload has no previous face: only a live change on this mounted instance animates.
    const animation = node.current?.animate([{ opacity: .35 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
    return () => animation?.cancel();
  }, [card.faceId, card.concealed]);
  return <g transform={`translate(${card.box.x} ${card.box.y})`} className={onSelect ? 'card-v2-item card-v2-interactive' : 'card-v2-item'} role={onSelect ? 'button' : 'group'} tabIndex={onSelect ? 0 : undefined}
    aria-label={card.concealed ? 'Concealed card' : card.texts.flatMap(t => t.lines.map(l => l.text)).join(' ') || card.image?.alt || 'Card'}
    onPointerDown={onGesture ? event => onGesture(event, card.instanceId, false) : undefined}
    onClick={onSelect ? () => onSelect(card.instanceId) : undefined}
    onKeyDown={onSelect ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(card.instanceId); } } : undefined}>
    <rect x={0} y={3} width={card.box.width} height={card.box.height} rx={card.style.radius} fill="#000000" opacity={.12} />
    <rect width={card.box.width} height={card.box.height} rx={card.style.radius} fill={card.style.surface} stroke={card.style.border} strokeWidth={card.style.borderWidth} />
    <path d={`M ${card.style.radius + 5} 3 H ${Math.max(card.style.radius + 5, card.box.width - card.style.radius - 5)}`} stroke={card.style.accent} strokeWidth={3} />
    {(selected || card.highlighted) && <rect x={-5} y={-5} width={card.box.width + 10} height={card.box.height + 10} rx={card.style.radius + 4} fill="none" stroke={card.style.accent} strokeWidth={3} strokeDasharray={selected ? '8 5' : undefined} />}
    <g ref={node}>
      {card.concealed ? <text x={card.box.width / 2} y={card.box.height / 2} textAnchor="middle" dominantBaseline="central" fontFamily={CARD_V2_FONT} fontSize={Math.min(64, card.box.height / 3)} fill={card.style.ink}>?</text> : <>
        {card.image && <image href={card.image.src} x={card.image.box.x} y={card.image.box.y} width={card.image.box.width} height={card.image.box.height} preserveAspectRatio="xMidYMid meet"><title>{card.image.alt}</title></image>}
        {card.texts.map((text, index) => {
          const height = text.lines.length * text.lineHeight;
          const top = text.box.y + (text.verticalAlign === 'center' ? Math.max(0, (text.box.height - height) / 2) : 0);
          return <g key={index} fontFamily={CARD_V2_FONT} fontSize={text.fontSize} fontWeight={text.emphasis === 'bold' ? 700 : 400} fontStyle={text.emphasis === 'italic' ? 'italic' : 'normal'} fill={card.style.ink}>
            {text.lines.map((line, lineIndex) => <text key={lineIndex} x={text.box.x + (text.align === 'center' ? text.box.width / 2 : 0)} y={top + lineIndex * text.lineHeight + text.fontSize} textAnchor={text.align === 'center' ? 'middle' : 'start'} textLength={line.width || undefined} lengthAdjust="spacingAndGlyphs" xmlSpace="preserve">{line.text}</text>)}
          </g>;
        })}
      </>}
    </g>
    {selected && onGesture && <g role="button" aria-label="Resize card" onPointerDown={event => { event.stopPropagation(); onGesture(event, card.instanceId, true); }} style={{cursor:'nwse-resize'}}><rect x={card.box.width-10} y={card.box.height-10} width={18} height={18} rx={3} fill="#2673cc" stroke="white" strokeWidth={2} /></g>}
    {showWarnings && card.overflow && <g className="card-v2-overflow"><title>Text exceeds this card. Enlarge the card, switch layout, or split the text.</title><rect x={5} y={card.box.height - 28} width={card.box.width - 10} height={23} rx={4} fill="#8b3414"/><text x={card.box.width / 2} y={card.box.height - 12} fontFamily={CARD_V2_FONT} textAnchor="middle" fontSize={12} fill="#ffffff">Text overflow — enlarge or split</text></g>}
  </g>;
}

/** Passive renderer: the already-resolved logical plan is the sole source of layout. */
export function CardV2Scene({ plan, onSelect, selectedInstanceId, showWarnings, className = '', onGeometryChange }: CardV2SceneProps) {
  const svg = useRef<SVGSVGElement>(null);
  const gesture = useRef<{ id: string; x: number; y: number; original: CardGeometry; resize: boolean; box: CardGeometry }>();
  const [draft, setDraft] = useState<{id:string;box:CardGeometry}|null>(null);
  const logicalPoint = (event: React.PointerEvent) => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return null;
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  };
  const start = (event: React.PointerEvent<SVGGElement>, id: string, resize: boolean) => {
    if (event.button !== 0) return;
    const point = logicalPoint(event), original = plan.cards.find(c=>c.instanceId===id)?.box;
    if (!point || !original) return;
    event.preventDefault(); event.stopPropagation(); onSelect?.(id);
    svg.current?.setPointerCapture(event.pointerId);
    gesture.current = { id, x:point.x, y:point.y, original, resize, box:original };
  };
  const move = (event: React.PointerEvent) => {
    const g = gesture.current, point = logicalPoint(event); if (!g || !point) return;
    const dx=point.x-g.x, dy=point.y-g.y, b=g.original;
    const box = g.resize ? {...b,width:Math.max(40,Math.min(plan.frame.width-b.x,b.width+dx)),height:Math.max(40,Math.min(plan.frame.height-b.y,b.height+dy))}
      : {...b,x:Math.max(0,Math.min(plan.frame.width-b.width,b.x+dx)),y:Math.max(0,Math.min(plan.frame.height-b.height,b.y+dy))};
    g.box=box; setDraft({id:g.id,box});
  };
  const finish = (event: React.PointerEvent, commit: boolean) => {
    const g=gesture.current; gesture.current=undefined; setDraft(null);
    if(svg.current?.hasPointerCapture(event.pointerId))svg.current.releasePointerCapture(event.pointerId);
    if(g && commit && JSON.stringify(g.box)!==JSON.stringify(g.original))onGeometryChange?.(g.id,g.box);
  };
  return <svg ref={svg} className={`card-v2-scene ${className}`} style={onGeometryChange ? {touchAction:'none'} : undefined} viewBox={`0 0 ${plan.frame.width} ${plan.frame.height}`} preserveAspectRatio="xMidYMid meet" aria-label="Card activity"
    onPointerMove={onGeometryChange ? move : undefined} onPointerUp={onGeometryChange ? e=>finish(e,true) : undefined} onPointerCancel={onGeometryChange ? e=>finish(e,false) : undefined} onLostPointerCapture={()=>{gesture.current=undefined;setDraft(null);}}>
    {plan.cards.map(card => <Card key={card.instanceId} card={draft?.id===card.instanceId?{...card,box:draft.box}:card} onSelect={onSelect} selected={card.instanceId === selectedInstanceId} showWarnings={showWarnings} onGesture={onGeometryChange ? start : undefined} />)}
  </svg>;
}
