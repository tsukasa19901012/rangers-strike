"use client";

import type { GameState, PendingZordSetup, PlayerId } from "@rangers-strike/engine";
import { CARD_PREVIEW_GESTURE_HINT } from "@/lib/commandPaymentUi";
import {
  zordSetupHint,
  zordSetupLegalFlags,
  zordSetupTitle,
  zordSetupZoneHint,
} from "@/lib/zordSetupUi";

type ZordSetupBannerProps = {
  state: GameState;
  playerId: PlayerId;
  setup: PendingZordSetup;
  validTargetIds: Set<string>;
  onSelectDestination: (destination: "command" | "discard") => void;
  onUseMothership?: () => void;
  onContinue: () => void;
  onCancel: () => void;
};

export function ZordSetupBanner({
  state,
  playerId,
  setup,
  validTargetIds,
  onSelectDestination,
  onUseMothership,
  onContinue,
  onCancel,
}: ZordSetupBannerProps) {
  const { canPickCommand, canPickDiscard, canUseMothership } = zordSetupLegalFlags(
    state,
    setup,
  );
  const zoneHint =
    setup.step === "material"
      ? zordSetupZoneHint(state, playerId, validTargetIds)
      : undefined;

  return (
    <div
      className="damage-payment-banner command-payment-banner zord-setup-banner"
      role="status"
      aria-live="polite"
    >
      <p className="damage-payment-banner__title">{zordSetupTitle(setup)}</p>
      <p className="damage-payment-banner__hint">{zordSetupHint(setup)}</p>
      {zoneHint && <p className="damage-payment-banner__sub">{zoneHint}</p>}
      {setup.step === "material" && validTargetIds.size > 0 && (
        <p className="command-payment-banner__gesture">{CARD_PREVIEW_GESTURE_HINT}</p>
      )}

      {setup.step === "destination" && (canPickCommand || canPickDiscard) && (
        <div className="command-payment-banner__actions">
          {canPickCommand && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => onSelectDestination("command")}
            >
              コマンドゾーンに置く
            </button>
          )}
          {canPickDiscard && (
            <button
              type="button"
              className="btn"
              onClick={() => onSelectDestination("discard")}
            >
              捨て札にする
            </button>
          )}
        </div>
      )}

      {setup.step === "material" &&
        setup.mothershipAvailable &&
        onUseMothership &&
        canUseMothership && (
          <div className="command-payment-banner__actions">
            <button type="button" className="btn" onClick={onUseMothership}>
              母艦で支払う（コマンドをホールド）
            </button>
          </div>
        )}

      {setup.step === "mothership" && (
        <div className="command-payment-banner__actions">
          <button type="button" className="btn btn--primary" onClick={onContinue}>
            続ける
          </button>
        </div>
      )}

      <div className="command-payment-banner__actions">
        <button type="button" className="btn" onClick={onCancel}>
          キャンセル
        </button>
      </div>
    </div>
  );
}
