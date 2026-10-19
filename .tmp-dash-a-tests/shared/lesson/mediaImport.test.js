"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const mediaImport_1 = require("./mediaImport");
const asset = (id, binId) => ({ id, binId });
const project = { assets: [asset('existing')], mediaBins: [{ id: 'active', name: 'Active' }] };
const result = (assets, bins = []) => ({ importedAssets: assets, importedBins: bins, createdSlides: [] });
(0, node_test_1.test)('file and drop imports go directly into the active bin without moving existing assets', () => {
    const next = (0, mediaImport_1.mergeLessonMediaImport)(project, result([asset('new')]), 'active');
    strict_1.default.equal(next.assets[1].binId, 'active');
    strict_1.default.equal(next.assets[0].binId, undefined);
    strict_1.default.equal(project.assets.length, 1);
});
(0, node_test_1.test)('folder imports attach roots to the active bin and preserve nested ownership', () => {
    const next = (0, mediaImport_1.mergeLessonMediaImport)(project, result([asset('loose'), asset('image', 'child')], [{ id: 'folder', name: 'Folder' }, { id: 'child', name: 'Child', parentId: 'folder' }]), 'active');
    strict_1.default.equal(next.mediaBins[1].parentId, 'active');
    strict_1.default.equal(next.mediaBins[2].parentId, 'folder');
    strict_1.default.equal(next.assets[1].binId, 'active');
    strict_1.default.equal(next.assets[2].binId, 'child');
});
(0, node_test_1.test)('root and deleted destinations use the general pool', () => {
    for (const destination of [undefined, 'deleted']) {
        const next = (0, mediaImport_1.mergeLessonMediaImport)(project, result([asset('new')], [{ id: 'folder', name: 'Folder' }]), destination);
        strict_1.default.equal(next.assets[1].binId, undefined);
        strict_1.default.equal(next.mediaBins[1].parentId, undefined);
    }
});
(0, node_test_1.test)('an import cannot duplicate an existing asset or create cyclic bins', () => {
    strict_1.default.throws(() => (0, mediaImport_1.mergeLessonMediaImport)(project, result([asset('existing')])), /duplicate|collision/i);
    strict_1.default.throws(() => (0, mediaImport_1.mergeLessonMediaImport)(project, result([asset('new')], [{ id: 'cycle', name: 'Cycle', parentId: 'cycle' }])), /cycle/i);
    strict_1.default.equal(project.assets.length, 1);
});
