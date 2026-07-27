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
