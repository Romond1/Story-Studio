"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fitDashQuestion = fitDashQuestion;
/** Largest centered, contained image that avoids the live camera and caption rectangles. */
function fitDashQuestion(view, image, blockers, caption = 0) {
    const cx = view.left + view.width / 2, cy = view.top + view.height / 2;
    let scale = Math.min(view.width * .86 / image.width, (view.height * .76 - caption) / image.height);
    for (const b of blockers) {
        if (b.width * b.height > view.width * view.height * .8)
            continue;
        const dx = b.left > cx ? b.left - cx - 8 : b.left + b.width < cx ? cx - b.left - b.width - 8 : -1, dy = b.top > cy ? b.top - cy - 8 : b.top + b.height < cy ? cy - b.top - b.height - 8 : -1;
        scale = Math.min(scale, Math.max(dx > 0 ? dx * 2 / image.width : 0, dy > 0 ? (dy * 2 - caption) / image.height : 0));
    }
    scale = Math.max(.01, scale);
    return { width: Math.round(image.width * scale), height: Math.round(image.height * scale + caption) };
}
