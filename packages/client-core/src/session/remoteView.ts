// 対人戦（オンライン）: the server sends each player only what they may see (engine view/viewFor.ts).
// The match screen was built for a person who is player1, so the client turns that view into a board
// where the person is always player1:
//  - materializeView puts the cards the person may see in a deck or the opponent's hand
//    (「山札を見て」 and the like, sent apart from the board) back into that zone, so the screen finds them;
//  - swapPlayers swaps player1 and player2 everywhere (keys, values, log lines) when the person is player2.
// Moves picked on that board are swapped back before they are sent (swapping twice gives the same value).
import type { CardInstance, GameAction, GameState, PlayerId } from "../engineApi";

/** What the client needs of a player's view (engine PlayerView). */
export type RemotePlayerView = {
  viewer: PlayerId;
  state: GameState;
  revealedCards: CardInstance[];
  revealedFrom?: Array<{ player: PlayerId; zone: "deck" | "hand" }>;
  actionPlayerId: PlayerId;
  legalActions: GameAction[];
};

const PLAYER_TOKEN = /player([12])/g;

function swapText(text: string): string {
  return text.includes("player") ? text.replace(PLAYER_TOKEN, (_, n: string) => (n === "1" ? "player2" : "player1")) : text;
}

/**
 * player1 ⇄ player2 in every string and object key of `value` (a deep copy). Card definitions are card data,
 * not the board, and are kept as they are.
 */
export function swapPlayers<T>(value: T): T {
  return swapValue(value, 0) as T;
}

function swapValue(value: unknown, depth: number): unknown {
  if (depth > 64) throw new Error("swapPlayers: too deep");
  if (typeof value === "string") return swapText(value);
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) return value.map((item) => swapValue(item, depth + 1));
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  // Keys keep their places: { player1: A, player2: B } becomes { player1: B', player2: A' } (not player2 first),
  // so code that walks the players in key order walks them in the same order.
  for (const key of Object.keys(source)) {
    const swapped = swapText(key);
    const pairKept = swapped !== key && Object.prototype.hasOwnProperty.call(source, swapped);
    const outKey = pairKept ? key : swapped;
    const item = pairKept ? source[swapped] : source[key];
    out[outKey] = depth === 0 && key === "definitions" ? item : swapValue(item, depth + 1);
  }
  return out;
}

/**
 * The view's board with the cards the person may see in a deck or a hand put back in that zone (in place of
 * face-down cards, from the top: the server does not say where in the deck they are).
 */
export function materializeView(view: RemotePlayerView): GameState {
  const state = view.state;
  const from = view.revealedFrom ?? [];
  if (view.revealedCards.length === 0 || from.length !== view.revealedCards.length) return state;
  const players = { ...state.players } as Record<PlayerId, GameState["players"][PlayerId]>;
  const copied = new Set<string>();
  view.revealedCards.forEach((card, i) => {
    const at = from[i]!;
    const key = `${at.player}:${at.zone}`;
    if (!players[at.player]) return;
    if (!copied.has(key)) {
      players[at.player] = { ...players[at.player], [at.zone]: [...players[at.player][at.zone]] };
      copied.add(key);
    }
    const zone = players[at.player][at.zone];
    const slot = zone.findIndex((c) => c.cardId === "?" && c.instanceId.startsWith("?"));
    if (slot >= 0) zone[slot] = { ...card, ...(zone[slot]!.faceDown ? { faceDown: true } : {}) };
  });
  return { ...state, players };
}

/** The board the match screen draws for the viewer (the viewer as player1). */
export function screenState(view: RemotePlayerView): GameState {
  const state = materializeView(view);
  return view.viewer === "player2" ? swapPlayers(state) : state;
}

/** The viewer's legal moves as the screen sees them (the viewer as player1). */
export function screenActions(view: RemotePlayerView): GameAction[] {
  return view.viewer === "player2" ? swapPlayers(view.legalActions) : view.legalActions;
}

/** A move picked on the screen, as the server expects it (the viewer's own player id). */
export function serverAction(viewer: PlayerId, action: GameAction): GameAction {
  return viewer === "player2" ? swapPlayers(action) : action;
}
