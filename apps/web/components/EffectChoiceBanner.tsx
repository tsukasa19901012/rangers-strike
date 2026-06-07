"use client";

import { CARD_PREVIEW_GESTURE_HINT } from "@/lib/commandPaymentUi";
import type { BoardTapEffectChoiceView } from "@/lib/effectChoiceBoardTap";

type EffectChoiceBannerProps = {
  view: BoardTapEffectChoiceView;
  canSkip: boolean;
  skipLabel: string;
  onSkip: () => void;
};

export function EffectChoiceBanner({
  view,
  canSkip,
  skipLabel,
  onSkip,
}: EffectChoiceBannerProps) {
  return (
    <div
      className="damage-payment-banner command-payment-banner effect-choice-banner"
      role="status"
      aria-live="polite"
    >
      <p className="damage-payment-banner__title">{view.title}</p>
      {view.sourceLine && (
        <p className="damage-payment-banner__sub">{view.sourceLine}</p>
      )}
      <p className="damage-payment-banner__hint">{view.hint}</p>
      <p className="damage-payment-banner__sub">{view.zoneHint}</p>
      <p className="command-payment-banner__gesture">{CARD_PREVIEW_GESTURE_HINT}</p>

      {canSkip && (
        <div className="command-payment-banner__actions">
          <button type="button" className="btn" onClick={onSkip}>
            {skipLabel}
          </button>
        </div>
      )}
    </div>
  );
}
