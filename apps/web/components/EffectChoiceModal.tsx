"use client";

import type { CardDefinition } from "@rangers-strike/cards";
import { getCardById } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "@rangers-strike/engine";
import { effectChoiceHint, effectChoiceTitle } from "@/lib/effectChoiceHint";
import {
  cardTargetMetaLine,
  resolveCardTargets,
  type CardTarget,
} from "@/lib/cardTargets";
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
  onSeabedDraw: (placement: "top" | "bottom") => void;
  onOptionalDraw: () => void;
  onConfirmDenjiReveal: () => void;
  onConfirmEffectChoice: () => void;
  onPreview: (card: CardDefinition) => void;
  /** Opponent / spectator: reveal step only (no confirm). */
  readOnly?: boolean;
};

function TargetButton({
  target,
  chooserPlayerId,
  onSelect,
}: {
  target: CardTarget;
  chooserPlayerId: PlayerId;
  onSelect: () => void;
}) {
  return (
    <button type="button" className="btn effect-action-modal__target" onClick={onSelect}>
      {target.card.name}
      <span className="effect-action-modal__target-meta">
        {cardTargetMetaLine(target, chooserPlayerId)}
      </span>
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
  onSeabedDraw,
  onOptionalDraw,
  onConfirmDenjiReveal,
  onConfirmEffectChoice,
  onPreview,
  readOnly = false,
}: EffectChoiceModalProps) {
  const title = effectChoiceTitle(pending);
  const hint = effectChoiceHint(pending);
  const sourceCard = getCardById(pending.sourceCardId);

  const targets = resolveCardTargets(state, pending.validInstanceIds);
  const bpBudgetSelected = new Set(pending.selectedInstanceIds ?? []);
  const bpBudgetTotal = targets
    .filter((t) => bpBudgetSelected.has(t.instanceId))
    .reduce((sum, t) => sum + (t.card.bp ?? 0), 0);
  const bpBudgetLimit = pending.bpBudget ?? 3000;

  const scryTop =
    pending.kind === "deck_top_or_bottom"
      ? state.players[playerId].deck[0]
      : null;
  const scryCard =
    scryTop && pending.viewedInstanceIds?.[0] === scryTop.instanceId
      ? getCardById(scryTop.cardId)
      : null;

  const denjiReveal =
    pending.kind === "denji_machine" && pending.denjiMachineMeta?.step === "reveal"
      ? (pending.viewedInstanceIds ?? [])
          .map((id) => {
            const ownerId = pending.playerId;
            const inst = state.players[ownerId].deck.find((c) => c.instanceId === id);
            if (!inst) return null;
            const card = getCardById(inst.cardId);
            const toHand = pending.denjiMachineMeta?.toHandInstanceIds.includes(id);
            return card
              ? { instanceId: inst.instanceId, card, toHand }
              : null;
          })
          .filter((e): e is { instanceId: string; card: CardDefinition; toHand: boolean } => !!e)
      : [];

  const denjiOrder =
    pending.kind === "denji_machine" && pending.denjiMachineMeta?.step === "order_bottom"
      ? (pending.denjiMachineMeta.limboBottomCards ?? [])
          .map((inst) => {
            const card = getCardById(inst.cardId);
            return card ? { instanceId: inst.instanceId, card } : null;
          })
          .filter((e): e is { instanceId: string; card: CardDefinition } => !!e)
      : [];

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

          {pending.kind === "seabed_draw" && (
            <div className="effect-action-modal__actions">
              <button type="button" className="btn" onClick={() => onSeabedDraw("top")}>
                上から引く
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => onSeabedDraw("bottom")}
              >
                下から引く
              </button>
            </div>
          )}

          {pending.kind === "denji_machine" && denjiReveal.length > 0 && (
            <div className="effect-action-modal__section">
              <p className="effect-action-modal__target-meta">
                {readOnly ? "相手の山札上3枚（公開）" : "山札の上3枚（相手に公開）"}
              </p>
              <div className="effect-action-modal__targets">
                {denjiReveal.map(({ instanceId, card, toHand }) => (
                  <button
                    key={instanceId}
                    type="button"
                    className="btn effect-action-modal__target effect-action-modal__target--preview"
                    onClick={() => onPreview(card)}
                  >
                    {card.name}
                    <span className="effect-action-modal__target-meta">
                      {toHand ? "→ 手札" : "→ 山札の下へ"}
                    </span>
                  </button>
                ))}
              </div>
              {!readOnly && (
                <div className="effect-action-modal__actions">
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={onConfirmDenjiReveal}
                  >
                    公開を確認して続ける
                  </button>
                </div>
              )}
            </div>
          )}

          {pending.kind === "denji_machine" && denjiOrder.length > 0 && (
            <div className="effect-action-modal__targets">
              {denjiOrder
                .filter((c) => pending.validInstanceIds.includes(c.instanceId))
                .map(({ instanceId, card }) => (
                  <button
                    key={instanceId}
                    type="button"
                    className="btn effect-action-modal__target"
                    onClick={() => onSelect(instanceId)}
                  >
                    {card.name}
                    <span className="effect-action-modal__target-meta">次に下へ</span>
                  </button>
                ))}
            </div>
          )}

          {pending.kind === "select_units_bp_budget" && targets.length > 0 && (
            <div className="effect-action-modal__section">
              <p className="effect-action-modal__target-meta">
                表記BP合計: {bpBudgetTotal} / {bpBudgetLimit}
              </p>
              <div className="effect-action-modal__targets">
                {targets.map((target) => {
                  const printedBp = target.card.bp ?? 0;
                  const selected = bpBudgetSelected.has(target.instanceId);
                  const wouldExceed =
                    !selected && bpBudgetTotal + printedBp > bpBudgetLimit;
                  return (
                    <button
                      key={target.instanceId}
                      type="button"
                      className={`btn effect-action-modal__target${selected ? " effect-action-modal__target--selected" : ""}`}
                      disabled={readOnly || wouldExceed}
                      onClick={() => onSelect(target.instanceId)}
                    >
                      {target.card.name}
                      <span className="effect-action-modal__target-meta">
                        {cardTargetMetaLine(target, playerId)} · BP{" "}
                        {printedBp.toLocaleString()}
                      </span>
                    </button>
                  );
                })}
              </div>
              {!readOnly && (
                <div className="effect-action-modal__actions">
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={onConfirmEffectChoice}
                  >
                    選択を確定
                  </button>
                  {canSkip && (
                    <button type="button" className="btn" onClick={onSkip}>
                      {skipLabel}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {pending.kind === "optional_deck_draw" && (
            <div className="effect-action-modal__actions">
              <button type="button" className="btn btn--primary" onClick={onOptionalDraw}>
                1枚ドローする
              </button>
            </div>
          )}

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
            pending.kind !== "seabed_draw" &&
            pending.kind !== "optional_deck_draw" &&
            pending.kind !== "denji_machine" &&
            pending.kind !== "select_units_bp_budget" &&
            pending.kind !== "scry_keep_one" && (
              <div className="effect-action-modal__targets">
                {targets.map((target) => (
                  <TargetButton
                    key={target.instanceId}
                    target={target}
                    chooserPlayerId={playerId}
                    onSelect={() => onSelect(target.instanceId)}
                  />
                ))}
              </div>
            )}

          {canSkip && !readOnly && pending.kind !== "denji_machine" && pending.kind !== "select_units_bp_budget" && (
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
