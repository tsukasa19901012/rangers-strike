/**
 * cardSpec PR-015〜PR-027（プロモーションカード バイオロボ〜黒獅子リオ）用ヘルパー。
 * PR-001-014.helpers.ts（RS・RK・RM・BK・XP・PR のヘルパーの連なりを含む）をそのまま再エクスポートし、小さな手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState } from "../types/game";
import { enter, inst, st } from "./PR-001-014.helpers";

export * from "./PR-001-014.helpers";

/** 自軍（player1）バトルフェイズに、battle を並べたあとで id（ラッシュエリア、instanceId は `${id}:x`）をバトルエリアに出す。 */
export function enterNext(
  id: string,
  battle: CardInstance[],
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
  p1: Partial<GameState["players"]["player1"]> = {},
): GameState {
  return enter(st({ player1: { battle, rush: [inst(id, "x")], ...p1 }, player2: p2 }, extra), `${id}:x`);
}
