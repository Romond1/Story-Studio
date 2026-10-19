export type GameSection = 'game' | 'mastery';
export interface GameSession { gameId: string; instanceId: string; moduleHost?: true }
export interface GameRegistration {
  id: string;
  title: string;
  description: string;
  entry: string;
  sections: readonly GameSection[];
  modes: readonly string[];
}
/** Bundled entries only. One Present iframe owns all gameplay, timers and audio. */
export const gameRegistry: readonly GameRegistration[] = [
  { id: 'hero-dash', title: 'Hero Dash', description: 'A teacher-led race through an enchanted forest. Ask image questions and help two heroes reach the finish.', entry: 'present.html', sections: ['mastery'], modes: ['Image questions', 'Two racers', 'Teacher controlled'] },
  { id: 'language-snake', title: 'Language Snake', description: 'Turn-based language practice with crystals, crowns and cooperative or versus play.', entry: 'language-snake.html', sections: ['game'], modes: ['Versus', 'Cooperative'] },
  { id: 'final-boss-hero', title: 'Final Boss Hero', description: 'Complete five card and question challenges to defeat the boss, earn rewards, and demonstrate your learning.', entry: 'final-boss-hero.html', sections: ['mastery'], modes: ['Memory Reveal', 'Match Pairs', 'Lane Battle', 'Open the Box', 'Board Dash'] },
];
export function getGame(id: string): GameRegistration | undefined { return gameRegistry.find(game => game.id === id); }
export function getGamesForSection(section: GameSection): readonly GameRegistration[] { return gameRegistry.filter(game => game.sections.includes(section)); }
export interface GameInputPacket {
  instanceId: string;
  key: string;
  code: string;
  phase: 'keydown' | 'keyup';
  repeat: boolean;
  shiftKey?: boolean;
}
export interface GameEndedEvent { instanceId: string; reason: 'closed' | 'reload' | 'crashed' }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const validId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 1024;
export function parseGameSession(value: unknown): GameSession | null {
  if (!object(value) || typeof value.gameId !== 'string' || !getGame(value.gameId) || !validId(value.instanceId)) return null;
  if (value.moduleHost !== undefined && value.moduleHost !== true) return null;
  return { gameId: value.gameId, instanceId: value.instanceId, ...(value.moduleHost === true ? { moduleHost: true as const } : {}) };
}
export function parseGameInput(value: unknown): GameInputPacket | null {
  if (!object(value) || !validId(value.instanceId) || typeof value.key !== 'string' || typeof value.code !== 'string' || !/^[A-Za-z][A-Za-z0-9]{0,31}$/.test(value.code) || !['keydown', 'keyup'].includes(String(value.phase)) || typeof value.repeat !== 'boolean') return null;
  if (value.ctrlKey === true || value.altKey === true || value.metaKey === true) return null;
  if (value.shiftKey !== undefined && typeof value.shiftKey !== 'boolean') return null;
  // Rebinding supports printable keys and ordinary physical navigation keys.
  if (!(value.key.length === 1 || /^(Arrow(Up|Down|Left|Right)|Escape|Enter|Tab|Backspace|Delete|Home|End|PageUp|PageDown|F([1-9]|1[0-2]))$/.test(value.key))) return null;
  return { instanceId: value.instanceId, key: value.key, code: value.code, phase: value.phase as GameInputPacket['phase'], repeat: value.repeat, ...(typeof value.shiftKey === 'boolean' ? { shiftKey: value.shiftKey } : {}) };
}
