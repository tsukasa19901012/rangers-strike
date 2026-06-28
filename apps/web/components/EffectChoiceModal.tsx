"use client";

import type { CardDefinition } from "@rangers-strike/cards";
import { resolvePlayableCard } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "@rangers-strike/engine";
import {
  effectChoiceHint,
  effectChoiceTitle,
  sagasSniperDeckCardMeta,
} from "@/lib/effectChoiceHint";
import {
  cardTargetMetaLine,
  resolveCardTargets,
  type CardTarget,
} from "@/lib/cardTargets";
import { isKnownEffectChoice } from "@/lib/webUiEffectCoverage";
import { GameModalBackdrop } from "./GameModalBackdrop";
import { LongPressPreviewButton } from "./LongPressPreviewButton";

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
  /** 相手 / 観戦者: 公開ステップのみ（確定なし）。 */
  readOnly?: boolean;
};

function TargetButton({
  target,
  chooserPlayerId,
  onSelect,
  onPreview,
}: {
  target: CardTarget;
  chooserPlayerId: PlayerId;
  onSelect: () => void;
  onPreview: (card: CardDefinition) => void;
}) {
  return (
    <LongPressPreviewButton
      type="button"
      className="btn effect-action-modal__target"
      onClick={onSelect}
      onPreview={() => onPreview(target.card)}
    >
      {target.card.name}
      <span className="effect-action-modal__target-meta">
        {cardTargetMetaLine(target, chooserPlayerId)}
      </span>
    </LongPressPreviewButton>
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
  const sourceCard = resolvePlayableCard(pending.sourceCardId);

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
      ? resolvePlayableCard(scryTop.cardId)
      : null;

  const denjiReveal =
    pending.kind === "denji_machine" && pending.denjiMachineMeta?.step === "reveal"
      ? (() => {
          const meta = pending.denjiMachineMeta;
          const snapshot = meta?.revealedCards;
          const source =
            snapshot && snapshot.length > 0
              ? snapshot
              : (pending.viewedInstanceIds ?? [])
                  .map((id) => state.players[pending.playerId].deck.find((c) => c.instanceId === id))
                  .filter((c): c is NonNullable<typeof c> => !!c);
          return source
            .map((inst) => {
              const card = resolvePlayableCard(inst.cardId);
              const toHand = meta?.toHandInstanceIds.includes(inst.instanceId);
              return card ? { instanceId: inst.instanceId, card, toHand } : null;
            })
            .filter(
              (e): e is { instanceId: string; card: CardDefinition; toHand: boolean } => !!e,
            );
        })()
      : [];

  const denjiOrder =
    pending.kind === "denji_machine" && pending.denjiMachineMeta?.step === "order_bottom"
      ? (pending.denjiMachineMeta.limboBottomCards ?? [])
          .map((inst) => {
            const card = resolvePlayableCard(inst.cardId);
            return card ? { instanceId: inst.instanceId, card } : null;
          })
          .filter((e): e is { instanceId: string; card: CardDefinition } => !!e)
      : [];

  const scryDeckOwnerId = pending.playerId;
  const scryKeepSelectable = new Set(pending.validInstanceIds);
  const scryKeep =
    pending.kind === "scry_keep_one"
      ? (pending.viewedInstanceIds ?? [])
          .map((id) => {
            const inst = state.players[scryDeckOwnerId].deck.find((c) => c.instanceId === id);
            if (!inst) return null;
            const card = resolvePlayableCard(inst.cardId);
            return card ? { instanceId: inst.instanceId, card } : null;
          })
          .filter((e): e is { instanceId: string; card: CardDefinition } => !!e)
      : [];
  const isSagasSniper = pending.effectId === "sagas_sniper";
  const sagasPowerCap = pending.maxPowerCost ?? 0;
  const isGenericFallback = !isKnownEffectChoice(pending);
  const effectiveCanSkip = canSkip || isGenericFallback;
  const effectiveSkipLabel = isGenericFallback ? "スキップ（UI未対応）" : skipLabel;

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
          {sourceCard && pending.kind !== "end_turn_menu" && (
            <p className="effect-action-modal__source">「{sourceCard.name}」の効果</p>
          )}
          <p className="effect-action-modal__hint">{hint}</p>

          {isGenericFallback && (
            <div className="effect-action-modal__section effect-action-modal__section--generic">
              <p className="effect-action-modal__target-meta">
                Web UI 未配線の効果です（汎用フォールバック）
              </p>
              <p className="effect-action-modal__generic-meta">
                <span>effectId: </span>
                <code className="effect-action-modal__mono">{pending.effectId}</code>
              </p>
              <p className="effect-action-modal__generic-meta">
                kind: <code className="effect-action-modal__mono">{pending.kind}</code>
              </p>
              {targets.length > 0 && (
                <div className="effect-action-modal__targets">
                  {targets.map((target) => (
                    <TargetButton
                      key={target.instanceId}
                      target={target}
                      chooserPlayerId={playerId}
                      onSelect={() => onSelect(target.instanceId)}
                      onPreview={onPreview}
                    />
                  ))}
                </div>
              )}
              {effectiveCanSkip && !readOnly && (
                <button
                  type="button"
                  className="btn effect-action-modal__skip"
                  onClick={onSkip}
                >
                  {effectiveSkipLabel}
                </button>
              )}
            </div>
          )}

          {!isGenericFallback && pending.kind === "confirm" && !readOnly && (
            <div className="effect-action-modal__section">
              <div className="effect-action-modal__targets">
                {pending.validInstanceIds.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="btn effect-action-modal__target"
                    onClick={() => onSelect(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isGenericFallback && pending.kind === "seabed_draw" && (
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

          {!isGenericFallback && pending.kind === "denji_machine" && denjiReveal.length > 0 && (
            <div className="effect-action-modal__section">
              <p className="effect-action-modal__target-meta">
                {readOnly ? "相手の山札上3枚（公開）" : "山札の上3枚（相手に公開）"}
              </p>
              <div className="effect-action-modal__targets">
                {denjiReveal.map(({ instanceId, card, toHand }) => (
                  <LongPressPreviewButton
                    key={instanceId}
                    type="button"
                    className="btn effect-action-modal__target effect-action-modal__target--preview"
                    onPreview={() => onPreview(card)}
                  >
                    {card.name}
                    <span className="effect-action-modal__target-meta">
                      {toHand ? "→ 手札" : "→ 山札の下へ"}
                    </span>
                  </LongPressPreviewButton>
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

          {!isGenericFallback && pending.kind === "denji_machine" && denjiOrder.length > 0 && (
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

          {!isGenericFallback && pending.kind === "select_units_bp_budget" && (
            <div className="effect-action-modal__section">
              {targets.length > 0 ? (
                <>
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
                          {selected && (
                            <span className="effect-action-modal__target-badge">選択中</span>
                          )}
                          <span className="effect-action-modal__target-meta">
                            {cardTargetMetaLine(target, playerId)} · BP{" "}
                            {printedBp.toLocaleString()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="effect-action-modal__target-meta">撃破できる対象がいません</p>
              )}
              {!readOnly && (
                <div className="effect-action-modal__actions">
                  {targets.length > 0 && (
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={onConfirmEffectChoice}
                    >
                      選択を確定
                    </button>
                  )}
                  {canSkip && (
                    <button
                      type="button"
                      className={`btn${targets.length === 0 ? " btn--primary" : ""}`}
                      onClick={onSkip}
                    >
                      {skipLabel}
                    </button>
                  )}
                  {targets.length === 0 && !canSkip && (
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={onConfirmEffectChoice}
                    >
                      続ける
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {!isGenericFallback && pending.kind === "optional_deck_draw" && (
            <div className="effect-action-modal__actions">
              <button type="button" className="btn btn--primary" onClick={onOptionalDraw}>
                1枚ドローする
              </button>
            </div>
          )}

          {!isGenericFallback && pending.kind === "deck_top_or_bottom" && scryCard && (
            <div className="effect-action-modal__section">
              <LongPressPreviewButton
                type="button"
                className="btn effect-action-modal__target effect-action-modal__target--preview"
                onPreview={() => onPreview(scryCard)}
              >
                {scryCard.name}
                <span className="effect-action-modal__target-meta">山札上を確認</span>
              </LongPressPreviewButton>
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

          {!isGenericFallback && pending.kind === "scry_keep_one" && scryKeep.length > 0 && (
            <div className="effect-action-modal__section">
              {isSagasSniper && (
                <p className="effect-action-modal__target-meta">
                  {readOnly
                    ? "相手の山札（公開）"
                    : "山札の内容（選択不可のカードは長押しで詳細）"}
                </p>
              )}
              <div className="effect-action-modal__targets">
                {scryKeep.map(({ instanceId, card }) => {
                  const selectable = scryKeepSelectable.has(instanceId);
                  const canPick = !readOnly && (!isSagasSniper || selectable);
                  const meta = isSagasSniper
                    ? sagasSniperDeckCardMeta(card, sagasPowerCap, selectable)
                    : "残す";
                  return (
                    <LongPressPreviewButton
                      key={instanceId}
                      type="button"
                      className={`btn effect-action-modal__target${canPick ? "" : " effect-action-modal__target--preview"}`}
                      disabled={readOnly}
                      onClick={() => {
                        if (canPick) onSelect(instanceId);
                      }}
                      onPreview={() => onPreview(card)}
                    >
                      {card.name}
                      <span className="effect-action-modal__target-meta">{meta}</span>
                    </LongPressPreviewButton>
                  );
                })}
              </div>
            </div>
          )}

          {!isGenericFallback &&
            targets.length > 0 &&
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
                    onPreview={onPreview}
                  />
                ))}
              </div>
            )}

          {effectiveCanSkip &&
            !readOnly &&
            !isGenericFallback &&
            pending.kind !== "denji_machine" &&
            pending.kind !== "select_units_bp_budget" && (
            <button
              type="button"
              className="btn effect-action-modal__skip"
              onClick={onSkip}
            >
              {effectiveSkipLabel}
            </button>
          )}
        </div>
      </div>
    </GameModalBackdrop>
  );
}
