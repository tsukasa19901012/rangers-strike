"use client";

import { EFFECT_LABELS, getCardById } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "@rangers-strike/engine";
import { CardImage } from "./CardImage";
import { GameModalBackdrop } from "./GameModalBackdrop";
import { LongPressPreviewButton } from "./LongPressPreviewButton";

type ShironLightModalProps = {
  state: GameState;
  pending: NonNullable<GameState["pendingEffectChoice"]>;
  viewerId: PlayerId;
  canAct: boolean;
  onPick: (instanceId: string) => void;
  onConfirmReveal: () => void;
  onPreview: (cardId: string) => void;
};

export function ShironLightModal({
  state,
  pending,
  viewerId,
  canAct,
  onPick,
  onConfirmReveal,
  onPreview,
}: ShironLightModalProps) {
  const meta = pending.shironLightMeta;
  if (!meta) return null;

  const owner = state.players[meta.ownerId];
  const label = EFFECT_LABELS.shiron_light ?? "シーロンの光";
  const step = meta.step;

  if (step === "pick") {
    const ownerLabel = meta.ownerId === viewerId ? "自分" : "相手";
    return (
      <GameModalBackdrop>
        <div
          className="modal modal--effect-action"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="shiron-pick-title"
        >
          <div className="modal__content modal__content--effect-action">
            <h3 id="shiron-pick-title" className="effect-action-modal__title">
              【{label}】
            </h3>
            <p className="effect-action-modal__hint">
              {canAct
                ? `${ownerLabel}の手札（裏向き）から1枚選んでください`
                : `相手が${ownerLabel}の手札から1枚選んでいます…`}
            </p>
            <div className="pile-modal__grid">
              {owner.hand.map((card) => {
                const definition = getCardById(card.cardId);
                const selectable = canAct && pending.validInstanceIds.includes(card.instanceId);
                return (
                  <div
                    key={card.instanceId}
                    className={[
                      "pile-modal__card",
                      selectable ? "pile-modal__card--target" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <CardImage
                      card={definition}
                      small
                      faceDown
                      onSelect={selectable ? () => onPick(card.instanceId) : undefined}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </GameModalBackdrop>
    );
  }

  const pickedId = meta.pickedInstanceId ?? pending.viewedInstanceIds?.[0];
  const picked = pickedId
    ? owner.hand.find((c) => c.instanceId === pickedId)
    : undefined;
  const pickedCard = picked ? getCardById(picked.cardId) : undefined;
  const isUnit = pickedCard?.type === "unit";

  return (
    <GameModalBackdrop>
      <div
        className="modal modal--effect-action"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shiron-reveal-title"
      >
        <div className="modal__content modal__content--effect-action">
          <h3 id="shiron-reveal-title" className="effect-action-modal__title">
            【{label}】公開
          </h3>
          <p className="effect-action-modal__hint">
            {canAct
              ? "選ばれたカードを確認してください"
              : "相手に選ばれたカードが公開されました"}
          </p>
          {pickedCard && (
            <LongPressPreviewButton
              type="button"
              className="btn effect-action-modal__target effect-action-modal__target--preview"
              onPreview={() => onPreview(pickedCard.id)}
            >
              {pickedCard.name}
              <span className="effect-action-modal__target-meta">
                {isUnit ? "ユニット（ラッシュに出せます）" : "ユニット以外"}
              </span>
            </LongPressPreviewButton>
          )}
          {canAct && (
            <div className="effect-action-modal__actions">
              <button type="button" className="btn btn--primary" onClick={onConfirmReveal}>
                確認して続ける
              </button>
            </div>
          )}
          {meta.ownerId === viewerId && isUnit && (
            <p className="effect-action-modal__target-meta">
              ユニットなら、通常どおり手札からラッシュエリアへ出せます。
            </p>
          )}
        </div>
      </div>
    </GameModalBackdrop>
  );
}
