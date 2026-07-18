import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

test("Vite emits relative asset URLs for packaged file loading", () => {
  const config = readFileSync(path.resolve(process.cwd(), "vite.config.ts"), "utf8");
  assert.match(config, /base:\s*['"]\.\/['"]/);
});
