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
import { cardCategories, getDefinition, isVehicle, unitSizeOf } from "../../core/catalog";
import { opponent } from "../../core/helpers";

export const IMOYOKAN_CARD_ID = "XG3-004";
export const ZIEG_JENNE_CARD_ID = "XG3-010";
export const MAX_LINER_CARD_ID = "XG3-007";
export const JUMA_HUNTER_CARD_ID = "XG3-011";

type View = Pick<GameState, "players" | "definitions" | "activePlayer"> & Partial<Pick<GameState, "xg3" | "turn">>;

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
    bonus += abareMaxBonus(state, playerId, instance);
    for (const b of turnBuffsOf(state, instance.instanceId)) bonus += b.bp ?? 0;
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
  if (xg3NoAttackTextDisabled(state, defender.instanceId)) return false;
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
  for (const b of turnBuffsOf(state, instance.instanceId)) if (b.sp !== undefined) sp = Math.max(sp, b.sp);
  if (gekiBlueApplies(state, playerId, instance)) sp = Math.max(sp, 1);
  if (isSameCardIdentity(instance.cardId, JUMA_HUNTER_CARD_ID) && enemyUnitPrinted(state, playerId, (d) => (cardCategories(d) as string[]).includes("DA"))) {
    return Math.max(sp, 1);
  }
  return sp;
}

export const ABARE_MAX_CARD_ID = "XG3-023";
export const URZARD_CARD_ID = "XG3-029";

function turnBuffsOf(state: View, instanceId: string) {
  return (state.xg3?.turnBuffs ?? []).filter((b) => b.instanceId === instanceId && b.turn === state.turn);
}

/**
 * XG3-023 アバレマックス【大気爆裂マックスフィールド】: 自軍バトルエリアのユニットがこれ1体だけなら、自軍バトルエリアのユニットは BP+2000、
 * 敵軍バトルエリアのユニットは BP-2000（BP0 以下の撃破は R-BP-02 のルールの撃破）。
 */
function abareMaxBonus(state: View, playerId: PlayerId, instance: CardInstance): number {
  const own = state.players[playerId].battle;
  if (!own.some((c) => c.instanceId === instance.instanceId)) return 0;
  const solo = (battle: CardInstance[]) => battle.length === 1 && isSameCardIdentity(battle[0]!.cardId, ABARE_MAX_CARD_ID);
  let bonus = 0;
  if (solo(own)) bonus += 2000;
  if (solo(state.players[opponent(playerId)].battle)) bonus -= 2000;
  return bonus;
}

/** XG3-031【宙宙斬】: そのターン、自軍バトルエリアの2番目に並ぶ、特徴「激気」を持つ M ユニットは「SP1」。 */
function gekiBlueApplies(state: View, playerId: PlayerId, instance: CardInstance): boolean {
  if (!(state.xg3?.gekiBlue ?? []).some((g) => g.ownerId === playerId && g.turn === state.turn)) return false;
  const battle = state.players[playerId].battle;
  if (battle[1]?.instanceId !== instance.instanceId) return false;
  if (unitSizeOf(state.definitions, instance) !== "M") return false;
  return (getDefinition(state.definitions, instance.cardId)?.features ?? []).includes("激気") || xg3AddedFeatures(state, instance).includes("激気");
}

function ownerOf(state: Pick<GameState, "players">, instanceId: string): PlayerId | null {
  for (const pid of ["player1", "player2"] as const) {
    const p = state.players[pid];
    if (p.battle.some((c) => c.instanceId === instanceId) || p.rush.some((c) => c.instanceId === instanceId)) return pid;
  }
  return null;
}

function hasOwnMVehicle(state: Pick<GameState, "players" | "definitions">, ownerId: PlayerId): boolean {
  const p = state.players[ownerId];
  return [...p.battle, ...p.rush].some((c) => isVehicle(getDefinition(state.definitions, c.cardId)) && unitSizeOf(state.definitions, c) === "M");
}

/** いまのサイズ（XG3-029 ※「自軍Mビークルがあれば、これはMユニットになり」）。変わらなければ undefined。 */
export function xg3SizeNow(state: Pick<GameState, "players" | "definitions">, instance: CardInstance): "M" | undefined {
  if (!isSameCardIdentity(instance.cardId, URZARD_CARD_ID)) return undefined;
  const owner = ownerOf(state, instance.instanceId);
  return owner && hasOwnMVehicle(state, owner) ? "M" : undefined;
}

/** 追加される特徴（XG3-029 ※「特徴「人型」が追加される」）。 */
export function xg3AddedFeatures(state: Pick<GameState, "players" | "definitions">, instance: Pick<CardInstance, "cardId" | "instanceId">): string[] {
  if (!isSameCardIdentity(instance.cardId, URZARD_CARD_ID)) return [];
  const owner = ownerOf(state, instance.instanceId);
  return owner && hasOwnMVehicle(state, owner) ? ["人型"] : [];
}

/** XG3-037【烏賊墨砲】: このターン、そのユニットの「アタックされない」という記述のあるテキストは無効。 */
export function xg3NoAttackTextDisabled(state: Partial<Pick<GameState, "xg3" | "turn">>, instanceId: string): boolean {
  return (state.xg3?.noAttackTextDisabled ?? []).some((d) => d.instanceId === instanceId && d.turn === state.turn);
}
