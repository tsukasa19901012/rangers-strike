import type { GameAction } from "../types/actions";
import type { GameState, PlayerId } from "../types/game";
import { applyAction } from "../core/applyAction";
import { getLegalActions } from "../core/legalActions";

/**
 * 出ても何もできない（何も起きない）バトル進入か。
 * 出た直後にアタック・ストライク・【ジュウクンドー】・起動効果のどれも選べず「何もしない」しかなく、出たことで効果も
 * 何も起きない（ログが「出た」だけ）ユニット（負けるだけのアタックしかできないユニットも含む）は、ターンの終わりまでバトルエリアに立っているだけで、相手のターンにアタックされて
 * 撃破されることがある。CPU（Lv5）は価値ネットの評価の揺れでこういう進入を選び、出たユニットの約 6 割が何もしない進入だった
 * （同デッキ Lv5 同士 92 試合、2026-11-09）。ライドして出る手（BP が上がる）や、NC で出る手は、ここには当たらない。
 */
export function isIdleBattleEntry(state: GameState, playerId: PlayerId, action: GameAction): boolean {
  if (action.type !== "move_to_battle" || action.playerId !== playerId) return false;
  if (action.vehicleInstanceId || action.rideOff) return false;
  const result = applyAction(state, action);
  if (!result.ok) return false;
  const next = result.state;
  const pending = next.pendingBattleEntry;
  if (!pending || pending.playerId !== playerId || pending.instanceId !== action.instanceId) return false;
  if (next.pendingEffectChoice || next.pendingRush || next.pendingBattle || next.pendingStrike || next.pendingLeave || next.pendingChase || next.pendingRideOffChoice) return false;
  const legal = getLegalActions(next);
  if (legal.some((a) => a.type !== "pass_battle_entry" && (a.type !== "battle" || attackDoesSomething(next, a)))) return false;
  const added = next.log.slice(state.log.length);
  return added.every((line) => line.startsWith(`${playerId}|move_to_battle|`));
}

/**
 * アタックして何か起きるか（相手のユニットを撃破できる、または選択などが始まる）。負けるだけのアタックしか無いユニットも、
 * 出ても何もできないのと同じ（出て「何もしない」を選び、相手のターンにアタックされて撃破されていた）。
 */
function attackDoesSomething(state: GameState, action: Extract<GameAction, { type: "battle" }>): boolean {
  const result = applyAction(state, action);
  if (!result.ok) return false;
  const next = result.state;
  if (next.winner || next.pendingEffectChoice || next.pendingBattle || next.pendingLeave || next.pendingStrike || next.pendingRush) return true;
  const enemy = next.players[action.playerId === "player1" ? "player2" : "player1"];
  const defenderLeft = !enemy.battle.some((c) => c.instanceId === action.defenderInstanceId) && !enemy.rush.some((c) => c.instanceId === action.defenderInstanceId);
  return defenderLeft;
}

/** 何もできない進入を除いた合法手（ほかに選べる手が無くなるなら、そのまま返す）。 */
export function withoutIdleEntries(state: GameState, playerId: PlayerId, actions: GameAction[]): GameAction[] {
  if (!actions.some((a) => a.type === "move_to_battle")) return actions;
  const kept = actions.filter((a) => !isIdleBattleEntry(state, playerId, a));
  return kept.length > 0 ? kept : actions;
}
