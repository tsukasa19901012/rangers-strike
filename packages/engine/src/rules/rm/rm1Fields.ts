/**
 * スペシャルメタルエディション RM-001〜RM-021 の継続効果の判定（低い層から呼ぶ小さなモジュール。カードの効果そのものは rules/rm/rm1Effects.ts）。
 * core/catalog.ts を import しない（定義は state.definitions を直接見る）。
 *
 * - `rm1ResidentActive`: RM の常駐が場にあって有効か（RK-248 パラダイス・ロストで無効になっていないか）。
 * - `rm1GrantsScrum`: RM-013 BSフォーメーション（keywords/battleKeywords.ts scrumBlocksAttack）。
 * - `rm1SonicFlapExtraHolds`: RM-014 ソニックフラップ（rules/commandPayment.ts のラッシュの支払い）。
 * - `rm1DorugiranWaivesCondition`: RM-019 超次元高速機ドルギランの※（rules/bkOperationTurnRules.ts rushAdditionalConditionApplies）。
 * - `rm1ActsAsVehicle`: RM-020 電子星獣ドルの※（core/legalActions.ts のライドの合法手）。
 * - `rm1ComboNumber`: RM-011 ターボユニット-W（rules/numberComboEffects.ts ncEffectiveNumber）。
 * - `isRm1StackedUnderUnitOperation`: RM-009・RM-011（ユニットの下に重ね、ユニットでなくなるとき捨札。rules/rk/rk1Features.ts）。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../../types/game";
import { rk12ResidentsNegated } from "../rk/rk12Fields";

type Defs = Pick<GameState, "definitions">;

export const MULTI_PACK_CARD_ID = "RM-009";
export const TURBO_UNIT_CARD_ID = "RM-011";

function def(state: Defs, cardId: string) {
  return state.definitions[cardId];
}

function named(state: Defs, cardId: string, name: string): boolean {
  const n = def(state, cardId)?.name;
  return !!n && n === name;
}

function fieldCards(player: Pick<PlayerState, "battle" | "rush">): CardInstance[] {
  return [...player.battle, ...player.rush];
}

/** 必要パワーの数字（「+」「-」を除く）。 */
export function rm1CostNumber(state: Defs, cardId: string): number {
  const raw = def(state, cardId)?.powerCost;
  if (typeof raw === "number") return raw;
  const m = String(raw ?? "").match(/\d+/);
  return m ? Number(m[0]) : Number.NaN;
}

/** owner の常駐置き場に cardId の常駐が何枚あって有効か（RK-248 で無効なら 0）。 */
export function rm1ResidentCount(state: Pick<GameState, "players">, ownerId: PlayerId, cardId: string): number {
  if (rk12ResidentsNegated(state, ownerId)) return 0;
  return state.players[ownerId].operation.filter((c) => isSameCardIdentity(c.cardId, cardId)).length;
}

export function rm1ResidentActive(state: Pick<GameState, "players">, ownerId: PlayerId, cardId: string): boolean {
  return rm1ResidentCount(state, ownerId, cardId) > 0;
}

/** RM-009 マルチパック・RM-011 ターボユニット-W（ユニットの下に重ね、重ねたユニットがユニットでなくなるとき捨札になる）。 */
export function isRm1StackedUnderUnitOperation(cardId: string): boolean {
  return isSameCardIdentity(cardId, MULTI_PACK_CARD_ID) || isSameCardIdentity(cardId, TURBO_UNIT_CARD_ID);
}

/**
 * RM-013 BSフォーメーション「特徴「ブルー」または「スワット」を持つ自軍ユニットは、次の能力を得る⇒スクラム」（atwiki/page-884）。
 * features はそのユニットのいまの特徴（効果で追加された特徴を含む）。
 */
export function rm1GrantsScrum(state: Pick<GameState, "players">, ownerId: PlayerId, features: string[]): boolean {
  if (!rm1ResidentActive(state, ownerId, "RM-013")) return false;
  return features.includes("ブルー") || features.includes("スワット");
}

/**
 * RM-014 ソニックフラップ「自分も相手も次の制限を受ける⇒自分自身の捨札にあるユニットカードと同じカード名のユニットカードを、コマンドをホールドして
 * ラッシュするとき、コマンドを追加で2つホールドしなければ、そのユニットカードはラッシュできない。」（atwiki/page-875）。
 * 追加でホールドするコマンドの数（場のソニックフラップ1枚につき2つ。両軍の常駐を数える）。
 */
export function rm1SonicFlapExtraHolds(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId, cardId: string): number {
  const d = def(state, cardId);
  if (d?.type !== "unit") return 0;
  const copies = rm1ResidentCount(state, "player1", "RM-014") + rm1ResidentCount(state, "player2", "RM-014");
  if (copies === 0) return 0;
  const sameInDiscard = state.players[playerId].discard.some((c) => def(state, c.cardId)?.type === "unit" && named(state, c.cardId, d.name));
  return sameInDiscard ? 2 * copies : 0;
}

/**
 * RM-019 超次元高速機ドルギラン「※これが自軍捨札にある間、自分が「電子星獣ドル」または「ギラン円盤」をラッシュするとき、ラッシュするユニットと同じ
 * カード名のユニットが自軍エリアになければ、その追加条件を満たさなくてもよい。」（atwiki/page-834）。
 */
export function rm1DorugiranWaivesCondition(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId, cardId: string): boolean {
  const d = def(state, cardId);
  if (d?.type !== "unit") return false;
  if (!named(state, cardId, "電子星獣ドル") && !named(state, cardId, "ギラン円盤")) return false;
  const player = state.players[playerId];
  if (!player.discard.some((c) => named(state, c.cardId, "超次元高速機ドルギラン"))) return false;
  return !fieldCards(player).some((c) => def(state, c.cardId)?.type === "unit" && named(state, c.cardId, d.name));
}

/**
 * RM-020 電子星獣ドル「※これは、チェイスを持つ自軍ユニットがあるか、ライドされてる間、Lビークルとして扱う。」（atwiki/page-835）。
 * hasChase はユニットがチェイスを持つかの判定（呼び出し側から受け取る）。
 */
export function rm1ActsAsVehicle(
  state: Pick<GameState, "players" | "definitions">,
  playerId: PlayerId,
  card: Pick<CardInstance, "cardId" | "instanceId">,
  hasChase: (cardId: string) => boolean,
): boolean {
  if (!isSameCardIdentity(card.cardId, "RM-020")) return false;
  const player = state.players[playerId];
  const field = fieldCards(player);
  if (field.some((c) => c.mountedOnInstanceId === card.instanceId && c.instanceId !== card.instanceId)) return true;
  return field.some((c) => c.instanceId !== card.instanceId && def(state, c.cardId)?.type === "unit" && hasChase(c.cardId));
}

/** RM-011 ターボユニット-W を重ねたユニットのナンバー（1枚につき1少なく。2より少なくならない。もとが2以下なら変わらない）。 */
export function rm1ComboNumber(card: Pick<CardInstance, "stackedCards">, n: number): number {
  const turbo = (card.stackedCards ?? []).filter((c) => isSameCardIdentity(c.cardId, TURBO_UNIT_CARD_ID)).length;
  if (turbo === 0 || n <= 2) return n;
  return Math.max(2, n - turbo);
}

/** RM-009 マルチパックを重ねたユニットか。 */
export function hasRm1MultiPack(card: Pick<CardInstance, "stackedCards"> | undefined): boolean {
  return (card?.stackedCards ?? []).some((c) => isSameCardIdentity(c.cardId, MULTI_PACK_CARD_ID));
}
