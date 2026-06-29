"use client";

import type { CardDefinition } from "@rangers-strike/cards";
import { CardImage } from "./CardImage";
import { GameModalBackdrop } from "./GameModalBackdrop";

type RideOffModalProps = {
  riderCard: CardDefinition;
  vehicleCard?: CardDefinition;
  onRideOff: () => void;
  onStayMounted: () => void;
};

export function RideOffModal({
  riderCard,
  vehicleCard,
  onRideOff,
  onStayMounted,
}: RideOffModalProps) {
  return (
    <GameModalBackdrop>
      <div
        className="modal modal--ride-off"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ride-off-title"
      >
        <div className="modal__content modal__content--ride-off">
          <h3 id="ride-off-title" className="ride-off-modal__title">
            ライドオフ
          </h3>
          <p className="ride-off-modal__lead">
            「{riderCard.name}」はライドしたままバトルエリアに出ました。アタックやストライクの前に、ライドオフしますか？
            {riderCard.comboNumber === "RC" &&
              " ライドオフするとライディングコンボを発動できます。"}
          </p>

          <div className="ride-off-modal__stack">
            {vehicleCard && (
              <div className="ride-off-modal__vehicle">
                <CardImage card={vehicleCard} small hideMeta />
              </div>
            )}
            <div className="ride-off-modal__rider">
              <CardImage card={riderCard} small hideMeta />
            </div>
          </div>

          <div className="ride-off-modal__actions">
            <button
              type="button"
              className="btn btn--primary ride-off-modal__action"
              onClick={onRideOff}
            >
              ライドオフする
              {riderCard.comboNumber === "RC" && (
                <span className="ride-off-modal__detail">ライディングコンボを発動</span>
              )}
            </button>
            <button
              type="button"
              className="btn ride-off-modal__action"
              onClick={onStayMounted}
            >
              ライドを維持
            </button>
          </div>
        </div>
      </div>
    </GameModalBackdrop>
  );
}
