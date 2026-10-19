/**
 * cardSpec XG3-043〜XG3-062（クロスギャザー ザ・Wインパクト ライダーマン〜仮面ライダーガタックRF）用ヘルパー。
 * XG3-022-041.helpers.ts をそのまま再エクスポートし、RC（ライディングコンビネーション）でバトルエリアに出す手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState } from "../types/game";
import { deckCards, inst, mount, rideOff, st } from "./XG3-022-041.helpers";

export * from "./XG3-022-041.helpers";

/**
 * 自軍バトルフェイズに、rider（RC のユニット）を自軍ラッシュエリアの SPEC-VEHICLE にライドさせてバトルエリアに出し、
 * ライドオフする（RC の効果の選択は残す）。
 */
export function rcEnter(
  rider: string,
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
  vehicle: CardInstance = inst("SPEC-VEHICLE", "v"),
): GameState {
  const [cid, suf] = rider.split(":") as [string, string];
  const s = st(
    { player1: { deck: deckCards(5), ...p1, rush: [inst(cid, suf), vehicle, ...(p1.rush ?? [])] }, player2: { deck: deckCards(5, "e"), ...p2 } },
    extra,
  );
  return rideOff(mount(s, rider, vehicle.instanceId), true);
}
