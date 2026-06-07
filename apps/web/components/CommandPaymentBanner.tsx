"use client";

import type { CommandPaymentView, PendingCommandPayment } from "@rangers-strike/engine";
import type { CardDefinition } from "@rangers-strike/cards";
import {
  CARD_PREVIEW_GESTURE_HINT,
  commandPaymentDetail,
  commandPaymentTitle,
  commandPaymentZoneHint,
  type CommandPaymentSelectedCard,
  type CommandPaymentUiContext,
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
  uiContext?: CommandPaymentUiContext;
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
  uiContext,
}: CommandPaymentBannerProps) {
  const isCategoryUse = pending.kind === "category_use";
  const title = commandPaymentTitle(pending, view, uiContext);
  const detail = commandPaymentDetail(pending, view, selectedCount);

  return (
    <div className="damage-payment-banner command-payment-banner" role="status" aria-live="polite">
      <p className="damage-payment-banner__title">{title}</p>
      <p className="damage-payment-banner__hint">{detail}</p>
      <p className="damage-payment-banner__sub">{commandPaymentZoneHint(view)}</p>
      <p className="command-payment-banner__gesture">{CARD_PREVIEW_GESTURE_HINT}</p>

      {!isCategoryUse && selectedCards.length > 0 && (
        <div className="command-payment-banner__selected">
          <div className="command-payment-banner__chips">
            {selectedCards.map(({ instanceId, definition }) => (
              <div key={instanceId} className="command-payment-banner__chip">
                <CardImage
                  card={definition}
                  small
                  hideMeta
                  onPreview={() => onPreviewCard(definition)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {view.prismAvailable && isCategoryUse && onPrismModeChange && (
        <label className="command-payment-banner__prism">
          <input
            type="checkbox"
            checked={usePrism}
            onChange={(e) => onPrismModeChange(e.target.checked)}
          />
          【プリズムパワー】ホールド2枚でカテゴリ支払い（{view.categories.join("・")}不要）
        </label>
      )}

      {!isCategoryUse && (
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
      )}
    </div>
  );
}
