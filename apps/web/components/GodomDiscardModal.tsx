"use client";

import { useState } from "react";
import { resolvePlayableCard } from "@rangers-strike/cards";
import type { GameAction, GameState, PlayerId } from "@rangers-strike/engine";
import { godomDiscardCandidates, matchGodomVariant, type GodomRushVariant } from "../lib/godomRushUi";
import { CardImage } from "./CardImage";
import { GameModalBackdrop } from "./GameModalBackdrop";

type GodomDiscardModalProps = {
  state: GameState;
  playerId: PlayerId;
  /** ラッシュするカード。 */
  rushCardId: string;
  /** 捨札にする「戦闘員」のユニットの選び方ごとのラッシュの宣言（[] はゴードムを使わない）。 */
  variants: GodomRushVariant[];
  onConfirm: (action: GameAction) => void;
  onCancel: () => void;
  onPreview: (cardId: string) => void;
};

/**
 * RS-586 巨神ゴードム【魔神に不足する物】「必要パワーに足りない数だけ、特徴「戦闘員」を持つユニットを捨札にする」:
 * 捨札にするユニットを選ぶ。アブレラ【闇の取引】等の別の手段でも払えるなら、ゴードムを使わないこともできる。
 */
export function GodomDiscardModal({
  state,
  playerId,
  rushCardId,
  variants,
  onConfirm,
  onCancel,
  onPreview,
}: GodomDiscardModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { candidateIds, needed } = godomDiscardCandidates(variants);
  const decline = matchGodomVariant(variants, []);
  const player = state.players[playerId];
  const cards = [...player.rush, ...player.battle].filter((c) => candidateIds.includes(c.instanceId));
  const match = needed > 0 && selectedIds.length === needed ? matchGodomVariant(variants, selectedIds) : undefined;
  const rushCard = resolvePlayableCard(rushCardId);

  const toggle = (instanceId: string) => {
    setSelectedIds((current) => {
      if (current.includes(instanceId)) return current.filter((id) => id !== instanceId);
      if (current.length >= needed) return current;
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
        aria-labelledby="godom-discard-title"
      >
        <div className="modal__content modal__content--effect-action">
          <h3 id="godom-discard-title" className="effect-action-modal__title">
            【魔神に不足する物】
          </h3>
          {rushCard && <p className="effect-action-modal__source">「{rushCard.name}」をラッシュ</p>}
          <p className="effect-action-modal__hint">
            必要パワーに足りない数だけ、特徴「戦闘員」を持つユニットを捨札にします（{selectedIds.length}/{needed}体選択中）
          </p>

          <div className="pile-modal__grid">
            {cards.map((card) => {
              const definition = resolvePlayableCard(card.cardId);
              const selected = selectedIds.includes(card.instanceId);
              return (
                <div
                  key={card.instanceId}
                  className={["pile-modal__card", selected ? "pile-modal__card--target" : ""].filter(Boolean).join(" ")}
                >
                  <CardImage
                    card={definition}
                    small
                    hideMeta
                    onSelect={() => toggle(card.instanceId)}
                    onPreview={() => onPreview(card.cardId)}
                  />
                </div>
              );
            })}
          </div>

          <div className="effect-action-modal__actions">
            <button type="button" className="btn btn--primary" disabled={!match} onClick={() => match && onConfirm(match)}>
              捨札にしてラッシュする
            </button>
            {decline && (
              <button type="button" className="btn" onClick={() => onConfirm(decline)}>
                ゴードムを使わずにラッシュする
              </button>
            )}
            <button type="button" className="btn effect-action-modal__skip" onClick={onCancel}>
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </GameModalBackdrop>
  );
}
