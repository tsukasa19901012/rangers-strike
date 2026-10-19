/**
 * スペシャルメタルエディション RM-022〜RM-042 の継続効果の判定（低い層から呼ぶ小さなモジュール。カードの効果そのものは rules/rm/rm2Effects.ts）。
 * core/catalog.ts を import しない（定義は state.definitions を直接見る）。
 *
 * - `rm2ActsAsVehicle`: RM-023 スクーパーの※（core/legalActions.ts のライドの合法手・keywords/chase.ts の乗り換え先）。
 * - `rm2BlocksBattleEntry`: RM-029 ジャスピオンの※（rules/restrictions.ts）。
 * - `rmChaseVehicleCandidate`: チェイスの乗り換え先にできるカード（ビークルのカード、RM-020・RM-023 のビークルとして扱うユニットカード。
 *   keywords/chase.ts・keywords/index.ts canInitiateChase）。
 * - `rm2CostNumber`: 必要パワーの数字（「+」「-」を除く）。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../../types/game";
import { rm1ActsAsVehicle } from "./rm1Fields";
import { unitSizeOf } from "../../core/catalog";

export const SCOOPER_CARD_ID = "RM-023";
export const JASPION_CARD_ID = "RM-029";

function fieldCards(state: Pick<GameState, "players">, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

/** 必要パワーの数字（「+」「-」を除く。数字がなければ NaN）。 */
export function rm2CostNumber(state: Pick<GameState, "definitions">, cardId: string): number {
  const raw = state.definitions[cardId]?.powerCost;
  if (typeof raw === "number") return raw;
  const m = String(raw ?? "").match(/\d+/);
  return m ? Number(m[0]) : Number.NaN;
}

/**
 * RM-023 スクーパー「※これは、チェイスを持つ自軍ユニットがあるか、ライドされている間、Sビークルとして扱う。」（atwiki/page-838）。
 * hasChase はユニットがチェイスを持つかの判定（呼び出し側から受け取る）。
 */
export function rm2ActsAsVehicle(
  state: Pick<GameState, "players" | "definitions">,
  playerId: PlayerId,
  card: Pick<CardInstance, "cardId" | "instanceId">,
  hasChase: (cardId: string) => boolean,
): boolean {
  if (!isSameCardIdentity(card.cardId, SCOOPER_CARD_ID)) return false;
  const field = fieldCards(state, playerId);
  if (field.some((c) => c.mountedOnInstanceId === card.instanceId && c.instanceId !== card.instanceId)) return true;
  return field.some((c) => c.instanceId !== card.instanceId && state.definitions[c.cardId]?.type === "unit" && hasChase(c.cardId));
}

/**
 * RM-029 ジャスピオン「※SPが空欄ではない自軍Sユニットがあれば、これはバトルエリアに出られない。」（atwiki/page-896）。
 * 自軍の場（ラッシュエリア・バトルエリア）の、これ以外の S ユニットの印刷の SP を見る（「！」も空欄ではない）。
 */
export function rm2BlocksBattleEntry(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId, unit: Pick<CardInstance, "cardId" | "instanceId">): boolean {
  if (!isSameCardIdentity(unit.cardId, JASPION_CARD_ID)) return false;
  return fieldCards(state, playerId).some((c) => {
    if (c.instanceId === unit.instanceId) return false;
    const d = state.definitions[c.cardId];
    if (d?.type !== "unit" || unitSizeOf(state.definitions, c) !== "S") return false;
    return d.sp !== undefined && d.sp !== null;
  });
}

/**
 * チェイスの乗り換え先にできる自軍ラッシュエリアのカードか（ビークルのカード、またはビークルとして扱うユニットカード:
 * RM-020 電子星獣ドル・RM-023 スクーパー。チェイスを持つ自軍ユニットがある間は L／S ビークルとして扱う）。
 */
export function rmChaseVehicleCandidate(
  state: Pick<GameState, "players" | "definitions">,
  playerId: PlayerId,
  card: Pick<CardInstance, "cardId" | "instanceId">,
  hasChase: (cardId: string) => boolean,
): boolean {
  if (state.definitions[card.cardId]?.type === "vehicle") return true;
  return rm1ActsAsVehicle(state, playerId, card, hasChase) || rm2ActsAsVehicle(state, playerId, card, hasChase);
}
