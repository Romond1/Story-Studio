import test from "node:test";
import assert from "node:assert/strict";
import type { AssetItem, ProjectData, Section } from "./types";
import {
  appendAssetsAndUpdateSection,
  deleteSectionInProjectData,
  duplicateBreakSectionInProjectData,
  moveSectionInProjectData,
} from "./sectionMutations";

function createBreakSection(): Section {
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

function createProjectData(): ProjectData {
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

test("duplicateBreakSectionInProjectData deep clones mutable break state", () => {
  const ids = [
    "break-copy",
    "media-copy",
    "stroke-copy",
    "ref-copy",
    "ref-inst-copy",
    "section-inst-copy",
  ];
  const result = duplicateBreakSectionInProjectData(
    createProjectData(),
    "break-1",
    () => ids.shift() ?? "unexpected-id",
  );

  assert.ok(result);
  assert.equal(result.duplicatedId, "break-copy");

  const original = result.data.sections.find((section) => section.id === "break-1")!;
  const duplicate = result.data.sections.find((section) => section.id === "break-copy")!;

  assert.equal(result.data.sections[2]?.id, "break-copy");
  assert.equal(duplicate.name, "Question Time Copy");
  assert.notEqual(duplicate.breakMedia?.[0].id, original.breakMedia?.[0].id);
  assert.notEqual(duplicate.markerStrokes?.[0].id, original.markerStrokes?.[0].id);
  assert.notEqual(duplicate.storyReferences?.[0].id, original.storyReferences?.[0].id);
  assert.notEqual(duplicate.storyReferences?.[0].bCardInstances?.[0].id, original.storyReferences?.[0].bCardInstances?.[0].id);
  assert.notEqual(duplicate.bCardInstances?.[0].id, original.bCardInstances?.[0].id);
  assert.notStrictEqual(duplicate.breakViewport, original.breakViewport);
  assert.notStrictEqual(duplicate.bgTransform, original.bgTransform);
  assert.notStrictEqual(duplicate.markerStrokes?.[0].points, original.markerStrokes?.[0].points);

  duplicate.markerStrokes![0].points[0].x = 0.9;
  duplicate.breakViewport!.zoom = 3;
  duplicate.storyReferences![0].bCardInstances![0].position.x = 99;

  assert.equal(original.markerStrokes![0].points[0].x, 0.1);
  assert.equal(original.breakViewport!.zoom, 1.2);
  assert.equal(original.storyReferences![0].bCardInstances![0].position.x, 40);
});

test("appendAssetsAndUpdateSection preserves imported assets while changing break background", () => {
  const importedAsset: AssetItem = {
    id: "asset-2",
    relativePath: "media/new-bg.png",
    filename: "new-bg.png",
    originalName: "new-bg.png",
    mediaType: "image",
    sizeBytes: 1234,
    importedAt: "2026-04-03T00:00:00.000Z",
  };

  const next = appendAssetsAndUpdateSection(
    createProjectData(),
    "break-1",
    [importedAsset],
    { background: "url('media/new-bg.png')" },
  );

  assert.equal(next.assets.length, 1);
  assert.equal(next.assets[0].id, "asset-2");
  assert.equal(next.sections.find((section) => section.id === "break-1")?.background, "url('media/new-bg.png')");
});

test("moveSectionInProjectData reorders sections without changing break text content", () => {
  const data = createProjectData();
  data.sections[1] = { ...data.sections[1], questions: "Still editable" };
  const moved = moveSectionInProjectData(data, "break-1", "up");

  assert.ok(moved);
  assert.equal(moved.sections[0]?.id, "break-1");
  assert.equal(moved.sections[0]?.name, "Question Time");
  assert.equal(moved.sections[0]?.questions, "Still editable");
  assert.equal(data.sections[1]?.id, "break-1");
});

test("deleteSectionInProjectData removes one section without clobbering another break's text", () => {
  const data = createProjectData();
  data.sections.push({
    id: "break-2",
    name: "Question Time 2",
    type: "break",
    questions: "Keep me editable",
    breakMedia: [{ id: "media-2", slideId: "slide-2", fit: "contain" }],
  });
  data.slides.push({ id: "slide-2", assetId: "asset-x", sectionId: "section-1", transition: "fade" });

  const result = deleteSectionInProjectData(data, "section-1");

  assert.ok(result);
  assert.equal(result.data.sections.some((section) => section.id === "section-1"), false);
  assert.equal(result.data.sections.find((section) => section.id === "break-2")?.questions, "Keep me editable");
  assert.equal(result.data.sections.find((section) => section.id === "break-2")?.breakMedia?.length, 0);
});
