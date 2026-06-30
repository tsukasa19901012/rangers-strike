"use client";

import type { CardDefinition } from "@rangers-strike/cards";
import { CardImage } from "./CardImage";
import { GameModalBackdrop } from "./GameModalBackdrop";

type RegisterModalProps = {
  unitCard: CardDefinition;
  onHold: () => void;
  onDiscard: () => void;
};

export function RegisterModal({ unitCard, onHold, onDiscard }: RegisterModalProps) {
  return (
    <GameModalBackdrop>
      <div
        className="modal modal--register"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-title"
      >
        <div className="modal__content modal__content--register">
          <h3 id="register-title" className="ride-off-modal__title">
            レジスト
          </h3>
          <p className="ride-off-modal__lead">
            「{unitCard.name}」はバトルで撃破されました。捨札にするかわりに、このユニットをホールドしてバトルエリアに留めますか？
          </p>

          <div className="ride-off-modal__stack">
            <div className="ride-off-modal__rider">
              <CardImage card={unitCard} small hideMeta />
            </div>
          </div>

          <div className="ride-off-modal__actions">
            <button
              type="button"
              className="btn btn--primary ride-off-modal__action"
              onClick={onHold}
            >
              ホールドして留める
            </button>
            <button type="button" className="btn ride-off-modal__action" onClick={onDiscard}>
              捨札にする
            </button>
          </div>
        </div>
      </div>
    </GameModalBackdrop>
  );
}
