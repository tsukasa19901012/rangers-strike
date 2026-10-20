/**
 * cardSpec RK-316〜RK-335（ザ・マスクドライダーEXP vol.4 キバットバットⅢ世〜モモタロス（2nd））用ヘルパー。
 * RK15-295-315.helpers.ts（RK1〜RK14 のヘルパーを含む）をそのまま再エクスポートし、ゾーンから出す手・場の能力の起動を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { GameState, PlayerId } from "../types/game";
import { act, legal } from "./RK15-295-315.helpers";

export * from "./RK15-295-315.helpers";

/** 「これが自軍コマンドゾーン（等）にある間、…これを自軍ラッシュエリアに出してもよい」（self_rush_from_zone）が合法か。 */
export function canSelfRush(s: GameState, zone: "command" | "power" | "hand", instanceId: string, playerId: PlayerId = "player1"): boolean {
  return legal(s).some((a) => a.type === "self_rush_from_zone" && a.playerId === playerId && a.zone === zone && a.instanceId === instanceId);
}

/** self_rush_from_zone を行う。 */
export function selfRush(s: GameState, zone: "command" | "power" | "hand", instanceId: string, playerId: PlayerId = "player1"): GameState {
  return act(s, { type: "self_rush_from_zone", playerId, zone, instanceId });
}

/** 場のユニットの起動型の能力（activate_field_unit_ability）が合法か。 */
export function canActivate(s: GameState, unitInstanceId: string, playerId: PlayerId = "player1"): boolean {
  return legal(s).some((a) => a.type === "activate_field_unit_ability" && a.playerId === playerId && a.unitInstanceId === unitInstanceId);
}

/** 場のユニットの起動型の能力を使う。 */
export function activate(s: GameState, unitInstanceId: string, playerId: PlayerId = "player1"): GameState {
  return act(s, { type: "activate_field_unit_ability", playerId, unitInstanceId });
}

/** 山札・ゾーンのカードの instanceId（並び順のまま）。 */
export function deckIds(s: GameState, playerId: PlayerId = "player1"): string[] {
  return s.players[playerId].deck.map((c) => c.instanceId);
}
