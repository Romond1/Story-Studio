"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
(0, node_test_1.default)("Vite emits relative asset URLs for packaged file loading", () => {
    const config = (0, node_fs_1.readFileSync)(node_path_1.default.resolve(process.cwd(), "vite.config.ts"), "utf8");
    strict_1.default.match(config, /base:\s*['"]\.\/['"]/);
});
(0, node_test_1.default)('release includes every immutable builtin used to materialize portable Boss media', () => {
    const config = JSON.parse((0, node_fs_1.readFileSync)(node_path_1.default.resolve('package.json'), 'utf8'));
    for (const name of ['start', 'finish', 'move', 'bonus', 'back3', 'roll-again', 'steal']) {
        const file = `games/final-boss-hero/assets/board-dash/${name}.png`;
        strict_1.default.ok(config.build.files.includes(file), `${file} must be shipped for offline export`);
        strict_1.default.deepEqual([...(0, node_fs_1.readFileSync)(file).subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    }
});
