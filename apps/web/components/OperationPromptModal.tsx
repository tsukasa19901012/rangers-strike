"use client";

import { EFFECT_LABELS, getCardById } from "@rangers-strike/cards";
import type { GameState } from "@rangers-strike/engine";
import { resolveCardTargets } from "@/lib/cardTargets";
import type { PendingOperation, PendingZordRush } from "@/lib/dnd";

type OperationPromptModalProps = {
  state: GameState;
  pendingOp: PendingOperation | null;
  pendingZord: PendingZordRush | null;
  targetInstanceIds: string[];
  discardOnlyIds: Set<string> | null;
  onSelectTarget: (instanceId: string) => void;
  onCancel: () => void;
};

export function OperationPromptModal({
  state,
  pendingOp,
  pendingZord,
  targetInstanceIds,
  discardOnlyIds,
  onSelectTarget,
  onCancel,
}: OperationPromptModalProps) {
  if (!pendingOp && !pendingZord) return null;

  const opCard = pendingOp
    ? getCardById(pendingOp.cardId)
    : pendingZord
      ? getCardById(pendingZord.cardId)
      : null;
  const effectId = pendingOp?.effectId;
  const effectLabel = effectId ? (EFFECT_LABELS[effectId] ?? effectId) : "ゾードアップ";

  const targets = resolveCardTargets(state, [...targetInstanceIds]);
  const fieldTargets = discardOnlyIds
    ? targets.filter((t) => !discardOnlyIds.has(t.instanceId))
    : targets;
  const discardTargets = discardOnlyIds
    ? targets.filter((t) => discardOnlyIds.has(t.instanceId))
    : [];

  const hint = pendingZord
    ? "合体ユニットまたはSユニットを選んでください"
    : pendingOp?.targetType === "discard_any" ||
        pendingOp?.targetType === "discard_s_unit" ||
        pendingOp?.targetType === "discard_mecha"
      ? discardTargets.length > 0 && fieldTargets.length > 0
        ? "捨札または場のカードから対象を選んでください"
        : discardTargets.length > 0
          ? "捨札から対象を選んでください"
          : "対象を選んでください"
      : pendingOp?.targetType === "enemy_field_unit" ||
          pendingOp?.targetType === "enemy_battle_unit" ||
          pendingOp?.targetType === "enemy_field_unit_bp8000"
        ? "相手のユニットを選んでください"
        : "対象を選んでください";

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal modal--effect-action"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="operation-prompt-title"
      >
        <div className="modal__content modal__content--effect-action">
          <h3 id="operation-prompt-title" className="effect-action-modal__title">
            【{effectLabel}】
          </h3>
          {opCard && (
            <p className="effect-action-modal__source">「{opCard.name}」を使用中</p>
          )}
          <p className="effect-action-modal__hint">{hint}</p>

          {fieldTargets.length > 0 && (
            <div className="effect-action-modal__section">
              {discardTargets.length > 0 && (
                <p className="effect-action-modal__label">場のカード</p>
              )}
              <div className="effect-action-modal__targets">
                {fieldTargets.map((target) => (
                  <button
                    key={target.instanceId}
                    type="button"
                    className="btn effect-action-modal__target"
                    onClick={() => onSelectTarget(target.instanceId)}
                  >
                    {target.card.name}
                    <span className="effect-action-modal__target-meta">{target.zoneLabel}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {discardTargets.length > 0 && (
            <div className="effect-action-modal__section">
              <p className="effect-action-modal__label">捨札</p>
              <div className="effect-action-modal__targets">
                {discardTargets.map((target) => (
                  <button
                    key={target.instanceId}
                    type="button"
                    className="btn effect-action-modal__target"
                    onClick={() => onSelectTarget(target.instanceId)}
                  >
                    {target.card.name}
                    <span className="effect-action-modal__target-meta">捨札</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button type="button" className="btn effect-action-modal__skip" onClick={onCancel}>
            選択をキャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
