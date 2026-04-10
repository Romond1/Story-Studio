# Badge Student Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a remove-student control in badge edit mode that deletes the student from saved project data without changing the existing save schema.

**Architecture:** Reuse the current `sparkStudents` and `badgeConfig.badgeSprites` data model. Introduce a small shared helper that computes the next students, active student id, and cleaned badge sprite list after a removal so UI code can stay thin and existing saves remain compatible.

**Tech Stack:** TypeScript, React, Node test runner

---

### Task 1: Add shared removal logic and regression tests

**Files:**
- Create: `src/shared/badgeStudents.ts`
- Create: `src/shared/badgeStudents.test.ts`
- Modify: `tsconfig.test.json`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run test to verify it passes**

### Task 2: Wire removal into badge edit mode

**Files:**
- Modify: `src/renderer/sparks/SparkProvider.tsx`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Route provider removal through the shared helper**
- [ ] **Step 2: Add a remove control to badge-stage edit sprites**
- [ ] **Step 3: Preserve existing one-student guard and active-student fallback**
- [ ] **Step 4: Verify typecheck/build still succeeds**
