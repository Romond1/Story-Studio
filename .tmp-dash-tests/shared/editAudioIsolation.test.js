"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_vm_1 = __importDefault(require("node:vm"));
const typescript_1 = __importDefault(require("typescript"));
const mediaRenderResolution_1 = require("./content/mediaRenderResolution");
const mediaResolution_1 = require("./content/mediaResolution");
/** Exercise real App callbacks, with broadcast effects observed at the boundary. */
function harness(mode) {
    const source = typescript_1.default.createSourceFile('App.tsx', (0, node_fs_1.readFileSync)('src/renderer/App.tsx', 'utf8'), typescript_1.default.ScriptTarget.Latest, true, typescript_1.default.ScriptKind.TSX);
    const declarations = [];
    const visit = (node) => {
        if (typescript_1.default.isVariableDeclaration(node) && typescript_1.default.isIdentifier(node.name)) {
            if (['removeSlideAudio', 'removeSectionBgm'].includes(node.name.text) || node.name.text === 'handleKeyDown' && node.getText(source).includes('NumpadAdd'))
                declarations.push(`const ${node.getText(source)};`);
        }
        typescript_1.default.forEachChild(node, visit);
    };
    visit(source);
    const clip = { url: 'media://assets/shared.mp3', volume: .5 };
    const slide = { id: 'edit-slide', bgm: clip }, section = { id: 'edit-section', bgm: [clip] };
    const calls = [];
    const urls = [];
    const context = { appMode: mode, project: { data: { slides: [slide], sections: [section] } }, currentSlide: slide, selectedSection: section,
        resolveAuthoredMediaUrl: mediaRenderResolution_1.resolveAuthoredMediaUrl, mediaRegistry: { resolvePath: (value) => (0, mediaResolution_1.canonicalMediaPath)(value) === 'assets/shared.mp3' ? 'media://scoped/current/grant' : undefined },
        audioManager: { stopClip: (url) => { calls.push('stopClip'); urls.push(url); }, stopSectionMusic: () => calls.push('stopSectionMusic'), setVolume: (url) => { calls.push('setVolume'); urls.push(url); } },
        setProject: (p) => { context.latest = p; }, setIsDirty: () => { }, updateSection: (_id, value) => { context.sectionUpdate = value; },
        isPlainTeacherKey: () => true, claimTeacherKey: () => { }, activeOverlayId: null };
    node_vm_1.default.createContext(context);
    const code = typescript_1.default.transpileModule(declarations.join('\n') + '\nglobalThis.commands={removeSlideAudio,removeSectionBgm,handleKeyDown};', { compilerOptions: { target: typescript_1.default.ScriptTarget.ES2021 } }).outputText;
    node_vm_1.default.runInContext(code, context);
    return { context, calls, urls, commands: context.commands };
}
(0, node_test_1.default)('removing Edit slide/section audio changes authored content without stopping Live', () => {
    const { commands, calls, context } = harness('edit');
    commands.removeSlideAudio('bgm');
    commands.removeSectionBgm(0);
    strict_1.default.equal(context.latest.data.slides[0].bgm, undefined);
    strict_1.default.equal(context.sectionUpdate.bgm.length, 0);
    strict_1.default.deepEqual(calls, []);
});
(0, node_test_1.default)('Edit section volume shortcuts update authored volume without changing broadcast volume', () => {
    const { commands, calls, context } = harness('edit');
    commands.handleKeyDown({ code: 'NumpadAdd', key: '+' });
    strict_1.default.equal(context.sectionUpdate.bgm[0].volume, .55);
    strict_1.default.deepEqual(calls, []);
});
(0, node_test_1.default)('Teach explicit audio removal still stops playback', () => {
    const { commands, calls, urls } = harness('teach');
    commands.removeSlideAudio('bgm');
    commands.removeSectionBgm(0);
    strict_1.default.deepEqual(calls, ['stopClip', 'stopClip', 'stopSectionMusic']);
    strict_1.default.deepEqual(urls, ['media://scoped/current/grant', 'media://scoped/current/grant']);
});
(0, node_test_1.default)('Teach volume uses the current grant while the authored URL remains stable', () => {
    const { commands, calls, urls, context } = harness('teach');
    commands.handleKeyDown({ code: 'NumpadAdd', key: '+' });
    strict_1.default.deepEqual(calls, ['setVolume']);
    strict_1.default.deepEqual(urls, ['media://scoped/current/grant']);
    strict_1.default.equal(context.sectionUpdate.bgm[0].volume, .55);
    strict_1.default.equal(context.sectionUpdate.bgm[0].url, 'media://assets/shared.mp3');
});
