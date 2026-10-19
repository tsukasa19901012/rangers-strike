/**
 * クロスギャザー ザ・Wインパクト（XG3）の継続効果の判定（低いレベルの関数だけ。選択や処理の続きは rules/xg3/xg3*Effects.ts）。
 * ほかのモジュールから呼ばれるので、重いモジュールを import しない。
 *
 * - `isXg3StackedUnderUnitCard`: XG3-004 芋長の芋ヨーカン・XG3-010 ジークジェンヌ（ユニットの下に重ね、ユニットでなくなるとき捨札。rules/rk/rk1Features.ts）。
 * - `xg3FieldBpBonus`: BP の増減（rules/fieldAuras.ts）。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../../types/game";
import { cardHasKeyword } from "../../keywords/cardKeywords";
import { cardCategories, getDefinition } from "../../core/catalog";
import { opponent } from "../../core/helpers";

export const IMOYOKAN_CARD_ID = "XG3-004";
export const ZIEG_JENNE_CARD_ID = "XG3-010";
export const MAX_LINER_CARD_ID = "XG3-007";
export const JUMA_HUNTER_CARD_ID = "XG3-011";

type View = Pick<GameState, "players" | "definitions" | "activePlayer">;

/** ユニットの下に重ね、重ねたユニットがユニットでなくなるとき捨札になるカード。 */
export function isXg3StackedUnderUnitCard(cardId: string): boolean {
  return isSameCardIdentity(cardId, IMOYOKAN_CARD_ID) || isSameCardIdentity(cardId, ZIEG_JENNE_CARD_ID);
}

function stackedCount(instance: Pick<CardInstance, "stackedCards">, cardId: string): number {
  return (instance.stackedCards ?? []).filter((c) => isSameCardIdentity(c.cardId, cardId)).length;
}

/**
 * BP の増減（role は rules/fieldAuras.ts の呼び分け。general は常に、attacking / defending はバトルのときだけ）。
 * - XG3-004「このカードに重ねたユニットは、BP+3000され」（重ねた枚数分）。
 * - XG3-007【マックスシャトル】ホールド状態の間 BP-2000（公式Q&A atwiki/page-1889 Q1）。
 * - XG3-011【ジークブラスター】本来の特徴に「獣」を持つ敵軍ユニットがあれば BP+2000。
 */
export function xg3FieldBpBonus(state: View, playerId: PlayerId, instance: CardInstance, role: "general" | "attacking" | "defending"): number {
  let bonus = 0;
  if (role === "general") {
    bonus += 3000 * stackedCount(instance, IMOYOKAN_CARD_ID);
    if (instance.commandHeld && isSameCardIdentity(instance.cardId, MAX_LINER_CARD_ID)) bonus -= 2000;
    if (isSameCardIdentity(instance.cardId, JUMA_HUNTER_CARD_ID) && enemyUnitPrinted(state, playerId, (d) => (d.features ?? []).includes("獣"))) bonus += 2000;
  }
  void state;
  void playerId;
  return bonus;
}

/**
 * アタックされない（rules/legend3/restrictions.ts canAttackDefender）。
 * - XG3-007【マックスシャトル】ホールド状態の間「これはウイングを持たないユニットにアタックされない」。
 */
export function xg3DefenderBlocksAttack(
  state: GameState,
  attackerPlayerId: PlayerId,
  attacker: CardInstance,
  defenderPlayerId: PlayerId,
  defender: CardInstance,
): boolean {
  void defenderPlayerId;
  if (defender.commandHeld && isSameCardIdentity(defender.cardId, MAX_LINER_CARD_ID)) {
    if (!cardHasKeyword(state.definitions, attacker.cardId, "wing", { state, playerId: attackerPlayerId })) return true;
  }
  return false;
}

type Def = NonNullable<ReturnType<typeof getDefinition>>;

/** 敵軍エリア（バトル・ラッシュ）に、印刷（本来）の値が pred を満たすユニットがあるか。 */
function enemyUnitPrinted(state: View, playerId: PlayerId, pred: (d: Def) => boolean): boolean {
  const enemy = state.players[opponent(playerId)];
  return [...enemy.battle, ...enemy.rush].some((c) => {
    const d = getDefinition(state.definitions, c.cardId);
    return d?.type === "unit" && pred(d);
  });
}

/**
 * SP（rules/legend3/fieldEffects.ts legend3EffectiveSp）。
 * - XG3-011【ジークブラスター】本来のカテゴリに DA を持つ敵軍ユニットがあれば「SP1」。
 */
export function xg3EffectiveSp(state: View, playerId: PlayerId, instance: CardInstance, sp: number): number {
  if (isSameCardIdentity(instance.cardId, JUMA_HUNTER_CARD_ID) && enemyUnitPrinted(state, playerId, (d) => (cardCategories(d) as string[]).includes("DA"))) {
    return Math.max(sp, 1);
  }
  return sp;
}
