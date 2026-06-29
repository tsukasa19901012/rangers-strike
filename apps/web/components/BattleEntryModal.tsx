"use client";

import type { CardDefinition } from "@rangers-strike/cards";
import { CARD_PREVIEW_GESTURE_HINT } from "@/lib/commandPaymentUi";
import { CardImage } from "./CardImage";
import { GameModalBackdrop } from "./GameModalBackdrop";

export type BattleEntryTarget = {
  instanceId: string;
  card: CardDefinition;
  zone: "battle" | "rush";
};

type BattleEntryModalProps = {
  unitCard: CardDefinition;
  unitSpLabel: string;
  unitBp: number;
  strikeDamage: number;
  canStrike: boolean;
  targets: BattleEntryTarget[];
  variant?: "battle_entry" | "wing";
  onStrike: () => void;
  onAttack: (defenderInstanceId: string) => void;
  onPass: () => void;
  onPreviewCard?: (card: CardDefinition) => void;
};

export function BattleEntryModal({
  unitCard,
  unitSpLabel,
  unitBp,
  strikeDamage,
  canStrike,
  targets,
  variant = "battle_entry",
  onStrike,
  onAttack,
  onPass,
  onPreviewCard,
}: BattleEntryModalProps) {
  const isWing = variant === "wing";
  const title = isWing ? "ウイング" : "バトルアクション";
  const unitLead = isWing
    ? `「${unitCard.name}」をホールドしてラッシュからアタック`
    : `「${unitCard.name}」の行動を選んでください`;
  const passLabel = isWing ? "やめる" : "何もしない";
  const showStrike = canStrike && !isWing;

  return (
    <GameModalBackdrop>
      <div
        className="modal modal--battle-entry"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="battle-entry-title"
      >
        <div className="modal__content modal__content--battle-entry">
          <h3 id="battle-entry-title" className="battle-entry-modal__title">
            {title}
          </h3>
          <p className="battle-entry-modal__unit">{unitLead}</p>
          <p className="battle-entry-modal__stats">
            <span>{unitSpLabel}</span>
            <span>BP {unitBp.toLocaleString()}</span>
          </p>

          <div className="battle-entry-modal__actions">
            {showStrike && (
              <button
                type="button"
                className="btn btn--primary battle-entry-modal__action"
                onClick={onStrike}
              >
                ストライク
                <span className="battle-entry-modal__detail">
                  {strikeDamage}ダメージ
                </span>
              </button>
            )}

            {targets.length > 0 && (
              <div className="battle-entry-modal__group">
                <p className="battle-entry-modal__label">アタック</p>
                <div className="battle-entry-modal__targets">
                  {targets.map((target) => (
                    <div key={target.instanceId} className="battle-entry-modal__target">
                      <button
                        type="button"
                        className="battle-entry-modal__target-btn"
                        onClick={() => onAttack(target.instanceId)}
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
                      <span className="battle-entry-modal__target-zone">
                        {target.zone === "rush" ? "ラッシュ" : "バトル"}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="battle-entry-modal__gesture">{CARD_PREVIEW_GESTURE_HINT}</p>
              </div>
            )}

            <button
              type="button"
              className="btn battle-entry-modal__action battle-entry-modal__action--pass"
              onClick={onPass}
            >
              {passLabel}
            </button>
          </div>
        </div>
      </div>
    </GameModalBackdrop>
  );
}
