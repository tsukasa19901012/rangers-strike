/**
 * cardSpec RK-127〜RK-147（ザ・マスクドライダーEXP vol.2 仮面ライダーカリス〜デンライナーイスルギ）用ヘルパー。
 * RK6-106-126.helpers.ts（RK1〜RK5 のヘルパーを含む）をそのまま再エクスポートし、ラッシュの途中・カードを順に選ぶ手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import { expect } from "vitest";
import type { GameState, PlayerId } from "../types/game";
import { legal, tryAct } from "./RK6-106-126.helpers";

export * from "./RK6-106-126.helpers";

/** 手札のカードのラッシュを宣言し、コマンドの支払いまで済ませる（ラッシュの反応ウィンドウ・ラッシュしたときの選択は開いたまま）。 */
export function rushOpen(s: GameState, playerId: PlayerId, instanceId: string): GameState {
  let r = tryAct(s, { type: "initiate_command_payment", playerId, kind: "category_use", sourceInstanceId: instanceId });
  expect(r.ok, r.error).toBe(true);
  for (let i = 0; i < 4 && r.state.pendingCommandPayment?.playerId === playerId; i++) {
    const p = r.state.pendingCommandPayment;
    r = tryAct(r.state, { type: "resolve_command_payment", playerId, commandInstanceIds: p.validInstanceIds.slice(0, p.totalNeeded) });
    expect(r.ok, r.error).toBe(true);
  }
  return r.state;
}

/** 確定（confirm_effect_choice）が合法か。 */
export function canConfirm(s: GameState): boolean {
  return legal(s).some((a) => a.type === "confirm_effect_choice");
}

/** 開いている選択の持ち主と発生源。 */
export function choiceOwner(s: GameState): { playerId?: PlayerId; sourceCardId?: string } {
  return { playerId: s.pendingEffectChoice?.playerId, sourceCardId: s.pendingEffectChoice?.sourceCardId };
}
