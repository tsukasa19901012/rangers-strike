"use client";

import type { GameState, PlayerId } from "@rangers-strike/engine";
import { damagePaymentHint } from "@/lib/damagePaymentHint";
import { GameModalBackdrop } from "./GameModalBackdrop";

type DamagePaymentModalProps = {
  pending: NonNullable<GameState["pendingDamagePayment"]>;
  playerId: PlayerId;
};

export function DamagePaymentModal({
  pending,
  playerId,
}: DamagePaymentModalProps) {
  if (pending.playerId !== playerId) return null;

  return (
    <GameModalBackdrop>
      <div
        className="modal modal--effect-action"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <h3 className="modal__title">ダメージ処理</h3>
        <p className="modal__hint">{damagePaymentHint(pending)}</p>
        <p className="modal__hint modal__hint--sub">
          パワーゾーンの表向きカードをタップして選んでください。
        </p>
      </div>
    </GameModalBackdrop>
  );
}
