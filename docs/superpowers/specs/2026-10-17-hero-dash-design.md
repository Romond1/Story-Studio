# Hero Dash

Implement a teacher-controlled Mastery activity in the existing Story Studio repository. Control owns logical progress and private notes. The existing Present snapshot relay carries a whitelisted student projection; Present mounts the race view directly inside its existing overlay shell. No extra windows, communication channel, webcam service, or translation service.

Phase 1: pure race reducer, six checkpoints plus a finish, modular low-poly racers, smooth movement and chase camera. Phase 2: Mastery registration, Control panel, image questions using existing media imports and asset references, episode activity persistence and portable episode reuse. Phase 3 follows verified Phases 1–2: track lengths, manual bonuses and lightweight effects.

The existing app has no 3D dependency. Add Three.js with capped pixel ratio, simple lit meshes, no shadows or post processing. Keep the renderer separate from React and progression rules. Pause freezes visual movement; question display freezes movement until resolved or hidden. Undo restores teacher actions. Race outcome follows awarded positions; no automatic handicaps.

Save configuration and notes in an episode activity; store imports in the episode media pool. Reopening uses durable asset IDs. Existing portable episode export/import is the cross-lesson media transfer mechanism. Runtime scores remain session-only. Test rule boundaries, privacy, validation and persistence, then exercise native Control/Present with an Electron smoke script and capture screenshots. Do not deploy.
