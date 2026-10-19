"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const legacy_be_a_hero_v1_1 = require("./adventures/legacy-be-a-hero-v1");
const movement_1 = require("./movement");
const relics_1 = require("./relics");
const templates_1 = require("./modules/templates");
(0, node_test_1.default)('versioned legacy pack preserves movement identity and asset compatibility', () => {
    const pack = legacy_be_a_hero_v1_1.LEGACY_BE_A_HERO_V1;
    strict_1.default.equal(pack.id, 'legacy-be-a-hero');
    strict_1.default.equal(pack.version, 1);
    strict_1.default.deepEqual(pack.movementEvents.map(e => [e.id, e.gifRelativePath, e.shortcut]), [
        ['touch-color', 'assets/touch_color.gif', 'Numpad1'], ['run-in-place', 'assets/run.gif', 'Numpad2'], ['hero-pose', 'assets/hero_pose_mia.gif', 'Numpad3'], ['touch-head', 'assets/touch_head.gif', 'Numpad4'], ['touch-nose', 'assets/touch_nose.gif', 'Numpad5']
    ]);
    strict_1.default.deepEqual(movement_1.DEFAULT_MOVEMENT_EVENTS, pack.movementEvents);
    strict_1.default.deepEqual(movement_1.BUILT_IN_MOVEMENT_GIFS, pack.movementGifs);
    strict_1.default.notEqual(movement_1.DEFAULT_MOVEMENT_EVENTS, pack.movementEvents);
    strict_1.default.deepEqual(pack.movementGifs.filter(g => g.label.startsWith('Hero')), [{ label: 'Hero Pose - Mia', relativePath: 'assets/hero_pose_mia.gif' }, { label: 'Hero Pose - Yuki', relativePath: 'assets/hero_pose_yuki.gif' }]);
});
(0, node_test_1.default)('legacy questions and relic stages retain exact authored text', () => {
    strict_1.default.deepEqual(legacy_be_a_hero_v1_1.LEGACY_BE_A_HERO_V1.snakeQuestionLines, [
        'CLUE: They followed the glowing s__________ through the forest.', 'Answer: shard', '',
        'UNSCRAMBLE: deeper / The / forest / into / shard / moving / is', 'Answer: The shard is moving deeper into the forest.', '',
        'WHO SAID: "Do not rush, Yuki?"', 'Answer: Kage', '',
        'FINISH: The kids found a big old c__________ in the forest.', 'Answer: castle'
    ]);
    strict_1.default.deepEqual(relics_1.DEFAULT_RELIC_SYSTEM.stageTitles, { stage1: 'Echo Fragment Found', stage2: 'Echo Core Restored', stage3: 'Echo Stone Awakened' });
    strict_1.default.deepEqual(relics_1.DEFAULT_RELIC_SYSTEM.stageTitles, legacy_be_a_hero_v1_1.LEGACY_BE_A_HERO_V1.relicStageTitles);
});
(0, node_test_1.default)('new hosted module templates contain no legacy adventure content', () => {
    for (const type of ['activation-cards', 'language-snake', 'final-boss-hero']) {
        const config = (0, templates_1.createModuleTemplate)(type);
        strict_1.default.doesNotMatch(JSON.stringify(config), /Mia|Yuki|Kage|Echo (?:Stone|Core|Fragment)|glowing s__________/);
    }
});
