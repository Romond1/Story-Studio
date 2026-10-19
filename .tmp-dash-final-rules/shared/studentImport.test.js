"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const studentImport_1 = require("./studentImport");
(0, node_test_1.default)('legacy preview preserves distinct source IDs with identical names and strips private extras', () => {
    strict_1.default.deepEqual((0, studentImport_1.previewLegacyProfiles)(JSON.stringify({ studentRoster: [{ id: 'a', name: 'Same', history: 'private' }, { id: 'b', name: 'Same' }] })), [{ id: 'a', name: 'Same' }, { id: 'b', name: 'Same' }]);
});
(0, node_test_1.default)('legacy preview rejects ambiguous IDs, missing identity and oversized input', () => {
    for (const value of ['[{"id":"a","name":"A"},{"id":"a","name":"B"}]', '[{"name":"A"}]', '{}', 'x'.repeat(1_000_001)])
        strict_1.default.throws(() => (0, studentImport_1.previewLegacyProfiles)(value));
});
