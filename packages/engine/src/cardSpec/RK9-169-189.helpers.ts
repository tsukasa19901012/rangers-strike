/**
 * cardSpec RK-169〜RK-189（ザ・マスクドライダーEXP vol.2〜vol.3 仮面ライダーゼロノスVF〜ジェイクロッサー）用ヘルパー。
 * RK8-148-168.helpers.ts（RK1〜RK7 のヘルパーを含む）をそのまま再エクスポートし、チャージ・カウンターの使用を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { GameState, PlayerId } from "../types/game";
import { act, legal } from "./RK8-148-168.helpers";

export * from "./RK8-148-168.helpers";

/** チャージフェイズに手札のカードをパワーゾーンに置く（charge_power）。 */
export function chargePower(s: GameState, instanceId: string, playerId: PlayerId = "player1"): GameState {
  return act(s, { type: "charge_power", playerId, instanceId });
}

/** バトルの反応窓で手札のカウンターを使う（支払いは先頭の有効コマンド）。使えなければ例外。 */
export function playCounter(s: GameState, instanceId: string, playerId: PlayerId = "player1"): GameState {
  const pay = legal(s).find(
    (a) => a.type === "initiate_command_payment" && a.playerId === playerId && "sourceInstanceId" in a && a.sourceInstanceId === instanceId,
  );
  if (pay) return act(s, pay);
  const direct = legal(s).find((a) => a.type === "play_counter" && a.playerId === playerId && a.instanceId === instanceId);
  if (!direct) throw new Error(`no counter ${instanceId}; legal=${legal(s).map((a) => a.type).join(",")}`);
  return act(s, direct);
}

/** 手札のカウンターが使えるか。 */
export function canPlayCounter(s: GameState, instanceId: string, playerId: PlayerId = "player1"): boolean {
  return legal(s).some(
    (a) =>
      a.playerId === playerId &&
      ((a.type === "play_counter" && a.instanceId === instanceId) ||
        (a.type === "initiate_command_payment" && "sourceInstanceId" in a && a.sourceInstanceId === instanceId)),
  );
}
