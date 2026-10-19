"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clone = exports.makeId = void 0;
exports.sceneAt = sceneAt;
const makeId = () => globalThis.crypto.randomUUID();
exports.makeId = makeId;
const clone = (value) => JSON.parse(JSON.stringify(value));
exports.clone = clone;
function sceneAt(project, location) {
    if (!location?.entryId)
        return undefined;
    const entry = project.sequences[location.sequence].find(item => item.id === location.entryId);
    return entry && project.scenes[entry.sceneId];
}
