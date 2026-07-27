"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const mediaImport_1 = require("./mediaImport");
function asset(id, originalName) {
    return {
        id,
        relativePath: `assets/${id}.png`,
        filename: `${id}.png`,
        originalName,
        mediaType: "image",
        sizeBytes: 100,
        importedAt: "2026-06-20T00:00:00.000Z",
    };
}
function slide(id, assetId, sectionId = "section-1") {
    return {
        id,
        assetId,
        sectionId,
        transition: "fade",
    };
}
function projectData() {
    return {
        version: 1,
        createdAt: "2026-06-20T00:00:00.000Z",
        updatedAt: "2026-06-20T00:00:00.000Z",
        assets: [asset("existing", "existing.png")],
        slides: [slide("slide-existing", "existing")],
        sections: [
            { id: "section-1", name: "Section 1", type: "section" },
            { id: "break-1", name: "Question Time 1", type: "break", breakMedia: [] },
        ],
    };
}
(0, node_test_1.default)("applies imported media to the selected story section", () => {
    const importedAssets = [asset("new-1", "cat 01.png")];
    const createdSlides = [slide("slide-new-1", "new-1")];
    const result = { importedAssets, createdSlides };
    const next = (0, mediaImport_1.applyMediaImportToProjectData)(projectData(), result, "section-1");
    strict_1.default.equal(next.assets.length, 2);
    strict_1.default.equal(next.slides.at(-1)?.sectionId, "section-1");
    strict_1.default.equal(next.assets.at(-1)?.referenceCode, "1.2");
    strict_1.default.equal(next.sections.find((section) => section.id === "break-1")?.breakMedia?.length, 0);
});
(0, node_test_1.default)("applies imported media to the selected break as break media", () => {
    const importedAssets = [asset("break-img", "break image.png")];
    const createdSlides = [slide("slide-break-img", "break-img")];
    const result = { importedAssets, createdSlides };
    const next = (0, mediaImport_1.applyMediaImportToProjectData)(projectData(), result, "break-1");
    const breakSection = next.sections.find((section) => section.id === "break-1");
    strict_1.default.equal(next.slides.at(-1)?.sectionId, "break-1");
    strict_1.default.equal(next.assets.at(-1)?.referenceCode, "B1.1");
    strict_1.default.deepEqual(breakSection?.breakMedia, [
        { id: "break-slide-break-img", slideId: "slide-break-img", fit: "contain" },
    ]);
});
