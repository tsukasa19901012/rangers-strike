import type { GameAction } from "../types/actions";
import type { GameState, PlayerId } from "../types/game";
import { applyAction } from "../core/applyAction";
import { getLegalActions } from "../core/legalActions";
import { isMirrorWorld, MIRROR_WORLD_STACK_EFFECT_ID } from "../rules/rk/rk1NamedEffects";
import { heuristicEvaluate } from "./scoring";

/**
 * RK-016 / RK-075 ミラーワールド: 自軍ラッシュフェイズに場の自軍 S ユニットを重ねるか。
 * 起動の手は、重ねる選択が出たところ（まだ何も変わっていない盤面）で評価されるので、読みでは「何もしない」と同じ点になり
 * 一度も選ばれなかった。ここでは起動と重ねる選択をまとめて、重ねた後の盤面で比べる。
 * 比べるのは手書きの評価（価値ネットワークはミラーワールドの守りを特徴に持たず、重ねると場のユニットが減る損だけを見る）。
 */
const MARGIN = 100;

function bestStack(state: GameState, playerId: PlayerId): { action: GameAction | null; score: number } {
  let best: GameAction | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const a of getLegalActions(state)) {
    if (a.type !== "resolve_effect_choice" && a.type !== "skip_effect_choice") continue;
    const r = applyAction(state, a);
    if (!r.ok) continue;
    const score = heuristicEvaluate(r.state, playerId) + (a.type === "skip_effect_choice" ? MARGIN : 0);
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return { action: best, score: bestScore };
}

/** 重ねる選択が出ているとき: 重ねた後の盤面が見送るよりはっきり良いユニットを選ぶ（なければ見送る）。 */
export function pickMirrorWorldChoice(state: GameState, playerId: PlayerId): GameAction | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId || pending.effectId !== MIRROR_WORLD_STACK_EFFECT_ID) return null;
  return bestStack(state, playerId).action;
}

/** 自軍ラッシュフェイズ: 重ねると今より良くなるならミラーワールドを起動する。 */
export function pickMirrorWorldActivation(state: GameState, playerId: PlayerId, actions: GameAction[]): GameAction | null {
  const ops = state.players[playerId].operation;
  const base = heuristicEvaluate(state, playerId) + MARGIN;
  for (const a of actions) {
    if (a.type !== "activate_resident_operation") continue;
    const op = ops.find((c) => c.instanceId === a.operationInstanceId);
    if (!op || !isMirrorWorld(op.cardId)) continue;
    const r = applyAction(state, a);
    if (!r.ok) continue;
    const { action, score } = bestStack(r.state, playerId);
    if (action?.type === "resolve_effect_choice" && score > base) return a;
  }
  return null;
}
