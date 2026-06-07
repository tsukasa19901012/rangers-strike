"use client";

import { useMemo, useState } from "react";
import { EFFECT_LABELS, getCardById } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "@rangers-strike/engine";
import { CardImage } from "./CardImage";
import { GameModalBackdrop } from "./GameModalBackdrop";

type CyberSRiderModalProps = {
  state: GameState;
  playerId: PlayerId;
  operationInstanceId: string;
  operationCardId: string;
  validHandInstanceIds: string[];
  canConfirmSelection: (selectedIds: string[]) => boolean;
  onConfirm: (selectedIds: string[]) => void;
  onCancel: () => void;
  onPreview: (cardId: string) => void;
};

export function CyberSRiderModal({
  state,
  playerId,
  operationInstanceId,
  operationCardId,
  validHandInstanceIds,
  canConfirmSelection,
  onConfirm,
  onCancel,
  onPreview,
}: CyberSRiderModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const opCard = getCardById(operationCardId);
  const effectLabel = EFFECT_LABELS.cyber_s_rider ?? "サイバースライダー";
  const validIds = useMemo(() => new Set(validHandInstanceIds), [validHandInstanceIds]);
  const handCards = state.players[playerId].hand.filter(
    (card) => card.instanceId !== operationInstanceId && validIds.has(card.instanceId),
  );
  const canConfirm = canConfirmSelection(selectedIds);

  const toggleCard = (instanceId: string) => {
    setSelectedIds((current) => {
      if (current.includes(instanceId)) {
        return current.filter((id) => id !== instanceId);
      }
      if (current.length >= 2) return current;
      return [...current, instanceId];
    });
  };

  return (
    <GameModalBackdrop>
      <div
        className="modal modal--effect-action"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cyber-s-rider-title"
      >
        <div className="modal__content modal__content--effect-action">
          <h3 id="cyber-s-rider-title" className="effect-action-modal__title">
            【{effectLabel}】
          </h3>
          {opCard && (
            <p className="effect-action-modal__source">「{opCard.name}」を使用中</p>
          )}
          <p className="effect-action-modal__hint">
            手札から最大2枚選び、コマンドゾーンにホールドで置きます（{selectedIds.length}/2枚選択中）
          </p>

          <div className="pile-modal__grid">
            {handCards.map((card) => {
              const definition = getCardById(card.cardId);
              const selected = selectedIds.includes(card.instanceId);
              return (
                <div
                  key={card.instanceId}
                  className={[
                    "pile-modal__card",
                    selected ? "pile-modal__card--target" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <CardImage
                    card={definition}
                    small
                    hideMeta
                    onSelect={() => toggleCard(card.instanceId)}
                    onPreview={() => onPreview(card.cardId)}
                  />
                </div>
              );
            })}
          </div>

          <div className="effect-action-modal__actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={!canConfirm}
              onClick={() => onConfirm(selectedIds)}
            >
              発動する
            </button>
            <button type="button" className="btn effect-action-modal__skip" onClick={onCancel}>
              選択をキャンセル
            </button>
          </div>
        </div>
      </div>
    </GameModalBackdrop>
  );
}
