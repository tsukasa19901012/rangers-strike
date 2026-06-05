"use client";

import type { ReactNode } from "react";
import { getCardById } from "@rangers-strike/cards";
import type { StartPhaseStatus } from "@rangers-strike/engine";
import { GameModalBackdrop } from "./GameModalBackdrop";

type StartPhaseModalProps = {
  status: StartPhaseStatus;
  onRelease: () => void;
  onReturnBattleUnit: (battleInstanceId: string) => void;
  onDraw: () => void;
  onBonusDraw: () => void;
};

function StepRow({
  label,
  done,
  detail,
  action,
}: {
  label: string;
  done: boolean;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="start-phase-modal__step">
      <div className="start-phase-modal__step-head">
        <span className={`start-phase-modal__badge${done ? " start-phase-modal__badge--done" : ""}`}>
          {done ? "完了" : "未完了"}
        </span>
        <span className="start-phase-modal__step-label">{label}</span>
      </div>
      {detail && <p className="start-phase-modal__step-detail">{detail}</p>}
      {!done && action}
    </div>
  );
}

export function StartPhaseModal({
  status,
  onRelease,
  onReturnBattleUnit,
  onDraw,
  onBonusDraw,
}: StartPhaseModalProps) {
  return (
    <GameModalBackdrop>
      <div
        className="modal modal--start-phase"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-phase-title"
      >
        <div className="modal__content modal__content--effect-action">
          <h3 id="start-phase-title" className="effect-action-modal__title">
            スタートフェイズ
          </h3>
          <p className="effect-action-modal__hint">
            次の3つの行程を好きな順番で行ってください。
          </p>

          <div className="start-phase-modal__steps">
            <StepRow
              label="ホールド中のコマンドをリリース"
              done={status.releaseDone}
              detail={
                !status.releaseDone && status.heldCommandCount > 0
                  ? `ホールド中 ${status.heldCommandCount} 枚`
                  : status.releaseDone
                    ? "すべてリリース済み"
                    : "ホールド中のコマンドなし"
              }
              action={
                status.canRelease ? (
                  <button type="button" className="btn btn--primary" onClick={onRelease}>
                    コマンドをリリース
                  </button>
                ) : undefined
              }
            />

            <StepRow
              label="バトルエリアのユニットをラッシュに戻す"
              done={status.returnDone}
              detail={
                !status.returnDone && status.battleUnitCount > 0
                  ? `バトルエリア ${status.battleUnitCount} 体（1体ずつ戻してください）`
                  : status.returnDone
                    ? "すべてラッシュに戻しました"
                    : "バトルエリアにユニットなし"
              }
              action={
                status.canReturn ? (
                  <div className="effect-action-modal__targets">
                    {status.battleUnits.map((unit) => {
                      const card = getCardById(unit.cardId);
                      return (
                        <button
                          key={unit.instanceId}
                          type="button"
                          className="btn effect-action-modal__target"
                          onClick={() => onReturnBattleUnit(unit.instanceId)}
                        >
                          {card?.name ?? unit.cardId}
                          <span className="effect-action-modal__target-meta">ラッシュに戻す</span>
                        </button>
                      );
                    })}
                  </div>
                ) : undefined
              }
            />

            <StepRow
              label="山札から1枚ドロー"
              done={status.drawDone}
              detail={
                status.drawDone
                  ? "ドロー済み（追加ドローは任意）"
                  : "必須のドローを1枚行ってください"
              }
              action={
                status.canDraw ? (
                  <button type="button" className="btn btn--primary" onClick={onDraw}>
                    ドロー
                  </button>
                ) : undefined
              }
            />
          </div>

          {status.canBonusDraw && (
            <div className="effect-action-modal__actions">
              <button type="button" className="btn" onClick={onBonusDraw}>
                追加で1枚ドロー（任意）
              </button>
            </div>
          )}

          {status.canAdvanceToCharge && !status.canBonusDraw && (
            <p className="effect-action-modal__hint">
              行程が完了しました。チャージフェイズへ移行します…
            </p>
          )}
        </div>
      </div>
    </GameModalBackdrop>
  );
}
