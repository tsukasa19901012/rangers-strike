import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingMorph, PlayerId, PlayerState } from "../types/game";
import { getDefinition } from "../core/catalog";
import { findInZone, updatePlayer } from "../core/helpers";
import { buildLogEntry } from "../log/formatLog";
import { markFieldEntryHandled } from "../events/emitUnitRushed";
import { openEffectChoice } from "../rules/pendingChoices";
import { openRushCounterWindow } from "../rules/rushEffects";
import { cardHasKeyword } from "./cardKeywords";
import {
  featuresExactlyMatch,
  listMorphReplacementCandidates,
  MORPH_REPLACEMENT_ZONES,
} from "./morph";
import {
  morphOrderChooserPlayerId,
  morphReplacementChooserPlayerId,
  rushMethodBlocksMorphReaction,
  shouldMorphOrderChooserAct,
  type MorphReplacementZone,
  type RushMethod,
} from "../rules/morphProcedure";
import { applyOnRushUnitEffects } from "../rules/onRushUnitEffects";

type FieldZone = "rush" | "battle";

function findMorphUnit(
  player: PlayerState,
  instanceId: string,
): { zone: FieldZone; index: number; card: CardInstance } | null {
  for (const zone of ["rush", "battle"] as const) {
    const index = player[zone].findIndex((c) => c.instanceId === instanceId);
    if (index >= 0) return { zone, index, card: player[zone][index]! };
  }
  return null;
}

/** 置き換え先はコマンドゾーンとパワーゾーンだけ。ルール: R-KW-MORPH-02 */
function findReplacement(
  player: PlayerState,
  instanceId: string,
): { zone: MorphReplacementZone; index: number; card: CardInstance } | null {
  for (const zone of MORPH_REPLACEMENT_ZONES) {
    const index = player[zone].findIndex((c) => c.instanceId === instanceId);
    if (index >= 0) return { zone, index, card: player[zone][index]! };
  }
  return null;
}

/**
 * 敵軍ユニットのラッシュに反応できるモーフ持ちユニット。
 * ルール: R-KW-MORPH-01 — 「モーフ以外で」ラッシュされたときに誘発する（ラッシュの手段で判定）。
 * ラッシュされたカード自身がモーフを持っていても反応できる。
 */
export function listMorphReactors(
  state: GameState,
  defenderId: PlayerId,
  rushMethod: RushMethod = "normal",
): Array<{ instanceId: string; cardId: string; candidateCount: number }> {
  if (rushMethodBlocksMorphReaction(rushMethod)) return [];

  const defender = state.players[defenderId];
  const results: Array<{ instanceId: string; cardId: string; candidateCount: number }> = [];

  for (const zone of ["rush", "battle"] as const) {
    for (const unit of defender[zone]) {
      if (!cardHasKeyword(state.definitions, unit.cardId, "morph")) continue;
      const candidates = listMorphReplacementCandidates(
        defender,
        state.definitions,
        unit.cardId,
      );
      if (candidates.length > 0) {
        results.push({
          instanceId: unit.instanceId,
          cardId: unit.cardId,
          candidateCount: candidates.length,
        });
      }
    }
  }
  return results;
}

/**
 * 自軍ゾーンへ移るユニット: 置き換えたカードのいたゾーンの状態（コマンドのホールド／リリース）を引き継ぐ。
 * ルール: R-KW-MORPH-02, R-REPL-04
 */
function inheritZoneState(replaced: CardInstance, leaving: CardInstance): CardInstance {
  const next: CardInstance = {
    instanceId: leaving.instanceId,
    cardId: leaving.cardId,
  };
  if (replaced.commandHeld) next.commandHeld = true;
  if (replaced.mothershipHold) next.mothershipHold = true;
  return next;
}

function inheritFieldState(from: CardInstance, to: CardInstance): CardInstance {
  return {
    ...to,
    commandHeld: from.commandHeld,
    mothershipHold: from.mothershipHold,
    registerHeld: from.registerHeld,
    mountedOnInstanceId: from.mountedOnInstanceId,
    bpModifier: from.bpModifier,
    spModifier: from.spModifier,
    spOverride: from.spOverride,
    battleActed: from.battleActed,
  };
}

export function applyMorphSwap(
  state: GameState,
  defenderId: PlayerId,
  morphUnitInstanceId: string,
  replacementInstanceId: string,
): { state: GameState; log: string } | { error: string } {
  const player = state.players[defenderId];
  const morphFound = findMorphUnit(player, morphUnitInstanceId);
  const replacementFound = findReplacement(player, replacementInstanceId);
  if (!morphFound || !replacementFound) return { error: "invalid_target" };

  const morphDef = getDefinition(state.definitions, morphFound.card.cardId);
  const replacementDef = getDefinition(state.definitions, replacementFound.card.cardId);
  if (!morphDef || !replacementDef || replacementDef.type !== "unit") {
    return { error: "invalid_target" };
  }

  const morphFeatures = morphDef.features ?? [];
  const replacementFeatures = replacementDef.features ?? [];
  if (!featuresExactlyMatch(morphFeatures, replacementFeatures)) {
    return { error: "invalid_target" };
  }

  const candidates = listMorphReplacementCandidates(
    player,
    state.definitions,
    morphFound.card.cardId,
  );
  if (!candidates.some((c) => c.instanceId === replacementInstanceId)) {
    return { error: "invalid_target" };
  }

  // 置き換えは位置と状態を入れ替える（バトルエリアの並び順も変えない）。ルール: R-KW-MORPH-02, R-REPL-04
  const entering = inheritFieldState(morphFound.card, replacementFound.card);
  const leaving = inheritZoneState(replacementFound.card, morphFound.card);

  const fieldCards = [...player[morphFound.zone]];
  fieldCards[morphFound.index] = entering;
  const zoneCards = [...player[replacementFound.zone]];
  zoneCards[replacementFound.index] = leaving;
  const nextPlayer = {
    ...player,
    [morphFound.zone]: fieldCards,
    [replacementFound.zone]: zoneCards,
  };

  const log = buildLogEntry(
    defenderId,
    "morph_swap",
    morphFound.card.cardId,
    state.definitions,
    replacementFound.card.cardId,
  );

  return {
    state: markFieldEntryHandled(
      { ...state, ...updatePlayer(state, defenderId, nextPlayer) },
      [replacementFound.card.instanceId],
    ),
    log,
  };
}

function openMorphReplacementChoice(
  state: GameState,
  pending: PendingMorph,
  morphUnitInstanceId: string,
): GameState {
  const defender = state.players[pending.defenderPlayerId];
  const morphUnit = findMorphUnit(defender, morphUnitInstanceId);
  if (!morphUnit) return finalizeMorphAndContinue(state, pending);

  const candidates = listMorphReplacementCandidates(
    defender,
    state.definitions,
    morphUnit.card.cardId,
  );

  return openEffectChoice(state, {
    playerId: pending.defenderPlayerId,
    effectId: "morph_replacement",
    sourceCardId: morphUnit.card.cardId,
    sourceInstanceId: morphUnitInstanceId,
    kind: "select_unit",
    phasePlayerId: pending.phasePlayerId,
    optional: true,
    validInstanceIds: candidates.map((c) => c.instanceId),
    morphMeta: {
      ...pending,
      activeMorphUnitInstanceId: morphUnitInstanceId,
    },
  });
}

export function openMorphReactionWindow(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
  phasePlayerId: PlayerId,
  rushMethod: RushMethod = "normal",
): GameState {
  const defenderId = rusherPlayerId === "player1" ? "player2" : "player1";
  const rushed = findInZone(state.players[rusherPlayerId], "rush", rushedInstanceId);
  if (!rushed) return state;

  const reactors = listMorphReactors(state, defenderId, rushMethod);
  if (reactors.length === 0) return state;

  const pending: PendingMorph = {
    defenderPlayerId: defenderId,
    rusherPlayerId,
    rushedInstanceId,
    phasePlayerId,
    morphUnitInstanceIds: reactors.map((r) => r.instanceId),
  };

  if (reactors.length === 1) {
    return openMorphReplacementChoice(
      { ...state, pendingMorph: pending },
      pending,
      reactors[0]!.instanceId,
    );
  }

  return {
    ...state,
    pendingMorph: pending,
    activePlayer: pending.phasePlayerId,
  };
}

export function beginMorphUnitSelection(
  state: GameState,
  actingPlayerId: PlayerId,
  morphUnitInstanceId: string,
): GameState | null {
  const pending = state.pendingMorph;
  if (!pending) return null;
  if (!pending.morphUnitInstanceIds.includes(morphUnitInstanceId)) return null;

  const orderChooser = morphOrderChooserPlayerId(pending);
  if (orderChooser) {
    if (actingPlayerId !== orderChooser) return null;
  } else if (actingPlayerId !== pending.defenderPlayerId) {
    return null;
  }

  return openMorphReplacementChoice(state, pending, morphUnitInstanceId);
}

export function finalizeMorphAndContinue(
  state: GameState,
  pending: PendingMorph,
): GameState {
  const withoutMorph = { ...state, pendingMorph: undefined };
  return openRushCounterWindow(
    withoutMorph,
    pending.rusherPlayerId,
    pending.rushedInstanceId,
    pending.phasePlayerId,
  );
}

export function passMorphReaction(state: GameState, defenderId: PlayerId): GameState | null {
  const pending = state.pendingMorph;
  if (!pending || pending.defenderPlayerId !== defenderId) return null;
  return finalizeMorphAndContinue(
    { ...state, pendingEffectChoice: undefined },
    pending,
  );
}

export function continueMorphAfterReplacement(
  state: GameState,
  pending: PendingMorph,
  usedMorphUnitInstanceId: string,
): GameState {
  const remaining = pending.morphUnitInstanceIds.filter(
    (id) => id !== usedMorphUnitInstanceId,
  );
  const rushed = findInZone(
    state.players[pending.rusherPlayerId],
    "rush",
    pending.rushedInstanceId,
  );
  if (!rushed) {
    return finalizeMorphAndContinue({ ...state, pendingMorph: undefined }, pending);
  }

  const stillValid = remaining.filter((id) => {
    const defender = state.players[pending.defenderPlayerId];
    const morphUnit = findMorphUnit(defender, id);
    if (!morphUnit) return false;
    return (
      listMorphReplacementCandidates(defender, state.definitions, morphUnit.card.cardId)
        .length > 0
    );
  });

  if (stillValid.length === 0) {
    return finalizeMorphAndContinue({ ...state, pendingMorph: undefined }, pending);
  }

  const nextPending: PendingMorph = {
    ...pending,
    morphUnitInstanceIds: stillValid,
    activeMorphUnitInstanceId: undefined,
  };

  if (stillValid.length === 1) {
    return openMorphReplacementChoice(
      { ...state, pendingMorph: nextPending },
      nextPending,
      stillValid[0]!,
    );
  }

  return {
    ...state,
    pendingMorph: nextPending,
    activePlayer: shouldMorphOrderChooserAct(nextPending)
      ? pending.phasePlayerId
      : pending.defenderPlayerId,
  };
}

export function resolveMorphReplacementChoice(
  state: GameState,
  defenderId: PlayerId,
  replacementInstanceId: string,
): { state: GameState; log?: string; extraLogs?: string[] } | { error: string } {
  const pending = state.pendingEffectChoice;
  const morphPending = pending?.morphMeta ?? state.pendingMorph;
  if (
    !pending ||
    pending.effectId !== "morph_replacement" ||
    pending.playerId !== defenderId ||
    !morphPending?.activeMorphUnitInstanceId
  ) {
    return { error: "no_pending_morph" };
  }

  const swap = applyMorphSwap(
    state,
    defenderId,
    morphPending.activeMorphUnitInstanceId,
    replacementInstanceId,
  );
  if ("error" in swap) return swap;

  const morphFound = findMorphUnit(
    swap.state.players[defenderId],
    morphPending.activeMorphUnitInstanceId,
  );
  let nextState = swap.state;
  const extraLogs: string[] = [];
  if (morphFound) {
    const rushEffects = applyOnRushUnitEffects(
      nextState,
      defenderId,
      replacementInstanceId,
      morphPending.phasePlayerId,
      morphFound.zone,
    );
    nextState = rushEffects.state;
    extraLogs.push(...rushEffects.logs);
  }

  const next = continueMorphAfterReplacement(
    { ...nextState, pendingEffectChoice: undefined },
    morphPending,
    morphPending.activeMorphUnitInstanceId,
  );

  return { state: next, log: swap.log, extraLogs: extraLogs.length > 0 ? extraLogs : undefined };
}
