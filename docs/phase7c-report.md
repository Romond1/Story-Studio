# Phase 7C Hero Board

Status: COMPLETE — focused verification, production builds and native acceptance passed.

## Contract and independent review

The Hero Board reads the existing private progression repository. Student and class filters intersect by stable student IDs, including archived profiles for historical review. Adventure and episode filters restrict recorded history; lifetime inventory and relic balances remain explicitly labelled as adventure totals rather than inferred episode earnings. Score records are labelled temporary session scores. Only positive balances of authored badge rewards appear as achievements.

Historical captured definitions and accepted transaction definitions supply labels, with the currently open authored definition taking precedence for the same adventure ID. Missing definitions fall back to stable IDs and do not invent badge classifications. Same-named adventures, rewards, and students remain separate. Selected history rows trim both participant IDs and scores to the selected students. Teacher adjustments reuse the existing Core panel and service with the open episode's definitions and scope, not the board's browsing filters.

Review identified a UI gap: adventure options initially came only from available definitions, leaving historical adventures without a definition unselectable despite their visible balances/history. The UI owner corrected this by unioning recorded adventure IDs with definition IDs; source review confirmed the raw-ID fallback. No cross-adventure balance or history leak was found. No application files were edited by the reviewer.

## Focused verification

Registered `src/shared/heroBoard.test.ts` in the shared test compiler. Fresh compilation and the Hero Board, progression, and class suites passed **16/16 tests**:

```text
npx tsc -p tsconfig.test.json
node --test dist-test/shared/heroBoard.test.js dist-test/shared/progression.test.js dist-test/shared/studentClasses.test.js
```

The six board tests cover same-name isolation, badge classification, relic thresholds, intersecting class/student filters, archived history, score redaction, episode participation with lifetime balances, chronological accepted definition labels, current-definition precedence, missing-definition fallback, nonmutation of source state, and participation without invented balances or achievements. The participation view unions captured runs, recorded history, and progress while applying the same stable-ID filters. The adjacent progression and class tests verify durable identity, exactly-once grants, guest exclusion, archived approval rejection, scoped manual changes, and membership persistence.

Renderer/main typechecks and production builds passed. The frozen-build native gate passed five groups with no Control or Present renderer errors: authentic Core progress across three episodes/two adventures/three profiles and two actual Snake completions; intersecting filters and badge-only achievements separate from temporary scores; episode-filtered history with explicitly retained adventure-lifetime totals; archived profile history; and an actual Hero Board teacher adjustment through the existing Core service without changing another adventure. Desktop and 620-pixel screenshots were inspected. This focused native gate does not claim an additional process-restart check; durable restart/replay remains covered by the earlier 6F/6G gates. Evidence: `docs/phase7c-evidence/native/results.json`, `hero-board.png`, and `hero-board-620.png`. All data and profiles were synthetic and disposable.



