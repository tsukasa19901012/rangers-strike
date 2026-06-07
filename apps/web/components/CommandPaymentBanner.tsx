"use client";

import type { CommandPaymentView, PendingCommandPayment } from "@rangers-strike/engine";
import { commandPaymentHint, commandPaymentZoneHint } from "@/lib/commandPaymentUi";

type CommandPaymentBannerProps = {
  pending: PendingCommandPayment;
  view: CommandPaymentView;
  selectedCount: number;
  usePrism: boolean;
  onPrismModeChange?: (usePrism: boolean) => void;
};

export function CommandPaymentBanner({
  pending,
  view,
  selectedCount,
  usePrism,
  onPrismModeChange,
}: CommandPaymentBannerProps) {
  const title =
    view.kind === "battle_entry"
      ? "バトルエリアに出す"
      : view.kind === "mothership_hold"
        ? "母艦の支払い"
        : view.kind === "effect_hold"
          ? "コマンドをホールド"
          : "カードを使う";

  return (
    <div className="damage-payment-banner command-payment-banner" role="status" aria-live="polite">
      <p className="damage-payment-banner__title">{title}</p>
      <p className="damage-payment-banner__hint">
        {commandPaymentHint(pending, view, selectedCount)}
      </p>
      <p className="damage-payment-banner__sub">{commandPaymentZoneHint(view)}</p>

      {view.prismAvailable && view.kind === "category_use" && onPrismModeChange && (
        <label className="command-payment-banner__prism">
          <input
            type="checkbox"
            checked={usePrism}
            onChange={(e) => onPrismModeChange(e.target.checked)}
          />
          【プリズムパワー】ホールド2枚でカテゴリ支払い（{view.categories.join("・")}不要）
        </label>
      )}
    </div>
  );
}
