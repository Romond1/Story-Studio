"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEpisodeFromScene = createEpisodeFromScene;
exports.putDerivedImage = putDerivedImage;
exports.putCatalogEntity = putCatalogEntity;
exports.putCatalogCollection = putCatalogCollection;
exports.removeCatalogEntity = removeCatalogEntity;
exports.removeCatalogCollection = removeCatalogCollection;
exports.putEpisodeActivity = putEpisodeActivity;
exports.putActivityOccurrence = putActivityOccurrence;
exports.removeEpisodeActivity = removeEpisodeActivity;
exports.removeActivityOccurrence = removeActivityOccurrence;
exports.reorderActivityOccurrences = reorderActivityOccurrences;
exports.putAdventureDefinition = putAdventureDefinition;
const model_1 = require("../lesson/model");
const validation_1 = require("../lesson/validation");
const validation_2 = require("./validation");
/** Pure projection for an explicitly approved conversion; filesystem backup belongs to main. */
function createEpisodeFromScene(scene, adventure) {
    const p = (0, validation_1.parseLessonProject)(scene);
    return (0, validation_2.parseEpisodeProject)({ format: 'story-studio-episode', version: 1, id: p.id, title: p.title, createdAt: p.createdAt, updatedAt: p.updatedAt, assets: p.assets, mediaBins: p.mediaBins, scenes: p.scenes, sequences: p.sequences, ...(p.sections ? { sections: p.sections } : {}), cards: p.cards, library: p.library, cardSets: p.cardSets, adventure: (0, model_1.clone)(adventure), requiredCapabilities: ['derived-images-v1', 'manual-catalog-v1'], derivedImages: [], catalog: { entities: [], collections: [] } });
}
function putDerivedImage(project, image) {
    return (0, validation_2.parseEpisodeProject)({ ...project, derivedImages: [...project.derivedImages.filter(item => item.id !== image.id), (0, model_1.clone)(image)] });
}
function putCatalogEntity(project, entity) {
    const annotations = entity.tags.map(tag => entity.tagAnnotations?.find(item => item.tag === tag) ?? { tag, source: 'manual' });
    return (0, validation_2.parseEpisodeProject)({ ...project, catalog: { ...project.catalog, entities: [...project.catalog.entities.filter(item => item.id !== entity.id), { ...(0, model_1.clone)(entity), tagAnnotations: annotations }] } });
}
function putCatalogCollection(project, collection) {
    return (0, validation_2.parseEpisodeProject)({ ...project, catalog: { ...project.catalog, collections: [...(project.catalog.collections ?? []).filter(item => item.id !== collection.id), (0, model_1.clone)(collection)] } });
}
function removeCatalogEntity(project, id) {
    if (project.catalog.collections?.some(collection => collection.entityIds.includes(id)))
        throw new Error('Entity is referenced by a collection. Reassign its membership first.');
    return (0, validation_2.parseEpisodeProject)({ ...project, catalog: { ...project.catalog, entities: project.catalog.entities.filter(entity => entity.id !== id) } });
}
function removeCatalogCollection(project, id) {
    return (0, validation_2.parseEpisodeProject)({ ...project, catalog: { ...project.catalog, collections: (project.catalog.collections ?? []).filter(collection => collection.id !== id) } });
}
function putEpisodeActivity(project, activity) {
    return (0, validation_2.parseEpisodeProject)({ ...project, requiredCapabilities: [...new Set([...project.requiredCapabilities, 'bundled-modules-v1'])], activities: [...(project.activities ?? []).filter(item => item.id !== activity.id), (0, model_1.clone)(activity)], occurrences: project.occurrences ?? [] });
}
function putActivityOccurrence(project, occurrence) {
    const existing = project.occurrences ?? [], index = existing.findIndex(item => item.id === occurrence.id);
    const occurrences = existing.map(item => item.id === occurrence.id ? (0, model_1.clone)(occurrence) : item);
    if (index < 0)
        occurrences.push((0, model_1.clone)(occurrence));
    return (0, validation_2.parseEpisodeProject)({ ...project, occurrences });
}
function removeEpisodeActivity(project, id) {
    if (project.occurrences?.some(item => item.activityId === id))
        throw new Error('Activity is referenced by an occurrence');
    return (0, validation_2.parseEpisodeProject)({ ...project, activities: project.activities?.filter(item => item.id !== id) });
}
function removeActivityOccurrence(project, id) { return (0, validation_2.parseEpisodeProject)({ ...project, occurrences: project.occurrences?.filter(item => item.id !== id) }); }
function reorderActivityOccurrences(project, ids) {
    const current = project.occurrences ?? [];
    if (ids.length !== current.length || new Set(ids).size !== ids.length || ids.some(id => !current.some(item => item.id === id)))
        throw new Error('Invalid occurrence ordering');
    return (0, validation_2.parseEpisodeProject)({ ...project, occurrences: ids.map(id => current.find(item => item.id === id)) });
}
function putAdventureDefinition(project, definition) {
    return (0, validation_2.parseEpisodeProject)({ ...project, requiredCapabilities: [...new Set([...project.requiredCapabilities, 'adventure-definitions-v1'])], adventureDefinition: (0, model_1.clone)(definition) });
}
