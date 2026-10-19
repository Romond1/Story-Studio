import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

test("Vite emits relative asset URLs for packaged file loading", () => {
  const config = readFileSync(path.resolve(process.cwd(), "vite.config.ts"), "utf8");
  assert.match(config, /base:\s*['"]\.\/['"]/);
});

test('release includes every immutable builtin used to materialize portable Boss media', () => {
  const config = JSON.parse(readFileSync(path.resolve('package.json'), 'utf8'));
  for (const name of ['start', 'finish', 'move', 'bonus', 'back3', 'roll-again', 'steal']) {
    const file = `games/final-boss-hero/assets/board-dash/${name}.png`;
    assert.ok(config.build.files.includes(file), `${file} must be shipped for offline export`);
    assert.deepEqual([...readFileSync(file).subarray(0, 8)], [137,80,78,71,13,10,26,10]);
  }
});
