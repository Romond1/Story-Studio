# Boss editor usability implementation plan

1. Capture native zoom baseline and add usability smoke assertions (scripts/boss-editor-usability-smoke.cjs).
2. Extend HostedMediaPanel targets, thumbnail grid and labels. Wire card preview assignment in EditModeShell.
3. Add EditorPanelDivider and responsive CSS, test pointer/keyboard bounds.
4. Replace layout-changing zoom in BattleShell with transform scaling; add wheel normalization regression to fitPlayArea.test.cjs.
5. Build and run native usability and editor persistence workflows; inspect screenshots and record evidence. No commits or user project edits.
