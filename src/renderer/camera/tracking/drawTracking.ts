import { buildHatGeometry, type FacePose } from '../../../shared/faceTracking';
import type { TrackingSettings } from '../../../shared/faceTrackingProtocol';
import { merlinOptions } from '../../../shared/faceTrackingProtocol';
import { FACE_GEOMETRY_VFOV } from '../../../shared/facePoseMath';

/** Separate post-key overlay: costume pixels never pass through the chroma matte. */
export function drawTracking(canvas: HTMLCanvasElement, pose: FacePose | null, settings: TrackingSettings, mirror: boolean, width: number, height: number) {
  const diagnostics = merlinOptions(settings);
  if (!pose || !settings.enabled || (!settings.hat && !settings.markers && !diagnostics.enabled)) {
    releaseTrackingCanvas(canvas);
    return;
  }
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Tracking overlay canvas is unavailable.');
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  if (mirror) { ctx.translate(width, 0); ctx.scale(-1, 1); }
  if (settings.hat && !diagnostics.enabled) {
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
  if (settings.markers && !diagnostics.enabled) {
    for (const [point, color] of [[pose.nose, '#ff6e9a'], [pose.forehead, '#57efff'], [pose.chin, '#ffdb5c']] as const) {
      ctx.beginPath(); ctx.arc(point.x * width, point.y * height, Math.max(2, width * .004), 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#102035'; ctx.lineWidth = 1; ctx.stroke();
    }
  }
  ctx.restore();
  if (diagnostics.enabled) {
    // Draw labels after mirroring so text remains readable in either camera mode.
    const font = Math.max(14, Math.round(width / 80));
    ctx.font = `${font}px sans-serif`;
    ctx.lineWidth = 2;
    if (diagnostics.referencePoints) {
      for (const [name, point, color] of [
        ['nose', pose.nose, '#ff6e9a'], ['chin', pose.chin, '#ffdb5c'],
        ['temple 127', pose.leftTemple, '#57efff'], ['temple 356', pose.rightTemple, '#57efff'],
      ] as const) {
        if (!point) continue;
        const x = (mirror ? 1 - point.x : point.x) * width, y = point.y * height;
        ctx.beginPath(); ctx.arc(x, y, font * .5, 0, Math.PI * 2);
        ctx.strokeStyle = color; ctx.stroke();
        ctx.fillStyle = '#102035'; ctx.fillRect(x + font * .6, y - font, ctx.measureText(name).width + 8, font + 5);
        ctx.fillStyle = color; ctx.fillText(name, x + font * .6 + 4, y);
      }
    }
    const mode = diagnostics.hairRoots || diagnostics.pitchCompensation || diagnostics.residualRegistration
      || diagnostics.springMotion || diagnostics.jawMotion ? 'COMPENSATIONS ENABLED' : 'RIGID';
    const info = `${mode} · ${FACE_GEOMETRY_VFOV}° virtual FOV · ${mirror ? 'mirrored' : 'unmirrored'} · head z ${pose.matrix[14].toFixed(1)} cm`;
    const textWidth = Math.min(width - 32, ctx.measureText(info).width);
    const left = (width - textWidth) / 2;
    ctx.fillStyle = '#102035'; ctx.fillRect(left - 8, 8, textWidth + 16, font + 16);
    ctx.fillStyle = '#ffffff'; ctx.fillText(info, left, font + 12, width - 32);
  }
}

/** Clear stale accessories and release the full-resolution backing store. */
export function releaseTrackingCanvas(canvas: HTMLCanvasElement | null) {
  if (canvas && (canvas.width !== 1 || canvas.height !== 1)) { canvas.width = 1; canvas.height = 1; }
}
