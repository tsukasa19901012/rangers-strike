import { useMemo } from "react";
import type { DeckEntry } from "@rangers-strike/cards";
import {
  estimateDeckWarnings,
  formatDeckWarningMessage,
  type DeckWarningEstimate,
} from "@/lib/deckWarnings";

const SS06_SUPPLEMENT = "一部カードは効果 UI 未対応の場合があります";

type DeckWarningBannerProps = {
  entries?: DeckEntry[];
  estimate?: DeckWarningEstimate;
  showSupplement?: boolean;
};

export function DeckWarningBanner({
  entries,
  estimate: estimateProp,
  showSupplement = true,
}: DeckWarningBannerProps) {
  const estimate = useMemo(
    () =>
      estimateProp ??
      (entries ? estimateDeckWarnings(entries) : { uiUncertainCount: 0, uncertainCardIds: [] }),
    [entries, estimateProp],
  );
  const message = formatDeckWarningMessage(estimate);
  if (!message) return null;

  return (
    <div className="deck-warning-banner" role="status">
      <p className="deck-warning-banner__message">{message}</p>
      {showSupplement && (
        <p className="deck-warning-banner__supplement">{SS06_SUPPLEMENT}</p>
      )}
    </div>
  );
}

export { SS06_SUPPLEMENT };
