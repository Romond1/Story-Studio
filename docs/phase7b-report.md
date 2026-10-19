# Phase 7B classes and enrollment

Status: COMPLETE — targeted verification, typechecks/builds and native acceptance passed.

Classes extend the existing private student settings authority. One student may belong to multiple classes without creating another identity. Enrollment preserves archived student IDs; active teaching loads exclude archived students. Archiving the active class clears its selection without silently choosing another. Restoration does not auto-select it.

Eight targeted checks passed, and renderer/main typechecks and production builds passed. The native gate passed all five groups on the frozen build, with no renderer errors:

- Three UI-created permanent students joined two classes, with one shared member and an active class selected before lesson opening.
- Teach loaded exactly the selected class's existing student identities.
- Rename, unenrollment, archive and restore preserved class identity and private progress, with explicit active-class clearing.
- Archived students retained historical membership while being excluded from active loading; restoration reused their original membership.
- Classes and active selection survived process restart, while a temporary guest was absent from persisted settings and the reopened session. Seeded private progression remained unchanged.

Evidence: `docs/phase7b-evidence/native/results.json`, `classes.png`, and `teach-class.png`. Both screenshots were inspected. The gate used disposable profiles, synthetic classes and a synthetic lesson. No production records or source lessons were changed. This phase's native evidence does not claim another full application-suite run beyond the separately reported targeted verification.
