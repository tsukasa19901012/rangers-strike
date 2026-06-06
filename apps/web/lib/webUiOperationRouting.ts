import { getCardEffect, type EffectTarget } from "@rangers-strike/cards";
import { needsOperationTarget } from "@rangers-strike/engine";

export type OperationDropRoute =
  | { kind: "cyber_s_rider_modal" }
  | { kind: "target_modal"; targetType: EffectTarget }
  | { kind: "direct_play" };

/** GameApp のラッシュフェイズ・オペレーションゾーンのドロップルーティングを反映。 */
export function resolveOperationDropRoute(cardId: string): OperationDropRoute {
  const effect = getCardEffect(cardId);
  if (effect?.effectId === "cyber_s_rider") {
    return { kind: "cyber_s_rider_modal" };
  }
  if (needsOperationTarget(cardId)) {
    const targetType = effect?.target;
    if (!targetType) {
      throw new Error(`operation ${cardId} needs target but target is undefined`);
    }
    return { kind: "target_modal", targetType };
  }
  return { kind: "direct_play" };
}
