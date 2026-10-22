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

export type CardDefinition = GameState["definitions"][string];

export type DeckEntry = { cardId: string; count: number };

/** Deck building over the full card pool (rules from @rangers-strike/cards). */
export interface DeckApi {
  /** Cards that may go into a deck (commanders excluded), in catalog order. */
  readonly cards: readonly CardDefinition[];
  validate(entries: readonly DeckEntry[]): { ok: boolean; total: number; errors: string[] };
  /** Same-name key for the copy limit (variants of one card share it). */
  sameNameKey(card: CardDefinition): string;
  /** Copy limit per same name (Infinity for "any number" cards). */
  maxCopies(card: CardDefinition): number;
  /** Category codes of a card (ET, WB, OT, MA, DA). */
  categories(card: CardDefinition): string[];
  /** Card definitions for a match, one per copy. */
  build(entries: readonly DeckEntry[]): CardDefinition[];
}

export type StarterDeckInfo = {
  id: string;
  name: string;
  entries: { cardId: string; count: number }[];
};

export interface EngineApi {
  createStarterGame(options: {
    player1Starter?: string;
    player2Starter?: string;
    /** Custom decks (deck builder) take precedence over the starter ids. */
    player1Deck?: CardDefinition[];
    player2Deck?: CardDefinition[];
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
  /** The player's power: power zone + the opponent's multi-category commands (+ effect bonuses). */
  countAvailablePower(state: GameState, playerId: PlayerId): number;
  /** How much of that comes from multi-category cards in the opponent's command zone. */
  countOpponentMultiCategoryCommands(state: GameState, playerId: PlayerId): number;
  getEffectLabel(effectId: string): string;
  readonly starterDecks: Readonly<Record<string, StarterDeckInfo>>;
  readonly ALL_STARTER_DECK_IDS: readonly string[];
  readonly WIN_DAMAGE: number;
  readonly deckApi: DeckApi;
}

export const HUMAN: PlayerId = "player1";
export const CPU: PlayerId = "player2";
