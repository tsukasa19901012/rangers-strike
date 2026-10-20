import { rm2BlocksBattleEntry } from "./rm/rm2Fields";
import { xg6BlocksBattleEntry } from "./xg6/xg6Fields";
import { filthyAirActive } from "./legend1/otherLinesNamedEffects";
import { rk3BattleEntryBlocked } from "./rk/rk3UnitEffects";
import { hammerPunchBlocksEntry } from "./legend1/set6NamedEffects348";
import { set9CBlocksBattleEntry } from "./legend1/set9NamedEffectsC";
import { enteredRushAreaUnderZenibomb } from "./rushAreaEntries";
import { ownAutoBattleEntryNegated } from "./legend1/set8NamedEffectsD";
import { set8BRequiresBattleEntry } from "./legend1/set8NamedEffectsB";
import { sliderEvolutionIgnoresEntryHold } from "./legend1/set4NamedEffects";
import { set6BBattleEntryBlocked } from "./legend1/set6NamedEffectsB";
import { riddenVehicleGrantsEntryHold } from "./legend1/set7NamedEffectsB";
import { beastSwordIgnoresEntryHold } from "./legend1/set5NamedEffectsA";
import { rushAreaEntryBlockedThisTurn } from "./legend1/set5NamedEffects";
import { hellSaturnGrantCount } from "./hellSaturn";
import { errataBattleEntryBlocked, isDivingOrochi } from "./errataCardEffects";
import {
  battleHasComboPartner,
  cannotEnterBattle,
  countLightningGravityPermanents,
  getBattleEntryComboFromOwnTurnPartnerIds,
  getBattleEntryComboFromPartnerIds,
  getBattleEntryHandDiscardCount,
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
  unitEffectiveCategories,
  unitSizeOf,
} from "../core/catalog";
import {
  heldCallLeadMatchesCategories,
  type CallLeadKind,
} from "./callLead";
import {
  clearCostWindow as clearCostWindowBridge,
  isCostWindowSatisfied,
  satisfyCostWindow as satisfyCostWindowBridge,
} from "../core/costWindow";
import { hasScopedRestriction, hasTurnRuleModifier } from "../core/scopedModifiers";
import { findInZone, opponent } from "../core/helpers";
import { memoizeInSearchWithContext } from "../core/searchCache";
import { actionContextState } from "./zordFeatureContext";
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
  karakuriLionChainHoldCount,
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
import { rk6BlocksBattleEntry } from "./rk/rk6Fields";
import { rk14NeedsEntryHold } from "./rk/rk14Fields";
import { rk15BlocksAttackStrike, rk15RequiresBattleEntry } from "./rk/rk15Fields";
import { xg5RequiresBattleEntry } from "./xg5/xg5Fields";
import { rk8BlocksBattleEntry } from "./rk/rk8UnitEffects";
import { rk9BlocksBattleEntry } from "./rk/rk9Fields";
import { rk10BlocksBattleEntry, rk10ElasmoHoldReduction, rk10OmegaIgnoresEntryHold } from "./rk/rk10Fields";
import { rk12BlocksBattleEntry, rk12RequiresBattleEntry, rk12ResidentsNegated } from "./rk/rk12Fields";
import { unitFeatures as rk12UnitFeatures } from "./addedFeatures";
import {
  rs482BlocksAttackStrike,
  rs579BlocksAttackStrikeOnRushTurn,
  rs603BlocksVehicle,
} from "./rs/rsCatchallField";


/** 「可能ならバトルエリアに置く」で直接バトルエリアにラッシュしたユニットに付ける（このターン有効）。 */
export const DIRECT_BATTLE_RUSH_RESTRICTION = "direct_battle_rush";

/**
 * RS-110【ゼニボム】:「次の相手ターン、新しくラッシュエリアに出たユニットは、ターンが終わるまでバトルエリアに出られない」。
 * 「ラッシュするとき可能ならバトルエリアに置く」（RS-090 レッドレーサー）はバトルエリアに直接ラッシュする効果で、
 * 「新しくラッシュエリアに出たユニット」にあたらない（atwiki/page-308 Q2・page-303 Q1「（2010/10/25修正）」。
 * docs/rules/README.md §1.2 例外2・§5.7 e）。
 * 「新しくラッシュエリアに出たユニット」は手段を問わず、場の外からそのターンに相手のラッシュエリアに出たユニット
 * （ユーザー決定 2026-10-19、docs/rules/README.md §5.7。判定は rules/rushAreaEntries.ts trackZenibombEntries）。
 * バトルエリアからラッシュエリアに戻ったユニットは含まない。
 */
export function zenibombBlocksBattleEntry(player: PlayerState, instanceId: string): boolean {
  if (!hasTurnRuleModifier(player, TURN_RULE_IDS.ZENIBOMB)) return false;
  if (!enteredRushAreaUnderZenibomb(player, instanceId)) return false;
  return !hasScopedRestriction(player, instanceId, DIRECT_BATTLE_RUSH_RESTRICTION);
}

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
    // RK-248 パラダイス・ロスト: このターン、相手の常駐オペレーションは無効（rules/rk/rk12Fields.ts）。
    if (rk12ResidentsNegated(state, playerId)) continue;
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
  if (!isMediumUnit(state.definitions, unit)) return null;
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
  // RS-364【黒き太陽神への忠誠】:「これは自軍コマンドを1つホールドしなければバトルエリアに出られない。」と書かれているかのように扱う
  // （複数あっても 1 つ — faq-card-6 RS-364 Q5。獣奏剣で無効にできる — 同 Q4）。
  if (hellSaturnGrantCount(state, playerId, unit) > 0) unitHold = Math.max(unitHold, 1);
  // RK-280 ダークレイダー・RK-281 ドラグランザー: ユニットの間は「これは自軍コマンドを1つホールドしなければバトルエリアに出られない」
  // （rules/rk/rk14Fields.ts）。
  if (rk14NeedsEntryHold(state, playerId, unit)) unitHold = Math.max(unitHold, 1);
  // RS-468 ギンガリラ【水の星獣】: 特徴「車両」を持つユニットは「これは自軍コマンドを1つホールドしなければバトルエリアに出られない」と
  // 書かれているかのように扱う（rules/legend1/set7NamedEffectsB.ts）。
  if (riddenVehicleGrantsEntryHold(state, playerId, unit)) unitHold = Math.max(unitHold, 1);
  if (unitHold > 0 && scorchingRoarBypassesHold(unit.cardId, state, playerId)) {
    unitHold = 0;
  }
  // RS-228【超スライダー進化】: このターン、「1つホールドしなければ出られない」テキストを無効にしたユニット。
  if (unitHold > 0 && sliderEvolutionIgnoresEntryHold(state, playerId, unit.instanceId)) {
    unitHold = 0;
  }
  // RS-243【獣奏剣】: このターン、すべての自軍ユニットの「1つホールドしなければ出られない」を無効にする。
  if (unitHold > 0 && beastSwordIgnoresEntryHold(state, playerId)) {
    unitHold = 0;
  }
  // RK-199 オメガゼール【ゼール種の統率】: 「オメガゼール」以外の「レイヨウ型」の自軍ユニットの「1つホールドしなければ出られない」は無効。
  if (unitHold > 0 && rk10OmegaIgnoresEntryHold(state, playerId, unit)) unitHold = 0;
  // RK-209 エラスモテリウムオルフェノク ※: ホールドする数は相手の手札1枚につき1少なくなる（rules/rk/rk10Fields.ts）。
  if (unitHold > 0) unitHold = Math.max(0, unitHold - rk10ElasmoHoldReduction(state, playerId, unit));
  const lgHold = isMediumUnit(state.definitions, unit)
    ? countActiveLightningGravity(state)
    : 0;
  // ルール: R-ADD-07 — 「〜しなければバトルエリアに出られない」制限は1つずつ別々に満たす
  // （ハリケンレオンは体数分重複）。
  const lionHold = karakuriLionChainHoldCount(state, playerId, unit);
  return unitHold + lgHold + lionHold + accelMemoryHoldCount(state, playerId, unit);
}

/**
 * XG4-062【アクセルメモリ】: ライドされているこのビークルがバトルエリアにある間、特徴「加速」を持たない
 * 敵軍Sユニットは自分自身のコマンドを1つホールドしなければバトルエリアに出られない。
 * ルール: R-ERR-XG4-062 — 「自軍コマンド」は制限を受ける側（敵軍プレイヤー）にとっての自軍コマンド。
 */
export function accelMemoryHoldCount(
  state: GameState,
  playerId: PlayerId,
  unit: CardInstance,
): number {
  const def = getDefinition(state.definitions, unit.cardId);
  if (!def || def.type !== "unit" || unitSizeOf(state.definitions, unit) !== "S") return 0;
  if ((def.features ?? []).includes("加速")) return 0;
  const enemy = state.players[opponent(playerId)];
  const riders = [...enemy.battle, ...enemy.rush];
  return enemy.battle.filter(
    (c) =>
      c.cardId === "XG4-062" && riders.some((r) => r.mountedOnInstanceId === c.instanceId),
  ).length;
}

/**
 * RS-290 龍星王【飛竜棍・大風車】: これが自軍バトルエリアにある間、「DA」の敵軍Sユニットはバトルエリアに出られない
 * （atwiki/page-474）。効果で DA が追加されたユニットも含む（faq-card-5 RS-290 Q1・RS-339 Q1）。
 * ライドして L ユニットになれば対象外（atwiki/page-474 Q3。ここではラッシュエリアの S ユニットだけを判定）。
 */
export function ryuseioBlocksMove(state: GameState, playerId: PlayerId, unit: CardInstance): boolean {
  const enemy = state.players[opponent(playerId)];
  if (!enemy.battle.some((c) => c.cardId === "RS-290")) return false;
  // ビークルにライドして出るなら L ユニットとして扱い、対象外（atwiki/page-474 Q3）。
  if (unit.mountedOnInstanceId) return false;
  const def = getDefinition(state.definitions, unit.cardId);
  if (def?.type !== "unit" || unitSizeOf(state.definitions, unit) !== "S") return false;
  return unitEffectiveCategories(state, playerId, unit, "rush").includes("DA");
}

/** RS-047 Pat Signer: BP>=5000 のMユニットの戦闘進入をブロック。 */
export function patSignerBlocksMove(
  state: GameState,
  playerId: PlayerId,
  unit: CardInstance,
): boolean {
  const def = getDefinition(state.definitions, unit.cardId);
  if (unitSizeOf(state.definitions, unit) !== "M") return false;

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

/**
 * 「※これはラッシュしたターンにバトルエリアに出られない」（RS-106 等の unnamed rule、RS-208・RS-295 の DSL キーワード）。
 */
export function noEntryOnRushTurn(cardId: string): boolean {
  return noBattleEntryTurnRushed(cardId) || cardHasGrantKeyword(cardId, "no_battle_rush_turn");
}

/** 無条件の「※これはバトルエリアに出られない。」（定義テキストからも判定する）。 */
export function unconditionalNoEntryText(def: CardDefinition): boolean {
  return /(^|\s)※これはバトルエリアに出られない。/.test(def.text ?? "");
}

export function canMoveUnitToBattle(
  state: GameState,
  playerId: PlayerId,
  unit: CardInstance,
  fromZone: "rush" | "hand" = "rush",
): boolean {
  // CPU の探索の間は、同じ状態・同じユニットの判定を使い回す（合法手の列挙・出なければならないユニットの判定・
  // ホールドの支払いの判定で何度も調べる。判定は applyAction / getLegalActions の入口の状態も読むので、それも区別する）。
  return memoizeInSearchWithContext(state, actionContextState(), unit, `${playerId}:${fromZone}`, () =>
    canMoveUnitToBattleUncached(state, playerId, unit, fromZone),
  );
}

function canMoveUnitToBattleUncached(
  state: GameState,
  playerId: PlayerId,
  unit: CardInstance,
  fromZone: "rush" | "hand",
): boolean {
  const def = getDefinition(state.definitions, unit.cardId);
  if (!def || !canEnterBattleFromRush(def)) return false;
  const player = state.players[playerId];

  if (isVehicle(def)) {
    if (!canVehicleEnterBattleFromRush(state, playerId, unit)) return false;
  }

  // ルール: R-HOLD-03 — ホールド状態のユニットもバトルエリアに出られる（レジスト後のホールドも同じ）。

  if (fromZone === "hand") {
    return false;
  }

  if (def.type === "unit" && patSignerBlocksMove(state, playerId, unit)) return false;
  if (def.type === "unit" && ryuseioBlocksMove(state, playerId, unit)) return false;

  if (cannotEnterBattle(unit.cardId) || unconditionalNoEntryText(def)) return false;
  // RK-122 ホースオルフェノク格闘態 ※（自軍パワーゾーンに6枚以上カードが無ければ出られない。rules/rk/rk6Fields.ts）。
  if (def.type === "unit" && rk6BlocksBattleEntry(state, playerId, unit)) return false;
  // RK-153 仮面ライダーガオウ・RK-167 仮面ライダーカイザ の※（rules/rk/rk8UnitEffects.ts）。
  if (def.type === "unit" && rk8BlocksBattleEntry(state, playerId, unit)) return false;
  // RK-177 蜂女【催眠音波】でホールドしなかったユニット（rules/rk/rk9Fields.ts）。
  if (def.type === "unit" && rk9BlocksBattleEntry(state, playerId, unit)) return false;
  if (def.type === "unit" && rk10BlocksBattleEntry(state, playerId, unit)) return false;
  // RK-247 仮面ライダーネガ電王の※（自軍ユニットがホールドされたターンにしか出られない。rules/rk/rk12Fields.ts）。
  if (def.type === "unit" && rk12BlocksBattleEntry(state, playerId, unit)) return false;
  // RM-029 ジャスピオン ※（SP が空欄ではない自軍 S ユニットがあれば出られない。rules/rm/rm2Fields.ts）。
  if (def.type === "unit" && rm2BlocksBattleEntry(state, playerId, unit)) return false;
  // XG6-029【大反転スカイキック】の「このターン、これはバトルエリアに出られない」（rules/xg6/xg6Fields.ts）。
  if (xg6BlocksBattleEntry(state, playerId, unit)) return false;
  // RS-289 / XP-023「※これはダメージを受けた敵軍ターンの次の自軍ターンにしかバトルエリアに出られない」（atwiki/page-416）。
  if (damageGateBlocksEntry(state, playerId, unit.cardId)) return false;

  if (needsAllySInBattle(unit.cardId)) {
    const hasAllyS = state.players[playerId].battle.some((c) =>
      isSmallUnit(state.definitions, c),
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

  if (noEntryOnRushTurn(unit.cardId) && wasRushedThisTurn(player, unit.instanceId)) {
    return false;
  }

  // RS-320【スワンイリュージョン】・RS-324 マジマザー: このターン、ラッシュエリアのユニットはバトルエリアに出られない。
  if (rushAreaEntryBlockedThisTurn(state, playerId)) return false;
  // RS-660【SPインカム】: 新しくラッシュエリアに出たユニットとホールド状態のユニットは出られない（rules/legend1/set9NamedEffectsC.ts）。
  if (set9CBlocksBattleEntry(state, playerId, unit)) return false;
  // RS-356 デンジイエロー【ハンマーパンチ】: このターン、必要パワーの数字が3以下のユニットは出られない。
  if (hammerPunchBlocksEntry(state, playerId, unit)) return false;

  if (zenibombBlocksBattleEntry(player, unit.instanceId)) {
    return false;
  }

  if (trafficControlRequiresSameSize(state, playerId, def.size)) return false;

  if (isBattleBlocked(state.players[playerId], unit.instanceId)) return false;

  if (cannotEnterBattleOwnTurn(state, playerId, unit.cardId)) return false;

  if (noteOtherNcBattleEntryBlock(state, playerId, player, unit)) return false;
  // 第6弾 RS-419 聖剣ズバーン ※ 等（rules/legend1/set6NamedEffectsB.ts）。
  if (set6BBattleEntryBlocked(state, playerId, unit)) return false;
  // RK-140 / RK-334 のロック、RS-288 の「獣奏剣」ホールド要件（rules/errataCardEffects.ts）。
  if (errataBattleEntryBlocked(state, playerId, unit)) return false;
  // RK-059 ゼクトルーパー【フォーメーションα】（rules/rk/rk3UnitEffects.ts）。
  if (rk3BattleEntryBlocked(state, playerId, unit)) return false;

  // RS-242 / RS-416 等「自軍ラッシュエリアのSユニットを1体捨札にしなければ出られない」— 自身は数えない。
  if (
    needsBattleEntryRushDiscard(unit.cardId) &&
    !battleEntryRushDiscardSatisfied(player, unit.cardId) &&
    !hasBattleEntryRushDiscardTarget(player, state.definitions, unit.instanceId)
  ) {
    return false;
  }

  if (
    needsBattleEntryHandDiscard(unit.cardId) &&
    !battleEntryHandDiscardSatisfied(player, unit.cardId) &&
    !canPayBattleEntryHandDiscard(player, unit.cardId)
  ) {
    return false;
  }

  if (
    needsBattleEntryPowerDiscard(unit.cardId) &&
    // XG1-034【汚い大気】で※（パワーゾーンのカードを捨札にしなければ出られない）は無効（atwiki/page-1582 Q5）。
    !filthyAirActive(state) &&
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
    // RK-295 の※（1番目でなければ）・RK-302【ワームの頂点に立つ男】（rules/rk/rk15Fields.ts）。
    if (rk15BlocksAttackStrike(state, playerId, unit, rk12UnitFeatures)) return true;
  }
  if (unit.activatedNcEffects?.includes("optional_battle_no_attack")) return true;
  // RK-231 オロチ【潜水】: ホールド状態のときアタックもストライクもできない（ルール: R-ERR-RK231）。
  if (isDivingOrochi(unit)) return true;
  // ルール: R-HOLD-03 — ホールド中のユニットがアタック・ストライクできるかは [未確定]。
  // 確定するまでレジストでホールド中のユニットは従来どおりアタック・ストライク不可とする。
  if (unit.registerHeld) return true;
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
  if (def.type === "unit" && ryuseioBlocksMove(state, playerId, unit)) return false;
  if (cannotEnterBattle(unit.cardId) || unconditionalNoEntryText(def)) return false;
  // RK-122 ホースオルフェノク格闘態 ※（自軍パワーゾーンに6枚以上カードが無ければ出られない。rules/rk/rk6Fields.ts）。
  if (def.type === "unit" && rk6BlocksBattleEntry(state, playerId, unit)) return false;
  // RK-153 仮面ライダーガオウ・RK-167 仮面ライダーカイザ の※（rules/rk/rk8UnitEffects.ts）。
  if (def.type === "unit" && rk8BlocksBattleEntry(state, playerId, unit)) return false;
  // RK-177 蜂女【催眠音波】でホールドしなかったユニット（rules/rk/rk9Fields.ts）。
  if (def.type === "unit" && rk9BlocksBattleEntry(state, playerId, unit)) return false;
  if (def.type === "unit" && rk10BlocksBattleEntry(state, playerId, unit)) return false;
  if (def.type === "unit" && rk12BlocksBattleEntry(state, playerId, unit)) return false;
  // RM-029 ジャスピオン ※（SP が空欄ではない自軍 S ユニットがあれば出られない。rules/rm/rm2Fields.ts）。
  if (def.type === "unit" && rm2BlocksBattleEntry(state, playerId, unit)) return false;
  // XG6-029【大反転スカイキック】の「このターン、これはバトルエリアに出られない」（rules/xg6/xg6Fields.ts）。
  if (xg6BlocksBattleEntry(state, playerId, unit)) return false;
  if (damageGateBlocksEntry(state, playerId, unit.cardId)) return false;

  if (def.type === "unit" && needsAllySInBattle(unit.cardId)) {
    const hasAllyS = state.players[playerId].battle.some((c) =>
      isSmallUnit(state.definitions, c),
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

  if (noEntryOnRushTurn(unit.cardId) && wasRushedThisTurn(player, unit.instanceId)) {
    return false;
  }

  // RS-320【スワンイリュージョン】・RS-324 マジマザー: このターン、ラッシュエリアのユニットはバトルエリアに出られない。
  if (rushAreaEntryBlockedThisTurn(state, playerId)) return false;
  // RS-660【SPインカム】: 新しくラッシュエリアに出たユニットとホールド状態のユニットは出られない（rules/legend1/set9NamedEffectsC.ts）。
  if (set9CBlocksBattleEntry(state, playerId, unit)) return false;
  // RS-356 デンジイエロー【ハンマーパンチ】: このターン、必要パワーの数字が3以下のユニットは出られない。
  if (hammerPunchBlocksEntry(state, playerId, unit)) return false;

  if (zenibombBlocksBattleEntry(player, unit.instanceId)) {
    return false;
  }

  if (trafficControlRequiresSameSize(state, playerId, def.size)) return false;

  if (isBattleBlocked(state.players[playerId], unit.instanceId)) return false;

  if (cannotEnterBattleOwnTurn(state, playerId, unit.cardId)) return false;

  // canMoveUnitToBattle と同じ、ホールドでは解けない進入禁止（RK-140 / RK-334 のロック、RS-419 等）。
  // ここで弾かないと battle_entry 支払いが開けるのに、支払い後の move_to_battle が illegal_action になる。
  if (noteOtherNcBattleEntryBlock(state, playerId, player, unit)) return false;
  if (set6BBattleEntryBlocked(state, playerId, unit)) return false;
  if (errataBattleEntryBlocked(state, playerId, unit)) return false;
  // RK-059 ゼクトルーパー【フォーメーションα】（rules/rk/rk3UnitEffects.ts）。
  if (rk3BattleEntryBlocked(state, playerId, unit)) return false;

  if (needsBattleEntryRushDiscard(unit.cardId)) {
    if (!canPayBattleEntryRushDiscard(player, state.definitions, unit.cardId)) return false;
    if (!battleEntryRushDiscardSatisfied(player, unit.cardId)) {
      if (!hasBattleEntryRushDiscardTarget(player, state.definitions, unit.instanceId)) {
        return false;
      }
    }
  }

  if (!canPayBattleEntryHandDiscard(player, unit.cardId)) return false;

  if (
    needsBattleEntryPowerDiscard(unit.cardId) &&
    // XG1-034【汚い大気】で※（パワーゾーンのカードを捨札にしなければ出られない）は無効（atwiki/page-1582 Q5）。
    !filthyAirActive(state) &&
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
 * 効果でバトルエリアに出すとき、「ホールドしなければ出られない」制限の分だけ
 * リリース状態のコマンドをホールドする（左から自動選択）。ホールドできなければ null。
 * ルール: R-ADD-07 — 効果で出す場合も1体ごとに制限を満たす（RS-009 Q3、RS-097 Q2・Q6）。
 * プレイヤー操作の進入は initiate_command_payment（battle_entry）を使う。
 */
export function autoHoldForBattleEntry(
  state: GameState,
  playerId: PlayerId,
  unit: CardInstance,
  options: { freshHold?: boolean } = {},
): PlayerState | null {
  let player = state.players[playerId];

  // ルール: R-BA-04 — 「手札を2枚捨てなければ出られない」（狼鬼）も、効果で出すときに満たせるなら満たして出る
  // （RS-108 Q2）。捨てるカードは手札の先頭から選ぶ。
  if (
    needsBattleEntryHandDiscard(unit.cardId) &&
    !battleEntryHandDiscardSatisfied(player, unit.cardId)
  ) {
    const count = getBattleEntryHandDiscardCount(unit.cardId);
    if (player.hand.length < count) return null;
    const discarded = player.hand.slice(0, count);
    player = satisfyCostWindowBridge(
      {
        ...player,
        hand: player.hand.slice(count),
        discard: [...player.discard, ...discarded],
      },
      "battle_entry_hand_discard",
    );
  }

  const required = requiredBattleEntryHolds(
    { ...state, players: { ...state.players, [playerId]: player } },
    playerId,
    unit,
  );
  if (required <= 0) return player;
  if (countReleasedCommands(player) < required) return null;

  let remaining = required;
  const command = player.command.map((c) => {
    if (remaining > 0 && !c.commandHeld) {
      remaining -= 1;
      return { ...c, commandHeld: true, mothershipHold: false };
    }
    return c;
  });
  return satisfyCostWindowBridge({ ...player, command }, "battle_entry_hold");
}

/** 効果でバトルエリアに出し終えたら、出るための支払い済み記録を消す。 */
export function clearEffectBattleEntryWindows(player: PlayerState): PlayerState {
  return clearCostWindowBridge(
    clearCostWindowBridge(player, "battle_entry_hold"),
    "battle_entry_hand_discard",
  );
}

/**
 * バトルエリアに出すために必要なホールドを満たせるか（リリース状態のコマンドが足りるか）。
 * ルール: R-BA-04 — 「可能なら出る」はホールドが必要なユニットも、ホールドできれば出る。
 */
export function canMoveUnitToBattleWithHolds(
  state: GameState,
  playerId: PlayerId,
  unit: CardInstance,
): boolean {
  if (canMoveUnitToBattle(state, playerId, unit, "rush")) return true;
  if (!canMoveUnitToBattleExceptHoldRequirements(state, playerId, unit, "rush")) return false;
  const prepared = autoHoldForBattleEntry(state, playerId, unit);
  if (!prepared) return false;
  return canMoveUnitToBattle(
    { ...state, players: { ...state.players, [playerId]: prepared } },
    playerId,
    unit,
    "rush",
  );
}

/**
 * 効果で（ラッシュエリアから）バトルエリアに出されるユニットが、持ち主が条件を満たした上で出られるか。
 * ルール: R-KW-WRECKER-01 — 「出られない」ユニットは出せず、「～しなければ出られない」は持ち主が満たせるときだけ出せる。
 */
export function canBeDeployedToBattleByEffect(
  state: GameState,
  ownerId: PlayerId,
  unit: CardInstance,
): boolean {
  const prepared = autoHoldForBattleEntry(state, ownerId, unit);
  if (!prepared) return false;
  const withPrepared: GameState = { ...state, players: { ...state.players, [ownerId]: prepared } };
  return canMoveUnitToBattle(withPrepared, ownerId, unit, "rush");
}

function passesBattleEntryHoldRequirements(
  state: GameState,
  playerId: PlayerId,
  player: PlayerState,
  unit: CardInstance,
): boolean {
  const requiredTotal = requiredBattleEntryHolds(state, playerId, unit);

  // RS-301 / RS-302 ※: リリース状態の「Vコマンダー」をホールドして出る（既にホールド状態のものでは満たせない。R-ADD-07）。
  if (needsVCommanderHold(state, playerId, unit)) {
    if (!releasedVCommanderCommand(player, state.definitions)) return false;
  }

  // ルール: R-ADD-07 — 「コマンドをホールドしなければ出られない」制限は、出る直前に制限ごとに
  // リリース状態のコマンドを新たにホールドして満たす（既にホールド済みのコマンドでは満たせない）。
  // ホールドは battle_entry 支払い（または効果進入の autoHoldForBattleEntry）で行い、
  // 済んだことを battle_entry_hold コスト窓で表す。
  if (requiredTotal > 0) {
    return isCostWindowSatisfied(player, "battle_entry_hold");
  }
  return true;
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

function releasedVCommanderCommand(
  player: PlayerState,
  definitions: GameState["definitions"],
): CardInstance | undefined {
  return player.command.find(
    (c) => !c.commandHeld && getDefinition(definitions, c.cardId)?.name === "Vコマンダー",
  );
}

/**
 * RS-301 / RS-302「※これは、特徴「Vコマンダー」を持つ自軍ユニットがないとき、自軍コマンドゾーンの
 * 「Vコマンダー」をホールドしなければバトルエリアに出られない」— 出たときにリリース状態の「Vコマンダー」を
 * ホールドする（atwiki/page-444, page-445）。
 */
export function applyVCommanderHoldOnEnter(
  state: GameState,
  playerId: PlayerId,
  entering: CardInstance,
): GameState {
  if (!needsVCommanderHold(state, playerId, entering)) return state;
  const player = state.players[playerId];
  const vc = releasedVCommanderCommand(player, state.definitions);
  if (!vc) return state;
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        command: player.command.map((c) =>
          c.instanceId === vc.instanceId ? { ...c, commandHeld: true, mothershipHold: false } : c,
        ),
      },
    },
  };
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
  if (!filthyAirActive(state) && !canPayBattleEntryPowerDiscard(player, unit.cardId)) {
    const need = getBattleEntryPowerDiscardCount(unit.cardId);
    const have = player.power.filter((c) => !c.faceDown).length;
    return `「${unitName}」をバトルエリアに出すには、パワーからダメージ以外を${need}枚捨札する必要があります（対象${have}枚）。`;
  }
  if (!filthyAirActive(state) && !battleEntryPowerDiscardSatisfied(player, unit.cardId)) {
    return `「${unitName}」をバトルエリアに出すには、パワーからダメージ以外を選んで捨札してください。`;
  }

  if (noEntryOnRushTurn(unit.cardId) && wasRushedThisTurn(player, unit.instanceId)) {
    return `「${unitName}」はラッシュしたターンはバトルエリアに出せません。`;
  }

  if (rushAreaEntryBlockedThisTurn(state, playerId)) {
    return `このターン、ラッシュエリアのユニットはバトルエリアに出せません。`;
  }

  if (hammerPunchBlocksEntry(state, playerId, unit)) {
    return `相手の【ハンマーパンチ】の効果で、このターン、必要パワーの数字が3以下のユニットはバトルエリアに出せません。`;
  }

  if (zenibombBlocksBattleEntry(player, unit.instanceId)) {
    return "相手の【ゼニボム】の効果で、このターン新しくラッシュエリアに出たユニットはバトルエリアに出せません。";
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

  if (isBattleBlocked(player, unit.instanceId)) {
    return "【バトルダンス】でラッシュエリアに戻したユニットは、このターンはバトルエリアに出せません。";
  }

  const unitHolds = unitBattleEntryHoldCount(state, playerId, unit.cardId);
  const lgCount = isMediumUnit(state.definitions, unit) ? countActiveLightningGravity(state) : 0;
  const lionCount = karakuriLionChainHoldCount(state, playerId, unit);
  const requiredTotal = requiredBattleEntryHolds(state, playerId, unit);
  const released = countReleasedCommands(player);
  if (requiredTotal > 0 && !isCostWindowSatisfied(player, "battle_entry_hold")) {
    const parts: string[] = [];
    if (unitHolds > 0) {
      parts.push(`「${unitName}」の能力によりコマンドを${unitHolds}枚ホールド`);
    }
    if (lgCount > 0) {
      parts.push(`【稲妻重力エネルギー】の効果によりコマンドを${lgCount}枚ホールド`);
    }
    if (lionCount > 0) {
      parts.push(`【カラクリ忍法・連獅子】の効果によりコマンドを${lionCount}枚ホールド`);
    }
    const requirement = parts.length > 0 ? parts.join("、") : "コマンドをホールド";
    if (released < requiredTotal) {
      return `${requirement}する必要があります（リリース状態のコマンド${released}枚 / 必要${requiredTotal}枚。ホールド済みのコマンド（母艦のホールドを含む）では満たせません）。`;
    }
    return `${requirement}してください（バトルエリアに出る直前に新たにホールドします）。`;
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
  // RS-198 帝王アトン【帝王剣の呪い】: これが自軍エリアにある間、すべての敵軍 S ユニットは、毎ターン、
  // 可能ならバトルエリアに出る（atwiki/page-382）。
  const enemy = state.players[opponent(playerId)];
  const emperorCurse = [...enemy.rush, ...enemy.battle].some((c) => c.cardId === "RS-198");

  for (const card of player.rush) {
    if (wingTurnBlocksStrike(player, card.instanceId)) continue;
    // ルール: R-BA-04 — ホールドが必要なユニットも、ホールドできるなら「可能なら出る」に含む。
    if (!canMoveUnitToBattleWithHolds(state, playerId, card)) continue;
    if (
      // RS-595【頼もしい背中】: 「炎神」の自軍ユニット自身の「可能ならバトルエリアに出る」は無効（rules/legend1/set8NamedEffectsD.ts）。
      (hasAutoBattleEntryEachTurnNote(card.cardId) && !ownAutoBattleEntryNegated(state, playerId, card)) ||
      earthForceRequiresBattleEntry(state) ||
      (emperorCurse && isSmallUnit(state.definitions, card)) ||
      highwayPlanRequiresBattleEntry(state, card.cardId) ||
      // RS-557 ビンボーガミ【札束の誘惑】（rules/legend1/set8NamedEffectsB.ts）。
      set8BRequiresBattleEntry(state, playerId, card) ||
      // RK-247 仮面ライダーネガ電王【不敵な挑発】（特徴「警察」を持つユニット。rules/rk/rk12Fields.ts）。
      rk12RequiresBattleEntry(state, rk12UnitFeatures(state, playerId, card)) ||
      // RK-308 リュウタロス（2nd）の※（敵軍バトルエリアにユニットがあれば。rules/rk/rk15Fields.ts）。
      rk15RequiresBattleEntry(state, playerId, card) ||
      // XG5-059 仮面ライダーカリス【暴走する本能】（手札が1枚以下のとき。rules/xg5/xg5Fields.ts）。
      xg5RequiresBattleEntry(state, playerId, card)
    ) {
      mandatory.push(card);
    }
  }

  return mandatory;
}

/**
 * RS-216 暴走皇帝エグゾス【大宇宙ハイウェイ計画】: これが自軍エリアにある間、特徴「車両」を持つすべてのユニットは、
 * 毎ターン、可能ならバトルエリアに出る（敵軍の車両ユニットも対象）。
 */
function highwayPlanRequiresBattleEntry(state: GameState, cardId: string): boolean {
  const def = getDefinition(state.definitions, cardId);
  if (def?.type !== "unit" || !(def.features ?? []).includes("車両")) return false;
  return (["player1", "player2"] as const).some((pid) => {
    const p = state.players[pid];
    return [...p.rush, ...p.battle].some((c) => c.cardId === "RS-216");
  });
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
