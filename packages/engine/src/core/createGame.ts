import { allCardsCatalog, type CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { resetRushPhaseFlags } from "../rules/turnModifiers";
import { initializeStartPhasePlayer } from "../rules/startPhase";
import {
  INITIAL_HAND_SIZE,
  hasWonByDamage,
  hasWonByDeckOut,
} from "../types/game";
import { buildDefinitionMap } from "./catalog";

let instanceCounter = 0;

function createInstance(cardId: string): CardInstance {
  instanceCounter += 1;
  return { instanceId: `${cardId}-${instanceCounter}`, cardId };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j] as T;
    copy[j] = tmp as T;
  }
  return copy;
}

function emptyPlayer(id: PlayerId): PlayerState {
  return {
    id,
    deck: [],
    hand: [],
    discard: [],
    power: [],
    command: [],
    rush: [],
    battle: [],
    operation: [],
    damage: 0,
  };
}

function drawCards(player: PlayerState, count: number): PlayerState {
  const next = { ...player, deck: [...player.deck], hand: [...player.hand] };
  for (let i = 0; i < count; i += 1) {
    const card = next.deck.shift();
    if (!card) break;
    next.hand.push(card);
  }
  return next;
}

function buildDeckInstances(
  cards: CardDefinition[],
  rng: () => number,
): CardInstance[] {
  return shuffle(
    cards.map((card) => createInstance(card.id)),
    rng,
  );
}

export type CreateGameOptions = {
  player1Deck: CardDefinition[];
  player2Deck: CardDefinition[];
  firstPlayer?: PlayerId;
  rng?: () => number;
};

export function createGame(options: CreateGameOptions): GameState {
  instanceCounter = 0;
  const rng = options.rng ?? Math.random;
  const firstPlayer = options.firstPlayer ?? "player1";

  const player1 = drawCards(
    {
      ...emptyPlayer("player1"),
      deck: buildDeckInstances(options.player1Deck, rng),
    },
    INITIAL_HAND_SIZE,
  );
  const player2 = drawCards(
    {
      ...emptyPlayer("player2"),
      deck: buildDeckInstances(options.player2Deck, rng),
    },
    INITIAL_HAND_SIZE,
  );

  return {
    turn: 1,
    activePlayer: firstPlayer,
    firstPlayer,
    /** 先攻1ターン目はスタートフェイズを省略（公式・チュートリアル準拠） */
    phase: "charge",
    players: { player1, player2 },
    definitions: {
      ...buildDefinitionMap([allCardsCatalog.cards]),
      ...buildDefinitionMap([options.player1Deck, options.player2Deck]),
    },
    log: ["game_created"],
    winner: null,
  };
}

export function checkWinner(state: GameState): PlayerId | null {
  const p1 = state.players.player1;
  const p2 = state.players.player2;

  if (hasWonByDamage(p1)) return "player2";
  if (hasWonByDamage(p2)) return "player1";
  if (hasWonByDeckOut(p1)) return "player2";
  if (hasWonByDeckOut(p2)) return "player1";
  return null;
}

export function advancePhase(state: GameState): GameState {
  if (state.winner) return state;

  const phaseOrder = ["start", "charge", "rush", "battle", "end"] as const;
  const index = phaseOrder.indexOf(state.phase);
  const next = phaseOrder[(index + 1) % phaseOrder.length] ?? "start";

  let turn = state.turn;
  let activePlayer = state.activePlayer;
  const log = [...state.log, `phase:${state.phase}->${next}`];

  if (state.phase === "end") {
    activePlayer = activePlayer === "player1" ? "player2" : "player1";
    turn += 1;
  }

  let nextState: GameState = {
    ...state,
    turn,
    activePlayer,
    phase: next,
    log,
    winner: checkWinner(state),
  };

  if (next === "rush") {
    nextState = {
      ...nextState,
      players: {
        ...nextState.players,
        [activePlayer]: resetRushPhaseFlags(nextState.players[activePlayer]),
      },
    };
  }

  if (next === "start") {
    nextState = {
      ...nextState,
      players: {
        ...nextState.players,
        [activePlayer]: initializeStartPhasePlayer(nextState.players[activePlayer]),
      },
    };
  }

  return nextState;
}
