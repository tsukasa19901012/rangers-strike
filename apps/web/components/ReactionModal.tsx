"use client";

import { EFFECT_LABELS, getCardById } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "@rangers-strike/engine";
import { resolveCardTargets } from "@/lib/cardTargets";

type ReactionKind = "strike" | "battle" | "rush" | "leave";

type ReactionModalProps = {
  kind: ReactionKind;
  state: GameState;
  playerId: PlayerId;
  counterInstanceIds: string[];
  interceptInstanceIds: string[];
  substituteInstanceIds: string[];
  hiddenNinjaCounterId: string | null;
  canUsePlasma: boolean;
  canPass: boolean;
  onCounter: (instanceId: string) => void;
  onSubstitute: (instanceId: string) => void;
  onIntercept: (instanceId: string) => void;
  onPlasma: () => void;
  onPass: () => void;
  onCancelSubstitute: () => void;
};

const TITLES: Record<ReactionKind, string> = {
  strike: "ストライクへの応答",
  battle: "アタックへの応答",
  rush: "ラッシュへの応答",
  leave: "離場への応答",
};

export function ReactionModal({
  kind,
  state,
  playerId,
  counterInstanceIds,
  interceptInstanceIds,
  substituteInstanceIds,
  hiddenNinjaCounterId,
  canUsePlasma,
  canPass,
  onCounter,
  onSubstitute,
  onIntercept,
  onPlasma,
  onPass,
  onCancelSubstitute,
}: ReactionModalProps) {
  const choosingSubstitute = !!hiddenNinjaCounterId && substituteInstanceIds.length > 0;
  const counters = counterInstanceIds
    .map((id) => {
      const inst = state.players[playerId].hand.find((c) => c.instanceId === id);
      if (!inst) return null;
      const card = getCardById(inst.cardId);
      return card ? { instanceId: id, card } : null;
    })
    .filter((e): e is { instanceId: string; card: NonNullable<ReturnType<typeof getCardById>> } => !!e);

  const interceptors = resolveCardTargets(state, interceptInstanceIds);
  const substitutes = resolveCardTargets(state, substituteInstanceIds);

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal modal--effect-action"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reaction-modal-title"
      >
        <div className="modal__content modal__content--effect-action">
          <h3 id="reaction-modal-title" className="effect-action-modal__title">
            {choosingSubstitute ? "【隠れ忍】身代わり" : TITLES[kind]}
          </h3>
          <p className="effect-action-modal__hint">
            {choosingSubstitute
              ? "身代わりにするユニットを選んでください"
              : kind === "strike" && interceptInstanceIds.length > 0
                ? "ファイブテクターで迎撃、カウンター、またはスキップできます"
                : kind === "strike" && canUsePlasma
                  ? "プラズマエネルギーを発動するか、スキップしてください"
                  : "カウンターを使うか、応答をスキップしてください"}
          </p>

          {choosingSubstitute ? (
            <>
              <div className="effect-action-modal__targets">
                {substitutes.map((target) => (
                  <button
                    key={target.instanceId}
                    type="button"
                    className="btn effect-action-modal__target"
                    onClick={() => onSubstitute(target.instanceId)}
                  >
                    {target.card.name}
                    <span className="effect-action-modal__target-meta">{target.zoneLabel}</span>
                  </button>
                ))}
              </div>
              <button type="button" className="btn effect-action-modal__skip" onClick={onCancelSubstitute}>
                身代わりをやめる
              </button>
            </>
          ) : (
            <>
              {interceptors.length > 0 && (
                <div className="effect-action-modal__section">
                  <p className="effect-action-modal__label">迎撃（ファイブテクター）</p>
                  <div className="effect-action-modal__targets">
                    {interceptors.map((target) => (
                      <button
                        key={target.instanceId}
                        type="button"
                        className="btn btn--danger effect-action-modal__target"
                        onClick={() => onIntercept(target.instanceId)}
                      >
                        {target.card.name}
                        <span className="effect-action-modal__target-meta">{target.zoneLabel}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {counters.length > 0 && (
                <div className="effect-action-modal__section">
                  <p className="effect-action-modal__label">カウンター</p>
                  <div className="effect-action-modal__targets">
                    {counters.map(({ instanceId, card }) => (
                      <button
                        key={instanceId}
                        type="button"
                        className="btn effect-action-modal__target"
                        onClick={() => onCounter(instanceId)}
                      >
                        {card.name}
                        <span className="effect-action-modal__target-meta">手札</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="effect-action-modal__actions">
                {kind === "strike" && canUsePlasma && (
                  <button type="button" className="btn btn--danger" onClick={onPlasma}>
                    {EFFECT_LABELS.plasma_energy ?? "プラズマエネルギー"}
                  </button>
                )}
                {canPass && (
                  <button type="button" className="btn btn--primary" onClick={onPass}>
                    応答スキップ
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
