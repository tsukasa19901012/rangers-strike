import type { CardInstance, GameState, PlayerId } from "../types/game";
import { COMMAND_ZONE_MAX } from "../types/game";
import { cardName, getDefinition } from "../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../core/helpers";
import { getCardDslDocument } from "../dsl/effectLookup";
import {
  startGaroaGrudgeChoice,
  startMereChameleonChoice,
  startSilverBlazerChoice,
} from "./pendingChoices";

function shuffleDeck(deck: CardInstance[]): CardInstance[] {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

function cardHasKeyword(cardId: string, keyword: string): boolean {
  const doc = getCardDslDocument(cardId);
  return (
    doc?.effects?.some((effect) =>
      effect.effects.some((p) => p.type === "grant_keyword" && p.keyword === keyword),
    ) ?? false
  );
}

function playerHasMereChameleonOnField(state: GameState, playerId: PlayerId): string | null {
  const player = state.players[playerId];
  for (const card of [...player.rush, ...player.battle]) {
    if (card.cardId === "RS-504") return card.cardId;
    if (cardHasKeyword(card.cardId, "while_in_field_ally_enter_mere_chameleon")) {
      return card.cardId;
    }
  }
  return null;
}

/** RS-504: 臨獣カメレオン拳 — 味方バトル進入時。 */
export function tryMereChameleonOnAllyEnterBattle(
  state: GameState,
  playerId: PlayerId,
  entering: CardInstance,
  phasePlayerId: PlayerId,
): GameState {
  if (entering.cardId === "RS-504") return state;
  const name = cardName(state.definitions, entering.cardId);
  if (name === "獣人メレ" || name === "メレ") return state;

  const sourceCardId = playerHasMereChameleonOnField(state, playerId);
  if (!sourceCardId) return state;

  const withChoice = startMereChameleonChoice(state, {
    playerId,
    effectId: "kamereon_ken",
    sourceCardId,
    sourceInstanceId: entering.instanceId,
    phasePlayerId,
  });
  return withChoice ?? state;
}

/** RS-633: スタート終了時コマンドのホールド⇔捨札。 */
export function applyMegaSilverStartEndToggle(
  state: GameState,
  playerId: PlayerId,
): GameState {
  let next = state;
  const player = next.players[playerId];
  let command = [...player.command];
  let discard = [...player.discard];
  let changed = false;

  for (let i = 0; i < command.length; i += 1) {
    const card = command[i]!;
    if (card.cardId !== "RS-633" && !cardHasKeyword(card.cardId, "start_end_command_toggle_hold_discard")) {
      continue;
    }
    if (!card.commandHeld) {
      command[i] = { ...card, commandHeld: true, mothershipHold: false };
      changed = true;
    } else {
      const [removed] = command.splice(i, 1);
      if (removed) discard.push(removed);
      i -= 1;
      changed = true;
    }
  }

  if (!changed) return state;
  return {
    ...next,
    ...updatePlayer(next, playerId, { ...player, command, discard }),
  };
}

function splitDeckForPlayer(state: GameState, playerId: PlayerId): GameState {
  const player = state.players[playerId];
  if (player.deck.length < 2) return state;

  const pileA: CardInstance[] = [];
  const pileB: CardInstance[] = [];
  for (let i = 0; i < player.deck.length; i += 1) {
    const card = player.deck[i]!;
    if (i % 2 === 0) pileA.push(card);
    else pileB.push(card);
  }
  const chosen = pileA.length >= pileB.length ? pileA : pileB;
  const rejected = pileA.length >= pileB.length ? pileB : pileA;

  return {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      deck: shuffleDeck(chosen),
      discard: [...player.discard, ...rejected],
    }),
  };
}

/** RS-580: 全てを飲み込む飢餓 — ラッシュ時に双方の山札を2分割。 */
export function applyHungerGodOnRush(
  state: GameState,
  rusherPlayerId: PlayerId,
): GameState {
  const enemyId = opponent(rusherPlayerId);
  let next = splitDeckForPlayer(state, rusherPlayerId);
  next = splitDeckForPlayer(next, enemyId);
  return next;
}

/** RS-580: ユニットでなくなるとき、各プレイヤー捨札を山札に戻してシャッフル。 */
export function applyHungerGodCeaseShuffle(state: GameState): GameState {
  let next = state;
  for (const playerId of ["player1", "player2"] as const) {
    const player = next.players[playerId];
    if (player.discard.length === 0) continue;
    next = {
      ...next,
      ...updatePlayer(next, playerId, {
        ...player,
        deck: shuffleDeck([...player.deck, ...player.discard]),
        discard: [],
      }),
    };
  }
  return next;
}

export function applyGaroaGrudgeEnterBattle(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  if (state.activePlayer !== playerId) return state;
  const withChoice = startGaroaGrudgeChoice(state, {
    playerId,
    effectId: "no_e58fa4",
    sourceCardId: "RS-277",
    sourceInstanceId,
    phasePlayerId,
  });
  return withChoice ?? state;
}

export function applySilverBlazerEnterBattle(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  if (state.activePlayer !== playerId) return state;
  const withChoice = startSilverBlazerChoice(state, {
    playerId,
    effectId: "shirubabureiza",
    sourceCardId: "RS-633",
    sourceInstanceId,
    phasePlayerId,
  });
  return withChoice ?? state;
}

/** 捨札からコマンドゾーンへ（RS-504 枝）。 */
export function applyMereChameleonDiscardToCommand(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState | null {
  const player = state.players[playerId];
  if (player.command.length >= COMMAND_ZONE_MAX) return null;
  const found = findInZone(player, "discard", instanceId);
  if (!found) return null;
  const [, discard] = removeAt(player.discard, found.index);
  return {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      discard,
      command: [...player.command, { ...found.card, commandHeld: false }],
    }),
  };
}

/** 敵コマンド/パワー(表)のレッドユニットを敵ラッシュへ（RS-277）。 */
export function applyGaroaRedToEnemyRush(
  state: GameState,
  enemyId: PlayerId,
  instanceId: string,
): GameState | null {
  const enemy = state.players[enemyId];
  const cmdFound = findInZone(enemy, "command", instanceId);
  if (cmdFound) {
    const [, command] = removeAt(enemy.command, cmdFound.index);
    return {
      ...state,
      ...updatePlayer(state, enemyId, {
        ...enemy,
        command,
        rush: [...enemy.rush, cmdFound.card],
      }),
    };
  }
  const pwrFound = findInZone(enemy, "power", instanceId);
  if (pwrFound && !pwrFound.card.faceDown) {
    const [, power] = removeAt(enemy.power, pwrFound.index);
    return {
      ...state,
      ...updatePlayer(state, enemyId, {
        ...enemy,
        power,
        rush: [...enemy.rush, pwrFound.card],
      }),
    };
  }
  return null;
}
