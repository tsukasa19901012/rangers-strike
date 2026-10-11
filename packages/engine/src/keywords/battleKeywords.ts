import type { Category } from "@rangers-strike/cards";
import { set9ATaxisCategory } from "../rules/legend1/set9NamedEffectsA";
import { cardCategories } from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import { sameCanonicalCardName, textHasKeywordNotation } from "@rangers-strike/cards";
import type { KeywordNotationLabel } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { cardHasKeyword } from "./cardKeywords";
import { getDefinition, isLargeUnit, isSmallUnit } from "../core/catalog";
import { loseDamageThreshold } from "../core/createGame";
import {
  addTurnRestrictionModifier,
  clearTurnRestrictionModifiersForInstance,
} from "../core/scopedModifiers";
import { cardHasGrantKeyword, listCardGrantKeywords, stackedEquipmentGrantsWing } from "../dsl/promotedKeywordBridge";
import { battlePositionOneBased } from "../rules/fractionalSp";
import { srBigBatonTaxisCategory } from "../rules/srEffects";
import { isBattleBlocked, markBattleBlocked } from "../rules/turnModifiers";
import { RESTRICTION_IDS } from "../types/scopedModifiers";
import { findInZone, updatePlayer } from "../core/helpers";
import { riddenVehicleGrantsScrum } from "../rules/legend1/set7NamedEffectsB";
import { unitFeatures } from "../rules/addedFeatures";
import { featuresMatchKeywordSlug } from "../dsl/featureKeywords";

const TAXIS_POSITION: Record<Category, number> = {
  WB: 1,
  MA: 2,
  OT: 3,
  ET: 4,
  DA: 5,
};

export function crossValueForCard(cardId: string): number {
  let total = 0;
  for (const keyword of listCardGrantKeywords(cardId)) {
    const match = keyword.match(/^cross(\d+)$/);
    if (match) total += Number(match[1]);
  }
  return total;
}

export function cardHasBattleKeyword(
  definitions: Record<string, CardDefinition>,
  cardId: string,
  keyword: "cross1" | "blast" | "breaker" | "scrum" | "taxis",
  context?: { state: GameState; playerId: PlayerId },
): boolean {
  if (keyword === "cross1") {
    return crossValueForCard(cardId) > 0 || cardHasGrantKeyword(cardId, "cross1");
  }
  if (cardHasGrantKeyword(cardId, keyword)) return true;
  // ルール: R-KW-00 — 本文の「※キーワード」表記だけを見る（【モスブレイカー】等の効果名は除外）。
  const labels: Record<"blast" | "breaker" | "scrum" | "taxis", KeywordNotationLabel> = {
    blast: "ブラスト",
    breaker: "ブレイカー",
    scrum: "スクラム",
    taxis: "タクス",
  };
  return textHasKeywordNotation(definitions[cardId]?.text, labels[keyword]);
}

/** 左側ユニットのクロス合計。ルール: R-KW-CROSS-01, R-KW-CROSS-02 */
export function crossShiftLeftOf(
  battle: CardInstance[],
  index: number,
): number {
  let shift = 0;
  for (let i = 0; i < index; i += 1) {
    shift += crossValueForCard(battle[i]!.cardId);
  }
  return shift;
}

/** バトルエリアのユニットに左側のクロスが与える減少量 X（バトルエリアにいなければ 0）。 */
export function crossReductionFor(
  battle: CardInstance[],
  instanceId: string,
): number {
  const index = battle.findIndex((c) => c.instanceId === instanceId);
  if (index < 0) return 0;
  return crossShiftLeftOf(battle, index);
}

/**
 * クロス: ナンバーの数字と分数 SP の分母を X 少なくする。ただし 2 より少なくならない
 * （元が 2 未満なら変えない）。並び順は変わらない。ルール: R-KW-CROSS-01
 */
export function crossReducedNumber(value: number, reduction: number): number {
  if (reduction <= 0 || value < 2) return value;
  return Math.max(2, value - reduction);
}

export function parseTaxisCategory(cardId: string): Category | null {
  for (const keyword of listCardGrantKeywords(cardId)) {
    const match = keyword.match(/^taxis_(MA|ET|OT|WB|DA)$/);
    if (match) return match[1] as Category;
  }
  return null;
}

/** タクス: 隣接左ユニットが指定位置にいれば SP1（クロス非影響の絶対位置）。 */
export function taxisSpFloor(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  const player = state.players[playerId];
  const index = player.battle.findIndex((c) => c.instanceId === instance.instanceId);
  if (index <= 0) return 0;

  const left = player.battle[index - 1]!;
  const taxisCategory =
    parseTaxisCategory(left.cardId) ??
    srBigBatonTaxisCategory(state, playerId, left.cardId) ??
    // RS-610 秘伝ディスク: 特徴「侍」を持つユニットはタクスMA を得る（rules/legend1/set9NamedEffectsA.ts）。
    set9ATaxisCategory(state, playerId, left);
  if (!taxisCategory) return 0;

  const holderPosition = index;
  if (holderPosition !== TAXIS_POSITION[taxisCategory]) return 0;

  const def = getDefinition(state.definitions, instance.cardId);
  if (!def || def.type !== "unit") return 0;
  // ルール: R-KW-TAKUS-01 — 対象は指定カテゴリを持つ「S ユニット」だけ。
  if (!isSmallUnit(state.definitions, instance.cardId)) return 0;
  if (!cardCategories(def).includes(taxisCategory)) return 0;
  return 1;
}

const FEATURE_POSITION_SP_RE = /^battle_position_sp_(.+)_pos2_sp1$/;

/** battle_position_sp_<特徴 slug>_pos2_sp1（any 以外）: 特徴を持つ S ユニットがバトルエリアの2番目なら SP1。 */
function featurePositionSpFloor(state: GameState, playerId: PlayerId, instance: CardInstance): number {
  const index = state.players[playerId].battle.findIndex((c) => c.instanceId === instance.instanceId);
  if (index !== 1) return 0;
  const def = getDefinition(state.definitions, instance.cardId);
  if (!def || def.type !== "unit" || def.size !== "S") return 0;
  const features = unitFeatures(state, playerId, instance);
  for (const source of [...state.players.player1.rush, ...state.players.player2.rush]) {
    for (const keyword of listCardGrantKeywords(source.cardId)) {
      const m = keyword.match(FEATURE_POSITION_SP_RE);
      if (!m || m[1] === "any") continue;
      if (featuresMatchKeywordSlug(features, m[1]!)) return 1;
    }
  }
  return 0;
}

/**
 * RS-430（ラッシュエリアにある間）: 追加条件を持たない WB の S ユニットは
 * バトルエリアで2番目に並んだとき SP1 になる。
 */
export function fieldPositionSpFloor(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  const player = state.players[playerId];
  // RS-501 エレハン・キンポー【遊びの中に修行あり】: 「これが自軍ラッシュエリアにある間、特徴「イエロー」を持つすべての
  // Sユニットは次の能力を得る⇒バトルエリアで2番目に並んだとき「SP1」になる。」（atwiki/page-742）— 特徴で絞る
  // battle_position_sp_<特徴>_pos2_sp1。自軍・敵軍の限定はない。
  if (featurePositionSpFloor(state, playerId, instance) > 0) return 1;
  // 自軍と敵軍のラッシュエリアのロボタフが対象（faq-card-6 RS-430 Q3）。
  const hasSource = [...state.players.player1.rush, ...state.players.player2.rush].some((c) =>
    cardHasGrantKeyword(c.cardId, "battle_position_sp_any_pos2_sp1"),
  );
  if (!hasSource) return 0;

  const index = player.battle.findIndex((c) => c.instanceId === instance.instanceId);
  if (index < 0) return 0;
  if (index + 1 !== 2) return 0;

  const def = getDefinition(state.definitions, instance.cardId);
  if (!def || def.type !== "unit" || def.size !== "S") return 0;
  if (!cardCategories(def).includes("WB")) return 0;
  if (def.rushAdditionalCondition) return 0;
  return 1;
}

function numericComboNumber(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): number | null {
  const def = getDefinition(definitions, cardId);
  return typeof def?.comboNumber === "number" ? def.comboNumber : null;
}

/** スクラム: 右隣ユニットの CN が「自 CN + 1」の間、アタック不可。 */
export function scrumBlocksAttack(
  state: GameState,
  defenderPlayerId: PlayerId,
  defenderInstanceId: string,
): boolean {
  const player = state.players[defenderPlayerId];
  const defenderIndex = player.battle.findIndex((c) => c.instanceId === defenderInstanceId);
  if (defenderIndex < 0) return false;

  const defender = player.battle[defenderIndex]!;
  if (
    !cardHasBattleKeyword(state.definitions, defender.cardId, "scrum") &&
    // RS-467 ギンガルコン【風の星獣】: ライドしたユニットがある間、WB の自軍 S ユニットはスクラムを得る（rules/legend1/set7NamedEffectsB.ts）。
    !riddenVehicleGrantsScrum(state, defenderPlayerId, defender)
  ) {
    return false;
  }

  const defenderCn = numericComboNumber(state.definitions, defender.cardId);
  if (defenderCn === null) return false;

  const right = player.battle[defenderIndex + 1];
  if (!right) return false;

  const rightCn = numericComboNumber(state.definitions, right.cardId);
  if (rightCn === null) return false;

  return rightCn === defenderCn + 1;
}

/**
 * ブレイカー: 自軍エリアにある間、ブレイカーを持たない敵軍ユニット／敵軍ビークルの効果に選ばれない。
 * オペレーションの効果では選べる（防ぐのはユニット／ビークルの効果だけ）。
 * 発生源が不明な呼び出しは従来どおり敵軍ユニットの効果として扱う。
 * ルール: R-KW-BREAKER-01, R-KW-BREAKER-03
 */
export function breakerBlocksEffectTarget(
  definitions: Record<string, CardDefinition>,
  targetCardId: string,
  sourceCardId?: string,
): boolean {
  if (!cardHasBattleKeyword(definitions, targetCardId, "breaker")) return false;
  if (!sourceCardId) return true;
  const sourceType = getDefinition(definitions, sourceCardId)?.type;
  if (sourceType && sourceType !== "unit" && sourceType !== "vehicle") return false;
  if (cardHasBattleKeyword(definitions, sourceCardId, "breaker")) return false;
  return true;
}

export function cardHasNotSelectableExceptAttack(cardId: string): boolean {
  return cardHasGrantKeyword(cardId, "not_selectable_except_attack");
}

/**
 * ブレイカー同名制限: 本来のカード名が同名の自軍ユニット／ビークルが場にあれば、ブレイカー持ちはラッシュできない。
 * 場の同名カードがブレイカーを持つかどうかは問わない。逆にブレイカーを持たないカードは制限されない。
 * ルール: R-KW-BREAKER-01, R-KW-BREAKER-02
 */
export function breakerBlocksSameNameRush(
  player: { rush: CardInstance[]; battle: CardInstance[] },
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
): boolean {
  if (!cardHasBattleKeyword(definitions, rushingCardId, "breaker")) return false;
  const rushingName = getDefinition(definitions, rushingCardId)?.name;
  if (!rushingName) return false;

  for (const zone of ["rush", "battle"] as const) {
    for (const card of player[zone]) {
      const def = getDefinition(definitions, card.cardId);
      if (!def?.name || !sameCanonicalCardName(def.name, rushingName)) continue;
      if (def.type === "unit" || def.type === "vehicle") return true;
    }
  }
  return false;
}

/**
 * ブラスト: 負けるまで残りダメージ1点で、自軍 L ユニットが1体もなければ追加条件を満たさなくてよい。
 * ルール: R-KW-BLAST-01（敗北の閾値は命の泉等で変わる: R-KW-BLAST-02）
 */
export function blastBypassesRushAdditionalCondition(
  state: Pick<GameState, "players" | "definitions">,
  playerId: PlayerId,
  rushingCardId: string,
): boolean {
  if (!cardHasBattleKeyword(state.definitions, rushingCardId, "blast")) return false;
  const player = state.players[playerId];
  const remaining = loseDamageThreshold(state, playerId) - player.damage;
  // ルール: R-KW-BLAST-02 — XG2-034 ブラストバギーが（どちらかの）エリアにある間は残り1点または2点。
  const maxRemaining = blastRuleChangedByBuggy(state) ? 2 : 1;
  if (remaining < 1 || remaining > maxRemaining) return false;
  return !playerHasAllyLargeUnit(state, playerId);
}

/** XG2-034 ブラストバギー（【奇襲】）がいずれかのプレイヤーのエリアにあるか。変更後のルールは敵軍にも適用される。 */
function blastRuleChangedByBuggy(state: Pick<GameState, "players" | "definitions">): boolean {
  return (["player1", "player2"] as const).some((pid) =>
    [...state.players[pid].rush, ...state.players[pid].battle].some((c) => c.cardId === "XG2-034"),
  );
}

export function playerHasAllyLargeUnit(
  state: Pick<GameState, "players" | "definitions">,
  playerId: PlayerId,
): boolean {
  const player = state.players[playerId];
  for (const zone of ["rush", "battle"] as const) {
    if (player[zone].some((c) => isLargeUnit(state.definitions, c.cardId))) {
      return true;
    }
  }
  return false;
}

export function cardHasMorphKeyword(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): boolean {
  return cardHasKeyword(definitions, cardId, "morph");
}

export function powerZoneHasMorphUnitCard(
  state: GameState,
  playerId: PlayerId,
): boolean {
  return state.players[playerId].power.some((card) => {
    if (card.faceDown) return false;
    const def = getDefinition(state.definitions, card.cardId);
    return def?.type === "unit" && cardHasMorphKeyword(state.definitions, card.cardId);
  });
}

export function isBloodVesselStrikeActive(
  state: GameState,
  strikerOwnerId: PlayerId,
): boolean {
  const player = state.players[strikerOwnerId];
  for (const zone of ["rush", "battle"] as const) {
    for (const card of player[zone]) {
      if (cardHasGrantKeyword(card.cardId, "blood_vessel_on_strike")) {
        return true;
      }
    }
  }
  return false;
}

export function canWingAttackFromRush(
  state: GameState,
  playerId: PlayerId,
  unit: CardInstance,
): boolean {
  if (state.phase !== "battle") return false;
  if (
    !cardHasKeyword(state.definitions, unit.cardId, "wing", { state, playerId }) &&
    !stackedEquipmentGrantsWing(unit)
  ) {
    return false;
  }
  if (unit.battleActed) return false;
  if (!unit.commandHeld) return false;
  // ルール: R-HOLD-03 — レジストのホールドはウイングのホールドの代わりにならない。
  if (unit.registerHeld) return false;
  const inRush = state.players[playerId].rush.some((c) => c.instanceId === unit.instanceId);
  return inRush;
}

export function canHoldForWing(
  state: GameState,
  playerId: PlayerId,
  unit: CardInstance,
): boolean {
  if (state.phase !== "battle") return false;
  if (
    !cardHasKeyword(state.definitions, unit.cardId, "wing", { state, playerId }) &&
    !stackedEquipmentGrantsWing(unit)
  ) {
    return false;
  }
  // ルール: R-KW-WING-02 — バトルエリアに出られない制限を受けていても発動できる。
  // ルール: R-KW-WING-03 — ウイングでアタックした後もリリースされれば同じターンに再び発動できる
  // （発動できるかはリリース状態かどうかだけで決まる）。
  if (unit.commandHeld) return false;
  return state.players[playerId].rush.some((c) => c.instanceId === unit.instanceId);
}

export function applyHoldForWing(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState | null {
  const player = state.players[playerId];
  const found = findInZone(player, "rush", instanceId);
  if (!found || !canHoldForWing(state, playerId, found.card)) return null;

  const rush = player.rush.map((c) => {
    if (c.instanceId !== instanceId) return c;
    // 新たなウイングの発動ごとにアタックの権利を得る（R-KW-WING-03）。
    const held = { ...c, commandHeld: true };
    delete held.battleActed;
    return held;
  });
  let nextPlayer = markBattleBlocked({ ...player, rush }, instanceId);
  if (nextPlayer.unitActionsThisTurn?.[instanceId]) {
    const actions = { ...nextPlayer.unitActionsThisTurn };
    delete actions[instanceId];
    nextPlayer = { ...nextPlayer, unitActionsThisTurn: actions };
  }
  nextPlayer = addTurnRestrictionModifier(
    nextPlayer,
    instanceId,
    RESTRICTION_IDS.WING_TURN_NO_STRIKE,
  );

  return { ...state, ...updatePlayer(state, playerId, nextPlayer) };
}

/** アタック前のウイングホールドを取り消し（リリース相当）。 */
export function canCancelWingHold(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): boolean {
  if (state.phase !== "battle") return false;
  const player = state.players[playerId];
  const found = findInZone(player, "rush", instanceId);
  if (!found) return false;
  if (!found.card.commandHeld || found.card.battleActed) return false;
  if (!wingTurnBlocksStrike(player, instanceId)) return false;
  return (
    cardHasKeyword(state.definitions, found.card.cardId, "wing", {
      state,
      playerId,
    }) || stackedEquipmentGrantsWing(found.card)
  );
}

export function applyCancelWingHold(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState | null {
  if (!canCancelWingHold(state, playerId, instanceId)) return null;
  const player = state.players[playerId];
  return {
    ...state,
    ...updatePlayer(state, playerId, resetWingUnitForReuse(player, instanceId)),
  };
}

export function wingTurnBlocksStrike(player: PlayerState, instanceId: string): boolean {
  return (
    player.modifiers?.some(
      (m) =>
        m.kind === "restriction" &&
        m.instanceId === instanceId &&
        m.restriction === RESTRICTION_IDS.WING_TURN_NO_STRIKE &&
        m.scope === "turn",
    ) ?? false
  );
}

export function rideOffBlocksStrike(player: PlayerState, instanceId: string): boolean {
  return (
    player.modifiers?.some(
      (m) =>
        m.kind === "restriction" &&
        m.instanceId === instanceId &&
        m.restriction === RESTRICTION_IDS.NO_STRIKE_AFTER_RIDEOFF &&
        m.scope === "turn",
    ) ?? false
  );
}

export function applyNoStrikeAfterRideOff(
  player: PlayerState,
  instanceId: string,
): PlayerState {
  return addTurnRestrictionModifier(
    player,
    instanceId,
    RESTRICTION_IDS.NO_STRIKE_AFTER_RIDEOFF,
  );
}

/** BF 中に battle→rush したユニット — ウイング再使用のため battleActed を消す。 */
export function prepareWingUnitReturnedToRush(card: CardInstance): CardInstance {
  if (!card.battleActed) return card;
  const next = { ...card };
  delete next.battleActed;
  return next;
}

/** ホールド解除後に同一 BF 内でウイングを再発動できるよう制限を消す。 */
export function resetWingUnitForReuse(
  player: PlayerState,
  instanceId: string,
): PlayerState {
  let next = clearTurnRestrictionModifiersForInstance(player, instanceId, [
    RESTRICTION_IDS.WING_TURN_NO_STRIKE,
    RESTRICTION_IDS.CANNOT_ENTER_BATTLE,
  ]);
  next = {
    ...next,
    rush: next.rush.map((c) =>
      c.instanceId === instanceId
        ? prepareWingUnitReturnedToRush({ ...c, commandHeld: false })
        : c,
    ),
  };
  return next;
}

export function battlePositionForInstance(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): number | null {
  return battlePositionOneBased(state.players[playerId].battle, instanceId);
}
