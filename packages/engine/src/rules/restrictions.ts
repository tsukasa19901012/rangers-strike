import {
  battleHasComboPartner,
  cannotEnterBattle,
  countLightningGravityPermanents,
  getBattleEntryComboFromOwnTurnPartnerIds,
  getBattleEntryComboFromPartnerIds,
  getBattleEntryHoldCount,
  hasAutoBattleEntryEachTurnNote,
  needsAllySInBattle,
  needsBattleEntryComboFrom,
  needsBattleEntryComboFromOwnTurn,
  needsBattleEntryHandDiscard,
  noAttackOrStrikeTurnRushed,
  noBattleEntryTurnRushed,
} from "@rangers-strike/cards";
import { getCardEffect } from "@rangers-strike/cards";
import type { CardDefinition, Category } from "@rangers-strike/cards";
import { anyPlayerHasActiveFieldKeyword, findFieldCardByKeyword } from "../dsl/fieldKeywords";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import {
  allCategoriesExistInCommandZone,
  canEnterBattleFromRush,
  effectiveBp,
  getDefinition,
  hasHeldCommandForCategories,
  hasOperationEffect,
  isMediumUnit,
  isSmallUnit,
  isUnit,
  isVehicle,
} from "../core/catalog";
import {
  heldCallLeadMatchesCategories,
  type CallLeadKind,
} from "./callLead";
import { isCostWindowSatisfied, satisfyCostWindow as satisfyCostWindowBridge } from "../core/costWindow";
import { hasTurnRuleModifier } from "../core/scopedModifiers";
import { findInZone, opponent } from "../core/helpers";
import { TURN_RULE_IDS } from "../types/scopedModifiers";
import { earthForceActive } from "./strikeReactions";
import { effectiveBattleEntryHoldCount } from "./rushAdditionalCondition";
import { wingTurnBlocksStrike } from "../keywords/battleKeywords";
import {
  isBattleBlocked,
  opponentInfiniteChainBlocks,
  wasRushedThisTurn,
} from "./turnModifiers";
import {
  findLegend2NamedEffectOnField,
  karakuriLionChainBlocksEntry,
  trafficControlRequiresSameSize,
} from "./legend2/fieldEffects";
import {
  canVehicleEnterBattleFromRush,
} from "./vehicleRules";
import {
  cannotEnterBattleOwnTurn,
  scorchingRoarBypassesHold,
} from "./legend3/fieldEffects";
import { cardHasGrantKeyword } from "../dsl/promotedKeywordBridge";
import {
  battleEntryHandDiscardSatisfied,
  battleEntryPowerDiscardSatisfied,
  battleEntryRushDiscardSatisfied,
  canPayBattleEntryHandDiscard,
  canPayBattleEntryPowerDiscard,
  canPayBattleEntryRushDiscard,
  hasBattleEntryRushDiscardTarget,
  needsBattleEntryPowerDiscard,
  needsBattleEntryRushDiscard,
} from "./legend3/restrictions";
import { getBattleEntryPowerDiscardCount } from "./batch07FieldEffects";
import { damageGateBlocksEntry } from "./keywordGapRuntime";
import {
  rs482BlocksAttackStrike,
  rs579BlocksAttackStrikeOnRushTurn,
  rs603BlocksVehicle,
} from "./rs/rsCatchallField";

export function countLightningGravityOperations(state: GameState): number {
  return countLightningGravityPermanents(
    [state.players.player1.operation, state.players.player2.operation],
    (cardId) => getCardEffect(cardId),
  );
}

/** RS-069 は両フィールドで重複；RS-072 無限連鎖でブロックされると無効。 */
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

/** RS-069 がMユニットの戦闘進入をブロックするときのUI通知。 */
export type LightningGravityHoldNotice = {
  unitName: string;
  requiredHolds: number;
  heldHolds: number;
  lightningGravityCount: number;
  unitHoldCount: number;
};

function unitBattleEntryHoldCount(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): number {
  return effectiveBattleEntryHoldCount(state, playerId, cardId, getBattleEntryHoldCount(cardId));
}

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
  const requiredHolds = requiredBattleEntryHolds(state, playerId, unit);
  const heldHolds = countHeldCommands(player);
  if (requiredHolds === 0 || heldHolds >= requiredHolds) return null;

  const def = getDefinition(state.definitions, unit.cardId);
  return {
    unitName: def?.name ?? unit.cardId,
    requiredHolds,
    heldHolds,
    lightningGravityCount: lgCount,
    unitHoldCount: unitBattleEntryHoldCount(state, playerId, unit.cardId),
  };
}

/** カード文面 + RS-069: 戦闘進入にホールド中コマンドが必要。 */
export function requiredBattleEntryHolds(
  state: GameState,
  playerId: PlayerId,
  unit: CardInstance,
): number {
  let unitHold = unitBattleEntryHoldCount(state, playerId, unit.cardId);
  if (unitHold > 0 && scorchingRoarBypassesHold(unit.cardId, state, playerId)) {
    unitHold = 0;
  }
  const lgHold = isMediumUnit(state.definitions, unit.cardId)
    ? countActiveLightningGravity(state)
    : 0;
  return unitHold + lgHold;
}

/** RS-047 Pat Signer: BP>=5000 のMユニットの戦闘進入をブロック。 */
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
    if (anyPlayerHasActiveFieldKeyword(state, "block_m_battle_entry_bp5000_plus", ["battle"])) {
      return true;
    }
    const hasSigner = state.players[pid].battle.some((c) => c.cardId === "RS-047");
    if (hasSigner) return true;
  }

  return false;
}

/** note_other_* nc battle entry restrictions — returns true if entry is blocked. */
function noteOtherNcBattleEntryBlock(
  state: GameState,
  playerId: PlayerId,
  player: PlayerState,
  unit: CardInstance,
): boolean {
  const cardId = unit.cardId;
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];

  // RS-368: can't enter on rush turn unless own damage ≥ 4
  if (cardId === "RS-368") {
    if (wasRushedThisTurn(player, unit.instanceId) && player.damage < 4) {
      return true;
    }
  }

  // RS-414: can't enter if enemy has ピンク unit
  if (cardId === "RS-414") {
    const enemyHasPink = [...enemy.rush, ...enemy.battle].some((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return d?.features?.includes("ピンク");
    });
    if (enemyHasPink) return true;
  }

  // RS-586: can't enter without 7+ 戦闘員 cards in own discard
  if (cardId === "RS-586") {
    const senshoCount = player.discard.filter((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return d?.features?.includes("戦闘員");
    }).length;
    if (senshoCount < 7) return true;
  }

  // XG4-015: can't enter without 5+ cards in own discard
  if (cardId === "XG4-015") {
    if (player.discard.length < 5) return true;
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
  if (!def || !canEnterBattleFromRush(def)) return false;
  const player = state.players[playerId];

  if (isVehicle(def)) {
    if (!canVehicleEnterBattleFromRush(state, playerId, unit)) return false;
  }

  if (unit.registerHeld) return false;

  if (fromZone === "hand") {
    return false;
  }

  if (def.type === "unit" && patSignerBlocksMove(state, playerId, unit)) return false;

  if (cannotEnterBattle(unit.cardId)) return false;

  if (needsAllySInBattle(unit.cardId)) {
    const hasAllyS = state.players[playerId].battle.some((c) =>
      isSmallUnit(state.definitions, c.cardId),
    );
    if (!hasAllyS) return false;
  }

  if (needsBattleEntryComboFrom(unit.cardId)) {
    const partners = getBattleEntryComboFromPartnerIds(unit.cardId);
    if (!battleHasComboPartner(player.battle, partners, unit.instanceId)) {
      return false;
    }
  }

  if (
    needsBattleEntryComboFromOwnTurn(unit.cardId) &&
    state.activePlayer === playerId
  ) {
    const partners = getBattleEntryComboFromOwnTurnPartnerIds(unit.cardId);
    if (!battleHasComboPartner(player.battle, partners, unit.instanceId)) {
      return false;
    }
  }

  if (noBattleEntryTurnRushed(unit.cardId) && wasRushedThisTurn(player, unit.instanceId)) {
    return false;
  }

  if (hasTurnRuleModifier(player, TURN_RULE_IDS.ZENIBOMB) && wasRushedThisTurn(player, unit.instanceId)) {
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

  if (cannotEnterBattleOwnTurn(state, playerId, unit.cardId)) return false;

  if (noteOtherNcBattleEntryBlock(state, playerId, player, unit)) return false;

  if (
    needsBattleEntryHandDiscard(unit.cardId) &&
    !battleEntryHandDiscardSatisfied(player, unit.cardId) &&
    !canPayBattleEntryHandDiscard(player, unit.cardId)
  ) {
    return false;
  }

  if (
    needsBattleEntryPowerDiscard(unit.cardId) &&
    !battleEntryPowerDiscardSatisfied(player, unit.cardId) &&
    !canPayBattleEntryPowerDiscard(player, unit.cardId)
  ) {
    return false;
  }

  return passesBattleEntryHoldRequirements(state, playerId, player, unit);
}

export function cannotAttackOrStrikeThisTurn(
  player: PlayerState,
  unit: CardInstance,
  state?: GameState,
  playerId?: PlayerId,
): boolean {
  if (state && playerId) {
    if (rs482BlocksAttackStrike(state, playerId, unit.cardId)) return true;
    if (rs579BlocksAttackStrikeOnRushTurn(state, playerId, unit.instanceId)) return true;
    if (rs603BlocksVehicle(state, playerId, unit.cardId)) return true;
  }
  if (unit.activatedNcEffects?.includes("optional_battle_no_attack")) return true;
  return (
    noAttackOrStrikeTurnRushed(unit.cardId) &&
    wasRushedThisTurn(player, unit.instanceId)
  );
}

/** DSL grant_keyword `cannot_attack` — バトル（アタック）を開始できない。 */
export function unitCannotInitiateAttack(cardId: string): boolean {
  return cardHasGrantKeyword(cardId, "cannot_attack");
}

/** フィールド / 効果チェックのみ（※ または稲妻重力のホールド数は含まない）。 */
export function canMoveUnitToBattleExceptHoldRequirements(
  state: GameState,
  playerId: PlayerId,
  unit: CardInstance,
  fromZone: "rush" | "hand" = "rush",
): boolean {
  const def = getDefinition(state.definitions, unit.cardId);
  if (!def || !canEnterBattleFromRush(def)) return false;
  const player = state.players[playerId];

  if (isVehicle(def)) {
    if (!canVehicleEnterBattleFromRush(state, playerId, unit)) return false;
  }

  if (fromZone === "hand") return false;
  if (def.type === "unit" && patSignerBlocksMove(state, playerId, unit)) return false;
  if (cannotEnterBattle(unit.cardId)) return false;
  if (damageGateBlocksEntry(state, playerId, unit.cardId)) return false;

  if (def.type === "unit" && needsAllySInBattle(unit.cardId)) {
    const hasAllyS = state.players[playerId].battle.some((c) =>
      isSmallUnit(state.definitions, c.cardId),
    );
    if (!hasAllyS) return false;
  }

  if (needsBattleEntryComboFrom(unit.cardId)) {
    const partners = getBattleEntryComboFromPartnerIds(unit.cardId);
    if (!battleHasComboPartner(player.battle, partners, unit.instanceId)) {
      return false;
    }
  }

  if (
    needsBattleEntryComboFromOwnTurn(unit.cardId) &&
    state.activePlayer === playerId
  ) {
    const partners = getBattleEntryComboFromOwnTurnPartnerIds(unit.cardId);
    if (!battleHasComboPartner(player.battle, partners, unit.instanceId)) {
      return false;
    }
  }

  if (noBattleEntryTurnRushed(unit.cardId) && wasRushedThisTurn(player, unit.instanceId)) {
    return false;
  }

  if (hasTurnRuleModifier(player, TURN_RULE_IDS.ZENIBOMB) && wasRushedThisTurn(player, unit.instanceId)) {
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

  if (cannotEnterBattleOwnTurn(state, playerId, unit.cardId)) return false;

  if (needsBattleEntryRushDiscard(unit.cardId)) {
    if (!canPayBattleEntryRushDiscard(player, state.definitions)) return false;
    if (!battleEntryRushDiscardSatisfied(player, unit.cardId)) {
      if (!hasBattleEntryRushDiscardTarget(player, state.definitions, unit.instanceId)) {
        return false;
      }
    }
  }

  if (!canPayBattleEntryHandDiscard(player, unit.cardId)) return false;

  if (
    needsBattleEntryPowerDiscard(unit.cardId) &&
    !battleEntryPowerDiscardSatisfied(player, unit.cardId) &&
    !canPayBattleEntryPowerDiscard(player, unit.cardId)
  ) {
    return false;
  }

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
/** 効果/自動進入: ※用ホールドが既に揃っているとき支払い済みフラグを立てる。 */
export function markBattleEntryHoldReadyIfNoteSatisfied(
  player: PlayerState,
  unit: CardInstance,
): PlayerState {
  const unitHold = getBattleEntryHoldCount(unit.cardId);
  if (unitHold > 0 && countBattleEntryEligibleHolds(player) >= unitHold) {
    return satisfyCostWindowBridge(player, "battle_entry_hold");
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
  return satisfyCostWindowBridge({ ...player, command }, "battle_entry_hold");
}

function passesBattleEntryHoldRequirements(
  state: GameState,
  playerId: PlayerId,
  player: PlayerState,
  unit: CardInstance,
): boolean {
  let unitHold = unitBattleEntryHoldCount(state, playerId, unit.cardId);
  if (unitHold > 0 && scorchingRoarBypassesHold(unit.cardId, state, playerId)) {
    unitHold = 0;
  }
  const lgHold = isMediumUnit(state.definitions, unit.cardId)
    ? countActiveLightningGravity(state)
    : 0;
  const requiredTotal = unitHold + lgHold;

  if (requiredTotal === 0 && !needsVCommanderHold(state, playerId, unit)) {
    return true;
  }

  if (needsVCommanderHold(state, playerId, unit)) {
    if (!hasHeldVCommanderCommand(player, state.definitions)) return false;
  }

  if (unitHold > 0) {
    if (countBattleEntryEligibleHolds(player) < unitHold) return false;
    if (!isCostWindowSatisfied(player, "battle_entry_hold")) return false;
  }

  return countHeldCommands(player) >= requiredTotal;
}

function allyHasVCommanderFeature(
  state: GameState,
  playerId: PlayerId,
  excludeInstanceId?: string,
): boolean {
  const player = state.players[playerId];
  return [...player.rush, ...player.battle].some((c) => {
    if (excludeInstanceId && c.instanceId === excludeInstanceId) return false;
    const def = getDefinition(state.definitions, c.cardId);
    return def?.type === "unit" && (def.features ?? []).includes("Vコマンダー");
  });
}

function hasHeldVCommanderCommand(
  player: PlayerState,
  definitions: GameState["definitions"],
): boolean {
  return player.command.some((c) => {
    if (!c.commandHeld) return false;
    return getDefinition(definitions, c.cardId)?.name === "Vコマンダー";
  });
}

function needsVCommanderHold(
  state: GameState,
  playerId: PlayerId,
  unit: CardInstance,
): boolean {
  if (!cardHasGrantKeyword(unit.cardId, "v_commander_hold_entry")) return false;
  return !allyHasVCommanderFeature(state, playerId, unit.instanceId);
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

/** ユニットがバトルエリアに入れない理由（人間が読める形式）。 */
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
    const signer = findFieldCardByKeyword(state, "block_m_battle_entry_bp5000_plus", ["battle"])
      ?? findCardOnField(state, "RS-047");
    const who = signer?.playerId === playerId ? "自軍" : "敵軍";
    return `${who}の「${signer?.name ?? "パトシグナー"}」の【進入禁止サインボード】の効果で、BP5000以上のMユニットはバトルエリアに出られません。`;
  }

  if (cannotEnterBattle(unit.cardId)) {
    return `「${unitName}」はバトルエリアに出せないユニットです。`;
  }

  if (needsAllySInBattle(unit.cardId)) {
    return `「${unitName}」は自軍バトルエリアにSユニットがいないとバトルエリアに出せません。`;
  }

  if (needsBattleEntryComboFrom(unit.cardId)) {
    const partners = getBattleEntryComboFromPartnerIds(unit.cardId);
    if (!battleHasComboPartner(player.battle, partners, unit.instanceId)) {
      const partnerName = partners
        .map((id) => cardName(state.definitions, id))
        .join("」「");
      return `「${unitName}」は「${partnerName}」からコンビネーションしないとバトルエリアに出せません。`;
    }
  }

  if (
    needsBattleEntryComboFromOwnTurn(unit.cardId) &&
    state.activePlayer === playerId
  ) {
    const partners = getBattleEntryComboFromOwnTurnPartnerIds(unit.cardId);
    if (!battleHasComboPartner(player.battle, partners, unit.instanceId)) {
      const partnerName = partners
        .map((id) => cardName(state.definitions, id))
        .join("」「");
      return `「${unitName}」は自軍ターン中、「${partnerName}」からコンビネーションしないとバトルエリアに出せません。`;
    }
  }

  if (!canPayBattleEntryHandDiscard(player, unit.cardId)) {
    return `「${unitName}」をバトルエリアに出すには、手札から2枚捨札する必要があります（手札${player.hand.length}枚）。`;
  }
  if (!battleEntryHandDiscardSatisfied(player, unit.cardId)) {
    return `「${unitName}」をバトルエリアに出すには、手札から2枚選んで捨札してください。`;
  }
  if (!canPayBattleEntryPowerDiscard(player, unit.cardId)) {
    const need = getBattleEntryPowerDiscardCount(unit.cardId);
    const have = player.power.filter((c) => !c.faceDown).length;
    return `「${unitName}」をバトルエリアに出すには、パワーからダメージ以外を${need}枚捨札する必要があります（対象${have}枚）。`;
  }
  if (!battleEntryPowerDiscardSatisfied(player, unit.cardId)) {
    return `「${unitName}」をバトルエリアに出すには、パワーからダメージ以外を選んで捨札してください。`;
  }

  if (noBattleEntryTurnRushed(unit.cardId) && wasRushedThisTurn(player, unit.instanceId)) {
    return `「${unitName}」はラッシュしたターンはバトルエリアに出せません。`;
  }

  if (hasTurnRuleModifier(player, TURN_RULE_IDS.ZENIBOMB) && wasRushedThisTurn(player, unit.instanceId)) {
    return "相手の【ゼニボム】の効果で、このターンにラッシュしたユニットはバトルエリアに出せません。";
  }

  if (trafficControlRequiresSameSize(state, playerId, def?.size)) {
    const controller = findLegend2NamedEffectOnField(state, "traffic_control", ["battle"]);
    const requiredSize =
      getDefinition(state.definitions, player.battle[0]?.cardId ?? "")?.size ?? "不明";
    const who = controller?.playerId === playerId ? "自軍" : "敵軍";
    const controllerName = controller
      ? cardName(state.definitions, controller.cardId)
      : "パトトレーラー";
    return `${who}の「${controllerName}」の【交通整理】の効果で、先にバトルエリアへ入ったユニット（${requiredSize}）と同じサイズのユニットしか出せません。`;
  }

  if (
    karakuriLionChainBlocksEntry(
      state,
      playerId,
      unit,
      countHeldCommands(player),
    )
  ) {
    const chain = findLegend2NamedEffectOnField(state, "karakuri_lion_chain", ["battle"]);
    const who = chain?.playerId === playerId ? "自軍" : "敵軍";
    const chainName = chain ? cardName(state.definitions, chain.cardId) : "ハリケンレオン";
    return `${who}の「${chainName}」の【カラクリ忍法・連獅子】の効果で、SP1以上または「!」のユニットはコマンドを1枚ホールドしないとバトルエリアに出せません。`;
  }

  if (isBattleBlocked(player, unit.instanceId)) {
    return "【バトルダンス】でラッシュエリアに戻したユニットは、このターンはバトルエリアに出せません。";
  }

  const unitHolds = unitBattleEntryHoldCount(state, playerId, unit.cardId);
  const lgCount = countActiveLightningGravity(state);
  const requiredTotal = unitHolds + lgCount;
  const held = countHeldCommands(player);
  const released = countReleasedCommands(player);
  const battleEntryHeld = countBattleEntryEligibleHolds(player);
  if (unitHolds > 0 && !isCostWindowSatisfied(player, "battle_entry_hold")) {
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

/** RS-022: 可能ならラッシュの全ユニットが戦闘進入しなければならない。 */
export function earthForceRequiresBattleEntry(state: GameState): boolean {
  return earthForceActive(state);
}

/** RS-041/054/055 + RS-022: バトルフェイズ終了前に戦闘進入必須のラッシュユニット。 */
export function findMandatoryBattleEntries(
  state: GameState,
  playerId: PlayerId,
): CardInstance[] {
  if (state.phase !== "battle") return [];
  const player = state.players[playerId];
  const mandatory: CardInstance[] = [];

  for (const card of player.rush) {
    if (wingTurnBlocksStrike(player, card.instanceId)) continue;
    if (!canMoveUnitToBattle(state, playerId, card, "rush")) continue;
    if (hasAutoBattleEntryEachTurnNote(card.cardId) || earthForceRequiresBattleEntry(state)) {
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

/** ※ 戦闘進入注記を満たすホールド（母艦ゾード支払いホールドは除く）。 */
export function countBattleEntryEligibleHolds(player: PlayerState): number {
  return player.command.filter((c) => c.commandHeld && !c.mothershipHold).length;
}

/** 最大 `count` 枚までホールド中コマンドをリリース（コマンドゾーン左から右）。 */
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

/** RS-010: カード使用時、ホールド中コマンド2枚で必要カテゴリホールド1枚分を代替。 */
export function hasCommandForCardUse(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  categories: Category[],
  callLeadKind?: CallLeadKind,
): boolean {
  if (categories.length === 0) return true;
  if (!allCategoriesExistInCommandZone(player, definitions, categories)) return false;
  if (hasHeldCommandForCategories(player, definitions, categories)) return true;
  if (
    callLeadKind &&
    heldCallLeadMatchesCategories(player, definitions, callLeadKind, categories)
  ) {
    return true;
  }

  if (
    hasOperationEffect(player, "prism_power", definitions) &&
    countHeldCommands(player) >= 2
  ) {
    return true;
  }

  return false;
}
