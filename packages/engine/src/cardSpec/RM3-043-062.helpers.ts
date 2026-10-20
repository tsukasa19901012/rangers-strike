/**
 * cardSpec RM-043〜RM-062（スペシャルメタルエディション 鳥忍 カラス天狗〜テントリーナ）用ヘルパー。
 * RM2-022-042.helpers.ts（RM1・RK1〜RK16 のヘルパーを含む）をそのまま再エクスポートし、ナンバーコンビネーション・常駐の盤面の小さな手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { act, deckCards, fill, inst, legal, st } from "./RM2-022-042.helpers";

export * from "./RM2-022-042.helpers";

/** 自軍（player1）バトルフェイズに、left（並びの順）の後へ id を出す（最後の進入ウィンドウ・NC/JC の選択は残す）。 */
export function enterAfter(
  id: string,
  left: CardInstance[],
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
): GameState {
  const [cardId, suf] = id.split(":") as [string, string];
  const s = st(
    {
      player1: { deck: deckCards(5), ...p1, battle: [...left, ...(p1.battle ?? [])], rush: [inst(cardId, suf), ...(p1.rush ?? [])] },
      player2: { deck: deckCards(5, "e"), ...p2 },
    },
    extra,
  );
  return act(s, { type: "move_to_battle", playerId: "player1", instanceId: id });
}

/** フィラー n 体（TST-UNIT-0。特徴なし）。 */
export function fillers0(n: number, prefix = "f"): CardInstance[] {
  return fill(n, prefix);
}

/** 選択の持ち主が確定・発動できるか（confirm_effect_choice が合法手にあるか）。 */
export function confirmOffered(s: GameState, playerId: PlayerId): boolean {
  return legal(s).some((a) => a.type === "confirm_effect_choice" && a.playerId === playerId);
}

/** resolve_effect_choice の候補（指定プレイヤーの）。 */
export function choiceFor(s: GameState, playerId: PlayerId): string[] {
  return legal(s)
    .filter((a) => a.type === "resolve_effect_choice" && a.playerId === playerId)
    .map((a) => ("instanceId" in a ? (a.instanceId as string) : ""))
    .sort();
}
