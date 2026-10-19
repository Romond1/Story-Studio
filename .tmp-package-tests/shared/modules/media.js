"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectModuleAssets = collectModuleAssets;
exports.remapModuleAssets = remapModuleAssets;
/** Visit only declared schema fields. Display text never becomes a dependency. */
function visit(activity, fn) {
    const media = (object, key, path, kind = 'image') => { if (typeof object[key] === 'string' && /^(asset:|builtin:)/.test(object[key]))
        object[key] = fn(object[key], `${path}/${key}`, kind); };
    if (activity.moduleType === 'language-snake') {
        const c = activity.config;
        media(c, 'backgroundImage', '/config');
        media(c, 'music', '/config', 'audio');
        for (const key of Object.keys(c.sounds ?? {}))
            media(c.sounds, key, '/config/sounds', 'audio');
    }
    if (activity.moduleType === 'final-boss-hero') {
        const c = activity.config, e = c.encounter;
        media(e, 'background', '/config/encounter');
        for (const key of Object.keys(e.gameBackgrounds ?? {}))
            media(e.gameBackgrounds, key, '/config/encounter/gameBackgrounds');
        for (const side of ['hero', 'villain']) {
            media(e[side], 'portrait', `/config/encounter/${side}`);
            media(e[side], 'video', `/config/encounter/${side}`, 'video');
        }
        e.introSetup.heroes.forEach((h, i) => { media(h, 'portrait', `/config/encounter/introSetup/heroes/${i}`); media(h, 'video', `/config/encounter/introSetup/heroes/${i}`, 'video'); });
        e.cutscenes.forEach((c, i) => media(c, 'mediaSource', `/config/encounter/cutscenes/${i}`, c.mediaType));
        for (const key of ['rewards', 'powerUps'])
            e[key].forEach((r, i) => media(r, 'icon', `/config/encounter/${key}/${i}`));
        c.cardLibrary.forEach((c, i) => { for (const key of ['image', 'frontImage', 'backImage'])
            media(c, key, `/config/cardLibrary/${i}`); });
    }
}
function collectModuleAssets(activity) { const result = []; visit(JSON.parse(JSON.stringify(activity)), (ref, field, mediaType) => { result.push({ ref, ...(ref.startsWith('asset:') ? { assetId: ref.slice(6) } : {}), field, mediaType }); return ref; }); return result; }
function remapModuleAssets(activity, map) { const result = JSON.parse(JSON.stringify(activity)); visit(result, (ref, field) => map(ref, field)); return result; }
