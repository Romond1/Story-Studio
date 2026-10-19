"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeLessonMediaImport = mergeLessonMediaImport;
const mediaImportValidation_1 = require("../mediaImportValidation");
/** Capture the destination before opening a picker; preserve imported folder trees. */
function mergeLessonMediaImport(project, imported, destination) {
    (0, mediaImportValidation_1.validateMediaImport)(project, imported);
    const target = project.mediaBins.some(bin => bin.id === destination) ? destination : undefined;
    const bins = imported.importedBins ?? [];
    const importedIds = new Set(bins.map(bin => bin.id));
    return {
        ...project,
        assets: [...project.assets, ...imported.importedAssets.map(asset => ({ ...asset, binId: asset.binId && importedIds.has(asset.binId) ? asset.binId : target }))],
        mediaBins: [...project.mediaBins, ...bins.map(bin => ({ ...bin, parentId: bin.parentId && importedIds.has(bin.parentId) ? bin.parentId : target }))],
    };
}
