import { countLogicalBattleSlots } from "../rules/battleLine";
import { allCardsCatalog, type CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { resetRushPhaseFlags } from "../rules/turnModifiers";
import { initializeStartPhasePlayer } from "../rules/startPhase";
import {
  INITIAL_HAND_SIZE,
  hasWonByDamage,
  WIN_DAMAGE,
  hasLostByDeckOut,
} from "../types/game";
import { buildDefinitionMap } from "./catalog";
import { hasTurnRuleModifier } from "./scopedModifiers";

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
    exile: [],
    commander: [],
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

export function createGameForDecks(
  player1Deck: CardDefinition[],
  player2Deck: CardDefinition[],
  options: Omit<CreateGameOptions, "player1Deck" | "player2Deck"> = {},
): GameState {
  return createGame({
    player1Deck,
    player2Deck,
    ...options,
  });
}

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

/**
 * 敗北ダメージ閾値。
 * RS-244 命の泉: どちらかの場にあれば両者 9 点まで負けない。
 * RS-348 メディテーション: 配置者は 14 点まで負けない。
 */
export function loseDamageThreshold(
  state: Pick<GameState, "players">,
  playerId: PlayerId,
): number {
  let threshold = WIN_DAMAGE;
  const anyLifeSpring = (["player1", "player2"] as const).some((pid) =>
    state.players[pid].operation.some((c) => c.cardId === "RS-244"),
  );
  if (anyLifeSpring) threshold = Math.max(threshold, 9);
  if (state.players[playerId].operation.some((c) => c.cardId === "RS-348")) {
    threshold = Math.max(threshold, 14);
  }
  return threshold;
}

function hasLost(state: GameState, playerId: PlayerId): boolean {
  const player = state.players[playerId];
  return player.damage >= loseDamageThreshold(state, playerId) || hasLostByDeckOut(player);
}

/**
 * 勝者判定。両者が同時に敗北条件を満たした場合はターンプレイヤーの勝利
 * （公式FAQ RS-054 / RS-093）。
 */
export function checkWinner(state: GameState): PlayerId | null {
  const p1Lost = hasLost(state, "player1");
  const p2Lost = hasLost(state, "player2");
  if (p1Lost && p2Lost) return state.activePlayer;
  if (p1Lost) return "player2";
  if (p2Lost) return "player1";
  return null;
}

export function advancePhase(state: GameState): GameState {
  if (state.winner) return state;

  const phaseOrder = ["start", "charge", "rush", "battle", "end"] as const;
  const index = phaseOrder.indexOf(state.phase);
  let next: (typeof phaseOrder)[number] = phaseOrder[(index + 1) % phaseOrder.length] ?? "start";
  // RK-012 宏のオルゴール時計:「このターン、相手はバトルフェイズを飛ばす」。
  if (
    state.phase === "rush" &&
    next === "battle" &&
    hasTurnRuleModifier(state.players[state.activePlayer], "skip_battle_phase_this_turn")
  ) {
    next = "end";
  }

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

  if (state.phase === "battle" && next === "end") {
    // ルール: R-TIME-07 — 「自軍バトルフェイズを終えるときの並び順」はその瞬間だけを参照する。
    const ender = nextState.players[activePlayer];
    const positions: Record<string, number> = {};
    ender.battle.forEach((card, index) => {
      positions[card.instanceId] = countLogicalBattleSlots(ender.battle.slice(0, index)) + 1;
    });
    nextState = {
      ...nextState,
      players: {
        ...nextState.players,
        [activePlayer]: { ...ender, battlePositionsAtBattleEnd: positions },
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
