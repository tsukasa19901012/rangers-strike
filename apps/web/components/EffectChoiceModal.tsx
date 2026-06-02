"use client";

import type { CardDefinition } from "@rangers-strike/cards";
import { getCardById } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "@rangers-strike/engine";
import { effectChoiceHint, effectChoiceTitle } from "@/lib/effectChoiceHint";
import { resolveCardTargets, type CardTarget } from "@/lib/cardTargets";
import { GameModalBackdrop } from "./GameModalBackdrop";

type EffectChoiceModalProps = {
  state: GameState;
  playerId: PlayerId;
  pending: NonNullable<GameState["pendingEffectChoice"]>;
  canSkip: boolean;
  skipLabel: string;
  onSelect: (instanceId: string) => void;
  onSkip: () => void;
  onRuinSurvey: (placement: "top" | "bottom") => void;
  onPreview: (card: CardDefinition) => void;
};

function TargetButton({
  target,
  onSelect,
}: {
  target: CardTarget;
  onSelect: () => void;
}) {
  return (
    <button type="button" className="btn effect-action-modal__target" onClick={onSelect}>
      {target.card.name}
      <span className="effect-action-modal__target-meta">{target.zoneLabel}</span>
    </button>
  );
}

export function EffectChoiceModal({
  state,
  playerId,
  pending,
  canSkip,
  skipLabel,
  onSelect,
  onSkip,
  onRuinSurvey,
  onPreview,
}: EffectChoiceModalProps) {
  const title = effectChoiceTitle(pending);
  const hint = effectChoiceHint(pending);
  const sourceCard = getCardById(pending.sourceCardId);

  const targets = resolveCardTargets(state, pending.validInstanceIds);

  const scryTop =
    pending.kind === "deck_top_or_bottom"
      ? state.players[playerId].deck[0]
      : null;
  const scryCard =
    scryTop && pending.viewedInstanceIds?.[0] === scryTop.instanceId
      ? getCardById(scryTop.cardId)
      : null;

  const scryKeep =
    pending.kind === "scry_keep_one"
      ? (pending.viewedInstanceIds ?? [])
          .map((id) => {
            const inst = state.players[playerId].deck.find((c) => c.instanceId === id);
            if (!inst) return null;
            const card = getCardById(inst.cardId);
            return card ? { instanceId: inst.instanceId, card } : null;
          })
          .filter((e): e is { instanceId: string; card: CardDefinition } => !!e)
      : [];

  return (
    <GameModalBackdrop>
      <div
        className="modal modal--effect-action"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="effect-choice-title"
      >
        <div className="modal__content modal__content--effect-action">
          <h3 id="effect-choice-title" className="effect-action-modal__title">
            {title}
          </h3>
          {sourceCard && (
            <p className="effect-action-modal__source">「{sourceCard.name}」の効果</p>
          )}
          <p className="effect-action-modal__hint">{hint}</p>

          {pending.kind === "deck_top_or_bottom" && scryCard && (
            <div className="effect-action-modal__section">
              <button
                type="button"
                className="btn effect-action-modal__target effect-action-modal__target--preview"
                onClick={() => onPreview(scryCard)}
              >
                {scryCard.name}
                <span className="effect-action-modal__target-meta">山札上を確認</span>
              </button>
              <div className="effect-action-modal__actions">
                <button type="button" className="btn" onClick={() => onRuinSurvey("top")}>
                  山札の上に戻す
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => onRuinSurvey("bottom")}
                >
                  山札の下に戻す
                </button>
              </div>
            </div>
          )}

          {pending.kind === "scry_keep_one" && scryKeep.length > 0 && (
            <div className="effect-action-modal__targets">
              {scryKeep.map(({ instanceId, card }) => (
                <button
                  key={instanceId}
                  type="button"
                  className="btn effect-action-modal__target"
                  onClick={() => onSelect(instanceId)}
                >
                  {card.name}
                  <span className="effect-action-modal__target-meta">残す</span>
                </button>
              ))}
            </div>
          )}

          {targets.length > 0 &&
            pending.kind !== "deck_top_or_bottom" &&
            pending.kind !== "scry_keep_one" && (
              <div className="effect-action-modal__targets">
                {targets.map((target) => (
                  <TargetButton
                    key={target.instanceId}
                    target={target}
                    onSelect={() => onSelect(target.instanceId)}
                  />
                ))}
              </div>
            )}

          {canSkip && (
            <button
              type="button"
              className="btn effect-action-modal__skip"
              onClick={onSkip}
            >
              {skipLabel}
            </button>
          )}
        </div>
      </div>
    </GameModalBackdrop>
  );
}
