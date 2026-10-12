import { boardDashPlugin } from "./plugins/boardDash";
import { laneBattlePlugin } from "./plugins/laneBattle";
import { matchPairsPlugin } from "./plugins/matchPairs";
import { memoryRevealPlugin } from "./plugins/memoryReveal";
import { openBoxPlugin } from "./plugins/openBox";
import type { MiniGamePlugin } from "./types";
import type { MiniGameId } from "../types/game";

export const miniGamePlugins: MiniGamePlugin[] = [
  memoryRevealPlugin,
  matchPairsPlugin,
  laneBattlePlugin,
  openBoxPlugin,
  boardDashPlugin,
];

export const miniGameRegistry: Record<MiniGameId, MiniGamePlugin> = {
  memoryReveal: memoryRevealPlugin,
  matchPairs: matchPairsPlugin,
  laneBattle: laneBattlePlugin,
  openBox: openBoxPlugin,
  boardDash: boardDashPlugin,
};
