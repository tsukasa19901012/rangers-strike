"use client";

import type { CardDefinition } from "@rangers-strike/cards";
import { CARD_PREVIEW_GESTURE_HINT } from "@/lib/commandPaymentUi";
import { CardImage } from "./CardImage";
import { GameModalBackdrop } from "./GameModalBackdrop";

export type ChaseVehicleTarget = {
  instanceId: string;
  card: CardDefinition;
};

type ChaseModalProps = {
  chaserCard: CardDefinition;
  mode?: "rider_leave" | "vehicle_destroyed";
  vehicles: ChaseVehicleTarget[];
  onSelectVehicle: (vehicleInstanceId: string) => void;
  onPass: () => void;
  onPreviewCard?: (card: CardDefinition) => void;
};

export function ChaseModal({
  chaserCard,
  mode,
  vehicles,
  onSelectVehicle,
  onPass,
  onPreviewCard,
}: ChaseModalProps) {
  const lead =
    mode === "vehicle_destroyed"
      ? `「${chaserCard.name}」が乗っていたビークルが破壊されました。別のビークルにチェイスしますか？`
      : `「${chaserCard.name}」が離場します。チェイスで別のビークルに乗り換えますか？`;

  return (
    <GameModalBackdrop>
      <div
        className="modal modal--chase"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chase-title"
      >
        <div className="modal__content modal__content--chase">
          <h3 id="chase-title" className="chase-modal__title">
            チェイス
          </h3>
          <p className="chase-modal__lead">{lead}</p>

          {vehicles.length > 0 ? (
            <div className="chase-modal__group">
              <p className="chase-modal__label">乗り換え先のビークル</p>
              <div className="chase-modal__targets">
                {vehicles.map((target) => (
                  <button
                    key={target.instanceId}
                    type="button"
                    className="chase-modal__target-btn"
                    onClick={() => onSelectVehicle(target.instanceId)}
                  >
                    <CardImage
                      card={target.card}
                      small
                      hideMeta
                      onPreview={
                        onPreviewCard ? () => onPreviewCard(target.card) : undefined
                      }
                    />
                  </button>
                ))}
              </div>
              <p className="chase-modal__gesture">{CARD_PREVIEW_GESTURE_HINT}</p>
            </div>
          ) : (
            <p className="chase-modal__empty">乗り換え可能なビークルがありません。</p>
          )}

          <button type="button" className="btn chase-modal__pass" onClick={onPass}>
            チェイスしない
          </button>
        </div>
      </div>
    </GameModalBackdrop>
  );
}
