# Phase 6A — Proposed Core contracts

These are design contracts, not installed production types or a new on-disk format. They constrain the [6B plan](superpowers/plans/2026-10-12-phase6b-media-registry.md) and later independently authorized phases. Existing formats keep their current readers/writers until an explicit, backed-up conversion is available.

## Authority and physical placement

Core is a boundary around the existing domain services, not a second copy of state. Its document authority lives with the Control process's current immutable revision and `ProjectHistory`. Electron main remains the only filesystem writer and issuer of active-project leases. Present receives render plans, or an allowlisted bundled activity runtime with narrow ports. No module imports another module's mutable store, obtains a `setProject` callback, or writes student storage.

| Layer | Owns | Must not own |
| --- | --- | --- |
| Core document service | Current authored revision, validated commands, reference graph, module config, lesson context | Independent duplicates of `assets[]` or history |
| Core session coordinator | Run/occurrence identity, active participants, module lifecycle, accepted transient results | Permanent progress inside a lesson document |
| Main persistence services | Active-folder lease, media bytes, atomic lesson writes; later private progression transactions | Game timers, renderer layout or alternate authored revision |
| Control UI | Teacher selections, editing intentions, reward approvals | Ad hoc progression mutations bypassing Core |
| Present | Passive scene rendering; single hosted activity's ephemeral gameplay and supported input | Permanent student records or independent authoritative lesson saves |

Use the existing renderer domain transaction mechanism first; no Electron-main rewrite of the entire lesson store. A main-process media lease is an access/context index, not a mutable document replica.

## 6B: registry over existing records

The following names are proposed additions under `src/shared/content/`. `AssetItem`, `MediaBin`, `LessonProject`, `ProjectData` and `MediaType` remain their existing imports.

```ts
type ProjectDocument =
  | { format: 'scene'; data: LessonProject }
  | { format: 'legacy'; data: ProjectData };
type ProjectLease = { id: string }; // opaque, main-issued, runtime-only
type AssetRef = { assetId: string }; // local to this episode's registry
type AssetUse = {
  assetId: string;
  ownerType: 'scene' | 'card' | 'slide' | 'section' | 'booster'
    | 'reward' | 'relic' | 'movement' | 'bubble' | 'module';
  ownerId: string;
  field: string; // JSON pointer into the authored document
};
type DependencyIssue = {
  ownerId: string;
  field: string;
  kind: 'missing-id' | 'ambiguous-path' | 'unregistered-local'
    | 'builtin' | 'external-url' | 'embedded-data' | 'unknown-content';
  value: string;
};
type DependencyReport = {
  uses: readonly AssetUse[];
  issues: readonly DependencyIssue[];
  complete: boolean; // false for unresolved/unknown dependencies
};
type AssetResolution =
  | { ok: true; assetId: string; mediaType: MediaType; url: string }
  | { ok: false; code: 'missing' | 'ambiguous' | 'wrong-type' | 'stale-project'
      | 'unsafe-path' | 'unregistered'; assetId?: string };
interface MediaRegistryView {
  get(id: string): Readonly<AssetItem> | undefined;
  list(type?: MediaType): readonly Readonly<AssetItem>[];
  bins(): readonly Readonly<MediaBin>[];
  dependencies(): DependencyReport;
  usages(id: string): readonly AssetUse[];
}
interface AssetResolver {
  resolve(lease: ProjectLease, ref: AssetRef, expected?: MediaType): Promise<AssetResolution>;
}
```

`createMediaRegistry(document)` builds disposable maps/edges from an immutable document; it never rewrites IDs/paths or persists its index. Duplicate IDs and non-unique path aliases produce diagnostics and no arbitrary first-match resolution. Rebuild on document revision or memoize by object identity, not by mutable global project name. Async resolution is prefetched into a read-only render lookup before calling today's synchronous `projectScene`; never start async work inside projection. Existing synchronous render resolvers can wrap that lookup.

A registry can list all physical assets even when dependency analysis is incomplete. `complete` concerns graph coverage, not whether every unused pool item is placed. `builtin` is complete only for a recognized versioned built-in mapping; external URLs/data URLs remain reported for 6E materialization. No delete operation is exposed in 6B.

### Reference enumeration rules

Enumerate each authored field once (owner+JSON pointer), regardless of how often a scene/card is placed. For scene lessons, include backgrounds, images, audio, and **all card definitions**, not just active/library-selected cards. For legacy projects, include slide assets, audio clips/cues, section media/backgrounds/music, A/B definitions, Card V2 definitions, bubble definitions/custom images, badge/relic image slots and movement media. Follow `slideId`, `aCardId`, card placement and set links to report broken content references without multiplying dependency edges. Placement counts remain a separate UI concern.

Known URL/path compatibility matching accepts the two existing `media://` spellings, encoded segments and render-only queries. Decode once and compare canonical relative paths exactly; never infer dependencies by text substring. Path-only files receive an `unregistered-local` diagnostic with their original field and value; opening does not synthesize/persist new assets. A safe compatibility resolver continues rendering such files under the existing project scope. Registering old path-only files is an explicit later migration; newly imported bubble files can be registered immediately while retaining the legacy path field.

Unknown extension/module payloads must make dependency coverage incomplete rather than imply they contain no media. They remain unchanged in the source document. No real file garbage collection or byte deduplication is part of registry work.

### Import and resolution boundary

Keep `importProjectMedia` for copying. Main captures the active lease/folder before showing a picker, authenticates the Control caller, and pins the import through completion. The renderer registers returned records through one validated authored command with expected revision/lease and one history entry. Existing audio and bubble IPC signatures can be compatibility facades; new responses may include asset records without dropping old fields.

On project activation/Save As, main retires the old lease; outstanding resolution results are ignored by Control. The new resolver only issues URLs for a registered ID in the supplied immutable manifest and active scope. Main validates relative path syntax, lexical **and realpath** containment, file existence and lease. Treat the manifest as a validated access index tied to a revision; only Control can replace it. Revoke old grants before new snapshots are published. Grant IDs are temporary and never saved in `project.json`.

Add the scoped path alongside legacy URLs, preserving existing passive render-plan URL validation (`media://`). Existing local URLs remain a compatibility surface until their consumers are adapted; all changed consumers use leases. Tests must distinguish legacy compatibility behavior from the stronger new scoped contract.

## 6C: derived assets and semantic catalog

Introduce a new versioned episode envelope when persistent features first require it (6C); do not quietly add unsupported transforms to scene v1. Choose `story-studio-episode`, version 1, so older scene and legacy readers explicitly refuse it. The envelope reuses the scene/card submodel through version-specific validation, not by passing the new envelope to the old parser. 6C supports the basic envelope; 6D adds a gated module-config capability; 6E adds portable-package publication. Readers reject unsupported required capabilities.

```ts
type DefinitionRef = { adventureId: string; definitionId: string; version: string };
type ContentEntity = {
  id: string; adventureId: string;
  kind: 'character' | 'location' | 'item' | 'other';
  name: string; tags: string[]; assetIds: string[];
  tagAnnotations?: { tag: string; source: 'manual' | 'imported'; author?: string }[];
};
type ImageTransformV1 = {
  version: 1;
  crop?: { x: number; y: number; width: number; height: number }; // normalized source coordinates
  flipX?: boolean; rotation?: 0 | 90 | 180 | 270;
  brightness?: number; contrast?: number; saturation?: number;
};
type DerivedImage = {
  id: string; kind: 'derived-image'; sourceAssetId: string;
  transform: ImageTransformV1;
  presentation: { fit: 'cover' | 'contain'; aspectRatio?: number; focalX?: number; focalY?: number };
};
```

Keep physical assets and derived records in separate typed collections indexed by a unified ID namespace. IDs cannot collide. Initially derived images reference physical images only (no chains, cycles or derived video/audio); reject unsupported sources rather than rendering an approximate result. Apply crop, flip, rotation, then color adjustments in that documented order; constrain normalized crop to the source, positive aspect ratio and finite supported adjustment ranges. Use one shared transform implementation for preview/Present/export. Derived renders are disposable caches keyed by source digest plus canonical transform version/configuration. Keep originals byte-identical and never serialize cache URLs. Existing per-slide trim, adjustments and viewport remain intact unless explicitly mapped during conversion.

Entity identity is `(adventureId, entityId)`, never display name. Multiple assets can describe one entity; one asset can be associated with multiple entities. Collection IDs and manual tags are adventure-scoped. Store tagging provenance separately so a future schema can add automated annotations; implement no automated tagging in Phase 6.

## 6D: bundled module contract

```ts
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type ActivityInstance = {
  id: string; moduleType: string; moduleVersion: number;
  configVersion: number; config: Json;
};
type RunContext = {
  sessionId: string; runId: string; instanceId: string; occurrenceId: string;
  episodeId: string; adventureId: string; participantIds: string[];
};
type ActivityEvent = {
  version: 1; eventId: string; context: RunContext; sequence: number;
  type: 'activity-completed' | 'score-reported' | 'reward-requested';
  payload: Json;
};
interface ModulePorts {
  assets: AssetResolver;
  emit(event: ActivityEvent): Promise<{ accepted: boolean; reason?: string }>;
}
interface ModuleDefinition {
  type: string; version: number; configVersion: number;
  supportedInputs: readonly ('keyboard' | 'pointer' | 'teacher-command')[];
  rewardCapabilities: readonly ('request-reward' | 'report-score' | 'report-completion')[];
  parseConfig(value: unknown): Json; // throws field-specific validation errors
  collectAssets(config: Json): AssetRef[];
  create(ports: ModulePorts): ModuleRuntime;
}
interface ModuleRuntime {
  initialize(config: Json, context: RunContext, lease: ProjectLease): Promise<void>;
  start(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  reset(): Promise<void>;
  stop(): Promise<void>;
  dispose(): Promise<void>;
  exportAuthoredConfig(): Json;
}
```

These interfaces describe host behavior, not JavaScript objects sent through IPC. Serialize discriminated protocol messages with request IDs, protocol/module versions, host generation, run/instance IDs and validated payloads. Main authenticates sender/frame and active run; bridge validates origin/source; reject stale/duplicate messages. Ports contain no arbitrary code loader, file path writer, `localStorage` object or student mutation API. Registry entries remain statically bundled.

Lifecycle: initialized → running ↔ paused → stopped → disposed; failure always disposes listeners/audio/timers. Reset creates a new run ID; stop/dispose are idempotent. Pause must freeze game simulation/audio, not merely hide the iframe. Preserve native modifier input behavior and the single Present runtime. Adapter conformance tests cover every transition.

Core holds authored `ActivityInstance.config`. A hosted editor submits validated config-change commands with expected revision, then acknowledges the new revision before Save is considered current. Standalone game saves remain separate; hosted mode must not silently overwrite Core config with an auto-loaded device save. Snake's config adapter separates questions/setup/media from `game`; Final Boss's adapter separates `project` from `session`. Internal mini-games can keep their current registry and battle mechanics behind the Final Boss adapter.

Teacher-only questions/answers should not be added to passive scene snapshots. An interactive runtime may need its validated activity content to run; this is a separate explicitly scoped channel, not permission to send the full lesson, roster or progress database to Present.

## 6E: episode and portable package schemas

The new episode envelope owns: stable episode identity; adventure reference; scene/card/timeline content; source/derived registry and bins; module instances and ordered occurrences; definition references; required capabilities. A single episode ID is distinct from an adventure ID and a teaching session/run ID. Keep ordered Story/Activation sequences and add explicit Challenge/Mastery occurrences through versioned content, not ambiguous array concatenation.

```ts
type AdventureRef = { id: string; version: string };
type PackageManifestV1 = {
  format: 'story-studio-package'; version: 1;
  episodeId: string; adventure: AdventureRef;
  requiredCapabilities: string[];
  files: { path: string; bytes: number; sha256: string }[];
  definitions: DefinitionRef[];
  adventureDependencies: { adventureId: string; version: string; bundledPath: string; sha256: string }[];
};
```

Initially a portable project is one folder containing `project.json`, `manifest.json`, `assets/`, and versioned content definitions. Retain folder open/Save As infrastructure; a compressed archive is an optional transport, not a new authoring model. Normal saves preserve unused imported media/bins. Export includes all authored assets/definitions and their transitive dependencies, including unplaced cards and derived sources. Content hashes can deduplicate stored bytes while preserving distinct asset identities and metadata; do not conflate source identity with digest.

Default export bundles an immutable snapshot of every required adventure-level asset, catalog entry, reward and relic definition, with provenance/version/digest. References retain adventure identity but resolve from the package-local snapshot. No machine-specific installed-pack path is sufficient for a portable success. If an optional thin/reference export is ever added, label it non-self-contained and require exact installed version/digest at import; do not silently fall back to a different pack.

External/data media is enumerated by each module adapter. Embedded data can be materialized to validated files on explicit export; remote media must be explicitly acquired with provenance or reported as blocking. Missing local files, unsupported transforms/modules or incomplete dependency scans block a claim of portable completion. Do not replace missing required content with placeholders/default cards.

Construct export documents from an authored-field allowlist, never by copying arbitrary project keys or game saves wholesale. Exclude roster, student names/IDs bound to a run, scores, inventory, relic progress, session rewards/deduplication state, settings, localStorage recovery and Final Boss/Snake runtime checkpoints. Replace legacy student-specific badge placement bindings with unbound layout slots where explicitly converted. Archive the original separately; do not embed an unsanitized legacy backup in a shareable package. Run checkpoints, if supported, belong to a separate private recovery store.

Import validates paths, duplicate/colliding IDs, counts/size bounds, hashes, known format/capabilities, dependency closure and supported versions **before activation**. Reject traversal, absolute paths and symlink escapes; stage files outside the source; publish only after validation succeeds. Unsupported packages leave the active lesson and source untouched. A clean-profile offline open/render is the required portability test.

## 6F: progression and durable idempotency

Student identity extends the current app roster outside lesson folders. A private main-process progress repository stores adventure-scoped inventory/relic state and episode-scoped completion. Use stable student IDs; a temporary `lesson-class` or game player name is not automatically a permanent identity.

Commands: `RecordActivityCompletion`, `RecordScore`, `RequestReward`, `ApproveReward`, `RejectReward`, `GrantReward`, `UpdateInventory`, `AdvanceRelic`, `AdvanceEpisode`. Modules may submit the first three through declared capabilities. Only teacher/Core policy can authorize the remaining mutations. Expose accepted events (`ActivityCompleted`, `ScoreReported`, `RewardGranted`, `InventoryUpdated`, `RelicAdvanced`, `EpisodeAdvanced`) to interested modules as read-only results.

Persist idempotency keys `(adventureId, episodeId, runId, eventId)` alongside outcomes and a payload digest in the same atomic transaction as progress changes. An identical replay returns the original result; the same key with a different payload is rejected. Teacher decisions use separate stable command IDs and bind to the original request/result and explicit participant IDs. If a crash happens after commit but before acknowledgment, replay returns the committed outcome without another grant. Do not write a ledger and balance in separate uncoordinated files.

For the small initial local store, use one versioned snapshot containing progress+accepted-event outcomes, an atomic writer and serialized transactions; retain a recovery backup. Do not prune accepted IDs while their runs remain replayable. An eventual database can implement the same transaction interface without changing module APIs. Session animations may expire independently; replaying a visual cannot rescore.

Multi-student results use a captured participant list and per-participant scores/reward requests, not whichever student happens to be selected when an async event arrives. Validate identities, scope, module capability and expected run. No default auto-award: teacher approval is the initial policy. Existing legacy awards keep their current behavior until an explicit progression migration is selected; migrated episodes use the private repository. Do not write both legacy totals and the new permanent store for one event.

## Migration protocol (6C–6G, never implicit on open)

1. Read/detect source format without writing. Preflight all references and unsupported fields; report blockers before conversion.
2. Explicitly choose conversion into a new empty folder. Preserve a byte-for-byte source backup plus SHA-256 manifest in a private location; never overwrite the source to make it compatible.
3. Assign missing adventure/episode IDs explicitly; preserve asset/card/scene IDs when valid. Record any unavoidable collision remapping and update every typed reference atomically. Never use filenames or names as permanent identity.
4. Convert supported authored content. Keep opaque legacy fields in the private backup; unresolved features block a claimed complete migration, rather than being silently dropped. Keep the old workspace available.
5. Separately offer legacy progress import with explicit student identity mapping and conflict preview. Do not assume multiple episode totals are independent increments, merge by name, or extract them automatically during lesson import.
6. Validate/save/reopen the converted copy, compare authored structure/media and produce a migration report. Rollback means reopening the preserved original and restoring the private progress backup if progression import was performed.

No migration is implemented in 6A or required for the 6B registry view. Compatibility is a tested boundary, not a claim that new content can be round-tripped through an old writer.
