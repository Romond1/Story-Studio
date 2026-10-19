"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const visualMedia_1 = require("./visualMedia");
(0, node_test_1.default)('same media filename changes render identity across projects and reopen without changing authored reference', () => {
    const authored = 'media://assets/lesson%20image.png';
    const first = (0, visualMedia_1.visualMediaUrl)(authored, 'project-a:1');
    strict_1.default.notEqual(first, (0, visualMedia_1.visualMediaUrl)(authored, 'project-b:1'));
    strict_1.default.notEqual(first, (0, visualMedia_1.visualMediaUrl)(authored, 'project-a:2'));
    strict_1.default.equal((0, visualMedia_1.visualMediaUrl)(first, 'project-a:1'), first);
    strict_1.default.equal(authored, 'media://assets/lesson%20image.png');
    strict_1.default.equal(first.split('?')[0], authored);
});
(0, node_test_1.default)('visual namespace preserves other query values and only changes local lesson media', () => {
    strict_1.default.equal((0, visualMedia_1.visualMediaUrl)('/assets/run-hash.gif', 'scope'), '/assets/run-hash.gif');
    strict_1.default.equal((0, visualMedia_1.visualMediaUrl)('media://a.png?fit=contain#part', 'new'), 'media://a.png?fit=contain&sceneScope=new#part');
    strict_1.default.equal((0, visualMedia_1.visualMediaUrl)('media://a.png?sceneScope=old&fit=contain', 'new'), 'media://a.png?sceneScope=new&fit=contain');
});
(0, node_test_1.default)('CSS background image gets the same namespace while colors and gradients remain intact', () => {
    strict_1.default.equal((0, visualMedia_1.visualMediaBackground)("url('media://a.png')", 'new'), 'url("media://a.png?sceneScope=new")');
    strict_1.default.equal((0, visualMedia_1.visualMediaBackground)('linear-gradient(red, blue)', 'new'), 'linear-gradient(red, blue)');
});
