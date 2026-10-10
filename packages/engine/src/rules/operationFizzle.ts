import { getCardEffect } from "@rangers-strike/cards";
import { collectOperationTargets, needsOperationTarget } from "../effects/resolveOperation";
import {
  dslOperationOpensChoose,
  getDslOperationEffect,
  shouldUseDslOperation,
} from "../dsl/dslCatalog";
import { collectTargetInstanceIds } from "../dsl/targetSelectors";
import type { GameState, PlayerId } from "../types/game";

/**
 * オペレーションに適正な対象がなく、効果を解決できないか（空撃ちになるか）。
 * ルール: R-CARD-03, R-RES-04 — 対象がない・解決できないオペレーションも、コマンドのホールドや
 * 手札を減らす目的で使用でき、その場合は効果を発動せず捨札にする。
 * RS-004 デンジマシーンは自軍山札が2枚以下なら効果を発動しない（R-WIN-04）。
 */
export function operationFizzles(
  state: GameState,
  playerId: PlayerId,
  operationInstanceId: string,
  operationCardId: string,
): boolean {
  const player = state.players[playerId];
  const effect = getCardEffect(operationCardId);
  if (effect?.effectId === "denji_machine") return player.deck.length < 3;
  if (effect?.effectId === "cyber_s_rider") {
    return !player.hand.some((c) => c.instanceId !== operationInstanceId);
  }

  const dslEffect = getDslOperationEffect(operationCardId, "rush");
  const dslChoose =
    dslEffect &&
    shouldUseDslOperation(operationCardId, dslEffect) &&
    dslOperationOpensChoose(dslEffect);
  if (dslChoose && dslEffect.effects[0]?.type === "choose") {
    const choose = dslEffect.effects[0];
    const targets = collectTargetInstanceIds(
      state,
      playerId,
      choose.valid,
      operationInstanceId,
      operationCardId,
    );
    if (choose.kind === "optional_deck_draw") {
      return player.deck.length === 0 && targets.length === 0;
    }
    return targets.length === 0;
  }

  if (needsOperationTarget(operationCardId) && !dslChoose) {
    return collectOperationTargets(state, playerId, operationCardId).length === 0;
  }
  return false;
}
