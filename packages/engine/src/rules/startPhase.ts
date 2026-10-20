import { rm3StaysInBattleAtStart } from "./rm/rm3Fields";
import { unitFeatures } from "./addedFeatures";
import { isRk8BattleToRushTrigger, rk8StaysInBattleAtStart, tryRk8BattleToRush } from "./rk/rk8UnitEffects";
import { isOtherLinesBattleToRushTrigger, tryOtherLinesBattleToRush } from "./legend1/otherLinesNamedEffects";
import { applyRk2StartPhaseEnd } from "./rk/rk2UnitEffects";
import { collectRk12KaenQueue, isRk12KaenQueueEntry, openRk12KaenOnReturn } from "./rk/rk12UnitEffects";
import { applyRk4StartPhaseEnd, isRk4BattleToRushTrigger, tryRk4BattleToRush } from "./rk/rk4UnitEffects";
import { getCardEffect } from "@rangers-strike/cards";
import { gorgonBlocksRelease, isSet6BBattleToRushTrigger, trySet6BBattleToRush } from "./legend1/set6NamedEffectsB";
import { darkLawStackPending, openDarkLawStackIfNeeded } from "./legend1/set5NamedEffectsA";
import { activeNamedEffect } from "./ncGatedEffects";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { checkWinner } from "../core/createGame";
import { cardName, hasOperationEffect } from "../core/catalog";
import { findInZone, removeAt, updatePlayer } from "../core/helpers";
import { buildLogEntry, buildSimpleLogEntry } from "../log/formatLog";
import { applyMegaSilverStartEndToggle } from "./batch04FieldEffects";
import { startSelectPowerChoice } from "./pendingChoices";
import { tryLegend3BattleToRush } from "./legend3/restrictions";
import { prepareRegisterUnitReturnedToRush } from "./resist";
import { tryCyclopsScarletOnReturnToRush } from "./cyclopsScarlet";
import { isSmallUnit } from "../core/catalog";
import { opponent } from "../core/helpers";
import { set9CBeforeStartReturn, set9CStaysInBattleAtStart } from "./legend1/set9NamedEffectsC";
import {
  applyOpponentHoldOtEtOnCommandRelease,
  applyPlasmaShockwaveShuffleBack,
  plasmaShockwaveActive,
} from "./srEffects";

/** スタートフェイズ: ホールド中のコマンドをすべてリリース。 */
export function releaseAllCommands(state: GameState, playerId: PlayerId): GameState {
  const player = state.players[playerId];
  const command = player.command.map((c) =>
    // RS-413 冥府神ゴーゴン【もの言わぬ石と化せ】: 制限を受けているプレイヤーのコマンドゾーンの S ユニットのカードはリリースできない。
    c.commandHeld && !gorgonBlocksRelease(state, playerId, c) ? { ...c, commandHeld: false, mothershipHold: false } : c,
  );
  let nextState: GameState = {
    ...state,
    ...updatePlayer(state, playerId, { ...player, command }),
  };
  nextState = applyOpponentHoldOtEtOnCommandRelease(nextState, playerId);
  return nextState;
}

function collectBattleToRushEffectQueue(cards: CardInstance[]): string[] {
  return cards
    .filter(
      (card) =>
        activeNamedEffect(card, "falcon_claw") ||
        isSet6BBattleToRushTrigger(card) ||
        isOtherLinesBattleToRushTrigger(card) ||
        // RK-074 ライダーマン【カギ爪アーム】（rules/rk/rk4UnitEffects.ts）。
        isRk4BattleToRushTrigger(card) ||
        // RK-155 キングライナー・RK-156 マシンデンバード・RK-157 バットイマジン（rules/rk/rk8UnitEffects.ts）。
        isRk8BattleToRushTrigger(card),
    )
    .map((card) => card.instanceId);
}

const CYCLOPS_QUEUE_PREFIX = "cyclops_scarlet::";

/**
 * RS-417 冥府神サイクロプス【消滅の緋色】「これが自軍ラッシュエリアにある間、敵軍Sユニットがバトルエリアから
 * ラッシュエリアに戻るたび…」（atwiki/page-614）— スタートフェイズの「戻す」でも誘発する。
 * 戻った S ユニット1体・サイクロプス1体ごとにキューへ積む（faq-card-6 RS-417 Q2/Q3）。
 */
function collectCyclopsScarletQueue(state: GameState, playerId: PlayerId, movedCards: CardInstance[]): string[] {
  const cyclopses = state.players[opponent(playerId)].rush.filter((c) => c.cardId === "RS-417");
  if (cyclopses.length === 0) return [];
  const entries: string[] = [];
  for (const card of movedCards) {
    if (!isSmallUnit(state.definitions, card)) continue;
    for (const cy of cyclopses) entries.push(`${CYCLOPS_QUEUE_PREFIX}${cy.instanceId}::${card.instanceId}`);
  }
  return entries;
}

function parseCyclopsQueueEntry(entry: string): { cyclopsInstanceId: string; unitInstanceId: string } | null {
  if (!entry.startsWith(CYCLOPS_QUEUE_PREFIX)) return null;
  const [cyclopsInstanceId, unitInstanceId] = entry.slice(CYCLOPS_QUEUE_PREFIX.length).split("::");
  if (!cyclopsInstanceId || !unitInstanceId) return null;
  return { cyclopsInstanceId, unitInstanceId };
}

/**
 * スタートフェイズに戻す単位（ライドの組は1組）の代表 instanceId を並び順で返す。
 * ビークルにライドしているユニットはビークルと一緒に戻るので代表に含めない。
 */
export function listStartReturnGroupIds(player: PlayerState): string[] {
  const battleIds = new Set(player.battle.map((c) => c.instanceId));
  return player.battle
    .filter((c) => !(c.mountedOnInstanceId && battleIds.has(c.mountedOnInstanceId)))
    .map((c) => c.instanceId);
}

/** instanceId を含むライドの組（ビークルとライドしているユニット）の instanceId 一覧。 */
function returnGroupMembers(player: PlayerState, instanceId: string): Set<string> {
  const card = player.battle.find((c) => c.instanceId === instanceId);
  if (!card) return new Set();
  const battleIds = new Set(player.battle.map((c) => c.instanceId));
  const rootId =
    card.mountedOnInstanceId && battleIds.has(card.mountedOnInstanceId)
      ? card.mountedOnInstanceId
      : card.instanceId;
  const members = new Set([rootId]);
  for (const c of player.battle) {
    if (c.mountedOnInstanceId === rootId) members.add(c.instanceId);
  }
  return members;
}

/**
 * スタートフェイズ: 戻す予定のユニットを1組ずつ戻し、そのつど誘発した効果（falcon_claw 等）を解決する。
 * 選択が開いたらそこで止まり、解決後にもう一度呼ばれて続きを戻す。
 * ルール: R-START-01（戻す順は任意。戻す途中で誘発した効果を解決してから残りを戻せる: faq-card-3 RS-135）
 */
export function continueBattleToRushEffectQueue(state: GameState): GameState {
  if (state.pendingEffectChoice || state.winner) return state;
  const phasePlayerId = state.pendingBattleToRushPhasePlayerId;
  const queue = state.pendingBattleToRushQueue ?? [];

  if (phasePlayerId && queue.length > 0) {
    const [nextId, ...rest] = queue;
    const owner = state.players[phasePlayerId];
    if (isRk12KaenQueueEntry(nextId!)) {
      // RK-232 火焔大将の※（rules/rk/rk12UnitEffects.ts）。
      return continueBattleToRushEffectQueue(openRk12KaenOnReturn({ ...state, pendingBattleToRushQueue: rest }, phasePlayerId, nextId!));
    }
    const cyclops = parseCyclopsQueueEntry(nextId!);
    if (cyclops) {
      // RS-417【消滅の緋色】: 戻った敵軍 S ユニット1体・サイクロプス1体ごとに1回（grnrngr/faq-card-6 RS-417 Q2/Q3）。
      const returned = owner.rush.find((c) => c.instanceId === cyclops.unitInstanceId);
      const controller = state.players[opponent(phasePlayerId)];
      const base: GameState = { ...state, pendingBattleToRushQueue: rest };
      if (!returned || !controller.rush.some((c) => c.instanceId === cyclops.cyclopsInstanceId)) {
        return continueBattleToRushEffectQueue(base);
      }
      return continueBattleToRushEffectQueue(
        tryCyclopsScarletOnReturnToRush(base, phasePlayerId, returned, phasePlayerId),
      );
    }
    const card = owner.rush.find((c) => c.instanceId === nextId);
    if (!card) {
      return continueBattleToRushEffectQueue({ ...state, pendingBattleToRushQueue: rest });
    }
    let withChoice = tryLegend3BattleToRush(state, phasePlayerId, card, phasePlayerId);
    // RS-394/RS-395【チェンジフォーメーション】（rules/legend1/set6NamedEffectsB.ts）。
    if (!withChoice.pendingEffectChoice) withChoice = trySet6BBattleToRush(withChoice, phasePlayerId, card, phasePlayerId);
    // XP-026【アクセルグランツァー】（rules/legend1/otherLinesNamedEffects.ts）。
    if (!withChoice.pendingEffectChoice) withChoice = tryOtherLinesBattleToRush(withChoice, phasePlayerId, card, phasePlayerId);
    // RK-074【カギ爪アーム】（rules/rk/rk4UnitEffects.ts）。
    if (!withChoice.pendingEffectChoice) withChoice = tryRk4BattleToRush(withChoice, phasePlayerId, card, phasePlayerId);
    // RK-155・RK-156・RK-157（rules/rk/rk8UnitEffects.ts）。
    if (!withChoice.pendingEffectChoice) withChoice = tryRk8BattleToRush(withChoice, phasePlayerId, card, phasePlayerId);
    return continueBattleToRushEffectQueue({ ...withChoice, pendingBattleToRushQueue: rest });
  }

  const returnQueue = state.pendingStartReturnQueue ?? [];
  if (phasePlayerId && returnQueue.length > 0) {
    const [nextId, ...rest] = returnQueue;
    const base: GameState = { ...state, pendingStartReturnQueue: rest };
    // RS-652【清輝顕現バブルキャプチャー】で戻せない／RS-648【イカロスバインド】で撃破するか戻さないかを選ぶ
    // （rules/legend1/set9NamedEffectsC.ts）。選択を開いたら、選んだ後にここから続ける。
    const members = [...returnGroupMembers(base.players[phasePlayerId], nextId!)];
    // RK-153【車両強奪】で選ばれたユニットは戻さない（rules/rk/rk8UnitEffects.ts）。
    if (members.some((m) => rk8StaysInBattleAtStart(base, phasePlayerId, m))) return continueBattleToRushEffectQueue(base);
    // RM-052 ビートルーダー【マグネアタッチメント】で戻せない「メカ」のホールド状態のユニット（rules/rm/rm3Fields.ts）。
    if (members.some((m) => rm3StaysAtStart(base, phasePlayerId, m))) return continueBattleToRushEffectQueue(base);
    const restriction = members.length > 0 ? set9CBeforeStartReturn(base, phasePlayerId, members) : null;
    if (restriction === "stay") return continueBattleToRushEffectQueue(base);
    if (restriction) return restriction;
    const moved = returnBattleGroupToRush(base, phasePlayerId, nextId!);
    return continueBattleToRushEffectQueue(moved ?? base);
  }

  if (phasePlayerId && state.phase === "start" && allRemainingBattleUnitsStay(state, phasePlayerId)) {
    state = {
      ...state,
      ...updatePlayer(state, phasePlayerId, { ...state.players[phasePlayerId], hasReturnedBattleThisStart: true }),
    };
  }
  return {
    ...state,
    pendingBattleToRushQueue: undefined,
    pendingStartReturnQueue: undefined,
    pendingBattleToRushPhasePlayerId: undefined,
  };
}

/**
 * バトルエリアの1組をラッシュエリアに戻し、誘発効果をキューに積む（解決は呼び出し側）。
 * ルール: R-START-02 — ラッシュではない。ライド状態・ホールド状態はそのまま。
 */
function returnBattleGroupToRush(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState | null {
  const player = state.players[playerId];
  const members = returnGroupMembers(player, instanceId);
  if (members.size === 0) return null;

  const movedCards = player.battle
    .filter((c) => members.has(c.instanceId))
    .map(prepareRegisterUnitReturnedToRush)
    .map(({ jointComboGrants: _grants, ...rest }) => rest);
  const battle = player.battle.filter((c) => !members.has(c.instanceId));
  const effectQueue = [
    ...collectBattleToRushEffectQueue(movedCards),
    ...collectCyclopsScarletQueue(state, playerId, movedCards),
    // RK-232 火焔大将の※（戻った「本来のカテゴリにMAを持ち、ナンバーを持たない」S ユニット1体ごと）。
    ...collectRk12KaenQueue(state, playerId, movedCards),
  ];
  return {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      battle,
      rush: [...player.rush, ...movedCards],
      hasReturnedBattleThisStart: battle.length === 0,
    }),
    pendingBattleToRushQueue: [...(state.pendingBattleToRushQueue ?? []), ...effectQueue],
    pendingBattleToRushPhasePlayerId: playerId,
  };
}

/**
 * スタートフェイズ: バトルエリアのユニットをラッシュエリアに戻す。
 * `instanceId` 指定時はその1組だけ、省略時は並び順で1組ずつすべて戻す（途中で選択が開いたら中断）。
 */
export function returnAllBattleUnitsToRush(
  state: GameState,
  playerId: PlayerId,
  instanceId?: string,
): GameState | null {
  const player = state.players[playerId];
  if (player.battle.length === 0) return null;

  if (instanceId) {
    if (!player.battle.some((c) => c.instanceId === instanceId)) return null;
    return continueBattleToRushEffectQueue({
      ...state,
      pendingStartReturnQueue: [instanceId],
      pendingBattleToRushPhasePlayerId: playerId,
    });
  }

  const [first, ...rest] = listReturnableStartGroupIds(state, playerId);
  if (!first) return null;
  return continueBattleToRushEffectQueue({
    ...state,
    pendingStartReturnQueue: [first, ...rest],
    pendingBattleToRushPhasePlayerId: playerId,
  });
}

/** スタートフェイズに戻せる組の代表（戻せない・戻さないことを選んだユニットを除く。rules/legend1/set9NamedEffectsC.ts）。 */
export function listReturnableStartGroupIds(state: GameState, playerId: PlayerId): string[] {
  const player = state.players[playerId];
  return listStartReturnGroupIds(player).filter(
    (id) =>
      ![...returnGroupMembers(player, id)].some(
        (m) => set9CStaysInBattleAtStart(state, playerId, m) || rk8StaysInBattleAtStart(state, playerId, m) || rm3StaysAtStart(state, playerId, m),
      ),
  );
}

/** RM-052【マグネアタッチメント】で戻せないユニットか（今の特徴で「メカ」を見る）。 */
function rm3StaysAtStart(state: GameState, playerId: PlayerId, instanceId: string): boolean {
  return rm3StaysInBattleAtStart(state, playerId, instanceId, (card) => unitFeatures(state, playerId, card));
}

/** バトルエリアに残っているユニットがすべて戻せない（戻さない）ユニットか。 */
function allRemainingBattleUnitsStay(state: GameState, playerId: PlayerId): boolean {
  const player = state.players[playerId];
  return player.battle.length > 0 && listReturnableStartGroupIds(state, playerId).length === 0;
}

export function initializeStartPhasePlayer(player: PlayerState): PlayerState {
  const hasHeld = player.command.some((c) => c.commandHeld);
  const hasBattle = player.battle.length > 0;
  return {
    ...player,
    unitActionsThisTurn: undefined,
    battlePositionsAtBattleEnd: undefined,
    fieldAbilityUsedThisRush: undefined,
    hasDrawnThisStart: false,
    hasBonusDrawnThisStart: false,
    hasPaidEarthForceUpkeep: false,
    hasReleasedCommandsThisStart: !hasHeld,
    hasReturnedBattleThisStart: !hasBattle,
  };
}

function hasHeldCommands(player: PlayerState): boolean {
  return player.command.some((c) => c.commandHeld);
}

/** ターン終了効果（冒険 RS-030 等）でホールドが先に解消された場合も完了とみなす。 */
export function isReleaseStepComplete(player: PlayerState): boolean {
  if (player.hasReleasedCommandsThisStart === true) return true;
  return !hasHeldCommands(player);
}

export function hasCompletedStartPhaseSteps(
  state: GameState,
  player: PlayerState,
): boolean {
  const returnComplete =
    player.hasReturnedBattleThisStart === true ||
    player.battle.length === 0 ||
    allRemainingBattleUnitsStay(state, player.id) ||
    plasmaShockwaveActive(state);
  return (
    isReleaseStepComplete(player) &&
    returnComplete &&
    player.hasDrawnThisStart === true
  );
}

export function canReleaseStartCommands(state: GameState, playerId: PlayerId): boolean {
  if (state.phase !== "start") return false;
  if (state.pendingEffectChoice?.playerId === playerId) return false;
  const player = state.players[playerId];
  if (player.hasReleasedCommandsThisStart) return false;
  return player.command.some((c) => c.commandHeld);
}

export function canReturnBattleAtStart(state: GameState, playerId: PlayerId): boolean {
  if (state.phase !== "start") return false;
  if (plasmaShockwaveActive(state)) return false;
  if (state.pendingEffectChoice?.playerId === playerId) return false;
  const player = state.players[playerId];
  if (player.hasReturnedBattleThisStart) return false;
  return listReturnableStartGroupIds(state, playerId).length > 0;
}

export function canBonusDraw(state: GameState, playerId: PlayerId): boolean {
  const player = state.players[playerId];
  return (
    player.hasDrawnThisStart === true &&
    player.hasBonusDrawnThisStart !== true &&
    player.hand.length < player.damage &&
    player.deck.length > 0
  );
}

export function canAdvanceFromStartPhase(state: GameState, playerId: PlayerId): boolean {
  const player = state.players[playerId];
  if (state.phase !== "start") return false;
  if (state.pendingEffectChoice?.playerId === playerId) return false;
  if (!hasCompletedStartPhaseSteps(state, player)) return false;
  if (darkLawStackPending(state, playerId)) return false;
  if (
    mustResolveEarthForceUpkeepBeforeStartEnd(state, playerId) &&
    canPayEarthForceUpkeep(state, playerId)
  ) {
    return false;
  }
  return true;
}

/** 必須ステップ後に自動進行；任意のボーナスドローは先に取れる場合あり。 */
export function shouldAutoAdvanceFromStartPhase(
  state: GameState,
  playerId: PlayerId,
): boolean {
  return canAdvanceFromStartPhase(state, playerId) && !canBonusDraw(state, playerId);
}

/** {@link canAdvanceFromStartPhase} が満たされたときスタートからチャージへ移行。 */
export function transitionStartToChargePhase(
  state: GameState,
  playerId: PlayerId,
): GameState | null {
  if (!canAdvanceFromStartPhase(state, playerId)) return null;

  let nextState = state;
  const logEntries: string[] = [];

  if (
    mustResolveEarthForceUpkeepBeforeStartEnd(state, playerId) &&
    !canPayEarthForceUpkeep(state, playerId)
  ) {
    const discarded = discardEarthForceForUnpaidUpkeep(nextState, playerId);
    nextState = discarded.state;
    logEntries.push(
      buildLogEntry(
        playerId,
        "earth_force_upkeep",
        "RS-022",
        state.definitions,
        "failed",
      ),
    );
  }

  nextState = applyMegaSilverStartEndToggle(nextState, playerId);
  // SR-007【プラズマ衝撃波】: 見るのはこのスタートフェイズを終えるプレイヤーのバトルエリア（rules/srEffects.ts）。
  nextState = applyPlasmaShockwaveShuffleBack(nextState, playerId);

  const resetPlayer = {
    ...nextState.players[playerId],
    hasChargedThisTurn: false,
    hasDrawnThisStart: false,
    hasBonusDrawnThisStart: false,
    hasReleasedCommandsThisStart: false,
    hasReturnedBattleThisStart: false,
  };
  nextState = {
    ...nextState,
    ...updatePlayer(nextState, playerId, resetPlayer),
    phase: "charge",
  };
  logEntries.push(buildSimpleLogEntry(playerId, "end_phase", "start"));
  // RK-042 ブランウイング【閃光の翼】: スタートフェイズを終えるとき、自分自身のコマンドを選んでホールドする（rules/rk/rk2UnitEffects.ts）。
  nextState = applyRk2StartPhaseEnd(nextState, playerId);
  // RK-080 超変身・RK-082 オルタフォース「自軍スタートフェイズを終えるとき、一度だけ…」（rules/rk/rk4UnitEffects.ts）。
  nextState = applyRk4StartPhaseEnd(nextState, playerId);

  return {
    ...nextState,
    log: [...nextState.log, ...logEntries],
    winner: checkWinner(nextState),
  };
}

export type StartPhaseBattleUnit = {
  instanceId: string;
  cardId: string;
};

export type StartPhaseStatus = {
  releaseDone: boolean;
  returnDone: boolean;
  drawDone: boolean;
  canRelease: boolean;
  canReturn: boolean;
  canDraw: boolean;
  canBonusDraw: boolean;
  canAdvanceToCharge: boolean;
  heldCommandCount: number;
  battleUnitCount: number;
  battleUnits: StartPhaseBattleUnit[];
  /** 1体ずつ戻すときに選べるユニット（ライドの組は代表1体）。2組以上のときだけ並ぶ。 */
  returnChoices: Array<StartPhaseBattleUnit & { name: string }>;
};

export function getStartPhaseStatus(
  state: GameState,
  playerId: PlayerId,
): StartPhaseStatus {
  const player = state.players[playerId];
  const effectBlocksStart =
    state.pendingEffectChoice?.playerId === playerId;
  return {
    releaseDone: isReleaseStepComplete(player),
    returnDone: player.hasReturnedBattleThisStart === true,
    drawDone: player.hasDrawnThisStart === true,
    canRelease: canReleaseStartCommands(state, playerId),
    canReturn: canReturnBattleAtStart(state, playerId),
    canDraw:
      state.phase === "start" &&
      !effectBlocksStart &&
      !player.hasDrawnThisStart,
    canBonusDraw: !effectBlocksStart && canBonusDraw(state, playerId),
    canAdvanceToCharge: canAdvanceFromStartPhase(state, playerId),
    heldCommandCount: player.command.filter((c) => c.commandHeld).length,
    battleUnitCount: player.battle.length,
    battleUnits: player.battle.map((c) => ({
      instanceId: c.instanceId,
      cardId: c.cardId,
    })),
    returnChoices: (() => {
      const ids = listStartReturnGroupIds(player);
      if (ids.length < 2 || !canReturnBattleAtStart(state, playerId)) return [];
      return ids.map((id) => {
        const cardId = player.battle.find((c) => c.instanceId === id)?.cardId ?? id;
        return { instanceId: id, cardId, name: cardName(state.definitions, cardId) };
      });
    })(),
  };
}

function countFaceUpPower(state: GameState, playerId: PlayerId): number {
  return state.players[playerId].power.filter((c) => !c.faceDown).length;
}

export function hasOwnEarthForce(state: GameState, playerId: PlayerId): boolean {
  return hasOperationEffect(
    state.players[playerId],
    "earth_force",
    state.definitions,
  );
}

/** RS-022: 必須ドロー後、支払うか常駐が離れるまで維持費が発生。 */
export function needsEarthForceUpkeep(state: GameState, playerId: PlayerId): boolean {
  const player = state.players[playerId];
  if (!player.hasDrawnThisStart) return false;
  if (player.hasPaidEarthForceUpkeep) return false;
  return hasOwnEarthForce(state, playerId);
}

export function canPayEarthForceUpkeep(state: GameState, playerId: PlayerId): boolean {
  return countFaceUpPower(state, playerId) >= 3;
}

export function mustResolveEarthForceUpkeepBeforeStartEnd(
  state: GameState,
  playerId: PlayerId,
): boolean {
  return needsEarthForceUpkeep(state, playerId);
}

export function openEarthForceUpkeepChoiceIfNeeded(
  state: GameState,
  playerId: PlayerId,
): GameState {
  // RS-256 闇の戒律: ドローの後、自軍捨札から1枚選び重ねる（維持費の選択がなければ先に開く）。
  if (!needsEarthForceUpkeep(state, playerId) || !canPayEarthForceUpkeep(state, playerId)) {
    return openDarkLawStackIfNeeded(state, playerId);
  }
  return openEarthForceUpkeepChoiceIfNeededImpl(state, playerId);
}

function openEarthForceUpkeepChoiceIfNeededImpl(
  state: GameState,
  playerId: PlayerId,
): GameState {
  if (!needsEarthForceUpkeep(state, playerId)) return state;
  if (!canPayEarthForceUpkeep(state, playerId)) return state;
  if (state.pendingEffectChoice) return state;

  const player = state.players[playerId];
  const earthForce = player.operation.find((c) => getCardEffect(c.cardId)?.effectId === "earth_force");
  if (!earthForce) return state;

  const next = startSelectPowerChoice(state, {
    playerId,
    effectId: "earth_force",
    sourceCardId: earthForce.cardId,
    sourceInstanceId: earthForce.instanceId,
    phasePlayerId: playerId,
    selectCount: 3,
    optional: false,
  });
  return next ?? state;
}

/** RS-022: 維持費を支払えない場合、常駐を捨てる。 */
export function discardEarthForceForUnpaidUpkeep(
  state: GameState,
  playerId: PlayerId,
): { state: GameState; discarded: boolean } {
  const player = state.players[playerId];
  const index = player.operation.findIndex(
    (c) => getCardEffect(c.cardId)?.effectId === "earth_force",
  );
  if (index < 0) return { state, discarded: false };

  const [card, withoutOp] = removeAt(player.operation, index);
  const nextPlayer = {
    ...player,
    operation: withoutOp,
    discard: [...player.discard, card],
  };

  return {
    state: { ...state, ...updatePlayer(state, playerId, nextPlayer) },
    discarded: true,
  };
}
