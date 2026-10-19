import { xg1cOnMorphSwap } from "../rules/xg1/xg1cEffects";
import { filthyAirActive } from "../rules/legend1/otherLinesNamedEffects";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingMorph, PlayerId, PlayerState } from "../types/game";
import { getDefinition } from "../core/catalog";
import { findInZone, updatePlayer } from "../core/helpers";
import { buildLogEntry } from "../log/formatLog";
import { hasPendingPromptBlockingEffectRush, markFieldEntryHandled } from "../events/emitUnitRushed";
import { openEffectChoice } from "../rules/pendingChoices";
import { openRushCounterWindow } from "../rules/rushEffects";
import { listUsableRushCounters } from "../rules/operationCounters";
import { cardHasKeyword } from "./cardKeywords";
import {
  featuresExactlyMatch,
  listPlaceableMorphReplacementCandidates,
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
import { applyOnRushUnitEffects, applyPassiveRushTriggers } from "../rules/onRushUnitEffects";
import { rk16MorphDiscardCost, rk16MorphEntryHolds } from "../rules/rk/rk16Fields";

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
): { zone: MorphReplacementZone | "discard"; index: number; card: CardInstance } | null {
  // RK-317【ポッドバッティング】のときは自軍捨札からも選べる（候補は keywords/morph.ts で絞り込み済み）。
  for (const zone of [...MORPH_REPLACEMENT_ZONES, "discard"] as const) {
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
  // XG1-034【汚い大気】: モーフはパワーゾーンからカードが離れる処理を含むため、バトルフェイズ中は発動できない（atwiki/page-1582 Q2）。
  if (filthyAirActive(state)) return [];

  const defender = state.players[defenderId];
  const results: Array<{ instanceId: string; cardId: string; candidateCount: number }> = [];

  for (const zone of ["rush", "battle"] as const) {
    for (const unit of defender[zone]) {
      if (!cardHasKeyword(state.definitions, unit.cardId, "morph", { state, playerId: defenderId })) continue;
      const candidates = listPlaceableMorphReplacementCandidates(state, defenderId, unit);
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

  const candidates = listPlaceableMorphReplacementCandidates(state, defenderId, morphFound.card);
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
  let nextPlayer: PlayerState = {
    ...player,
    [morphFound.zone]: fieldCards,
    [replacementFound.zone]: zoneCards,
  };
  // RK-317【ポッドバッティング】: 捨札から選んだら DA のコマンドをホールドする。バトルエリアに出るユニットの
  // 「自軍コマンドをNつホールドしなければバトルエリアに出られない」もホールドする（rules/rk/rk16Fields.ts）。
  const exclude = [entering.instanceId, leaving.instanceId];
  if (replacementFound.zone === "discard") {
    nextPlayer = holdCommands(state, nextPlayer, rk16MorphDiscardCost(state, defenderId) ?? 0, exclude, true);
  }
  if (morphFound.zone === "battle") {
    nextPlayer = holdCommands(state, nextPlayer, rk16MorphEntryHolds(state, replacementFound.card.cardId), exclude, false);
  }
  // 出たばかりのモーフ持ちユニットの進入の行動（アタック・ストライク）は、置き換えたユニットが引き継ぐ（atwiki/page-1365 Q1）。
  const swapEntry = <T extends { instanceId: string } | undefined>(entry: T): T =>
    entry && entry.instanceId === morphUnitInstanceId ? ({ ...entry, instanceId: replacementInstanceId } as T) : entry;
  state = { ...state, pendingBattleEntry: swapEntry(state.pendingBattleEntry), deferredBattleEntry: swapEntry(state.deferredBattleEntry) };

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

/** リリース状態の自軍コマンドを先頭から count 枚ホールドする（daOnly なら DA を持つものだけ）。 */
function holdCommands(state: GameState, player: PlayerState, count: number, exclude: string[], daOnly: boolean): PlayerState {
  if (count <= 0) return player;
  let left = count;
  return {
    ...player,
    command: player.command.map((c) => {
      if (left <= 0 || c.commandHeld || exclude.includes(c.instanceId)) return c;
      if (daOnly) {
        const cat = getDefinition(state.definitions, c.cardId)?.category as string | string[] | undefined;
        if (!(Array.isArray(cat) ? cat.includes("DA") : cat === "DA")) return c;
      }
      left -= 1;
      return { ...c, commandHeld: true };
    }),
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

  const candidates = listPlaceableMorphReplacementCandidates(
    state,
    pending.defenderPlayerId,
    morphUnit.card,
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
    // ルール: R-TIME-03 — モーフの解決に入った後は、この時点で発動できたカウンターしか使えない（atwiki/page-1828）。
    counterInstanceIdsAtOpen: listUsableRushCounters(
      { ...state, activePlayer: phasePlayerId },
      defenderId,
      rushedInstanceId,
      rusherPlayerId,
    ),
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
  // ルール: R-KW-MORPH-01 — モーフは相手のラッシュへの応答。解決後はラッシュしたプレイヤーの手番に戻る。
  const withoutMorph: GameState = {
    ...state,
    pendingMorph: undefined,
    activePlayer: state.pendingEffectChoice ? state.activePlayer : pending.phasePlayerId,
  };
  return openRushCounterWindow(
    withoutMorph,
    pending.rusherPlayerId,
    pending.rushedInstanceId,
    pending.phasePlayerId,
    pending.morphResolved ? (pending.counterInstanceIdsAtOpen ?? []) : undefined,
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
      listPlaceableMorphReplacementCandidates(state, pending.defenderPlayerId, morphUnit.card)
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
  const resolvedPending: PendingMorph = { ...morphPending, morphResolved: true };

  // ルール: R-REPL-04 — 置き換えでエリアに出る方はラッシュに含まれる（atwiki/page-1413「置き換えでエリアに出ることはラッシュに含まれる。
  // ラッシュしたときに発動する効果は当然発生する」、atwiki/page-1294 A2「コマンドゾーンからラッシュされるカード」）。
  // 出たユニットは置き換えたモーフ持ちユニットのいた場所（ラッシュエリアかバトルエリア）にいる。
  // 「ラッシュしたとき」→ 他のカードの「ラッシュされたとき」（RK-160 シザーズジャガー等。faq-rider-2 RK-160 Q2）→ 残りのモーフ・カウンター窓の順。
  let nextState: GameState = { ...swap.state, pendingEffectChoice: undefined, pendingMorph: undefined };
  const extraLogs: string[] = [];
  const entered = findMorphUnit(nextState.players[defenderId], replacementInstanceId);
  if (entered) {
    const rushEffects = applyOnRushUnitEffects(
      nextState,
      defenderId,
      replacementInstanceId,
      morphPending.phasePlayerId,
      entered.zone,
    );
    nextState = rushEffects.state;
    extraLogs.push(...rushEffects.logs);
    // XG1-046【Vジェット】: ライドしているユニットがモーフで置き換えられたとき（rules/xg1/xg1cEffects.ts）。
    nextState = xg1cOnMorphSwap(nextState, defenderId, replacementInstanceId, morphPending.phasePlayerId);
  }
  const continuation = {
    pending: resolvedPending,
    usedMorphUnitInstanceId: morphPending.activeMorphUnitInstanceId,
    enteredInstanceId: replacementInstanceId,
    passiveDone: !entered,
  };
  const next = hasPendingPromptBlockingEffectRush(nextState)
    ? { ...nextState, deferredMorphContinuation: continuation }
    : resumeMorphAfterEntry(nextState, continuation);

  return { state: next, log: swap.log, extraLogs: extraLogs.length > 0 ? extraLogs : undefined };
}

/**
 * モーフで出たユニットの「ラッシュしたとき」を終えたあとの続き: 他のカードの「ラッシュされたとき」の誘発 → 残りのモーフ・カウンター窓。
 * 選択待ちになったら deferredMorphContinuation に残し、操作待ちがなくなった時点で core/applyAction.ts の後処理から再び呼ばれる。
 */
export function resumeMorphAfterEntry(
  state: GameState,
  continuation: NonNullable<GameState["deferredMorphContinuation"]>,
): GameState {
  let next: GameState = { ...state, deferredMorphContinuation: undefined };
  const { pending } = continuation;
  if (!continuation.passiveDone) {
    const passive = applyPassiveRushTriggers(next, pending.defenderPlayerId, continuation.enteredInstanceId, pending.phasePlayerId);
    next = passive.logs.length > 0 ? { ...passive.state, log: [...passive.state.log, ...passive.logs] } : passive.state;
    if (hasPendingPromptBlockingEffectRush(next)) {
      return { ...next, deferredMorphContinuation: { ...continuation, passiveDone: true } };
    }
  }
  return continueMorphAfterReplacement(next, pending, continuation.usedMorphUnitInstanceId);
}
