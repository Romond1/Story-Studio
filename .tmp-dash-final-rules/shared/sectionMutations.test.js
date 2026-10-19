"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const sectionMutations_1 = require("./sectionMutations");
function createBreakSection() {
    return {
        id: "break-1",
        name: "Question Time",
        type: "break",
        background: "url('old.png')",
        breakMedia: [
            { id: "media-1", slideId: "slide-1", fit: "contain", x: 10, y: 15, scale: 1.1 },
        ],
        markerStrokes: [
            {
                id: "stroke-1",
                color: "#fff",
                size: 6,
                opacity: 1,
                rainbow: false,
                points: [{ x: 0.1, y: 0.2, t: 123 }],
            },
        ],
        breakViewport: { zoom: 1.2, panX: 4, panY: 8 },
        bgTransform: { x: 5, y: 6, scale: 1.3, blur: 4 },
        storyReferences: [
            {
                id: "ref-1",
                type: "aCardRef",
                aCardId: "ac-1",
                bCardInstances: [
                    {
                        id: "inst-1",
                        bCardId: "bc-1",
                        position: { x: 40, y: 55 },
                        size: { width: 200, height: 300 },
                        zIndex: 1,
                        displayMode: "overlay",
                        flags: { pinned: true },
                    },
                ],
            },
        ],
        bCardInstances: [
            {
                id: "inst-2",
                bCardId: "bc-2",
                position: { x: 35, y: 60 },
                size: { width: 210, height: 310 },
                zIndex: 2,
                displayMode: "board",
            },
        ],
        bgm: [{ url: "music.mp3", volume: 0.5, tags: ["break"] }],
    };
}
function createProjectData() {
    return {
        version: 4,
        createdAt: "2026-04-03T00:00:00.000Z",
        updatedAt: "2026-04-03T00:00:00.000Z",
        assets: [],
        sections: [
            { id: "section-1", name: "Intro", type: "section" },
            createBreakSection(),
        ],
        slides: [],
        boostPack: { activationSequence: [], languageSequence: [], gamesSequence: [] },
        sparkStudents: [],
        activeStudentId: undefined,
        aCardLibrary: {},
        bCardLibrary: {},
    };
}
(0, node_test_1.default)("duplicateBreakSectionInProjectData deep clones mutable break state", () => {
    const ids = [
        "break-copy",
        "media-copy",
        "stroke-copy",
        "ref-copy",
        "ref-inst-copy",
        "section-inst-copy",
    ];
    const result = (0, sectionMutations_1.duplicateBreakSectionInProjectData)(createProjectData(), "break-1", () => ids.shift() ?? "unexpected-id");
    strict_1.default.ok(result);
    strict_1.default.equal(result.duplicatedId, "break-copy");
    const original = result.data.sections.find((section) => section.id === "break-1");
    const duplicate = result.data.sections.find((section) => section.id === "break-copy");
    strict_1.default.equal(result.data.sections[2]?.id, "break-copy");
    strict_1.default.equal(duplicate.name, "Question Time Copy");
    strict_1.default.notEqual(duplicate.breakMedia?.[0].id, original.breakMedia?.[0].id);
    strict_1.default.notEqual(duplicate.markerStrokes?.[0].id, original.markerStrokes?.[0].id);
    strict_1.default.notEqual(duplicate.storyReferences?.[0].id, original.storyReferences?.[0].id);
    strict_1.default.notEqual(duplicate.storyReferences?.[0].bCardInstances?.[0].id, original.storyReferences?.[0].bCardInstances?.[0].id);
    strict_1.default.notEqual(duplicate.bCardInstances?.[0].id, original.bCardInstances?.[0].id);
    strict_1.default.notStrictEqual(duplicate.breakViewport, original.breakViewport);
    strict_1.default.notStrictEqual(duplicate.bgTransform, original.bgTransform);
    strict_1.default.notStrictEqual(duplicate.markerStrokes?.[0].points, original.markerStrokes?.[0].points);
    duplicate.markerStrokes[0].points[0].x = 0.9;
    duplicate.breakViewport.zoom = 3;
    duplicate.storyReferences[0].bCardInstances[0].position.x = 99;
    strict_1.default.equal(original.markerStrokes[0].points[0].x, 0.1);
    strict_1.default.equal(original.breakViewport.zoom, 1.2);
    strict_1.default.equal(original.storyReferences[0].bCardInstances[0].position.x, 40);
});
(0, node_test_1.default)("appendAssetsAndUpdateSection preserves imported assets while changing break background", () => {
    const importedAsset = {
        id: "asset-2",
        relativePath: "media/new-bg.png",
        filename: "new-bg.png",
        originalName: "new-bg.png",
        mediaType: "image",
        sizeBytes: 1234,
        importedAt: "2026-04-03T00:00:00.000Z",
    };
    const next = (0, sectionMutations_1.appendAssetsAndUpdateSection)(createProjectData(), "break-1", [importedAsset], { background: "url('media/new-bg.png')" });
    strict_1.default.equal(next.assets.length, 1);
    strict_1.default.equal(next.assets[0].id, "asset-2");
    strict_1.default.equal(next.sections.find((section) => section.id === "break-1")?.background, "url('media/new-bg.png')");
});
(0, node_test_1.default)("moveSectionInProjectData reorders sections without changing break text content", () => {
    const data = createProjectData();
    data.sections[1] = { ...data.sections[1], questions: "Still editable" };
    const moved = (0, sectionMutations_1.moveSectionInProjectData)(data, "break-1", "up");
    strict_1.default.ok(moved);
    strict_1.default.equal(moved.sections[0]?.id, "break-1");
    strict_1.default.equal(moved.sections[0]?.name, "Question Time");
    strict_1.default.equal(moved.sections[0]?.questions, "Still editable");
    strict_1.default.equal(data.sections[1]?.id, "break-1");
});
(0, node_test_1.default)("deleteSectionInProjectData removes one section without clobbering another break's text", () => {
    const data = createProjectData();
    data.sections.push({
        id: "break-2",
        name: "Question Time 2",
        type: "break",
        questions: "Keep me editable",
        breakMedia: [{ id: "media-2", slideId: "slide-2", fit: "contain" }],
    });
    data.slides.push({ id: "slide-2", assetId: "asset-x", sectionId: "section-1", transition: "fade" });
    const result = (0, sectionMutations_1.deleteSectionInProjectData)(data, "section-1");
    strict_1.default.ok(result);
    strict_1.default.equal(result.data.sections.some((section) => section.id === "section-1"), false);
    strict_1.default.equal(result.data.sections.find((section) => section.id === "break-2")?.questions, "Keep me editable");
    strict_1.default.equal(result.data.sections.find((section) => section.id === "break-2")?.breakMedia?.length, 0);
});
