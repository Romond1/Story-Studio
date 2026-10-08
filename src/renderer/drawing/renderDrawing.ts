import type { TransientStroke, SceneViewport } from '../../shared/teachingScene';
import type { MarkerStroke } from '../../shared/types';
import type { LogicalFrame } from '../../shared/staticScene';
function getOpaqueStrokeColor(color: string, alpha: number): string {
  const clean = color.startsWith("#") ? color.slice(1) : color;
  if (clean.length !== 6) return color;
  const red = Number.parseInt(clean.slice(0, 2), 16);
  const green = Number.parseInt(clean.slice(2, 4), 16);
  const blue = Number.parseInt(clean.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export const renderStroke = (
    ctx: CanvasRenderingContext2D,
    stroke: TransientStroke,
    width: number,
    height: number,
    now: number,
  ) => {
    if (stroke.points.length < 2) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = stroke.size;

    for (let index = 1; index < stroke.points.length; index += 1) {
      const start = stroke.points[index - 1];
      const end = stroke.points[index];
      const fadeMs = stroke.fadeMs ?? 0;
      const fadeAlpha = fadeMs > 0 ? Math.max(0, 1 - (now - end.t) / fadeMs) : 1;
      const alpha = Math.max(0, Math.min(1, fadeAlpha * stroke.opacity));
      if (alpha <= 0) continue;
      const hue = stroke.rainbow ? (end.h ?? now / 18 + index * 8) : undefined;
      ctx.strokeStyle = stroke.rainbow
        ? `hsla(${hue}, 95%, 62%, ${alpha})`
        : getOpaqueStrokeColor(stroke.color, alpha);
      ctx.beginPath();
      ctx.moveTo(start.x * width, start.y * height);
      ctx.lineTo(end.x * width, end.y * height);
      ctx.stroke();
    }
  };


export function paintDrawing(canvas: HTMLCanvasElement, frame: LogicalFrame, viewport: SceneViewport, markers: MarkerStroke[], transient: TransientStroke[], now: number, contentFrame = frame) {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(frame.width * ratio));
  const height = Math.max(1, Math.round(frame.height * ratio));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, frame.width, frame.height);
  ctx.save(); ctx.translate(viewport.pan.x, viewport.pan.y); ctx.scale(viewport.zoom, viewport.zoom);
  [...markers, ...transient].forEach(stroke => renderStroke(ctx, stroke, contentFrame.width, contentFrame.height, now));
  const sparkle = transient[transient.length - 1];
  const last = sparkle?.points[sparkle.points.length - 1];
  if (sparkle?.sparkle && last && (!sparkle.fadeMs || now - last.t < sparkle.fadeMs)) {
    for (let index = 0; index < 6; index++) {
      const angle = (now / 120 + index) * 1.7; const distance = 2 + (index % 3) * 2;
      ctx.fillStyle = `rgba(255,255,255,${0.3 - index * 0.04})`; ctx.beginPath();
      ctx.arc(last.x * contentFrame.width + Math.cos(angle) * distance, last.y * contentFrame.height + Math.sin(angle) * distance, Math.max(0.6, 2.2 - index * 0.25), 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}
