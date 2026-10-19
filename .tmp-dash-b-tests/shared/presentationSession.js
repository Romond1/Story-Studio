"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPresentationSession = createPresentationSession;
exports.reducePresentationSession = reducePresentationSession;
exports.resolvePresentationTarget = resolvePresentationTarget;
exports.navigatePresentation = navigatePresentation;
exports.presentationToken = presentationToken;
exports.targetMatches = targetMatches;
exports.applyPresentationViewport = applyPresentationViewport;
exports.applyPresentationDrawing = applyPresentationDrawing;
function createPresentationSession(sessionId) {
    return { sessionId, projectId: null, revision: 0, targetRevision: 0, mode: 'story', storySlideId: null, sectionId: null, boostTab: 'activation', boostItemId: null, boardId: null, storyCheckpoint: null, overlays: { movement: null } };
}
function reducePresentationSession(session, command) {
    if (command.type === 'movement') {
        return command.value === session.overlays.movement ? session : { ...session, overlays: { ...session.overlays, movement: command.value }, revision: session.revision + 1 };
    }
    if (command.type === 'project') {
        // Never reuse a revision, including when reopening the same project folder.
        return { ...createPresentationSession(session.sessionId), projectId: command.projectId, storySlideId: command.slideId, sectionId: command.sectionId, revision: session.revision + 1, targetRevision: session.targetRevision + 1 };
    }
    const keys = Object.keys(command.changes);
    if (!keys.some(key => command.changes[key] !== session[key]))
        return session;
    const next = { ...session, ...command.changes, revision: session.revision + 1, targetRevision: session.targetRevision + 1 };
    if (session.mode !== 'boost' && next.mode === 'boost' && !session.storyCheckpoint) {
        next.storyCheckpoint = { storySlideId: session.storySlideId, sectionId: session.sectionId };
    }
    if (['story', 'movement', 'relics'].includes(next.mode) && session.storyCheckpoint) {
        // The checkpoint is independent of any hidden editor selection while boosting.
        next.storySlideId = session.storyCheckpoint.storySlideId;
        next.sectionId = session.storyCheckpoint.sectionId;
        next.storyCheckpoint = null;
    }
    return next;
}
function resolvePresentationTarget(data, session) {
    const target = {
        kind: 'empty', contentId: null, occurrenceId: JSON.stringify([session.mode, session.boostTab, session.boostItemId, session.sectionId, session.storySlideId, session.boardId]),
        slide: null, section: null, board: null, item: null, sequence: [], sequenceIndex: -1,
        drawingTarget: null, capabilities: { canDraw: false, canZoom: false, canNavigate: false },
    };
    if (!data || !session.projectId)
        return target;
    const useSlide = (id) => {
        const slide = data.slides.find(candidate => candidate.id === id);
        if (!slide)
            return false;
        target.slide = slide;
        target.section = data.sections.find(section => section.id === slide.sectionId) ?? null;
        target.drawingTarget = { kind: 'slide', id };
        return true;
    };
    const useBreak = (id) => {
        const section = data.sections.find(candidate => candidate.id === id && candidate.type === 'break');
        if (!section)
            return false;
        target.section = section;
        target.drawingTarget = { kind: 'break', id };
        return true;
    };
    if (session.mode === 'story' || session.mode === 'relics' || session.mode === 'movement') {
        target.occurrenceId = JSON.stringify(['story', session.sectionId, session.storySlideId]);
        const section = data.sections.find(candidate => candidate.id === session.sectionId);
        if (section?.type === 'break') {
            useBreak(section.id);
            target.kind = 'break';
            target.contentId = section.id;
        }
        else if (session.storySlideId) {
            target.kind = useSlide(session.storySlideId) ? 'slide' : 'invalid';
            target.contentId = session.storySlideId;
            // Selecting an empty section historically leaves the last slide visible,
            // while the section controls follow the section the teacher selected.
            target.section = section ?? null;
        }
        else if (session.sectionId && !section) {
            target.kind = 'invalid';
        }
        else {
            target.section = section ?? null;
        }
        target.capabilities.canNavigate = data.slides.length > 0;
    }
    else if (session.mode === 'boost' && session.boostTab !== 'badge') {
        target.sequence = data.boostPack?.[`${session.boostTab}Sequence`] ?? [];
        target.sequenceIndex = target.sequence.findIndex(item => item.id === session.boostItemId);
        target.item = target.sequence[target.sequenceIndex] ?? null;
        target.occurrenceId = JSON.stringify(['boost', session.boostTab, session.boostItemId]);
        target.capabilities.canNavigate = target.sequence.length > 0;
        const item = target.item;
        if (!item)
            target.kind = session.boostItemId ? 'invalid' : 'empty';
        else if (item.type === 'slideRef') {
            target.contentId = item.slideId;
            target.kind = useSlide(item.slideId) ? 'slide' : 'invalid';
            // A slide imported into a break is still an individual slide when used
            // by a booster reference; do not make the renderer select its break.
            target.section = null;
        }
        else if (item.type === 'breakRef') {
            target.contentId = item.breakId;
            target.kind = useBreak(item.breakId) ? 'break' : 'invalid';
        }
        else if (item.type === 'cardActivityRef') {
            const placement = data.cardsV2?.placements[item.placementId];
            target.contentId = item.placementId;
            target.kind = item.engine === 'card-v2' && placement && data.cardsV2?.activities[placement.activityId] ? 'cards-v2' : 'invalid';
        }
        else if (item.type === 'aCardRef') {
            target.contentId = item.aCardId;
            target.board = data.aCardLibrary?.[item.aCardId] ?? null;
            target.kind = target.board ? 'board' : 'invalid';
            // Language boards retain the closest valid slide/break backdrop. Marker
            // storage remains on that content, not on the sequence occurrence.
            if (target.board && session.boostTab === 'language') {
                for (let index = target.sequenceIndex - 1; index >= 0; index--) {
                    const previous = target.sequence[index];
                    if (previous.type === 'slideRef' && useSlide(previous.slideId)) {
                        target.section = null;
                        break;
                    }
                    if (previous.type === 'breakRef' && useBreak(previous.breakId))
                        break;
                }
            }
        }
        else {
            target.contentId = item.id;
            target.kind = item.type === 'promptCard' ? 'prompt' : 'activity';
        }
    }
    else if (session.mode === 'badge' || (session.mode === 'boost' && session.boostTab === 'badge')) {
        target.kind = 'activity';
        target.contentId = 'badge';
        target.occurrenceId = JSON.stringify(['badge']);
    }
    else if (session.mode === 'boards') {
        target.occurrenceId = JSON.stringify(['boards', session.boardId]);
        target.contentId = session.boardId;
        target.board = session.boardId ? data.aCardLibrary?.[session.boardId] ?? null : null;
        target.kind = target.board ? 'board' : session.boardId ? 'invalid' : 'empty';
    }
    // Relic/movement side panels retain the story stage; badge owns its full stage.
    target.capabilities.canDraw = target.drawingTarget !== null;
    target.capabilities.canZoom = target.slide !== null || target.section?.type === 'break';
    // A project edit can retarget an occurrence or change a language backdrop
    // without moving the cursor. Reject work captured for its old destination.
    target.occurrenceId = JSON.stringify([target.occurrenceId, target.kind, target.contentId, target.drawingTarget]);
    return target;
}
function navigatePresentation(data, session, direction) {
    if (!data)
        return session;
    const target = resolvePresentationTarget(data, session);
    if (session.mode === 'boost') {
        if (target.sequenceIndex < 0)
            return session;
        const item = target.sequence[target.sequenceIndex + direction];
        return item ? reducePresentationSession(session, { type: 'select', changes: { boostItemId: item.id } }) : session;
    }
    if (session.mode !== 'story' && session.mode !== 'relics' && session.mode !== 'movement')
        return session;
    let slide;
    if (target.kind === 'break' && target.section) {
        const start = data.sections.findIndex(section => section.id === target.section.id);
        for (let index = start + direction; index >= 0 && index < data.sections.length; index += direction) {
            const slides = data.slides.filter(candidate => candidate.sectionId === data.sections[index].id);
            slide = direction === 1 ? slides[0] : slides[slides.length - 1];
            if (slide)
                break;
        }
    }
    else if (target.slide) {
        const index = data.slides.findIndex(candidate => candidate.id === target.slide.id);
        slide = data.slides[index + direction];
    }
    return slide ? reducePresentationSession(session, { type: 'select', changes: { storySlideId: slide.id, sectionId: slide.sectionId } }) : session;
}
function presentationToken(session, target) {
    return { sessionId: session.sessionId, projectId: session.projectId, revision: session.targetRevision, occurrenceId: target.occurrenceId };
}
function targetMatches(session, target, token) {
    return token.sessionId === session.sessionId && token.projectId === session.projectId && token.revision === session.targetRevision && token.occurrenceId === target.occurrenceId;
}
/** Volatile viewport handoff only; callers keep the returned value outside the document. */
function applyPresentationViewport(current, session, target, token, next) {
    return target.capabilities.canZoom && targetMatches(session, target, token) ? next : current;
}
function applyPresentationDrawing(data, session, token, strokes) {
    const target = resolvePresentationTarget(data, session);
    if (!targetMatches(session, target, token) || !target.capabilities.canDraw || !target.drawingTarget)
        return data;
    const destination = target.drawingTarget;
    const existing = destination.kind === 'slide' ? target.slide?.markerStrokes : target.section?.markerStrokes;
    if (existing === strokes || (!existing?.length && strokes.length === 0))
        return data;
    if (destination.kind === 'slide') {
        return { ...data, slides: data.slides.map(slide => slide.id === destination.id ? { ...slide, markerStrokes: strokes } : slide) };
    }
    return { ...data, sections: data.sections.map(section => section.id === destination.id ? { ...section, markerStrokes: strokes } : section) };
}
