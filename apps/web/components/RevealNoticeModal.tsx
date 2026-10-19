"use client";

import { resolvePlayableCard } from "@rangers-strike/cards";
import type { RevealNoticeView } from "@/lib/revealNoticeUi";
import { CardImage } from "./CardImage";
import { GameModalBackdrop } from "./GameModalBackdrop";

type RevealNoticeModalProps = {
  view: RevealNoticeView;
  onClose: () => void;
  onPreview: (cardId: string) => void;
};

/** 効果でオモテにした（公開した）カードを両プレイヤーに見せる。OK を押すまで閉じない。 */
export function RevealNoticeModal({ view, onClose, onPreview }: RevealNoticeModalProps) {
  return (
    <GameModalBackdrop>
      <div
        className="modal modal--effect-action modal--reveal-notice"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reveal-notice-title"
        aria-describedby="reveal-notice-summary"
      >
        <div className="modal__content modal__content--effect-action">
          <h3 id="reveal-notice-title" className="effect-action-modal__title">
            {view.title}
          </h3>
          <p id="reveal-notice-summary" className="effect-action-modal__hint">
            {view.summary}
          </p>
          {view.declaredText && (
            <p className="effect-action-modal__hint">{view.declaredText}</p>
          )}
          <div className="pile-modal__grid">
            {view.cards.map((card) => (
              <div key={card.instanceId} className="pile-modal__card">
                <CardImage
                  card={resolvePlayableCard(card.cardId)}
                  small
                  onPreview={() => onPreview(card.cardId)}
                />
                <p className="effect-action-modal__target-meta">
                  {card.name}（必要パワー {card.powerCostText}）
                </p>
                <p className="effect-action-modal__target-meta">→ {card.destinationLabel}</p>
              </div>
            ))}
          </div>
          <div className="effect-action-modal__actions">
            <button type="button" className="btn btn--primary" onClick={onClose}>
              OK
            </button>
          </div>
        </div>
      </div>
    </GameModalBackdrop>
  );
}
