"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createModuleTemplate = void 0;
exports.parseModuleConfig = parseModuleConfig;
exports.parseEpisodeActivity = parseEpisodeActivity;
const media_1 = require("./media");
const finalBossTypes_1 = require("./finalBossTypes");
const checks_1 = require("./checks");
const games = (0, checks_1.arr)((0, checks_1.one)(finalBossTypes_1.MINI_GAME_IDS));
const strings = (0, checks_1.arr)(checks_1.str);
const ids = (0, checks_1.arr)(checks_1.identity);
const fighter = (0, checks_1.shape)({ name: checks_1.str, portrait: checks_1.media, health: (0, checks_1.num)(), energy: (0, checks_1.num)() }, { description: checks_1.str, video: checks_1.media });
const rewardOptional = { icon: checks_1.icon, category: checks_1.str, applicableGames: games, effectType: checks_1.str, effectValue: (0, checks_1.num)(-1000000) };
const card = (0, checks_1.shape)({ id: checks_1.identity, title: checks_1.str, image: checks_1.media, value: (0, checks_1.num)(-1000000), pairId: checks_1.str, tags: strings }, { description: checks_1.str, frontImage: checks_1.media, backImage: checks_1.media, frontText: checks_1.str, backText: checks_1.str, textColor: checks_1.color, fontSize: (0, checks_1.num)(1, 1000), textAlign: (0, checks_1.one)(['left', 'center', 'right']), cardWidth: (0, checks_1.num)(1, 10000), cardHeight: (0, checks_1.num)(1, 10000), miniGames: games, boardDashQuestion: checks_1.str });
const boss = (0, checks_1.shape)({ encounter: (0, checks_1.shape)({
        id: checks_1.identity, name: checks_1.str, hero: fighter, villain: fighter,
        introSetup: (0, checks_1.shape)({ enabled: checks_1.bool, title: checks_1.str, subtitle: checks_1.str, startButtonLabel: checks_1.str, heroes: (0, checks_1.arr)((0, checks_1.shape)({ id: checks_1.identity, name: checks_1.str, portrait: checks_1.media }, { subtitle: checks_1.str, video: checks_1.media })) }),
        background: checks_1.background, selectedCardIds: ids, enabledMiniGames: (0, checks_1.arr)((0, checks_1.one)(finalBossTypes_1.MINI_GAME_IDS), 1, 5), gameOrder: (0, checks_1.arr)((0, checks_1.one)(finalBossTypes_1.MINI_GAME_IDS), 1, 100),
        roundSettings: (0, checks_1.shape)({ roundCount: (0, checks_1.num)(1, 1000, true), difficulty: (0, checks_1.one)(['easy', 'normal', 'hard']) }),
        rewards: (0, checks_1.arr)((0, checks_1.shape)({ id: checks_1.identity, name: checks_1.str, description: checks_1.str, value: (0, checks_1.num)(-1000000) }, rewardOptional)),
        powerUps: (0, checks_1.arr)((0, checks_1.shape)({ id: checks_1.identity, name: checks_1.str, description: checks_1.str, charges: (0, checks_1.num)(0, 100000, true) }, { ...rewardOptional, energyCost: (0, checks_1.num)() })),
        battleSettings: (0, checks_1.shape)({ heroStartHp: (0, checks_1.num)(), heroMaxHp: (0, checks_1.num)(1), heroStartEnergy: (0, checks_1.num)(), heroMaxEnergy: (0, checks_1.num)(), villainStartHp: (0, checks_1.num)(), villainMaxHp: (0, checks_1.num)(1), villainStartEnergy: (0, checks_1.num)(), villainMaxEnergy: (0, checks_1.num)(), resolution: (0, checks_1.shape)({ baseDamage: (0, checks_1.num)(), bonusDamagePerScore: (0, checks_1.num)(), drawDamage: (0, checks_1.num)(), participationEnergyCost: (0, checks_1.num)(), winnerEnergyGain: (0, checks_1.num)(), loserEnergyLoss: (0, checks_1.num)(), drawEnergyGain: (0, checks_1.num)() }) }),
        cutscenes: (0, checks_1.arr)((0, checks_1.shape)({ id: checks_1.identity, name: checks_1.str, mediaSource: checks_1.media, mediaType: (0, checks_1.one)(['image', 'video']), tags: strings }, { description: checks_1.str })),
        actionItems: (0, checks_1.arr)((0, checks_1.shape)({ id: checks_1.identity, text: checks_1.str }, { emoji: checks_1.str, category: checks_1.str })),
        boardDashMedallionCounts: (0, checks_1.shape)({ move: (0, checks_1.num)(0, 1000, true), bonus: (0, checks_1.num)(0, 1000, true), back3: (0, checks_1.num)(0, 1000, true), rollAgain: (0, checks_1.num)(0, 1000, true), steal: (0, checks_1.num)(0, 1000, true) }), boardDashCardLimit: (0, checks_1.num)(1, 2000, true), boardDashCardIds: ids,
        pointerHighlight: (0, checks_1.shape)({ enabledByDefault: checks_1.bool, shortcut: checks_1.str, paletteShortcut: checks_1.str, clickOnly: checks_1.bool, defaultPalette: (0, checks_1.one)(['kids', 'villain']), kidsColors: (0, checks_1.arr)(checks_1.color, 1, 100), villainColors: (0, checks_1.arr)(checks_1.color, 1, 100), ringSize: (0, checks_1.num)(1, 1000), trailSize: (0, checks_1.num)(1, 1000), trailLength: (0, checks_1.num)(0, 10000, true), fadeMs: (0, checks_1.num)(0, 100000), spawnMs: (0, checks_1.num)(1, 100000) })
    }, { gameBackgrounds: (0, checks_1.record)(checks_1.background, (0, checks_1.one)(finalBossTypes_1.MINI_GAME_IDS), 5) }), cardLibrary: (0, checks_1.arr)(card, 1) });
const direction = (value) => (0, checks_1.shape)({ up: value, down: value, left: value, right: value });
const snake = (0, checks_1.shape)({ questionText: checks_1.str, setup: (0, checks_1.shape)({ mode: (0, checks_1.one)(['versus', 'coop']), lessonType: (0, checks_1.one)(['solo', 'group']), boardWidth: (0, checks_1.num)(4, 100, true), boardHeight: (0, checks_1.num)(4, 100, true), crystalCount: (0, checks_1.num)(1, 10000, true), coopTimerSeconds: (0, checks_1.num)(10, 86400, true), playerCount: (0, checks_1.num)(2, 4, true) }),
    playerDirectionLabels: (0, checks_1.record)(direction(checks_1.str), (0, checks_1.one)(['player-1', 'player-2', 'player-3', 'player-4']), 4), playerKeyBindings: (0, checks_1.record)(direction((0, checks_1.arr)(checks_1.str, 1, 8)), (0, checks_1.one)(['player-1', 'player-2', 'player-3', 'player-4']), 4),
    heroCrownSettings: (0, checks_1.shape)({ enabled: checks_1.bool, frequency: (0, checks_1.one)(['low', 'medium', 'high']), expiresAfterMoves: (0, checks_1.num)(1, 10000, true), cosmeticDurationSeconds: (0, checks_1.num)(1, 86400), bonusValue: (0, checks_1.num)() }), heroCrownChallengeText: checks_1.str,
    enemySettings: (0, checks_1.shape)({ enabled: checks_1.bool, speed: (0, checks_1.one)(['slow', 'normal']), respawnDelayTurns: (0, checks_1.num)(1, 10000, true), defeatReward: (0, checks_1.num)() }),
    backgroundControls: (0, checks_1.shape)({ blur: (0, checks_1.num)(0, 100), brightness: (0, checks_1.num)(0, 10), overlay: (0, checks_1.num)(0, 1), panelOpacity: (0, checks_1.num)(0, 1), boardOpacity: (0, checks_1.num)(0, 1) }), backgroundImage: checks_1.media
}, { sounds: (0, checks_1.record)(checks_1.media, (0, checks_1.one)(['correct', 'wrong', 'eat', 'crash', 'crown', 'congrats', 'cheer', 'confetti', 'villain']), 9), music: checks_1.media });
function parseModuleConfig(type, value) {
    if (JSON.stringify(value)?.length > 4000000)
        (0, checks_1.fail)('config size');
    const validators = { 'language-snake': snake, 'final-boss-hero': boss, 'activation-cards': (0, checks_1.shape)({ sceneIds: ids }) };
    if (!Object.hasOwnProperty.call(validators, type))
        (0, checks_1.fail)('type');
    validators[type](value, 'config');
    const result = JSON.parse(JSON.stringify(value));
    if (type === 'final-boss-hero') {
        const b = result;
        const e = b.encounter;
        const cardIds = b.cardLibrary.map(c => c.id);
        (0, checks_1.unique)(cardIds, 'cardLibrary/id');
        for (const key of ['selectedCardIds', 'boardDashCardIds']) {
            (0, checks_1.unique)(e[key], `encounter/${key}`);
            if (e[key].some(id => !cardIds.includes(id)))
                (0, checks_1.fail)(`encounter/${key}`);
        }
        (0, checks_1.unique)(e.enabledMiniGames, 'enabledMiniGames');
        if (e.gameOrder.some(game => !e.enabledMiniGames.includes(game)))
            (0, checks_1.fail)('gameOrder');
        for (const values of [e.rewards, e.powerUps, e.actionItems, e.cutscenes, e.introSetup.heroes])
            (0, checks_1.unique)(values.map(v => v.id), 'nested identity');
        for (const side of ['hero', 'villain']) {
            if (e.battleSettings[`${side}StartHp`] > e.battleSettings[`${side}MaxHp`] || e.battleSettings[`${side}StartEnergy`] > e.battleSettings[`${side}MaxEnergy`])
                (0, checks_1.fail)('battleSettings bounds');
        }
    }
    if (type === 'activation-cards')
        (0, checks_1.unique)(result.sceneIds, 'sceneIds');
    const activity = { id: 'validation', moduleType: type, moduleVersion: 1, configVersion: 1, config: result };
    const builtinBoss = new Set(['start', 'finish', 'move', 'bonus', 'back3', 'roll-again', 'steal'].map(key => `builtin:final-boss-hero/assets/board-dash/${key}.png`));
    for (const ref of (0, media_1.collectModuleAssets)(activity))
        if (ref.ref.startsWith('builtin:') && (type !== 'final-boss-hero' || !builtinBoss.has(ref.ref)))
            (0, checks_1.fail)(`${ref.field} builtin reference`);
    return result;
}
function parseEpisodeActivity(value) {
    (0, checks_1.shape)({ id: checks_1.identity, moduleType: (0, checks_1.one)(['activation-cards', 'language-snake', 'final-boss-hero']), moduleVersion: (v, p) => { if (v !== 1)
            (0, checks_1.fail)(p); }, configVersion: (v, p) => { if (v !== 1)
            (0, checks_1.fail)(p); }, config: () => { } })(value, 'activity');
    const v = value;
    return { ...v, config: parseModuleConfig(v.moduleType, v.config) };
}
var templates_1 = require("./templates");
Object.defineProperty(exports, "createModuleTemplate", { enumerable: true, get: function () { return templates_1.createModuleTemplate; } });
