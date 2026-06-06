"use client";

import type { GameState } from "@rangers-strike/engine";
import { damagePaymentHint } from "@/lib/damagePaymentHint";

type DamagePaymentModalProps = {
  pending: NonNullable<GameState["pendingDamagePayment"]>;
};

export function DamagePaymentModal({ pending }: DamagePaymentModalProps) {
  const sideKnuckle =
    pending.choosingPlayerId !== undefined &&
    pending.choosingPlayerId !== pending.playerId;

  return (
    <div className="damage-payment-banner" role="status" aria-live="polite">
      <p className="damage-payment-banner__title">ダメージ処理</p>
      <p className="damage-payment-banner__hint">{damagePaymentHint(pending)}</p>
      <p className="damage-payment-banner__sub">
        {sideKnuckle
          ? "相手ボードの表向きパワーをタップして選んでください。"
          : "自分のパワーゾーンの表向きカードをタップして選んでください。"}
      </p>
    </div>
  );
}
