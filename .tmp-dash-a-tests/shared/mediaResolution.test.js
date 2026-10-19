"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const mediaResolution_1 = require("./content/mediaResolution");
const mediaRenderResolution_1 = require("./content/mediaRenderResolution");
(0, node_test_1.default)('canonical media aliases decode once and retain exact path identity', () => {
    for (const value of ['media://assets/a%20日.png?render=1', 'media:///assets/a%20日.png', 'assets\\a 日.png'])
        strict_1.default.equal((0, mediaResolution_1.canonicalMediaPath)(value), 'assets/a 日.png');
    strict_1.default.equal((0, mediaResolution_1.compatibilityMediaUrl)('assets/a 日.png'), 'media://assets/a%20%E6%97%A5.png');
    for (const value of ['../x', '/absolute', 'C:\\x', 'assets/%2e%2e/x', 'assets/%252e%252e/x', 'https://x/a', 'assets/%2Fx', 'assets//x'])
        strict_1.default.equal((0, mediaResolution_1.canonicalMediaPath)(value), undefined, value);
});
(0, node_test_1.default)('render-only resolution scopes legacy URLs and CSS without rewriting authored values', () => {
    const authored = { url: 'media://assets/a.png', background: 'url("media:///assets/a.png")' };
    const before = JSON.stringify(authored);
    const resolve = (value) => (0, mediaResolution_1.canonicalMediaPath)(value) === 'assets/a.png' ? 'media://scoped/lease/grant' : undefined;
    strict_1.default.equal((0, mediaRenderResolution_1.resolveAuthoredMediaUrl)(authored.url, resolve), 'media://scoped/lease/grant');
    strict_1.default.equal((0, mediaRenderResolution_1.resolveAuthoredMediaUrl)('assets/missing.png', resolve), '');
    strict_1.default.equal((0, mediaRenderResolution_1.resolveAuthoredBackground)(authored.background, resolve), 'url("media://scoped/lease/grant")');
    strict_1.default.equal((0, mediaRenderResolution_1.resolveAuthoredBackground)('#111', resolve), '#111');
    strict_1.default.equal((0, mediaRenderResolution_1.resolveAuthoredBackground)('url("assets/missing.png")', resolve), 'none');
    strict_1.default.equal(JSON.stringify(authored), before);
});
