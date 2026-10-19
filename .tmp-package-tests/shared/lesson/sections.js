"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateSections = migrateSections;
exports.addSection = addSection;
exports.renameSection = renameSection;
exports.moveEntryToSection = moveEntryToSection;
exports.insertBreak = insertBreak;
exports.timelineGroups = timelineGroups;
exports.moveSection = moveSection;
exports.moveTimelineEntries = moveTimelineEntries;
exports.timelineGroupBoundary = timelineGroupBoundary;
exports.insertSectionMedia = insertSectionMedia;
const model_1 = require("./model");
const commands_1 = require("./commands");
const limits_1 = require("./limits");
/** Preserve sequence and audio exactly while upgrading old display labels. */
function migrateSections(project) {
    if (project.sections)
        return project;
    const sections = [];
    const sequences = { ...project.sequences };
    for (const sequence of ['story', 'activation']) {
        let previous;
        sequences[sequence] = project.sequences[sequence].map(entry => {
            if (!entry.section.trim()) {
                previous = undefined;
                return entry;
            }
            let section = previous?.name === entry.section ? previous : undefined;
            if (!section) {
                section = { id: (0, model_1.makeId)(), name: entry.section, sequence };
                sections.push(section);
            }
            previous = section;
            return { ...entry, sectionId: section.id };
        });
    }
    return sections.length ? { ...project, sections, sequences } : project;
}
function addSection(project, sequence, name = 'New section') {
    project = migrateSections(project);
    if ((project.sections?.length ?? 0) >= limits_1.LESSON_LIMITS.sections)
        throw new Error(`This lesson can contain at most ${limits_1.LESSON_LIMITS.sections} sections.`);
    const sectionId = (0, model_1.makeId)();
    return { project: { ...project, sections: [...(project.sections ?? []), { id: sectionId, name: name.trim().slice(0, 500) || 'New section', sequence }] }, sectionId };
}
function renameSection(project, sectionId, name) {
    name = name.trim().slice(0, 500);
    if (!name)
        return project;
    return { ...project, sections: project.sections?.map(s => s.id === sectionId ? { ...s, name } : s),
        sequences: { story: project.sequences.story.map(e => e.sectionId === sectionId ? { ...e, section: name } : e), activation: project.sequences.activation.map(e => e.sectionId === sectionId ? { ...e, section: name } : e) } };
}
function moveEntryToSection(project, sequence, entryId, sectionId, beforeEntryId) {
    const section = project.sections?.find(s => s.id === sectionId && s.sequence === sequence);
    if (sectionId && !section)
        throw new Error('Section no longer exists in this sequence.');
    const original = project.sequences[sequence].find(e => e.id === entryId);
    if (!original || entryId === beforeEntryId)
        return project;
    const entries = project.sequences[sequence].filter(e => e.id !== entryId);
    let index = beforeEntryId ? entries.findIndex(e => e.id === beforeEntryId) : -1;
    if (index < 0) {
        const last = entries.map(e => e.sectionId).lastIndexOf(sectionId);
        if (last >= 0)
            index = last + 1;
        else {
            const groups = timelineGroups(project, sequence), groupIndex = groups.findIndex(g => g.sectionId === sectionId);
            const following = groups.slice(groupIndex + 1).flatMap(g => g.entries).find(e => e.id !== entryId);
            index = following ? entries.findIndex(e => e.id === following.id) : entries.length;
        }
    }
    entries.splice(index, 0, { ...original, sectionId, section: section?.name ?? '' });
    return { ...project, sequences: { ...project.sequences, [sequence]: entries } };
}
function insertBreak(project, sequence, beforeEntryId, sectionId) {
    const scene = (0, commands_1.createScene)('Break');
    scene.objects = [
        { kind: 'text', id: (0, model_1.makeId)(), visible: true, text: 'Review together', fontSize: 52, color: '#ffffff', align: 'center', box: { x: 160, y: 170, width: 960, height: 100 } },
        { kind: 'bubble', id: (0, model_1.makeId)(), visible: true, text: 'What do you remember? Share one idea with the class.', fontSize: 32, color: '#182331', align: 'center', box: { x: 230, y: 330, width: 820, height: 170 } },
    ];
    const added = (0, commands_1.insertScene)(project, sequence, scene, beforeEntryId);
    const inherited = sectionId ?? project.sequences[sequence].find(e => e.id === beforeEntryId)?.sectionId;
    let next = { ...added.project, sequences: { ...added.project.sequences, [sequence]: added.project.sequences[sequence].map(e => e.id === added.entryId ? { ...e, kind: 'break' } : e) } };
    if (inherited)
        next = moveEntryToSection(next, sequence, added.entryId, inherited, beforeEntryId);
    return { project: next, entryId: added.entryId };
}
/** Containers follow sequence order; disjoint legacy runs remain in place. */
function timelineGroups(project, sequence) {
    const groups = [];
    for (const entry of project.sequences[sequence]) {
        const previous = groups[groups.length - 1];
        if (previous && previous.sectionId === entry.sectionId)
            previous.entries.push(entry);
        else
            groups.push({ key: entry.id, sectionId: entry.sectionId, entries: [entry] });
    }
    const sections = project.sections?.filter(s => s.sequence === sequence) ?? [];
    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        if (groups.some(g => g.sectionId === section.id))
            continue;
        const nextIds = sections.slice(i + 1).map(s => s.id);
        const index = groups.findIndex(g => g.sectionId && nextIds.includes(g.sectionId));
        groups.splice(index < 0 ? groups.length : index, 0, { key: section.id, sectionId: section.id, entries: [] });
    }
    if (!groups.some(g => !g.sectionId))
        groups.push({ key: 'ungrouped', entries: [] });
    return groups;
}
/** One immutable transaction moves every child, keeping scene and entry identities. */
function moveSection(project, sequence, sectionId, beforeSectionId, beforeEntryId) {
    const all = project.sections?.filter(s => s.sequence === sequence) ?? [];
    const visualIds = [...new Set(timelineGroups(project, sequence).map(g => g.sectionId).filter((id) => !!id))];
    const own = visualIds.map(id => all.find(s => s.id === id)).filter((s) => !!s);
    if (!own.some(s => s.id === sectionId) || (beforeSectionId && !own.some(s => s.id === beforeSectionId)))
        throw new Error('Section no longer exists in this sequence.');
    if (sectionId === beforeSectionId)
        return project;
    const section = own.find(s => s.id === sectionId);
    const ordered = own.filter(s => s.id !== sectionId);
    const sectionIndex = beforeSectionId ? ordered.findIndex(s => s.id === beforeSectionId) : ordered.length;
    ordered.splice(sectionIndex, 0, section);
    const children = project.sequences[sequence].filter(e => e.sectionId === sectionId);
    const entries = project.sequences[sequence].filter(e => e.sectionId !== sectionId);
    const following = ordered.slice(sectionIndex + 1).map(s => s.id);
    const target = beforeEntryId ? entries.findIndex(e => e.id === beforeEntryId) : entries.findIndex(e => e.sectionId && following.includes(e.sectionId));
    entries.splice(target < 0 ? entries.length : target, 0, ...children);
    return { ...project, sections: [...(project.sections ?? []).filter(s => s.sequence !== sequence), ...ordered], sequences: { ...project.sequences, [sequence]: entries } };
}
/** Cut transfers occurrences, never duplicates or detaches linked scenes. */
function moveTimelineEntries(project, source, destination, ids, sectionId, beforeEntryId) {
    const section = project.sections?.find(s => s.id === sectionId && s.sequence === destination);
    if (sectionId && !section)
        throw new Error('Section no longer exists in this sequence.');
    const moving = project.sequences[source].filter(e => ids.includes(e.id));
    if (!moving.length || (source === destination && beforeEntryId && ids.includes(beforeEntryId)))
        return project;
    const remaining = project.sequences[source].filter(e => !ids.includes(e.id));
    const targets = [...(source === destination ? remaining : project.sequences[destination])];
    if (targets.length + moving.length > limits_1.LESSON_LIMITS.entriesPerSequence)
        throw new Error('The destination sequence has no room for these scenes.');
    let index = beforeEntryId ? targets.findIndex(e => e.id === beforeEntryId) : -1;
    if (index < 0) {
        const last = targets.map(e => e.sectionId).lastIndexOf(sectionId);
        index = last < 0 ? targets.length : last + 1;
    }
    targets.splice(index, 0, ...moving.map(e => ({ ...e, sectionId, section: section?.name ?? '' })));
    return { ...project, sequences: { ...project.sequences, [source]: remaining, [destination]: targets } };
}
/** Explicit append boundary keeps disjoint ungrouped/legacy runs independent. */
function timelineGroupBoundary(project, sequence, group) {
    const last = group.entries[group.entries.length - 1];
    if (!last)
        return undefined;
    const index = project.sequences[sequence].findIndex(e => e.id === last.id);
    return project.sequences[sequence][index + 1]?.id;
}
/** Explicit membership makes empty/collapsed targets identical to populated targets. */
function insertSectionMedia(project, sequence, assetIds, sectionId, beforeEntryId) {
    if (sectionId && !project.sections?.some(s => s.id === sectionId && s.sequence === sequence))
        throw new Error('Section no longer exists.');
    const assets = assetIds.map(id => { const asset = project.assets.find(a => a.id === id && a.mediaType !== 'audio'); if (!asset)
        throw new Error('Drop image or video media here.'); return asset; });
    const entryIds = [];
    for (const asset of assets.length ? assets : [undefined]) {
        const section = project.sections?.find(s => s.id === sectionId);
        const groups = timelineGroups(project, sequence);
        const groupIndex = groups.findIndex(g => g.sectionId === sectionId);
        const own = project.sequences[sequence].filter(e => e.sectionId === sectionId);
        const lastIndex = own.length ? project.sequences[sequence].findIndex(e => e.id === own[own.length - 1].id) : -1;
        const next = beforeEntryId ?? (lastIndex >= 0 ? project.sequences[sequence][lastIndex + 1]?.id : groups.slice(groupIndex + 1).flatMap(g => g.entries)[0]?.id);
        const added = (0, commands_1.insertScene)(project, sequence, (0, commands_1.createScene)(asset?.originalName ?? 'New scene', asset?.id), next);
        project = { ...added.project, sequences: { ...added.project.sequences, [sequence]: added.project.sequences[sequence].map(e => e.id === added.entryId ? { ...e, sectionId, section: section?.name ?? '' } : e) } };
        entryIds.push(added.entryId);
    }
    return { project, entryIds };
}
