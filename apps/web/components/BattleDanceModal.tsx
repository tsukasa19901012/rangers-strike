"use client";

import { useMemo, useState } from "react";
import { EFFECT_LABELS, getCardById } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "@rangers-strike/engine";
import { cardTargetMetaLine, resolveCardTargets } from "@/lib/cardTargets";
import {
  explainBattleDanceUnavailable,
  listBattleDanceReleasedCommandIds,
  listBattleDanceTargetsForCommands,
} from "@/lib/battleDanceUi";
import { CardImage } from "./CardImage";
import { GameModalBackdrop } from "./GameModalBackdrop";

type BattleDanceModalProps = {
  state: GameState;
  playerId: PlayerId;
  operationCardId: string;
  legalActions: import("@rangers-strike/engine").GameAction[];
  onConfirm: (commandInstanceIds: [string, string], battleInstanceId: string) => void;
  onCancel: () => void;
  onPreview: (cardId: string) => void;
};

export function BattleDanceModal({
  state,
  playerId,
  operationCardId,
  legalActions,
  onConfirm,
  onCancel,
  onPreview,
}: BattleDanceModalProps) {
  const [selectedCommandIds, setSelectedCommandIds] = useState<string[]>([]);
  const [step, setStep] = useState<"commands" | "unit">("commands");

  const opCard = getCardById(operationCardId);
  const effectLabel = EFFECT_LABELS.battle_dance ?? "バトルダンス";
  const releasedIds = useMemo(
    () => new Set(listBattleDanceReleasedCommandIds(state, playerId)),
    [playerId, state],
  );
  const commandCards = state.players[playerId].command.filter((card) =>
    releasedIds.has(card.instanceId),
  );
  const unavailableReason = explainBattleDanceUnavailable(state, playerId);

  const selectedPair =
    selectedCommandIds.length === 2
      ? ([selectedCommandIds[0]!, selectedCommandIds[1]!] as [string, string])
      : null;
  const unitTargetIds = selectedPair
    ? listBattleDanceTargetsForCommands(legalActions, selectedPair)
    : [];
  const unitTargets = resolveCardTargets(state, unitTargetIds);

  const toggleCommand = (instanceId: string) => {
    setSelectedCommandIds((current) => {
      if (current.includes(instanceId)) {
        return current.filter((id) => id !== instanceId);
      }
      if (current.length >= 2) return current;
      return [...current, instanceId];
    });
  };

  const goToUnitStep = () => {
    if (selectedCommandIds.length !== 2) return;
    setStep("unit");
  };

  return (
    <GameModalBackdrop>
      <div
        className="modal modal--effect-action"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="battle-dance-title"
      >
        <div className="modal__content modal__content--effect-action">
          <h3 id="battle-dance-title" className="effect-action-modal__title">
            【{effectLabel}】
          </h3>
          {opCard && (
            <p className="effect-action-modal__source">「{opCard.name}」を発動</p>
          )}

          {commandCards.length === 0 ? (
            <p className="effect-action-modal__hint">{unavailableReason}</p>
          ) : step === "commands" ? (
            <>
              <p className="effect-action-modal__hint">
                リリース状態のコマンドを2枚選んでホールドします（{selectedCommandIds.length}/2枚選択中）
              </p>
              <div className="pile-modal__grid">
                {commandCards.map((card) => {
                  const definition = getCardById(card.cardId);
                  const selected = selectedCommandIds.includes(card.instanceId);
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
                        onSelect={() => toggleCommand(card.instanceId)}
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
                  disabled={selectedCommandIds.length !== 2}
                  onClick={goToUnitStep}
                >
                  次へ（Sユニットを選ぶ）
                </button>
                <button type="button" className="btn effect-action-modal__skip" onClick={onCancel}>
                  キャンセル
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="effect-action-modal__hint">
                ラッシュエリアに戻す自軍Sユニットを選んでください（このターン再進入不可）
              </p>
              {unitTargets.length > 0 ? (
                <div className="effect-action-modal__targets">
                  {unitTargets.map((target) => (
                    <button
                      key={target.instanceId}
                      type="button"
                      className="btn effect-action-modal__target"
                      onClick={() => {
                        if (!selectedPair) return;
                        onConfirm(selectedPair, target.instanceId);
                      }}
                    >
                      {target.card.name}
                      <span className="effect-action-modal__target-meta">
                        {cardTargetMetaLine(target, playerId)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="effect-action-modal__hint">{unavailableReason}</p>
              )}
              <div className="effect-action-modal__actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setStep("commands")}
                >
                  コマンド選択に戻る
                </button>
                <button type="button" className="btn effect-action-modal__skip" onClick={onCancel}>
                  キャンセル
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </GameModalBackdrop>
  );
}
