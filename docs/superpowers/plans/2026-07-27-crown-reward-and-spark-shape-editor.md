# Crown Reward and Spark Shape Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backward-compatible crown reward on `P`, functional built-in/custom reward appearances, and an aspect-locked badge sprite editor with reliable overlap controls.

**Architecture:** Centralize the four fixed reward definitions and all save-sensitive calculations in a new pure shared module. Keep project version 4, normalize optional crown fields at load/restore boundaries, and have the existing provider, overlays, Badge panel, and Badge stage consume the shared definitions. Preserve old sprite records verbatim while lazily adding crown records and keep editor-only selection state outside serialized project data.

**Tech Stack:** TypeScript 5.7, React 18, Electron 34, Vite 6, `react-rnd`, Node's built-in test runner

---

## File Structure

- Create `src/shared/sparkRewards.ts`: reward definitions, student/config normalization, totals, award/reset operations, shape paths, sprite creation, aspect-ratio sizing, and layer ordering.
- Create `src/shared/sparkRewards.test.ts`: regression coverage for legacy JSON, totals, awards, shapes, sprite preservation, sizing, and ordering.
- Modify `src/shared/types.ts`: add crown to reward, student, shape, config, and asset-map types.
- Modify `src/main/main.ts`: delegate project-load student normalization to the shared reward module without changing schema version.
- Modify `tsconfig.test.json`: compile the new shared module and tests.
- Modify `src/renderer/sparks/SparkProvider.tsx`: consume normalized defaults and support crown award/reset/count state.
- Modify `src/renderer/sparks/SparkBurst.tsx`: render all built-in paths or a custom PNG and select the crown entrance class.
- Modify `src/renderer/sparks/SparkOverlay.tsx`: resolve uploaded assets for bursts and support crown colors.
- Modify `src/renderer/sparks/BadgePanel.tsx`: add four reward appearance cards, PNG controls, crown test trigger, selected-sprite controls, sizing slider, and layer controls.
- Modify `src/renderer/sparks/FinalBadgeOverlay.tsx`: display crowns separately and include them in totals.
- Modify `src/renderer/sparks/sparkStyles.css`: add built-in/custom glyph styling, crown drop animation, reduced motion, and compact badge editing guides.
- Modify `src/renderer/App.tsx`: map `P` to crown, render four badge variants, maintain ephemeral sprite selection, and pass assets to the Spark overlay.

### Task 1: Define and Test the Four-Reward Model

**Files:**
- Create: `src/shared/sparkRewards.ts`
- Create: `src/shared/sparkRewards.test.ts`
- Modify: `src/shared/types.ts:242-340`
- Modify: `tsconfig.test.json:20-45`

- [ ] **Step 1: Add failing compatibility, total, award, reset, hotkey, and shape tests**

Create `src/shared/sparkRewards.test.ts` with focused tests:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import type { SparkStudent } from "./types";
import {
  REWARD_VARIANTS,
  awardRewardToStudent,
  getRewardShapePath,
  getRewardVariantForKey,
  getStudentRewardTotal,
  normalizeSparkStudent,
  resetStudentRewards,
} from "./sparkRewards";

const legacyStudent = {
  id: "student-1",
  name: "Ada",
  yellowSparks: 2,
  blueSparks: 3,
  pinkSparks: 4,
  stars: 9,
  badgeVisible: true,
  badgeSparkVariant: "gold",
};

test("legacy students gain zero crowns without losing existing reward data", () => {
  const normalized = normalizeSparkStudent(legacyStudent, () => "generated");
  assert.ok(normalized);
  assert.equal(normalized.id, "student-1");
  assert.equal(normalized.yellowSparks, 2);
  assert.equal(normalized.blueSparks, 3);
  assert.equal(normalized.pinkSparks, 4);
  assert.equal(normalized.crowns, 0);
  assert.equal(normalized.stars, 9);
});

test("crowns add to the overall reward total", () => {
  assert.equal(getStudentRewardTotal({ ...legacyStudent, crowns: 2 }), 11);
});

test("awarding crown changes only the active student and derived total", () => {
  const students = [
    normalizeSparkStudent(legacyStudent, () => "unused")!,
    normalizeSparkStudent({ ...legacyStudent, id: "student-2", name: "Grace" }, () => "unused")!,
  ];
  const next = awardRewardToStudent(students, "student-2", "crown");
  assert.equal(next[0], students[0]);
  assert.equal(next[1].crowns, 1);
  assert.equal(next[1].stars, 10);
});

test("reset clears all four rewards", () => {
  const student = normalizeSparkStudent({ ...legacyStudent, crowns: 5 }, () => "unused")!;
  const [next] = resetStudentRewards([student], student.id);
  assert.deepEqual(
    [next.yellowSparks, next.blueSparks, next.pinkSparks, next.crowns, next.stars],
    [0, 0, 0, 0, 0],
  );
});

test("P maps to crown without changing the existing reward keys", () => {
  assert.equal(getRewardVariantForKey("["), "gold");
  assert.equal(getRewardVariantForKey("]"), "blue");
  assert.equal(getRewardVariantForKey("\\"), "pink");
  assert.equal(getRewardVariantForKey("p"), "crown");
  assert.equal(getRewardVariantForKey("P"), "crown");
  assert.equal(getRewardVariantForKey("q"), null);
});

test("all configured reward variants and shapes have renderable definitions", () => {
  assert.deepEqual(REWARD_VARIANTS, ["gold", "blue", "pink", "crown"]);
  for (const shape of ["star", "diamond", "circle", "heart", "crown"] as const) {
    assert.match(getRewardShapePath(shape), /^M/);
  }
});
```

- [ ] **Step 2: Include the new test files and verify RED**

Add these entries to `tsconfig.test.json`:

```json
"src/shared/sparkRewards.ts",
"src/shared/sparkRewards.test.ts",
```

Run:

```powershell
npx tsc -p tsconfig.test.json
```

Expected: compilation fails because `SparkStudent.crowns`, the crown unions, and `./sparkRewards` do not exist.

- [ ] **Step 3: Extend serialized types with optional-compatible crown fields**

Update `src/shared/types.ts` so the existing fields remain and crown is additive:

```ts
export type SparkAwardVariant = "gold" | "blue" | "pink" | "crown";
export type SparkShape = "star" | "diamond" | "circle" | "heart" | "crown";

export interface SparkStudent {
  id: string;
  name: string;
  yellowSparks: number;
  blueSparks: number;
  pinkSparks: number;
  crowns: number;
  stars: number;
  badgeVisible: boolean;
  badgeSparkVariant?: SparkAwardVariant;
}
```

Add `crown?: string` to `BadgeConfig.badgeSparkAssetIds` and `crown?: SparkShape` to `SparkConfig.shapeByVariant`.

- [ ] **Step 4: Implement the minimal pure reward model**

Create `src/shared/sparkRewards.ts`:

```ts
import type {
  BadgeStudentSprite,
  SparkAwardVariant,
  SparkShape,
  SparkStudent,
} from "./types";

export const REWARD_VARIANTS = ["gold", "blue", "pink", "crown"] as const;

export const REWARD_DEFINITIONS: Record<
  SparkAwardVariant,
  {
    label: string;
    countField: "yellowSparks" | "blueSparks" | "pinkSparks" | "crowns";
    defaultShape: SparkShape;
    colorRgb: string;
  }
> = {
  gold: { label: "Yellow", countField: "yellowSparks", defaultShape: "star", colorRgb: "255, 215, 0" },
  blue: { label: "Blue", countField: "blueSparks", defaultShape: "star", colorRgb: "0, 191, 255" },
  pink: { label: "Pink", countField: "pinkSparks", defaultShape: "star", colorRgb: "255, 105, 180" },
  crown: { label: "Crown", countField: "crowns", defaultShape: "crown", colorRgb: "255, 184, 48" },
};

const SHAPE_PATHS: Record<SparkShape, string> = {
  star: "M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z",
  diamond: "M12 2L22 12L12 22L2 12Z",
  circle: "M12 2A10 10 0 1 1 11.999 2Z",
  heart: "M12 21L10.55 19.68C5.4 15.02 2 11.94 2 8.17C2 5.09 4.42 2.67 7.5 2.67C9.24 2.67 10.91 3.48 12 4.76C13.09 3.48 14.76 2.67 16.5 2.67C19.58 2.67 22 5.09 22 8.17C22 11.94 18.6 15.02 13.45 19.69Z",
  crown: "M3 18L2 6L7.5 11L12 3L16.5 11L22 6L21 18ZM4 21V19H20V21Z",
};

function safeCount(value: unknown): number {
  return Number.isFinite(value) ? Math.max(0, Number(value)) : 0;
}

export function getRewardShapePath(shape: SparkShape): string {
  return SHAPE_PATHS[shape];
}

export function getStudentRewardTotal(
  student: Pick<SparkStudent, "yellowSparks" | "blueSparks" | "pinkSparks"> & Partial<Pick<SparkStudent, "crowns">>,
): number {
  return safeCount(student.yellowSparks)
    + safeCount(student.blueSparks)
    + safeCount(student.pinkSparks)
    + safeCount(student.crowns);
}

export function normalizeSparkStudent(
  value: unknown,
  createId: () => string,
): SparkStudent | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const student: SparkStudent = {
    id: typeof raw.id === "string" && raw.id ? raw.id : createId(),
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : "Student",
    yellowSparks: safeCount(raw.yellowSparks),
    blueSparks: safeCount(raw.blueSparks),
    pinkSparks: safeCount(raw.pinkSparks),
    crowns: safeCount(raw.crowns),
    stars: 0,
    badgeVisible: raw.badgeVisible !== false,
    badgeSparkVariant: REWARD_VARIANTS.includes(raw.badgeSparkVariant as SparkAwardVariant)
      ? raw.badgeSparkVariant as SparkAwardVariant
      : "gold",
  };
  student.stars = getStudentRewardTotal(student);
  return student;
}

export function awardRewardToStudent(
  students: SparkStudent[],
  activeStudentId: string,
  variant: SparkAwardVariant,
): SparkStudent[] {
  const field = REWARD_DEFINITIONS[variant].countField;
  return students.map((student) => {
    if (student.id !== activeStudentId) return student;
    const next = { ...student, [field]: safeCount(student[field]) + 1 };
    return { ...next, stars: getStudentRewardTotal(next) };
  });
}

export function resetStudentRewards(students: SparkStudent[], activeStudentId: string): SparkStudent[] {
  return students.map((student) => student.id === activeStudentId
    ? { ...student, yellowSparks: 0, blueSparks: 0, pinkSparks: 0, crowns: 0, stars: 0 }
    : student);
}

export function getRewardVariantForKey(key: string): SparkAwardVariant | null {
  const normalized = key.length === 1 ? key.toLowerCase() : key;
  if (normalized === "[") return "gold";
  if (normalized === "]") return "blue";
  if (normalized === "\\") return "pink";
  if (normalized === "p") return "crown";
  return null;
}
```

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run:

```powershell
npx tsc -p tsconfig.test.json
node --test dist-test/shared/sparkRewards.test.js
```

Expected: 6 tests pass with zero failures.

- [ ] **Step 6: Commit the reward model**

```powershell
git add src/shared/types.ts src/shared/sparkRewards.ts src/shared/sparkRewards.test.ts tsconfig.test.json
git commit -m "feat: add crown reward model"
```

### Task 2: Normalize Existing Projects and Provider State

**Files:**
- Modify: `src/main/main.ts:460-505`
- Modify: `src/renderer/sparks/SparkProvider.tsx:1-350`
- Modify: `src/shared/sparkRewards.ts`
- Modify: `src/shared/sparkRewards.test.ts`

- [ ] **Step 1: Add failing tests for malformed legacy counts and preserved metadata**

Add `normalizeSparkStudents` to the existing import from `./sparkRewards`, then append:

```ts
test("student list normalization filters invalid entries and normalizes legacy students", () => {
  let nextId = 0;
  const normalized = normalizeSparkStudents(
    [null, legacyStudent, "invalid"],
    () => `generated-${++nextId}`,
  );
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].id, "student-1");
  assert.equal(normalized[0].crowns, 0);
  assert.equal(normalized[0].stars, 9);
});

test("normalization clamps invalid counts and preserves supported metadata", () => {
  const normalized = normalizeSparkStudent({
    ...legacyStudent,
    yellowSparks: -3,
    blueSparks: Number.NaN,
    pinkSparks: 4,
    crowns: 2,
    badgeVisible: false,
    badgeSparkVariant: "crown",
  }, () => "unused")!;
  assert.equal(normalized.yellowSparks, 0);
  assert.equal(normalized.blueSparks, 0);
  assert.equal(normalized.pinkSparks, 4);
  assert.equal(normalized.crowns, 2);
  assert.equal(normalized.stars, 6);
  assert.equal(normalized.badgeVisible, false);
  assert.equal(normalized.badgeSparkVariant, "crown");
});
```

- [ ] **Step 2: Run the focused test and verify RED if the implementation does not preserve all assertions**

Run:

```powershell
npx tsc -p tsconfig.test.json
node --test dist-test/shared/sparkRewards.test.js
```

Expected: FAIL because `normalizeSparkStudents` is not exported by the shared module.

- [ ] **Step 3: Replace duplicated main-process normalization**

First add this shared list normalizer:

```ts
export function normalizeSparkStudents(input: unknown, createId: () => string): SparkStudent[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => normalizeSparkStudent(item, createId))
    .filter((item): item is SparkStudent => item !== null);
}
```

Import it in `src/main/main.ts`, change `createDefaultSparkStudent` to include `crowns: 0`, remove the duplicated local normalizer, and call:

```ts
const sparkStudents = normalizeSparkStudents(
  (data as ProjectData & { sparkStudents?: unknown }).sparkStudents,
  randomUUID,
);
```

Keep `normalizeProjectData` returning `version: 4`; do not add a schema migration or overwrite `sparkConfig`, `badgeConfig`, assets, or badge sprites.

- [ ] **Step 4: Make provider defaults and mutations crown-aware**

In `SparkProvider.tsx`:

- Import `SparkAwardVariant` and shared helpers.
- Replace the local `SparkVariant` union with `export type SparkVariant = SparkAwardVariant`.
- Add `crown: "crown"` to default shapes.
- Add `crowns: 0` in `createStudent`.
- Add `crown` to `activeSparkCounts`.
- Replace the local total calculation with `getStudentRewardTotal`.
- Replace the manual award map with `awardRewardToStudent`.
- Replace the manual reset map with `resetStudentRewards`.

The award callback remains responsible for creating `BurstInfo`, preserving the active student's name, and removing the burst after the configured duration.

- [ ] **Step 5: Run type checks and reward tests**

Run:

```powershell
npm test
npm run build:main
```

Expected: all Node tests pass; main TypeScript compilation exits 0.

- [ ] **Step 6: Commit load/provider compatibility**

```powershell
git add src/main/main.ts src/renderer/sparks/SparkProvider.tsx src/shared/sparkRewards.test.ts
git commit -m "feat: normalize crown rewards in existing projects"
```

### Task 3: Render Functional Built-In Shapes and Crown Entrance

**Files:**
- Modify: `src/renderer/sparks/SparkBurst.tsx`
- Modify: `src/renderer/sparks/SparkOverlay.tsx`
- Modify: `src/renderer/sparks/sparkStyles.css`
- Modify: `src/renderer/App.tsx:4750-4765`

- [ ] **Step 1: Add a failing appearance-resolution test**

Add this test before changing production code:

```ts
import { resolveRewardAppearance } from "./sparkRewards";

test("custom assets override shapes and missing assets fall back to the configured shape", () => {
  const config = { shapeByVariant: { crown: "heart" as const } };
  const badge = { badgeSparkAssetIds: { crown: "asset-crown" } };
  assert.deepEqual(resolveRewardAppearance("crown", config, badge, new Set(["asset-crown"])), {
    shape: "heart",
    assetId: "asset-crown",
  });
  assert.deepEqual(resolveRewardAppearance("crown", config, badge, new Set()), {
    shape: "heart",
    assetId: undefined,
  });
});
```

Run `npm test`.

Expected: FAIL because `resolveRewardAppearance` is missing or incomplete.

- [ ] **Step 2: Implement appearance resolution**

Add to `src/shared/sparkRewards.ts`:

```ts
export function resolveRewardAppearance(
  variant: SparkAwardVariant,
  sparkConfig: Pick<SparkConfig, "shapeByVariant">,
  badgeConfig: Pick<BadgeConfig, "badgeSparkAssetIds">,
  availableAssetIds: ReadonlySet<string>,
): { shape: SparkShape; assetId?: string } {
  const shape = sparkConfig.shapeByVariant?.[variant] ?? REWARD_DEFINITIONS[variant].defaultShape;
  const configuredAssetId = badgeConfig.badgeSparkAssetIds?.[variant];
  return {
    shape,
    assetId: configuredAssetId && availableAssetIds.has(configuredAssetId)
      ? configuredAssetId
      : undefined,
  };
}
```

Add the required `SparkConfig` and `BadgeConfig` type imports. Run `npm test`; expected all tests pass.

- [ ] **Step 3: Update the burst renderer**

Change `SparkBurst` to accept `customImageUrl?: string`, use `REWARD_DEFINITIONS[variant]` for color, and render:

```tsx
{customImageUrl ? (
  <img
    className={`spark-main-visual ${variant === "crown" ? "spark-main-visual--crown" : ""}`}
    src={customImageUrl}
    alt=""
  />
) : (
  <svg
    className={`spark-main-visual ${variant === "crown" ? "spark-main-visual--crown" : ""}`}
    viewBox="0 0 24 24"
    fill={mainColor}
    aria-hidden="true"
  >
    <path d={getRewardShapePath(selectedShape)} />
  </svg>
)}
```

Remove the phase-2 placeholder comment and keep particles for every variant.

- [ ] **Step 4: Resolve custom images in the overlay**

Add `assets?: AssetItem[]` and `getMediaUrl?: (path: string) => string` props to `SparkOverlay`. Read `badgeConfig`, create an asset map, call `resolveRewardAppearance` for each burst, and pass the resolved URL to `SparkBurst`.

Use `REWARD_DEFINITIONS[latestVariant].colorRgb` for the counter glow so crown is type-safe.

At the `SparkOverlay` call in `App.tsx`, pass:

```tsx
<SparkOverlay
  assets={project?.data.assets || []}
  getMediaUrl={toMediaUrl}
/>
```

- [ ] **Step 5: Add crown animation and reduced-motion CSS**

Rename `.spark-svg-main` to `.spark-main-visual` and retain the standard animation. Add:

```css
.spark-main-visual--crown {
  animation-name: crown-drop-land;
  animation-duration: calc(var(--spark-burst-duration, 0.8s) * 1.35);
  animation-timing-function: cubic-bezier(0.18, 0.78, 0.26, 1);
}

@keyframes crown-drop-land {
  0% { transform: translateY(-220px) scale(1.35) rotate(-8deg); opacity: 0; }
  48% { transform: translateY(12px) scale(1.1) rotate(3deg); opacity: 1; }
  66% { transform: translateY(-24px) scale(0.96) rotate(-2deg); }
  82% { transform: translateY(4px) scale(1.02) rotate(1deg); }
  100% { transform: translateY(0) scale(1); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .spark-main-visual--crown {
    animation-name: crown-reduced-motion;
  }
}

@keyframes crown-reduced-motion {
  from { transform: scale(0.85); opacity: 0; }
  to { transform: scale(1); opacity: 0; }
}
```

- [ ] **Step 6: Verify tests and renderer build**

Run:

```powershell
npm test
npm run build:renderer
```

Expected: tests pass and Vite build exits 0.

- [ ] **Step 7: Commit functional reward rendering**

```powershell
git add src/shared/sparkRewards.ts src/shared/sparkRewards.test.ts src/renderer/sparks/SparkBurst.tsx src/renderer/sparks/SparkOverlay.tsx src/renderer/sparks/sparkStyles.css src/renderer/App.tsx
git commit -m "feat: render crown and custom reward shapes"
```

### Task 4: Build the Four-Reward Appearance Editor

**Files:**
- Modify: `src/shared/sparkRewards.ts`
- Modify: `src/shared/sparkRewards.test.ts`
- Modify: `src/renderer/sparks/BadgePanel.tsx:35-145,560-650`
- Modify: `src/renderer/sparks/sparkStyles.css`

- [ ] **Step 1: Add a failing immutable asset-map test**

Add `setRewardAssetId` to the existing import from `./sparkRewards` and append:

```ts
test("setting and removing one reward PNG preserves the other asset slots", () => {
  const initial = { gold: "gold-image", blue: "blue-image" };
  const withCrown = setRewardAssetId(initial, "crown", "crown-image");
  assert.deepEqual(withCrown, {
    gold: "gold-image",
    blue: "blue-image",
    crown: "crown-image",
  });
  assert.deepEqual(initial, { gold: "gold-image", blue: "blue-image" });
  assert.deepEqual(setRewardAssetId(withCrown, "crown", undefined), {
    gold: "gold-image",
    blue: "blue-image",
  });
});
```

Run:

```powershell
npx tsc -p tsconfig.test.json
```

Expected: FAIL because `setRewardAssetId` does not exist.

- [ ] **Step 2: Implement the immutable asset-map helper**

Add:

```ts
export function setRewardAssetId(
  current: BadgeConfig["badgeSparkAssetIds"] | undefined,
  variant: SparkAwardVariant,
  assetId: string | undefined,
): NonNullable<BadgeConfig["badgeSparkAssetIds"]> {
  const next = { ...(current || {}) };
  if (assetId) next[variant] = assetId;
  else delete next[variant];
  return next;
}
```

Run `npm test`; expected all tests pass.

- [ ] **Step 3: Generalize PNG import to all four rewards**

Change `importSparkPngForVariant` to accept `SparkAwardVariant`. Keep `decorateImportedAssetsForContext`, select the first normalized `mediaType === "image"` asset, and return without state changes for cancellation or non-image imports.

Add a `removeSparkPngForVariant` function that uses the tested helper and updates both `setBadgeConfig` and `project.data.badgeConfig` without removing the underlying project asset:

```ts
const removeSparkPngForVariant = (variant: SparkAwardVariant) => {
  if (!project) return;
  const nextAssetIds = setRewardAssetId(badgeConfig.badgeSparkAssetIds, variant, undefined);
  const nextBadgeConfig = { ...badgeConfig, badgeSparkAssetIds: nextAssetIds };
  setBadgeConfig({ badgeSparkAssetIds: nextAssetIds });
  onUpdateProject({ data: { ...project.data, badgeConfig: nextBadgeConfig } });
};
```

- [ ] **Step 4: Replace placeholder shape selects with reward cards**

Map `REWARD_VARIANTS` and render one card per reward. Each card:

- Resolves the current built-in shape with the reward default.
- Finds the custom asset by ID in `project.data.assets`.
- Shows either a media thumbnail or the shared SVG path.
- Provides a shape select with star, diamond, circle, heart, and crown.
- Provides Upload/Change PNG and Remove PNG buttons.
- Uses `setSparkConfig` for the shape and persists imported assets through `onUpdateProject`.

The shape select must use `SparkShape`, and the buttons must call the generalized functions with the current `SparkAwardVariant`.

- [ ] **Step 5: Add a crown test trigger and compact card styles**

Render four equal test buttons and add `.reward-appearance-grid`, `.reward-appearance-card`, `.reward-appearance-preview`, and `.reward-appearance-actions` styles. Keep the settings panel vertically scrollable at narrow widths.

- [ ] **Step 6: Verify compile and build**

Run:

```powershell
npm test
npm run build:renderer
```

Expected: all tests pass and the renderer build exits 0.

- [ ] **Step 7: Commit the appearance editor**

```powershell
git add src/shared/sparkRewards.ts src/shared/sparkRewards.test.ts src/renderer/sparks/BadgePanel.tsx src/renderer/sparks/sparkStyles.css
git commit -m "feat: add reward shape and PNG editor"
```

### Task 5: Add Safe Badge Sprite Creation, Sizing, and Layer Helpers

**Files:**
- Modify: `src/shared/sparkRewards.ts`
- Modify: `src/shared/sparkRewards.test.ts`

- [ ] **Step 1: Write failing sprite preservation, sizing, and layer tests**

Append:

```ts
import {
  ensureRewardSprites,
  moveRewardSpriteLayer,
  resizeRewardSprite,
} from "./sparkRewards";

test("adding crown sprites preserves every existing sprite record", () => {
  const existing = [
    { id: "gold-1", studentId: "student-1", variant: "gold" as const, x: 10, y: 20, width: 140, height: 170, zIndex: 20 },
    { id: "blue-1", studentId: "student-1", variant: "blue" as const, x: 150, y: 20, width: 140, height: 170, zIndex: 21 },
  ];
  const student = normalizeSparkStudent(legacyStudent, () => "unused")!;
  let nextId = 0;
  const next = ensureRewardSprites(existing, [student], () => `new-${++nextId}`);
  assert.equal(next[0], existing[0]);
  assert.equal(next[1], existing[1]);
  const pink = next.find((sprite) => sprite.variant === "pink");
  const crown = next.find((sprite) => sprite.variant === "crown");
  assert.ok(pink);
  assert.ok(crown);
  assert.equal(crown.width, crown.height);
});

test("aspect locked resize clamps width and keeps the saved ratio", () => {
  const sprite = { id: "s", studentId: "student-1", variant: "crown" as const, x: 0, y: 0, width: 200, height: 100 };
  assert.deepEqual(resizeRewardSprite(sprite, 800, { min: 60, max: 420 }), {
    width: 420,
    height: 210,
  });
});

test("layer controls move only the selected sprite", () => {
  const sprites = [
    { id: "a", studentId: "student-1", x: 0, y: 0, width: 100, height: 100, zIndex: 20 },
    { id: "b", studentId: "student-1", x: 0, y: 0, width: 100, height: 100, zIndex: 21 },
  ];
  const next = moveRewardSpriteLayer(sprites, "a", "forward");
  assert.equal(next.find((sprite) => sprite.id === "a")?.zIndex, 22);
  assert.equal(next.find((sprite) => sprite.id === "b")?.zIndex, 21);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
npx tsc -p tsconfig.test.json
node --test dist-test/shared/sparkRewards.test.js
```

Expected: FAIL because the sprite helpers do not exist.

- [ ] **Step 3: Implement minimal sprite helpers**

Add pure helpers that:

- Copy the incoming sprite array.
- For each visible student, add every missing reward variant; never rewrite existing objects.
- Place missing sprites after the highest right edge in the student's existing group, bounded to a sensible default stage area.
- Use a square `140 x 140` default for crown.
- Clamp requested sizing from 60 to 420 and derive height from the sprite's current `width / height` ratio.
- Move only the selected z-index to `max + 1` for forward or `min - 1` for backward, clamped to safe integer bounds.

Use this public API:

```ts
export function ensureRewardSprites(
  sprites: BadgeStudentSprite[],
  students: SparkStudent[],
  createId: () => string,
): BadgeStudentSprite[];

export function resizeRewardSprite(
  sprite: BadgeStudentSprite,
  requestedWidth: number,
  bounds?: { min: number; max: number },
): Pick<BadgeStudentSprite, "width" | "height">;

export function moveRewardSpriteLayer(
  sprites: BadgeStudentSprite[],
  spriteId: string,
  direction: "forward" | "backward",
): BadgeStudentSprite[];
```

- [ ] **Step 4: Run focused and full tests**

Run:

```powershell
node --test dist-test/shared/sparkRewards.test.js
npm test
```

Expected: all focused and full tests pass.

- [ ] **Step 5: Commit sprite behavior**

```powershell
git add src/shared/sparkRewards.ts src/shared/sparkRewards.test.ts
git commit -m "feat: add safe badge sprite editing helpers"
```

### Task 6: Replace the Clunky Badge Stage Interaction

**Files:**
- Modify: `src/renderer/App.tsx:710-820,840-900,4270-4850`
- Modify: `src/renderer/sparks/BadgePanel.tsx`
- Modify: `src/renderer/sparks/sparkStyles.css`

- [ ] **Step 1: Add ephemeral selection state in App**

Add:

```ts
const [selectedBadgeSpriteId, setSelectedBadgeSpriteId] = useState<string | null>(null);
```

Pass the selected ID and setter to every `BadgePanel` instance and to `BadgeStudentSprites`. Clear the selection when leaving Edit mode or when the selected sprite no longer exists. Do not store this ID in `ProjectData` or live-session snapshots.

- [ ] **Step 2: Render four variants and preserve old layouts**

In `BadgeStudentSprites`:

- Use `REWARD_VARIANTS`.
- In an effect, call `ensureRewardSprites` through the existing Badge config update path only when reward sprites are missing for visible students; never update Badge config during render.
- Resolve each sprite's asset with `resolveRewardAppearance`; use a built-in SVG when no valid asset exists.
- Include crown in `getVariantSparkCount`.
- Attach `data-student-name` and `data-reward-label` for editing guides.

Do not regenerate the three existing variants or overwrite their records.

- [ ] **Step 3: Lock stage resizing and make handles compact**

Update `Rnd`:

```tsx
lockAspectRatio
enableResizing={isEditMode && isSelected
  ? { topLeft: true, topRight: true, bottomLeft: true, bottomRight: true }
  : false}
minWidth={60}
minHeight={60}
maxWidth={420}
maxHeight={420}
```

On click, stop propagation and select the sprite. On resize stop, save the position and the actual locked dimensions. Apply editing classes:

```tsx
className={[
  "badge-sprite-editor-box",
  isEditMode ? "is-editable" : "",
  isSelected ? "is-selected" : "",
].filter(Boolean).join(" ")}
```

- [ ] **Step 4: Add the panel selection list and compact inspector**

In `BadgePanel`, derive all visible student/reward sprite rows. Each row selects the corresponding sprite even when covered on stage. For the selected record, render:

- Student and reward label.
- A width-based slider from 60 to 420 using `resizeRewardSprite`.
- Forward and Backward buttons using `moveRewardSpriteLayer`.
- Current dimensions.

Update only `badgeConfig.badgeSprites`; no asset or student records change.

- [ ] **Step 5: Add editing-only guide styles**

Add CSS that:

- Uses a subtle dashed outline for every `.is-editable` sprite box.
- Uses a bright solid outline and translucent background for `.is-selected`.
- Shows a small `Student · Reward` label using pseudo-element/data attributes.
- Keeps guides and labels absent outside `.is-editable`.
- Uses 12px corner handles that remain visible without creating a large opaque box.

- [ ] **Step 6: Run the automated verification**

Run:

```powershell
npm test
npm run build:renderer
npm run build:main
```

Expected: all tests pass; both TypeScript/Vite builds exit 0.

- [ ] **Step 7: Commit badge editing**

```powershell
git add src/renderer/App.tsx src/renderer/sparks/BadgePanel.tsx src/renderer/sparks/sparkStyles.css
git commit -m "feat: improve badge reward sizing and overlap editing"
```

### Task 7: Wire the Crown Hotkey and Final Scores

**Files:**
- Modify: `src/renderer/App.tsx:535-681`
- Modify: `src/renderer/sparks/BadgePanel.tsx:250-350`
- Modify: `src/renderer/sparks/FinalBadgeOverlay.tsx:1-180`
- Modify: `src/renderer/sparks/sparkStyles.css`

- [ ] **Step 1: Use the tested hotkey mapping**

In `SparkHotkeyHandler`, keep the existing editable-target guard and Backspace active-student cycling. Replace the three inline reward branches with:

```ts
const rewardVariant = getRewardVariantForKey(e.key);
if (rewardVariant) {
  e.preventDefault();
  triggerSpark(rewardVariant);
  return;
}
```

This makes both `p` and shifted `P` award crown only in Teach mode.

- [ ] **Step 2: Update Spark Lab and student summaries**

Add a Crown button to Spark Lab and Badge test triggers. Show `C: {student.crowns || 0}` in the student summary while keeping the existing counts and active indicator.

- [ ] **Step 3: Update the final badge**

Add a crown chip:

```tsx
<span className="badge-spark-chip crown">Crowns: {student.crowns || 0}</span>
```

Keep `getStudentSparkTotal(student)` as the source for per-student and class totals. Change the legacy metadata label from `Stars` to `Total Rewards` so the crown-inclusive value is not mislabeled, while retaining the underlying `stars` compatibility field.

Add a `.badge-spark-chip.crown` gold/orange treatment distinct from the yellow star chip.

- [ ] **Step 4: Run full verification**

Run:

```powershell
npm test
npm run build:renderer
npm run build:main
```

Expected: all tests pass; renderer and main builds exit 0.

- [ ] **Step 5: Commit hotkey and score display**

```powershell
git add src/renderer/App.tsx src/renderer/sparks/BadgePanel.tsx src/renderer/sparks/FinalBadgeOverlay.tsx src/renderer/sparks/sparkStyles.css
git commit -m "feat: award crowns with P and show competition wins"
```

### Task 8: Backward-Compatibility and Interaction Verification

**Files:**
- Verify: `src/shared/sparkRewards.test.ts`
- Verify: `src/main/main.ts`
- Verify: `src/renderer/App.tsx`
- Verify: `src/renderer/sparks/*`

- [ ] **Step 1: Run fresh automated checks**

Run:

```powershell
npm test
npm run build:renderer
npm run build:main
git diff --check HEAD~7..HEAD
```

Expected:

- All Node tests pass with zero failures.
- Renderer build exits 0.
- Main build exits 0.
- Diff check prints no whitespace errors.

- [ ] **Step 2: Compare a legacy project before and after load**

Use a copy of an existing version-4 project JSON that has three reward counts, custom star asset IDs, and saved badge sprite positions. Open and save the copy, then compare:

- Project version remains `4`.
- Existing asset IDs and asset records are unchanged.
- Yellow, blue, and pink counts are unchanged.
- `crowns` is `0`.
- `stars` equals the four-reward total.
- Existing sprite IDs, x/y, width/height, and variants are unchanged.
- Crown sprite records are additive only.

- [ ] **Step 3: Manually verify reward behavior in the app**

Run:

```powershell
npm run dev
```

In Teach mode:

- Select a student and press `P`.
- Confirm only that student's crown and total increase.
- Confirm the crown drops from above and bounces.
- Focus a text input and press `P`; confirm no crown is awarded.
- Press the existing three reward hotkeys and confirm unchanged behavior.
- Cycle active students with Backspace and confirm `P` follows the new active student.

- [ ] **Step 4: Manually verify appearance controls**

In Edit mode:

- Select each of star, diamond, circle, heart, and crown and trigger its reward.
- Upload a PNG independently for yellow, blue, pink, and crown.
- Confirm each uploaded PNG appears in its preview, burst, and badge sprite.
- Remove each PNG and confirm immediate fallback to the selected built-in shape.
- Temporarily make an asset reference unavailable and confirm project load/render falls back without crashing.

- [ ] **Step 5: Manually verify stage editing**

- Select every sprite using both the stage and panel list.
- Fully overlap two sprites; select the covered sprite from the list.
- Move it forward and backward and confirm visible ordering changes.
- Resize from each corner and with the slider.
- Confirm aspect ratio remains locked and size stays within 60–420px.
- Switch to Teach mode and confirm all outlines, labels, and handles disappear.
- Open the final badge and confirm crown counts and crown-inclusive totals.

- [ ] **Step 6: Review the requirement checklist**

Confirm every approved requirement is represented in the diff and verified:

- Crown reward on `P`.
- Same active-child targeting.
- Crown included in overall total and displayed separately.
- Distinct drop entrance.
- Four custom PNG slots.
- Five functional built-in shapes.
- Aspect-locked compact resizing.
- Selection and ordering for overlapped sprites.
- Backward-compatible JSON and live-session restoration.

- [ ] **Step 7: Commit any verification-only fixes after repeating RED/GREEN**

If manual verification exposes a defect, add a failing shared regression test where possible, verify it fails, implement the minimal fix, rerun all checks, stage only the regression test and its directly related source files, and commit with `fix: address crown reward verification finding`.
