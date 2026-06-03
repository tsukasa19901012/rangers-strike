"use client";

import { getCardById } from "@rangers-strike/cards";
import type { GameState, PendingZordSetup, PlayerId } from "@rangers-strike/engine";
import { resolveCardTargets, type CardTarget } from "@/lib/cardTargets";
import { GameModalBackdrop } from "./GameModalBackdrop";

type ZordSetupModalProps = {
  state: GameState;
  playerId: PlayerId;
  setup: PendingZordSetup;
  onSelectMaterial: (instanceId: string) => void;
  onSelectDestination: (destination: "command" | "discard") => void;
  onContinue: () => void;
  onCancel: () => void;
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

export function ZordSetupModal({
  state,
  playerId,
  setup,
  onSelectMaterial,
  onSelectDestination,
  onContinue,
  onCancel,
}: ZordSetupModalProps) {
  const zordCard = getCardById(setup.zordCardId);
  const materialTargets =
    setup.step === "material"
      ? resolveCardTargets(state, setup.validInstanceIds)
      : setup.materialInstanceId
        ? resolveCardTargets(state, [setup.materialInstanceId])
        : [];

  const hint =
    setup.step === "material"
      ? "ゾードアップの素材を選んでください。"
      : setup.step === "destination"
        ? "Sユニットをコマンドゾーンに置くか、捨て札にするか選んでください。"
        : "母艦の支払いに使うコマンドを、次の画面で選びます。";

  return (
    <GameModalBackdrop onBackdropClick={onCancel}>
      <div
        className="modal modal--zord-setup"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="zord-setup-title"
      >
        <div className="modal__content modal__content--effect-action">
          <h3 id="zord-setup-title" className="effect-action-modal__title">
            ゾードアップ
          </h3>
          {zordCard && (
            <p className="effect-action-modal__source">「{zordCard.name}」をラッシュする</p>
          )}
          <p className="effect-action-modal__hint">{hint}</p>

          {setup.step === "material" && materialTargets.length > 0 && (
            <div className="effect-action-modal__targets">
              {materialTargets.map((target) => (
                <TargetButton
                  key={target.instanceId}
                  target={target}
                  onSelect={() => onSelectMaterial(target.instanceId)}
                />
              ))}
            </div>
          )}

          {setup.step === "destination" && (
            <div className="effect-action-modal__actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => onSelectDestination("command")}
              >
                コマンドゾーンに置く
              </button>
              <button type="button" className="btn" onClick={() => onSelectDestination("discard")}>
                捨て札にする
              </button>
            </div>
          )}

          {setup.step === "mothership" && (
            <div className="effect-action-modal__actions">
              <button type="button" className="btn btn--primary" onClick={onContinue}>
                続ける
              </button>
            </div>
          )}

          <div className="modal__actions">
            <button type="button" className="btn" onClick={onCancel}>
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </GameModalBackdrop>
  );
}
