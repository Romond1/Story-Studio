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
const session_1 = require("./lesson/session");
const rewards_1 = require("./lesson/rewards");
/** Run the real event dispatcher with React's updater replay and deferred state commits. */
function harness() {
    const path = 'src/renderer/lesson/LessonRewardControls.tsx';
    const source = typescript_1.default.createSourceFile(path, (0, node_fs_1.existsSync)(path) ? (0, node_fs_1.readFileSync)(path, 'utf8') : '', typescript_1.default.ScriptTarget.Latest, true, typescript_1.default.ScriptKind.TSX);
    let declaration = '';
    const visit = (node) => {
        if (typescript_1.default.isVariableDeclaration(node) && typescript_1.default.isIdentifier(node.name) && node.name.text === 'commit')
            declaration = `const ${node.getText(source)};`;
        typescript_1.default.forEachChild(node, visit);
    };
    visit(source);
    strict_1.default.ok(declaration, 'Teaching rewards need a pure state dispatcher with a single audio side effect');
    const latest = { current: (0, rewards_1.initializeLessonRewards)((0, session_1.createSession)(), []) };
    const queue = [];
    const output = { chimes: 0, error: '' };
    const context = {
        latest, onSession: (updater) => { queue.push(updater); },
        audioManager: { playGeneratedChime: () => { output.chimes++; } },
        setError: (error) => { output.error = error; },
    };
    node_vm_1.default.createContext(context);
    node_vm_1.default.runInContext(typescript_1.default.transpileModule(`${declaration}\nglobalThis.commit=commit;`, { compilerOptions: { target: typescript_1.default.ScriptTarget.ES2021 } }).outputText, context);
    return { latest, queue, output, commit: context.commit };
}
(0, node_test_1.default)('reward click plays one chime even when React replays its state updater', () => {
    const h = harness(), before = h.latest.current;
    h.commit(session => (0, rewards_1.awardLessonReward)(session, 'gold', 'click', 1000), true);
    const first = h.queue[0](before), replay = h.queue[0](before);
    strict_1.default.deepEqual(first, replay);
    strict_1.default.equal(replay.rewards.students[0].stars, 1);
    strict_1.default.equal(h.output.chimes, 1);
    h.commit(session => (0, rewards_1.awardLessonReward)(session, 'gold', 'click', 1000), true);
    strict_1.default.equal(h.output.chimes, 1);
    strict_1.default.equal(h.queue.length, 1);
});
(0, node_test_1.default)('rapid reward clicks compose and queued events cannot mutate a replacement session', () => {
    const h = harness(), before = h.latest.current;
    h.commit(session => (0, rewards_1.awardLessonReward)(session, 'blue', 'first', 1000), true);
    h.commit(session => (0, rewards_1.awardLessonReward)(session, 'pink', 'second', 1001), true);
    const updated = h.queue.reduce((session, update) => update(session), before);
    strict_1.default.equal(updated.rewards.students[0].stars, 2);
    strict_1.default.equal(h.output.chimes, 2);
    const replacement = (0, rewards_1.initializeLessonRewards)((0, session_1.createSession)(), []);
    strict_1.default.equal(h.queue[0](replacement), replacement);
});
