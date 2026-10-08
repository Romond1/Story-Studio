# Research verification record

Date: 2026-10-07, Asia/Tokyo. This record verifies the investigation artifacts and existing code evidence, not an implemented Card V2.

## Scope

- Inspected the dirty working tree at Git HEAD `bd7440c` (`feat: toggle drawing with control d`), including existing uncommitted runtime, presentation and workspace refactors. HEAD alone does not reproduce the investigated code.
- Created only documentation/evidence under `D:/AI/GitHub/Story-Studio/docs/card-v2-research/` for the deliverable. Existing source changes were neither reverted nor incorporated into a commit.
- No application launch to open or save production lessons; no migrations, Card V2 implementation or production episode edits.
- No generated files in the existing `dist-test` were regenerated. Existing tests were compiled to `D:/Temp/story-card-v2-audit-6328bf1778d04ff385c8aeee4678e5f8/`.

## Existing-code verification

Run from `D:/AI/GitHub/Story-Studio`:

```powershell
npx tsc -p tsconfig.test.json --outDir 'D:\Temp\story-card-v2-audit-6328bf1778d04ff385c8aeee4678e5f8'
```

Compilation succeeded. The initial combined Node test invocation produced 30 passing tests from cardRuntime/presentationSession, then a dependency lookup failure for presentationSnapshot: the temporary output could not resolve the repository's `typescript` dependency. The attempted staticScene test path did not correspond to a standalone test suite; logical-frame checks live in presentationSnapshot. No staticScene standalone suite is claimed.

Re-ran only the failed snapshot suite with correct module lookup:

```powershell
$env:NODE_PATH = 'D:\AI\GitHub\Story-Studio\node_modules'
node --test 'D:\Temp\story-card-v2-audit-6328bf1778d04ff385c8aeee4678e5f8\shared\presentationSnapshot.test.js'
```

Result: 12 passed, zero failed. Aggregate verified existing tests: **42 passed** (7 cardRuntime, 23 presentationSession, 12 presentationSnapshot). The expected `[Present] Card content failed` diagnostic belongs to an error-path test; the suite completed successfully. No claim is made that the whole application test suite, release build or live UI was verified in this research phase.

## Episode evidence verification

Read the 17 discovered source files again and independently recomputed SHA-256 against `episode-source-discovery.json` after report assembly. Result: **17/17 match; zero changed sources**. The six selected numbered production sources are a subset of those 17. The source inventory records a read-only Episode 6 header inspection before the initial hash; all full analysis is within the hash-guarded interval.

The episode audit includes all nine raw ACard objects, all 137 BCard definitions, all 311 saved BCard placements, three ACard reference entries, media lookup/existence and exact-text ledger. The 460-record planning count is 9 + 137 + 311 + 3. These are potential structural conversion inputs, not successful migrations or rendered-card totals.

## Documentation checks

- Main report contains all 25 numbered sections, including every requested deliverable and explicit product-question answers.
- Both illustrative JSON blocks parse as JSON. They are design examples, not schema-certified V2 documents.
- Main-report local hyperlinks resolve; cited line numbers are in range. Architecture references link directly to source files where fully specified.
- Supporting evidence JSON parses; source/variant distinctions and field statistics are in the episode appendix.
- External product appendix distinguishes official documentation from UX assessment, implementation inference and unknown behavior. It includes the requested products and Mentimeter as an additional comparator.
- Cross-checked the key corrections: active runtime replaces old provider authority; Teach mutations are volatile; ACard timer anchor is shared; timer activation remains implicit; audio/animation metadata is not active runtime behavior.

## Explicit limits

No V2 behavior, text-fit algorithm, converter, screenshot parity, historical visual fidelity or classroom learning outcome has been validated. Current source inspection establishes likely geometry/overflow risks; it does not reproduce a live clipping defect. Existing card-media files were confirmed present, not decoded or played. Competitor research used public official documentation/source, not authenticated hands-on authoring tests. These boundaries are retained in the recommendations.
