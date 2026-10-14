// The engine surface the client core needs. The core never imports the engine
// at runtime: each shell injects an implementation (the Vita shell passes a
// pre-bundled, data-pruned engine; tests pass the TypeScript sources; a web
// shell can pass `import * as engine from "@rangers-strike/engine"`).
import type {
  ActionResult,
  CardInstance,
  CpuLevel,
  GameAction,
  GameState,
  PlayerId,
} from "@rangers-strike/engine";

export type { ActionResult, CardInstance, CpuLevel, GameAction, GameState, PlayerId };

export type StarterDeckInfo = {
  id: string;
  name: string;
  entries: { cardId: string; count: number }[];
};

export interface EngineApi {
  createStarterGame(options: {
    player1Starter?: string;
    player2Starter?: string;
    seed?: number;
    firstPlayer?: PlayerId;
  }): GameState;
  getLegalActions(state: GameState): GameAction[];
  applyAction(state: GameState, action: GameAction): ActionResult;
  getActionPlayerId(state: GameState): PlayerId;
  isCpuTurn(state: GameState, cpuPlayer?: PlayerId): boolean;
  pickCpuAction(state: GameState, playerId?: PlayerId, level?: CpuLevel): GameAction | null;
  pickCpuFallbackAction(state: GameState, playerId: PlayerId): GameAction | null;
  formatGameLog(entry: string, definitions: GameState["definitions"]): string;
  formatActionError(error: string): string;
  effectiveBp(state: GameState, playerId: PlayerId, instance: CardInstance): number;
  getEffectLabel(effectId: string): string;
  readonly starterDecks: Readonly<Record<string, StarterDeckInfo>>;
  readonly ALL_STARTER_DECK_IDS: readonly string[];
  readonly WIN_DAMAGE: number;
}

export const HUMAN: PlayerId = "player1";
export const CPU: PlayerId = "player2";
