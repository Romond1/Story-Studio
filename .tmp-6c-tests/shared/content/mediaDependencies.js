"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILTIN_MOVEMENT_PATHS = void 0;
exports.collectMediaDependencies = collectMediaDependencies;
const mediaResolution_1 = require("./mediaResolution");
exports.BUILTIN_MOVEMENT_PATHS = Object.freeze(['assets/touch_color.gif', 'assets/run.gif', 'assets/hero_pose_mia.gif', 'assets/hero_pose_yuki.gif', 'assets/touch_head.gif', 'assets/touch_nose.gif', 'assets/jingle.mp3']);
const pointer = (key) => key.replace(/~/g, '~0').replace(/\//g, '~1');
/** Enumerate schema-owned fields, never scan arbitrary strings for filenames. */
function collectMediaDependencies(document, lookup) {
    const uses = [], issues = [];
    let complete = true;
    const issue = (ownerId, field, kind, value) => { issues.push({ ownerId, field, kind, value }); if (kind !== 'builtin')
        complete = false; };
    const id = (ownerType, ownerId, field, value) => {
        if (!value)
            return;
        if (lookup.get(value))
            uses.push({ assetId: value, ownerType, ownerId, field });
        else
            issue(ownerId, field, lookup.has(value) ? 'ambiguous-id' : 'missing-id', value);
    };
    const path = (ownerType, ownerId, field, value, builtin = false) => {
        if (!value)
            return;
        if (/^data:/i.test(value))
            return issue(ownerId, field, 'embedded-data', value);
        if (/^(https?:)?\/\//i.test(value))
            return issue(ownerId, field, 'external-url', value);
        const canonical = (0, mediaResolution_1.canonicalMediaPath)(value);
        if (builtin && canonical && exports.BUILTIN_MOVEMENT_PATHS.includes(canonical))
            return issue(ownerId, field, 'builtin', value);
        const result = lookup.resolvePath(value);
        if (result.ok)
            uses.push({ assetId: result.assetId, ownerType, ownerId, field });
        else
            issue(ownerId, field, result.code === 'ambiguous' ? 'ambiguous-path' : canonical ? 'unregistered-local' : 'unknown-content', value);
    };
    const link = (ownerId, field, value, exists) => { if (value && !exists)
        issue(ownerId, field, 'missing-id', value); };
    const unknown = (value, keys, ownerId, base) => { for (const key of Object.keys(value))
        if (!keys.includes(key))
            issue(ownerId, `${base}/${pointer(key)}`, 'unknown-content', key); };
    const clip = (value, owner, base) => { if (value)
        unknown(value, ['url', 'volume', 'name', 'shortcut', 'color', 'fadeEnabled', 'tags'], owner, base); };
    const cards = (definitions, base) => Object.entries(definitions).forEach(([key, card]) => {
        const p = `${base}/${pointer(key)}`;
        unknown(card, ['id', 'label', 'tags', 'faces', 'style', 'template'], card.id, p);
        card.faces.forEach((face, i) => { id('card', card.id, `${p}/faces/${i}/imageAssetId`, face.imageAssetId); unknown(face, ['id', 'label', 'layout', 'text', 'supportingText', 'imageAssetId', 'alt', 'emphasis', 'style'], card.id, `${p}/faces/${i}`); });
    });
    const sets = (items, base, definitions) => items.forEach((set, i) => set.entries.forEach((entry, j) => link(set.id, `${base(i)}/entries/${j}/cardId`, entry.cardId, !!definitions[entry.cardId])));
    if (document.format === 'scene') {
        const data = document.data;
        unknown(data, ['format', 'version', 'id', 'title', 'createdAt', 'updatedAt', 'assets', 'mediaBins', 'scenes', 'sequences', 'sections', 'cards', 'library', 'cardSets', ...(data.format === 'story-studio-episode' ? ['adventure', 'requiredCapabilities', 'derivedImages', 'catalog'] : [])], data.id, '');
        if (data.format === 'story-studio-episode') {
            data.derivedImages.forEach((image, i) => { id('derived', image.id, `/derivedImages/${i}/sourceAssetId`, image.sourceAssetId); if (!data.assets.some(asset => asset.id === image.sourceAssetId && asset.mediaType === 'image'))
                issue(image.id, `/derivedImages/${i}/sourceAssetId`, 'unknown-content', 'Derived source must be a physical image'); });
            data.catalog.entities.forEach((entity, i) => entity.assetIds.forEach((assetId, j) => id('entity', entity.id, `/catalog/entities/${i}/assetIds/${j}`, assetId)));
        }
        cards(data.cards, '/cards');
        sets(data.cardSets, i => `/cardSets/${i}`, data.cards);
        data.library.forEach((cardId, i) => link(data.id, `/library/${i}`, cardId, !!data.cards[cardId]));
        Object.entries(data.scenes).forEach(([key, scene]) => {
            const p = `/scenes/${pointer(key)}`;
            unknown(scene, ['id', 'title', 'frame', 'background', 'objects', 'drawings', 'audio', 'transition', 'viewport', 'notes'], scene.id, p);
            id('scene', scene.id, `${p}/background/assetId`, scene.background.assetId);
            unknown(scene.background, ['color', 'assetId'], scene.id, `${p}/background`);
            scene.audio.forEach((audio, i) => { id('scene', scene.id, `${p}/audio/${i}/assetId`, audio.assetId); unknown(audio, ['id', 'assetId', 'volume', 'loop', 'autoplay'], scene.id, `${p}/audio/${i}`); });
            scene.objects.forEach((object, i) => {
                const op = `${p}/objects/${i}`;
                unknown(object, ['id', 'box', 'visible', 'kind', ...(object.kind === 'card' ? ['cardId', 'initialFaceId', 'initiallyConcealed', 'interaction'] : object.kind === 'image' ? ['assetId'] : ['text', 'fontSize', 'color', 'bubbleDefId', 'align'])], scene.id, op);
                if (object.kind === 'image')
                    id('scene', scene.id, `${op}/assetId`, object.assetId);
                else if (object.kind === 'card') {
                    link(scene.id, `${op}/cardId`, object.cardId, !!data.cards[object.cardId]);
                    link(scene.id, `${op}/initialFaceId`, object.initialFaceId, !!data.cards[object.cardId]?.faces.some(face => face.id === object.initialFaceId));
                }
                else if (object.kind !== 'text' && object.kind !== 'bubble')
                    issue(scene.id, op, 'unknown-content', String(object.kind));
            });
        });
        for (const sequence of ['story', 'activation'])
            data.sequences[sequence].forEach((entry, i) => link(entry.id, `/sequences/${sequence}/${i}/sceneId`, entry.sceneId, !!data.scenes[entry.sceneId]));
    }
    else {
        const data = document.data;
        unknown(data, ['version', 'createdAt', 'updatedAt', 'slides', 'assets', 'sections', 'boostPack', 'bubbleDefinitions', 'sparkConfig', 'badgeConfig', 'badgeImageAssetId', 'sparkStudents', 'activeStudentId', 'relicSystem', 'movement', 'aCardLibrary', 'bCardLibrary', 'mediaBins', 'cardsV2'], 'project', '');
        const instances = (items, owner, base) => items?.forEach((item, i) => link(owner, `${base}/${i}/bCardId`, item.bCardId, !!data.bCardLibrary?.[item.bCardId]));
        const sequence = (items, base) => items?.forEach((item, i) => {
            const p = `${base}/${i}`;
            instances(item.bCardInstances, item.id, `${p}/bCardInstances`);
            const keys = { slideRef: ['independentCopyOf', 'slideId', 'viewOverride'], breakRef: ['breakId', 'textOverride'], aCardRef: ['aCardId'], cardActivityRef: ['engine', 'placementId'], miniGame: ['gameType', 'config'], promptCard: ['title', 'body', 'durationMs'] };
            unknown(item, ['id', 'type', 'cardPlacementId', 'bCardInstances', ...(keys[item.type] ?? [])], item.id, p);
            link(item.id, `${p}/cardPlacementId`, item.cardPlacementId, !!data.cardsV2?.placements[item.cardPlacementId ?? '']);
            if (item.type === 'slideRef')
                link(item.id, `${p}/slideId`, item.slideId, data.slides.some(slide => slide.id === item.slideId));
            else if (item.type === 'breakRef')
                link(item.id, `${p}/breakId`, item.breakId, data.sections.some(section => section.id === item.breakId));
            else if (item.type === 'aCardRef')
                link(item.id, `${p}/aCardId`, item.aCardId, !!data.aCardLibrary?.[item.aCardId]);
            else if (item.type === 'cardActivityRef')
                link(item.id, `${p}/placementId`, item.placementId, !!data.cardsV2?.placements[item.placementId]);
            else if (item.type === 'miniGame')
                issue(item.id, `${p}/config`, 'unknown-content', item.gameType);
            else if (item.type !== 'promptCard')
                issue(item.id, p, 'unknown-content', String(item.type));
        });
        data.slides.forEach((slide, i) => {
            const p = `/slides/${i}`;
            id('slide', slide.id, `${p}/assetId`, slide.assetId);
            unknown(slide, ['cardPlacementId', 'id', 'assetId', 'sectionId', 'name', 'transition', 'transitionDuration', 'transitionDirection', 'markerStrokes', 'dialogue', 'sfx', 'bgm', 'videoAudio', 'videoTrim', 'imageAdjustments', 'tags', 'overlays', 'audioCues', 'bCardInstances', 'storyReferences'], slide.id, p);
            for (const key of ['dialogue', 'sfx'])
                slide[key]?.forEach((audio, j) => { path('slide', slide.id, `${p}/${key}/${j}/url`, audio.url); clip(audio, slide.id, `${p}/${key}/${j}`); });
            path('slide', slide.id, `${p}/bgm/url`, slide.bgm?.url);
            clip(slide.bgm, slide.id, `${p}/bgm`);
            slide.audioCues?.forEach((cue, j) => unknown(cue, ['id', 'kind', 'label', 'timeSec', 'targetAssetId', 'targetUrl', 'volume', 'fadeMs', 'tags'], slide.id, `${p}/audioCues/${j}`));
            slide.audioCues?.forEach((cue, j) => { id('slide', slide.id, `${p}/audioCues/${j}/targetAssetId`, cue.targetAssetId); path('slide', slide.id, `${p}/audioCues/${j}/targetUrl`, cue.targetUrl); });
            slide.overlays?.forEach((overlay, j) => path('bubble', overlay.id, `${p}/overlays/${j}/customImageSrc`, overlay.customImageSrc));
            slide.overlays?.forEach((overlay, j) => unknown(overlay, ['id', 'type', 'text', 'x', 'y', 'width', 'height', 'align', 'theme', 'visible', 'zIndex', 'bubbleId', 'bubbleDefId', 'locked', 'fontFamily', 'fontSize', 'fontWeight', 'textColor', 'flipX', 'flipY', 'lineHeight', 'fontStyle', 'textShadow', 'tailAngleDeg', 'tailOffsetX', 'tailOffsetY', 'textRect', 'tags', 'customImageSrc'], overlay.id, `${p}/overlays/${j}`));
            instances(slide.bCardInstances, slide.id, `${p}/bCardInstances`);
            sequence(slide.storyReferences, `${p}/storyReferences`);
            link(slide.id, `${p}/cardPlacementId`, slide.cardPlacementId, !!data.cardsV2?.placements[slide.cardPlacementId ?? '']);
        });
        data.sections.forEach((section, i) => {
            const p = `/sections/${i}`;
            unknown(section, ['cardPlacementId', 'id', 'name', 'type', 'questions', 'timer', 'timerMode', 'timerDuration', 'thumbnailSize', 'font', 'fontSize', 'isBold', 'isItalic', 'align', 'position', 'background', 'backgroundOpacity', 'breakMedia', 'markerStrokes', 'bgm', 'breakViewport', 'bgTransform', 'titleFontSize', 'timerSize', 'tags', 'bCardInstances', 'storyReferences'], section.id, p);
            if (section.background) {
                const match = /^url\(\s*(['"]?)(.*?)\1\s*\)$/.exec(section.background);
                if (match)
                    path('section', section.id, `${p}/background`, match[2]);
                else if (/^(media:|assets[\\/]|https?:|data:)/i.test(section.background))
                    path('section', section.id, `${p}/background`, section.background);
                else if (/url\(/i.test(section.background))
                    issue(section.id, `${p}/background`, 'unknown-content', section.background);
            }
            section.bgm?.forEach((audio, j) => { path('section', section.id, `${p}/bgm/${j}/url`, audio.url); clip(audio, section.id, `${p}/bgm/${j}`); });
            section.breakMedia?.forEach((media, j) => link(section.id, `${p}/breakMedia/${j}/slideId`, media.slideId, data.slides.some(slide => slide.id === media.slideId)));
            instances(section.bCardInstances, section.id, `${p}/bCardInstances`);
            sequence(section.storyReferences, `${p}/storyReferences`);
            link(section.id, `${p}/cardPlacementId`, section.cardPlacementId, !!data.cardsV2?.placements[section.cardPlacementId ?? '']);
        });
        for (const key of ['activationSequence', 'languageSequence', 'gamesSequence'])
            sequence(data.boostPack?.[key], `/boostPack/${key}`);
        Object.entries(data.aCardLibrary ?? {}).forEach(([key, card]) => { const p = `/aCardLibrary/${pointer(key)}`; id('card', card.id, `${p}/background/imageId`, card.background.imageId); instances(card.bCardInstances, card.id, `${p}/bCardInstances`); });
        Object.entries(data.bCardLibrary ?? {}).forEach(([key, card]) => { const p = `/bCardLibrary/${pointer(key)}`; for (const side of ['front', 'back'])
            id('card', card.id, `${p}/${side}/imageId`, card[side].imageId); id('card', card.id, `${p}/audioRefId`, card.audioRefId); });
        Object.entries(data.aCardLibrary ?? {}).forEach(([key, card]) => {
            const p = `/aCardLibrary/${pointer(key)}`;
            unknown(card, ['id', 'name', 'stageMode', 'background', 'title', 'questions', 'font', 'fontSize', 'titleFontSize', 'timerSize', 'textColor', 'isBold', 'isItalic', 'align', 'position', 'timer', 'timerMode', 'timerDuration', 'bCardInstances'], card.id, p);
            unknown(card.background, ['mode', 'color', 'gradientStart', 'gradientEnd', 'gradientDirection', 'imageId', 'offsetX', 'offsetY', 'scale', 'blur'], card.id, `${p}/background`);
        });
        Object.entries(data.bCardLibrary ?? {}).forEach(([key, card]) => {
            const p = `/bCardLibrary/${pointer(key)}`;
            unknown(card, ['id', 'name', 'front', 'back', 'audioRefId', 'animationPreset'], card.id, p);
            for (const side of ['front', 'back'])
                unknown(card[side], ['imageId', 'text', 'backgroundColor', 'textStyle', 'emoji'], card.id, `${p}/${side}`);
        });
        data.bubbleDefinitions?.forEach((bubble, i) => path('bubble', bubble.templateName, `/bubbleDefinitions/${i}/imageSrc`, bubble.imageSrc));
        data.bubbleDefinitions?.forEach((bubble, i) => unknown(bubble, ['templateName', 'imageSrc', 'defaultTextRect'], bubble.templateName, `/bubbleDefinitions/${i}`));
        id('reward', 'badge', '/badgeImageAssetId', data.badgeImageAssetId);
        for (const key of ['background', 'tabBackground'])
            id('reward', 'badge', `/badgeConfig/${key}/assetId`, data.badgeConfig?.[key]?.assetId);
        if (data.badgeConfig) {
            unknown(data.badgeConfig, ['congratsText', 'showStudentName', 'showFinalScore', 'alwaysDisplay', 'fontSize', 'celebrationDurationMs', 'confettiCount', 'background', 'tabBackground', 'animation', 'previewShield', 'badgeSprites', 'badgeSparkAssetIds', 'badgeSpriteMotion', 'badgeSpriteAnimDurationMs', 'badgeSpriteAnimIntensity'], 'badge', '/badgeConfig');
            for (const key of ['background', 'tabBackground']) {
                const value = data.badgeConfig[key];
                if (value)
                    unknown(value, ['assetId', 'posX', 'posY', 'scale', 'blur', 'brightness'], 'badge', `/badgeConfig/${key}`);
            }
            if (data.badgeConfig.badgeSparkAssetIds)
                unknown(data.badgeConfig.badgeSparkAssetIds, ['gold', 'blue', 'pink', 'crown'], 'badge', '/badgeConfig/badgeSparkAssetIds');
            data.badgeConfig.badgeSprites?.forEach((sprite, i) => unknown(sprite, ['id', 'studentId', 'x', 'y', 'width', 'height', 'zIndex', 'variant', 'assetId'], sprite.id, `/badgeConfig/badgeSprites/${i}`));
        }
        for (const key of ['gold', 'blue', 'pink', 'crown'])
            id('reward', 'badge', `/badgeConfig/badgeSparkAssetIds/${key}`, data.badgeConfig?.badgeSparkAssetIds?.[key]);
        data.badgeConfig?.badgeSprites?.forEach((sprite, i) => id('reward', sprite.id, `/badgeConfig/badgeSprites/${i}/assetId`, sprite.assetId));
        id('relic', 'relic', '/relicSystem/mainImageAssetId', data.relicSystem?.mainImageAssetId);
        if (data.relicSystem) {
            unknown(data.relicSystem, ['enabled', 'relicTitle', 'relicDescription', 'mainImageAssetId', 'stageImageAssetIds', 'stageTitles', 'studentProgress', 'showOnStage', 'widgetPosition', 'widgetOffset', 'widgetScale', 'widgetOpacity', 'animationStyle', 'animationDurationMs', 'animationIntensity', 'rgbFlowEnabled', 'widgetEntranceAnimation', 'hotkeys', 'animateOnProgress', 'animateOnStageChange', 'animateOnComplete'], 'relic', '/relicSystem');
            if (data.relicSystem.stageImageAssetIds)
                unknown(data.relicSystem.stageImageAssetIds, ['stage1', 'stage2', 'stage3'], 'relic', '/relicSystem/stageImageAssetIds');
        }
        for (const key of ['stage1', 'stage2', 'stage3'])
            id('relic', 'relic', `/relicSystem/stageImageAssetIds/${key}`, data.relicSystem?.stageImageAssetIds?.[key]);
        path('movement', 'movement', '/movement/jingleRelativePath', data.movement?.jingleRelativePath, true);
        if (data.movement)
            unknown(data.movement, ['randomEnabled', 'randomShortcut', 'jingleEnabled', 'jingleVolume', 'jingleRelativePath', 'events', 'deletedEventIds'], 'movement', '/movement');
        data.movement?.events.forEach((event, i) => path('movement', event.id, `/movement/events/${i}/gifRelativePath`, event.gifRelativePath, true));
        data.movement?.events.forEach((event, i) => unknown(event, ['id', 'name', 'instruction', 'enabled', 'shortcut', 'durationSeconds', 'animation', 'gifRelativePath', 'overlayOpacity', 'ringSpeedSeconds', 'intensity', 'primaryColor', 'secondaryColor', 'accentColor', 'gifScale', 'soundId'], event.id, `/movement/events/${i}`));
        const module = data.cardsV2;
        if (module) {
            if (module.engine !== 'card-v2' || module.version !== 1)
                issue('cardsV2', '/cardsV2', 'unknown-content', 'unsupported module');
            else {
                unknown(module, ['engine', 'version', 'cards', 'sets', 'activities', 'placements'], 'cardsV2', '/cardsV2');
                cards(module.cards, '/cardsV2/cards');
                const entries = Object.entries(module.sets);
                sets(entries.map(([, set]) => set), i => `/cardsV2/sets/${pointer(entries[i][0])}`, module.cards);
                Object.entries(module.activities).forEach(([key, activity]) => { const p = `/cardsV2/activities/${pointer(key)}`; link(activity.id, `${p}/setId`, activity.setId, !!module.sets[activity.setId ?? '']); activity.instances.forEach((instance, i) => { link(activity.id, `${p}/instances/${i}/cardId`, instance.cardId, !!module.cards[instance.cardId]); for (const face of ['initialFaceId', 'revealFaceId'])
                    link(activity.id, `${p}/instances/${i}/${face}`, instance[face], !!module.cards[instance.cardId]?.faces.some(f => f.id === instance[face])); }); });
                Object.entries(module.placements).forEach(([key, placement]) => link(placement.id, `/cardsV2/placements/${pointer(key)}/activityId`, placement.activityId, !!module.activities[placement.activityId]));
                Object.entries(module.activities).forEach(([key, activity]) => {
                    const p = `/cardsV2/activities/${pointer(key)}`;
                    unknown(activity, ['id', 'type', 'label', 'setId', 'frame', 'instances', 'allowCycling', 'allowDirectFace', 'circularCycling'], activity.id, p);
                    if (activity.type !== 'recall-reveal')
                        issue(activity.id, `${p}/type`, 'unknown-content', String(activity.type));
                    activity.instances.forEach((instance, i) => unknown(instance, ['style', 'id', 'cardId', 'geometry', 'initialFaceId', 'revealFaceId', 'initiallyConcealed', 'role'], activity.id, `${p}/instances/${i}`));
                });
                Object.entries(module.placements).forEach(([key, placement]) => unknown(placement, ['id', 'activityId', 'label'], placement.id, `/cardsV2/placements/${pointer(key)}`));
            }
        }
    }
    return { uses, issues, complete };
}
