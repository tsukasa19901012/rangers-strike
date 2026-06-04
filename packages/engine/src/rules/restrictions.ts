import {
  cannotEnterBattle,
  countLightningGravityPermanents,
  getBattleEntryHoldCount,
  hasAutoBattleEntryNote,
  needsAllySInBattle,
  noBattleEntryTurnRushed,
} from "@rangers-strike/cards";
import { getCardEffect } from "@rangers-strike/cards";
import type { CardDefinition, Category } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import {
  effectiveBp,
  getDefinition,
  hasHeldCommandForCategories,
  hasOperationEffect,
  isMediumUnit,
  isSmallUnit,
  isUnit,
} from "../core/catalog";
import { findInZone, opponent } from "../core/helpers";
import { earthForceActive } from "./strikeReactions";
import {
  isBattleBlocked,
  opponentInfiniteChainBlocks,
  wasRushedThisTurn,
  getTurnModifiers,
} from "./turnModifiers";
import {
  karakuriLionChainBlocksEntry,
  trafficControlRequiresSameSize,
} from "./legend2/fieldEffects";

export function countLightningGravityOperations(state: GameState): number {
  return countLightningGravityPermanents(
    [state.players.player1.operation, state.players.player2.operation],
    (cardId) => getCardEffect(cardId),
  );
}

/** RS-069 stacks on both fields; inactive when blocked by RS-072 infinite chain. */
export function countActiveLightningGravity(state: GameState): number {
  let count = 0;
  for (const playerId of ["player1", "player2"] as const) {
    const player = state.players[playerId];
    if (opponentInfiniteChainBlocks(state, playerId)) continue;
    for (const card of player.operation) {
      if (getCardEffect(card.cardId)?.effectId === "lightning_gravity") {
        count += 1;
      }
    }
  }
  return count;
}

export function lightningGravityActive(state: GameState): boolean {
  return countActiveLightningGravity(state) > 0;
}

/** Notice for UI when RS-069 blocks an M unit from entering battle. */
export type LightningGravityHoldNotice = {
  unitName: string;
  requiredHolds: number;
  heldHolds: number;
  lightningGravityCount: number;
  unitHoldCount: number;
};

export function getLightningGravityHoldNotice(
  state: GameState,
  playerId: PlayerId,
  unit: CardInstance,
): LightningGravityHoldNotice | null {
  if (!lightningGravityActive(state)) return null;
  if (!isMediumUnit(state.definitions, unit.cardId)) return null;
  if (canMoveUnitToBattle(state, playerId, unit, "rush")) return null;

  const lgCount = countActiveLightningGravity(state);
  if (lgCount === 0) return null;

  const player = state.players[playerId];
  const requiredHolds = requiredBattleEntryHolds(state, unit);
  const heldHolds = countHeldCommands(player);
  if (requiredHolds === 0 || heldHolds >= requiredHolds) return null;

  const def = getDefinition(state.definitions, unit.cardId);
  return {
    unitName: def?.name ?? unit.cardId,
    requiredHolds,
    heldHolds,
    lightningGravityCount: lgCount,
    unitHoldCount: getBattleEntryHoldCount(unit.cardId),
  };
}

/** Card text + RS-069: held commands required to enter battle. */
export function requiredBattleEntryHolds(
  state: GameState,
  unit: CardInstance,
): number {
  const unitHold = getBattleEntryHoldCount(unit.cardId);
  const lgHold = isMediumUnit(state.definitions, unit.cardId)
    ? countActiveLightningGravity(state)
    : 0;
  return unitHold + lgHold;
}

/** RS-047 Pat Signer: blocks M units with BP>=5000 from entering battle. */
export function patSignerBlocksMove(
  state: GameState,
  playerId: PlayerId,
  unit: CardInstance,
): boolean {
  const def = getDefinition(state.definitions, unit.cardId);
  if (def?.size !== "M") return false;

  const bp = effectiveBp(state, playerId, unit);
  if (bp < 5000) return false;

  for (const pid of ["player1", "player2"] as const) {
    const hasSigner = state.players[pid].battle.some((c) => c.cardId === "RS-047");
    if (hasSigner) return true;
  }

  return false;
}

export function canMoveUnitToBattle(
  state: GameState,
  playerId: PlayerId,
  unit: CardInstance,
  fromZone: "rush" | "hand" = "rush",
): boolean {
  const def = getDefinition(state.definitions, unit.cardId);
  if (!def || def.type !== "unit") return false;
  const player = state.players[playerId];

  if (fromZone === "hand") {
    return false;
  }

  if (patSignerBlocksMove(state, playerId, unit)) return false;

  if (cannotEnterBattle(unit.cardId)) return false;

  if (needsAllySInBattle(unit.cardId)) {
    const hasAllyS = state.players[playerId].battle.some((c) =>
      isSmallUnit(state.definitions, c.cardId),
    );
    if (!hasAllyS) return false;
  }

  if (noBattleEntryTurnRushed(unit.cardId) && wasRushedThisTurn(player, unit.instanceId)) {
    return false;
  }

  if (getTurnModifiers(player).zenibombActive && wasRushedThisTurn(player, unit.instanceId)) {
    return false;
  }

  if (trafficControlRequiresSameSize(state, playerId, def.size)) return false;

  if (
    karakuriLionChainBlocksEntry(
      state,
      playerId,
      unit,
      countHeldCommands(state.players[playerId]),
    )
  ) {
    return false;
  }

  if (isBattleBlocked(state.players[playerId], unit.instanceId)) return false;

  return passesBattleEntryHoldRequirements(state, player, unit);
}

/** Field / effect checks only (no ※ or 稲妻重力 hold counts). */
export function canMoveUnitToBattleExceptHoldRequirements(
  state: GameState,
  playerId: PlayerId,
  unit: CardInstance,
  fromZone: "rush" | "hand" = "rush",
): boolean {
  const def = getDefinition(state.definitions, unit.cardId);
  if (!def || def.type !== "unit") return false;
  const player = state.players[playerId];

  if (fromZone === "hand") return false;
  if (patSignerBlocksMove(state, playerId, unit)) return false;
  if (cannotEnterBattle(unit.cardId)) return false;

  if (needsAllySInBattle(unit.cardId)) {
    const hasAllyS = state.players[playerId].battle.some((c) =>
      isSmallUnit(state.definitions, c.cardId),
    );
    if (!hasAllyS) return false;
  }

  if (noBattleEntryTurnRushed(unit.cardId) && wasRushedThisTurn(player, unit.instanceId)) {
    return false;
  }

  if (getTurnModifiers(player).zenibombActive && wasRushedThisTurn(player, unit.instanceId)) {
    return false;
  }

  if (trafficControlRequiresSameSize(state, playerId, def.size)) return false;

  if (
    karakuriLionChainBlocksEntry(
      state,
      playerId,
      unit,
      countHeldCommands(state.players[playerId]),
    )
  ) {
    return false;
  }

  if (isBattleBlocked(state.players[playerId], unit.instanceId)) return false;

  return true;
}

/** コマンドゾーンでリリース状態（未ホールド）の枚数。 */
export function countReleasedCommands(player: PlayerState): number {
  return player.command.filter((c) => !c.commandHeld).length;
}

/**
 * 効果など支払いUIなしで※進入するとき、リリース中のコマンドを1枚ホールドする。
 * プレイヤー操作の進入は initiate_command_payment を使う。
 */
/** Effect/auto entry: ※用ホールドが既に揃っているとき支払い済みフラグを立てる。 */
export function markBattleEntryHoldReadyIfNoteSatisfied(
  player: PlayerState,
  unit: CardInstance,
): PlayerState {
  const unitHold = getBattleEntryHoldCount(unit.cardId);
  if (unitHold > 0 && countBattleEntryEligibleHolds(player) >= unitHold) {
    return { ...player, battleEntryHoldReady: true };
  }
  return player;
}

export function autoHoldForBattleEntry(
  player: PlayerState,
  unit: CardInstance,
): PlayerState | null {
  const unitHold = getBattleEntryHoldCount(unit.cardId);
  if (unitHold <= 0) return player;

  if (countBattleEntryEligibleHolds(player) >= unitHold) {
    return player;
  }

  const idx = player.command.findIndex((c) => !c.commandHeld);
  if (idx < 0) return null;

  const command = player.command.map((c, i) =>
    i === idx ? { ...c, commandHeld: true, mothershipHold: false } : c,
  );
  return { ...player, command, battleEntryHoldReady: true };
}

function passesBattleEntryHoldRequirements(
  state: GameState,
  player: PlayerState,
  unit: CardInstance,
): boolean {
  const unitHold = getBattleEntryHoldCount(unit.cardId);
  const lgHold = isMediumUnit(state.definitions, unit.cardId)
    ? countActiveLightningGravity(state)
    : 0;
  const requiredTotal = unitHold + lgHold;

  if (requiredTotal === 0) return true;

  if (unitHold > 0) {
    if (countBattleEntryEligibleHolds(player) < unitHold) return false;
    if (!player.battleEntryHoldReady) return false;
  }

  return countHeldCommands(player) >= requiredTotal;
}

function cardName(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): string {
  return getDefinition(definitions, cardId)?.name ?? cardId;
}

function findCardOnField(
  state: GameState,
  cardId: string,
): { playerId: PlayerId; name: string } | null {
  for (const playerId of ["player1", "player2"] as const) {
    const player = state.players[playerId];
    const zones = [...player.battle, ...player.rush] as const;
    for (const card of zones) {
      if (card.cardId === cardId) {
        return { playerId, name: cardName(state.definitions, cardId) };
      }
    }
  }
  return null;
}

/** Human-readable reason when a unit cannot enter the battle area. */
export function explainCannotEnterBattle(
  state: GameState,
  playerId: PlayerId,
  unit: CardInstance,
  fromZone: "rush" | "hand" = "rush",
): string | null {
  if (canMoveUnitToBattle(state, playerId, unit, fromZone)) return null;

  const def = getDefinition(state.definitions, unit.cardId);
  const unitName = def?.name ?? unit.cardId;
  const player = state.players[playerId];

  if (fromZone === "hand") {
    return "手札のユニットはバトルエリアに直接出せません。";
  }

  if (state.pendingBattleEntry) {
    return "先にバトルエリアに出したユニットのアクションを選んでください。";
  }

  if (patSignerBlocksMove(state, playerId, unit)) {
    const signer = findCardOnField(state, "RS-047");
    const who = signer?.playerId === playerId ? "自軍" : "敵軍";
    return `${who}の「${signer?.name ?? "パトシグナー"}」の【進入禁止サインボード】の効果で、BP5000以上のMユニットはバトルエリアに出られません。`;
  }

  if (cannotEnterBattle(unit.cardId)) {
    return `「${unitName}」はバトルエリアに出せないユニットです。`;
  }

  if (needsAllySInBattle(unit.cardId)) {
    return `「${unitName}」は自軍バトルエリアにSユニットがいないとバトルエリアに出せません。`;
  }

  if (noBattleEntryTurnRushed(unit.cardId) && wasRushedThisTurn(player, unit.instanceId)) {
    return `「${unitName}」はラッシュしたターンはバトルエリアに出せません。`;
  }

  if (getTurnModifiers(player).zenibombActive && wasRushedThisTurn(player, unit.instanceId)) {
    return "相手の【ゼニボム】の効果で、このターンにラッシュしたユニットはバトルエリアに出せません。";
  }

  if (trafficControlRequiresSameSize(state, playerId, def?.size)) {
    const controller = findCardOnField(state, "RS-086");
    const requiredSize =
      getDefinition(state.definitions, player.battle[0]?.cardId ?? "")?.size ?? "不明";
    const who = controller?.playerId === playerId ? "自軍" : "敵軍";
    return `${who}の「${controller?.name ?? "パトトレーラー"}」の【交通整理】の効果で、先にバトルエリアへ入ったユニット（${requiredSize}）と同じサイズのユニットしか出せません。`;
  }

  if (
    karakuriLionChainBlocksEntry(
      state,
      playerId,
      unit,
      countHeldCommands(player),
    )
  ) {
    const chain = findCardOnField(state, "RS-097");
    const who = chain?.playerId === playerId ? "自軍" : "敵軍";
    return `${who}の「${chain?.name ?? "ハリケンライオン"}」の【からくりライオンチェーン】の効果で、SP1以上または「!」のユニットはコマンドを1枚ホールドしないとバトルエリアに出せません。`;
  }

  if (isBattleBlocked(player, unit.instanceId)) {
    return "【バトルダンス】でラッシュエリアに戻したユニットは、このターンはバトルエリアに出せません。";
  }

  const unitHolds = getBattleEntryHoldCount(unit.cardId);
  const lgCount = countActiveLightningGravity(state);
  const requiredTotal = unitHolds + lgCount;
  const held = countHeldCommands(player);
  const released = countReleasedCommands(player);
  const battleEntryHeld = countBattleEntryEligibleHolds(player);
  if (unitHolds > 0 && !player.battleEntryHoldReady) {
    if (released < unitHolds) {
      if (held > battleEntryHeld) {
        return `「${unitName}」をバトルエリアに出すには、リリース状態の自軍コマンドを${unitHolds}枚ホールドする必要があります（母艦のホールドはバトル進入の条件になりません）。`;
      }
      return `「${unitName}」をバトルエリアに出すには、リリース状態の自軍コマンドが${unitHolds}枚以上必要です（リリース${released}枚）。`;
    }
    if (battleEntryHeld < unitHolds) {
      return `「${unitName}」をバトルエリアに出すには、リリース状態のコマンドを${unitHolds}枚選んでホールドしてください。`;
    }
    return `「${unitName}」をバトルエリアに出すには、※のコマンドホールド支払いを完了してください。`;
  }
  if (unitHolds > 0 && battleEntryHeld < unitHolds) {
    if (held > battleEntryHeld) {
      return `「${unitName}」をバトルエリアに出すには、リリース状態の自軍コマンドを${unitHolds}枚ホールドする必要があります（母艦のホールドはバトル進入の条件になりません）。`;
    }
    return `「${unitName}」をバトルエリアに出すには、リリース状態のコマンドを${unitHolds}枚選んでホールドしてください。`;
  }
  if (requiredTotal > 0 && held < requiredTotal) {
    const parts: string[] = [];
    if (unitHolds > 0) {
      parts.push(`「${unitName}」の能力によりコマンドを${unitHolds}枚ホールド`);
    }
    if (lgCount > 0) {
      parts.push(`【稲妻重力エネルギー】の効果によりコマンドを${lgCount}枚ホールド`);
    }
    const requirement = parts.length > 0 ? parts.join("、") : "コマンドをホールド";
    return `${requirement}する必要があります（現在${held}枚 / 必要${requiredTotal}枚）。`;
  }

  return `「${unitName}」はバトルエリアに出せません。`;
}

/** RS-022: all rush units must enter battle when possible. */
export function earthForceRequiresBattleEntry(state: GameState): boolean {
  return earthForceActive(state);
}

/** RS-041/054/055 + RS-022: rush units that must enter battle before ending the battle phase. */
export function findMandatoryBattleEntries(
  state: GameState,
  playerId: PlayerId,
): CardInstance[] {
  if (state.phase !== "battle") return [];
  const player = state.players[playerId];
  const mandatory: CardInstance[] = [];

  for (const card of player.rush) {
    if (!canMoveUnitToBattle(state, playerId, card, "rush")) continue;
    if (hasAutoBattleEntryNote(card.cardId) || earthForceRequiresBattleEntry(state)) {
      mandatory.push(card);
    }
  }

  return mandatory;
}

export function mustEnterBattleBeforePhaseEnd(
  state: GameState,
  playerId: PlayerId,
): boolean {
  return findMandatoryBattleEntries(state, playerId).length > 0;
}

export function countHeldCommands(player: PlayerState): number {
  return player.command.filter((c) => c.commandHeld).length;
}

/** Holds that satisfy ※ battle-entry notes (excludes 母艦 zord payment holds). */
export function countBattleEntryEligibleHolds(player: PlayerState): number {
  return player.command.filter((c) => c.commandHeld && !c.mothershipHold).length;
}

/** Release up to `count` held commands (left-to-right in command zone). */
export function releaseHeldCommands(
  player: PlayerState,
  count: number,
): PlayerState {
  if (count <= 0) return player;
  const command = player.command.map((c) => ({ ...c }));
  let remaining = count;
  for (let i = 0; i < command.length && remaining > 0; i++) {
    if (command[i]!.commandHeld) {
      command[i] = { ...command[i]!, commandHeld: false, mothershipHold: false };
      remaining -= 1;
    }
  }
  return { ...player, command };
}

/** RS-010: 2 held commands substitute for 1 required category hold when using a card. */
export function hasCommandForCardUse(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  categories: Category[],
): boolean {
  if (hasHeldCommandForCategories(player, definitions, categories)) return true;

  if (
    hasOperationEffect(player, "prism_power", definitions) &&
    countHeldCommands(player) >= 2
  ) {
    return true;
  }

  return false;
}
