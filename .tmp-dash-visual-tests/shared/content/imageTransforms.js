"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateImageTransform = validateImageTransform;
exports.validateImagePresentation = validateImagePresentation;
exports.imageTransformLayout = imageTransformLayout;
exports.adjustImagePixel = adjustImagePixel;
exports.transformImagePixels = transformImagePixels;
exports.canonicalImageTransform = canonicalImageTransform;
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const number = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const check = (value, field) => { if (!value)
    throw new Error(`Invalid image ${field}`); };
const keys = (value, allowed, field) => check(Object.keys(value).every(key => allowed.includes(key)), `${field} field`);
function validateImageTransform(value) {
    check(object(value), 'transform');
    const t = value;
    keys(t, ['version', 'crop', 'flipX', 'rotation', 'brightness', 'contrast', 'saturation'], 'transform');
    check(t.version === 1, 'transform version');
    if (t.crop !== undefined) {
        check(object(t.crop), 'crop');
        const c = t.crop;
        keys(c, ['x', 'y', 'width', 'height'], 'crop');
        check(number(c.x, 0, 1) && number(c.y, 0, 1) && number(c.width, Number.MIN_VALUE, 1) && number(c.height, Number.MIN_VALUE, 1) && c.x + c.width <= 1 && c.y + c.height <= 1, 'crop bounds');
    }
    check(t.flipX === undefined || typeof t.flipX === 'boolean', 'flipX');
    check(t.rotation === undefined || [0, 90, 180, 270].includes(t.rotation), 'rotation');
    for (const field of ['brightness', 'contrast', 'saturation'])
        check(t[field] === undefined || number(t[field], 0, 2), field);
}
function validateImagePresentation(value) {
    check(object(value), 'presentation');
    const p = value;
    keys(p, ['fit', 'aspectRatio', 'focalX', 'focalY'], 'presentation');
    check(p.fit === 'cover' || p.fit === 'contain', 'fit');
    check(p.aspectRatio === undefined || number(p.aspectRatio, .01, 100), 'aspectRatio');
    for (const field of ['focalX', 'focalY'])
        check(p[field] === undefined || number(p[field], 0, 1), field);
}
function imageTransformLayout(width, height, transform, presentation) {
    validateImageTransform(transform);
    validateImagePresentation(presentation);
    check(Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width * height <= 16000000, 'source pixel limit');
    const c = transform.crop ?? { x: 0, y: 0, width: 1, height: 1 };
    const x = Math.floor(c.x * width), y = Math.floor(c.y * height);
    const crop = { x, y, width: Math.ceil((c.x + c.width) * width) - x, height: Math.ceil((c.y + c.height) * height) - y };
    const swap = transform.rotation === 90 || transform.rotation === 270;
    const rotated = { width: swap ? crop.height : crop.width, height: swap ? crop.width : crop.height };
    const output = { width: rotated.width, height: presentation.aspectRatio ? Math.max(1, Math.round(rotated.width / presentation.aspectRatio)) : rotated.height };
    check(output.width <= 4096 && output.height <= 4096 && output.width * output.height <= 8000000, 'output pixel limit');
    const scale = (presentation.fit === 'cover' ? Math.max : Math.min)(output.width / rotated.width, output.height / rotated.height);
    const drawWidth = rotated.width * scale, drawHeight = rotated.height * scale;
    return { crop, rotated, output, draw: { x: (output.width - drawWidth) * (presentation.focalX ?? .5), y: (output.height - drawHeight) * (presentation.focalY ?? .5), width: drawWidth, height: drawHeight } };
}
/** sRGB channel math: brightness, contrast around 0.5, Rec.709 luma saturation; round/clamp once, preserve alpha. */
function adjustImagePixel(r, g, b, a, transform) {
    const brightness = transform.brightness ?? 1, contrast = transform.contrast ?? 1, saturation = transform.saturation ?? 1;
    const channels = [r, g, b].map(value => ((value / 255 * brightness) - .5) * contrast + .5);
    const luma = .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
    const [red, green, blue] = channels.map(value => Math.max(0, Math.min(255, Math.round((luma + (value - luma) * saturation) * 255))));
    return [red, green, blue, a];
}
/** Deterministic nearest-neighbor evaluation shared by Canvas decode/encode and pixel fixtures. */
function transformImagePixels(source, transform, presentation) {
    const { crop, rotated, output, draw } = imageTransformLayout(source.width, source.height, transform, presentation);
    check(source.data instanceof Uint8ClampedArray && source.data.length === source.width * source.height * 4, 'RGBA buffer');
    const data = new Uint8ClampedArray(output.width * output.height * 4);
    for (let y = 0; y < output.height; y++)
        for (let x = 0; x < output.width; x++) {
            const rx = Math.floor((x + .5 - draw.x) / draw.width * rotated.width), ry = Math.floor((y + .5 - draw.y) / draw.height * rotated.height);
            if (rx < 0 || ry < 0 || rx >= rotated.width || ry >= rotated.height)
                continue;
            let cx = rx, cy = ry;
            switch (transform.rotation ?? 0) {
                case 90:
                    cx = ry;
                    cy = crop.height - 1 - rx;
                    break;
                case 180:
                    cx = crop.width - 1 - rx;
                    cy = crop.height - 1 - ry;
                    break;
                case 270:
                    cx = crop.width - 1 - ry;
                    cy = rx;
                    break;
            }
            if (transform.flipX)
                cx = crop.width - 1 - cx;
            const from = ((crop.y + cy) * source.width + crop.x + cx) * 4, to = (y * output.width + x) * 4;
            data.set(adjustImagePixel(source.data[from], source.data[from + 1], source.data[from + 2], source.data[from + 3], transform), to);
        }
    return { ...output, data };
}
function canonicalImageTransform(transform, presentation) {
    validateImageTransform(transform);
    validateImagePresentation(presentation);
    return JSON.stringify({ version: 1, crop: transform.crop ? { x: transform.crop.x, y: transform.crop.y, width: transform.crop.width, height: transform.crop.height } : { x: 0, y: 0, width: 1, height: 1 }, flipX: transform.flipX ?? false, rotation: transform.rotation ?? 0, brightness: transform.brightness ?? 1, contrast: transform.contrast ?? 1, saturation: transform.saturation ?? 1, presentation: { fit: presentation.fit, aspectRatio: presentation.aspectRatio ?? null, focalX: presentation.focalX ?? .5, focalY: presentation.focalY ?? .5 } });
}
