import test from "node:test";
import assert from "node:assert/strict";
import type { ProjectData } from "./types";
import { normalizeAudioSettings } from "./audioSettings";
import { resolveVideoAudioSettings } from "./videoAudio";

test("app audio settings do not mutate a legacy episode project", () => {
  const legacyEpisode = {
    version: 1,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    slides: [{
      id: "slide-1",
      assetId: "video-1",
      sectionId: "section-1",
      transition: "fade",
      dialogue: [{ url: "media://dialogue.mp3", volume: 0.8 }],
      sfx: [{ url: "media://effect.wav", volume: 1 }],
      bgm: [{ url: "media://slide-music.mp3", volume: 0.5 }],
    }],
    assets: [],
    sections: [{
      id: "section-1",
      name: "Legacy Episode",
      type: "story",
      bgm: [{ url: "media://section-music.mp3", volume: 0.4 }],
    }],
  } as unknown as ProjectData;
  const before = JSON.stringify(legacyEpisode);

  const appSettings = normalizeAudioSettings(undefined);

  assert.equal(JSON.stringify(legacyEpisode), before);
  assert.equal("audio" in legacyEpisode, false);
  assert.equal(appSettings.microphoneMonitorEnabled, false);
});

test("legacy video slides retain enabled full-volume audio defaults", () => {
  assert.deepEqual(resolveVideoAudioSettings(undefined), { enabled: true, volume: 1 });
});
