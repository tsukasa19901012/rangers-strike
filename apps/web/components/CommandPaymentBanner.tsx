"use client";

import type { CommandPaymentView, PendingCommandPayment } from "@rangers-strike/engine";
import type { CardDefinition } from "@rangers-strike/cards";
import {
  CARD_PREVIEW_GESTURE_HINT,
  commandPaymentHint,
  commandPaymentZoneHint,
  type CommandPaymentSelectedCard,
} from "@/lib/commandPaymentUi";
import { CardImage } from "./CardImage";

type CommandPaymentBannerProps = {
  pending: PendingCommandPayment;
  view: CommandPaymentView;
  selectedCount: number;
  selectedCards: CommandPaymentSelectedCard[];
  usePrism: boolean;
  canConfirm: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onPrismModeChange?: (usePrism: boolean) => void;
  onPreviewCard: (card: CardDefinition) => void;
};

export function CommandPaymentBanner({
  pending,
  view,
  selectedCount,
  selectedCards,
  usePrism,
  canConfirm,
  onCancel,
  onConfirm,
  onPrismModeChange,
  onPreviewCard,
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
      <p className="command-payment-banner__gesture">{CARD_PREVIEW_GESTURE_HINT}</p>

      {selectedCards.length > 0 && (
        <div className="command-payment-banner__selected">
          <p className="command-payment-banner__selected-label">選択中</p>
          <div className="command-payment-banner__chips">
            {selectedCards.map(({ instanceId, definition }) => (
              <div key={instanceId} className="command-payment-banner__chip">
                <CardImage
                  card={definition}
                  small
                  onPreview={() => onPreviewCard(definition)}
                />
                <span className="command-payment-banner__chip-name">{definition.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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

      <div className="command-payment-banner__actions">
        <button type="button" className="btn" onClick={onCancel}>
          キャンセル
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!canConfirm}
          onClick={onConfirm}
        >
          ホールド確定（{selectedCount}/{pending.totalNeeded}）
        </button>
      </div>
    </div>
  );
}
