import type { GameState } from "@rangers-strike/engine";

export function damagePaymentHint(
  pending: NonNullable<GameState["pendingDamagePayment"]>,
): string {
  const picked = pending.selectedFlipIds.length;
  const total = pending.remainingFlips + picked;
  const sideKnuckle =
    pending.choosingPlayerId !== undefined &&
    pending.choosingPlayerId !== pending.playerId;
  if (sideKnuckle) {
    return `サイドナックル：相手の表向きパワーから${total}枚、裏向きにするカードを選んでください（${picked}/${total}）`;
  }
  return `ダメージ${pending.totalDamage}：表向きのパワーから${total}枚、裏向きにするカードを選んでください（${picked}/${total}）`;
}
