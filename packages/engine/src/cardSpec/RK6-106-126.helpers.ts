/**
 * cardSpec RK-106〜RK-126（ザ・マスクドライダーEXP vol.2 仮面ライダーアギトFF〜仮面ライダーギャレン）用ヘルパー。
 * RK5-085-105.helpers.ts（RK1〜RK4 のヘルパーを含む）をそのまま再エクスポートし、特徴・ライド・ストライクの反応用の手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import { unitFeatures } from "../rules/addedFeatures";
import type { GameState, PlayerId } from "../types/game";
import { act as actOn, legal } from "./RK5-085-105.helpers";

export * from "./RK5-085-105.helpers";

/** ユニットの今の特徴（効果で追加されたものを含む。バトルエリア・ラッシュエリア）。 */
export function featuresOf(s: GameState, playerId: PlayerId, instanceId: string): string[] {
  const p = s.players[playerId];
  const c = p.battle.find((x) => x.instanceId === instanceId) ?? p.rush.find((x) => x.instanceId === instanceId);
  if (!c) throw new Error(`no unit ${instanceId}`);
  return [...unitFeatures(s, playerId, c)].sort();
}

/** rider が vehicle にライドしてバトルエリアに出る手（mount_ride）が合法か。 */
export function canMount(s: GameState, rider: string, vehicle: string, playerId: PlayerId = "player1"): boolean {
  return legal(s).some(
    (a) => a.type === "mount_ride" && a.playerId === playerId && a.riderInstanceId === rider && a.vehicleInstanceId === vehicle,
  );
}

/** ストライクされたとき、instanceId をバトルエリアに出してバトルさせる手（five_tech_intercept）が合法か。 */
export function interceptOffered(s: GameState, instanceId: string, playerId: PlayerId = "player1"): boolean {
  return legal(s).some((a) => a.type === "five_tech_intercept" && a.playerId === playerId && a.interceptInstanceId === instanceId);
}

/** ストライクされたとき、instanceId をバトルエリアに出してバトルさせる。 */
export function intercept(s: GameState, instanceId: string, playerId: PlayerId = "player1"): GameState {
  const a = legal(s).find((x) => x.type === "five_tech_intercept" && x.playerId === playerId && x.interceptInstanceId === instanceId);
  if (!a) throw new Error(`no intercept for ${instanceId}`);
  return actOn(s, a);
}
