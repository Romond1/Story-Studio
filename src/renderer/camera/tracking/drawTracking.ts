import { buildHatGeometry, type FacePose } from '../../../shared/faceTracking';
import type { TrackingSettings } from '../../../shared/faceTrackingProtocol';

/** Separate post-key overlay: costume pixels never pass through the chroma matte. */
export function drawTracking(canvas: HTMLCanvasElement, pose: FacePose | null, settings: TrackingSettings, mirror: boolean, width: number, height: number) {
  if (!pose || !settings.enabled || (!settings.hat && !settings.markers)) {
    releaseTrackingCanvas(canvas);
    return;
  }
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Tracking overlay canvas is unavailable.');
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  if (mirror) { ctx.translate(width, 0); ctx.scale(-1, 1); }
  if (settings.hat) {
    const hat = buildHatGeometry(pose, width, height);
    ctx.lineWidth = Math.max(1, hat.span * .008); ctx.strokeStyle = '#f6d977';
    ctx.beginPath(); hat.brim.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.closePath(); ctx.fillStyle = '#44308b'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hat.left.x, hat.left.y); ctx.lineTo(hat.tip.x, hat.tip.y); ctx.lineTo(hat.right.x, hat.right.y);
    ctx.closePath(); ctx.fillStyle = '#7755cf'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hat.bandLeft.x, hat.bandLeft.y); ctx.lineTo(hat.bandRight.x, hat.bandRight.y);
    ctx.lineWidth = hat.span * .045; ctx.strokeStyle = '#efc75e'; ctx.stroke();
    const radius = hat.span * .055;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? radius * .4 : radius;
      const x = hat.star.x + Math.cos(angle) * r, y = hat.star.y + Math.sin(angle) * r;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.fillStyle = '#ffe69a'; ctx.fill();
  }
  if (settings.markers) {
    for (const [point, color] of [[pose.nose, '#ff6e9a'], [pose.forehead, '#57efff'], [pose.chin, '#ffdb5c']] as const) {
      ctx.beginPath(); ctx.arc(point.x * width, point.y * height, Math.max(2, width * .004), 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#102035'; ctx.lineWidth = 1; ctx.stroke();
    }
  }
  ctx.restore();
}

/** Clear stale accessories and release the full-resolution backing store. */
export function releaseTrackingCanvas(canvas: HTMLCanvasElement | null) {
  if (canvas && (canvas.width !== 1 || canvas.height !== 1)) { canvas.width = 1; canvas.height = 1; }
}
