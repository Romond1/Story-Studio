"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const mouseNavigation_1 = require("./mouseNavigation");
(0, node_test_1.test)('active lesson blocks only mouse/browser navigation commands', () => {
    for (const input of [3, 4, 'BrowserBack', 'BrowserForward', 'browser-backward', 'browser-forward']) {
        strict_1.default.equal((0, mouseNavigation_1.blocksMouseNavigation)(true, input), true);
        strict_1.default.equal((0, mouseNavigation_1.blocksMouseNavigation)(false, input), false);
    }
    for (const input of [0, 1, 2, 'ArrowLeft', 'ArrowRight', 'Backspace', 'Delete', 'z', 'media-play-pause']) {
        strict_1.default.equal((0, mouseNavigation_1.blocksMouseNavigation)(true, input), false);
    }
});
