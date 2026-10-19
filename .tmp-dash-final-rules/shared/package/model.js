"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOSS_BUILTIN_REFS = exports.PACKAGE_LIMITS = exports.PACKAGE_CAPABILITIES = exports.ADVENTURE_DEFINITION_PATH = void 0;
exports.ADVENTURE_DEFINITION_PATH = 'definitions/adventure.json';
exports.PACKAGE_CAPABILITIES = ['derived-images-v1', 'manual-catalog-v1', 'bundled-modules-v1', 'adventure-definitions-v1'];
exports.PACKAGE_LIMITS = { maxFiles: 10000, maxFileBytes: 1024 * 1024 * 1024, maxTotalBytes: 4 * 1024 * 1024 * 1024, maxJsonBytes: 16 * 1024 * 1024 };
exports.BOSS_BUILTIN_REFS = ['start', 'finish', 'move', 'bonus', 'back3', 'roll-again', 'steal'].map(key => `builtin:final-boss-hero/assets/board-dash/${key}.png`);
