/**
 * cardSpec XG3-022〜XG3-041（クロスギャザー ザ・Wインパクト アバレッド〜仮面ライダーディケイドCF）用ヘルパー。
 * XG3-002-021.helpers.ts（BK・RM・RK のヘルパーを含む）をそのまま再エクスポートし、相手の選択・手札からラッシュエリアに出す手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { GameState, PlayerId } from "../types/game";
import { legal, tryAct } from "./XG3-002-021.helpers";

export * from "./XG3-002-021.helpers";

/** 開いている選択が player のもので、sourceCardId から出たものか。 */
export function choiceOf(s: GameState, playerId: PlayerId, sourceCardId: string): boolean {
  return s.pendingEffectChoice?.playerId === playerId && s.pendingEffectChoice.sourceCardId === sourceCardId;
}

/** player の合法手の種類（重複なし）。 */
export function actionTypes(s: GameState, playerId: PlayerId = "player1"): string[] {
  return [...new Set(legal(s).filter((a) => a.playerId === playerId).map((a) => a.type))].sort();
}

/**
 * 手札からラッシュする（rushFromHand と同じ手順）が、相手のラッシュへの反応ウィンドウはパスしない
 * （「ラッシュされたとき」のカウンターを使えるかを確かめるため）。
 */
export function rushKeepReaction(
  s: GameState,
  playerId: PlayerId,
  instanceId: string,
  materials: string[] = [],
): GameState {
  let r = tryAct(s, { type: "begin_zord_setup", playerId, zordInstanceId: instanceId });
  if (!r.ok) r = tryAct(s, { type: "initiate_command_payment", playerId, kind: "category_use", sourceInstanceId: instanceId });
  if (!r.ok) throw new Error(`rushKeepReaction: ${r.error}`);
  const mats = [...materials];
  for (let i = 0; i < 12 && r.ok && r.state.pendingZordSetup; i += 1) {
    const setup = r.state.pendingZordSetup;
    if (setup.step === "destination") r = tryAct(r.state, { type: "resolve_zord_setup", playerId, destination: "discard" });
    else if (setup.step === "material") {
      const pick = mats.find((m) => setup.validInstanceIds.includes(m)) ?? setup.validInstanceIds[0];
      if (!pick) throw new Error("rushKeepReaction: no material");
      r = tryAct(r.state, { type: "resolve_zord_setup", playerId, materialInstanceId: pick });
    } else r = tryAct(r.state, { type: "resolve_zord_setup", playerId });
  }
  for (let i = 0; i < 6 && r.ok && r.state.pendingCommandPayment?.playerId === playerId; i += 1) {
    const p = r.state.pendingCommandPayment;
    r = tryAct(r.state, { type: "resolve_command_payment", playerId, commandInstanceIds: p.validInstanceIds.slice(0, p.totalNeeded) });
  }
  if (!r.ok) throw new Error(`rushKeepReaction: ${r.error}`);
  return r.state;
}
