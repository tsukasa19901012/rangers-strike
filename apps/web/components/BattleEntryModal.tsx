"use client";

import type { CardDefinition } from "@rangers-strike/cards";
import { GameModalBackdrop } from "./GameModalBackdrop";

export type BattleEntryTarget = {
  instanceId: string;
  card: CardDefinition;
  zone: "battle" | "rush";
};

type BattleEntryModalProps = {
  unitCard: CardDefinition;
  strikeDamage: number;
  canStrike: boolean;
  targets: BattleEntryTarget[];
  onStrike: () => void;
  onAttack: (defenderInstanceId: string) => void;
  onPass: () => void;
};

export function BattleEntryModal({
  unitCard,
  strikeDamage,
  canStrike,
  targets,
  onStrike,
  onAttack,
  onPass,
}: BattleEntryModalProps) {
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
            バトルアクション
          </h3>
          <p className="battle-entry-modal__unit">
            「{unitCard.name}」の行動を選んでください
          </p>

          <div className="battle-entry-modal__actions">
            {canStrike && (
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
                {targets.map((target) => (
                  <button
                    key={target.instanceId}
                    type="button"
                    className="btn battle-entry-modal__action"
                    onClick={() => onAttack(target.instanceId)}
                  >
                    {target.card.name}
                    <span className="battle-entry-modal__detail">
                      {target.zone === "rush" ? "ラッシュ" : "バトル"}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              className="btn battle-entry-modal__action battle-entry-modal__action--pass"
              onClick={onPass}
            >
              何もしない
            </button>
          </div>
        </div>
      </div>
    </GameModalBackdrop>
  );
}
