"use client";

import type { LightningGravityHoldNotice } from "@rangers-strike/engine";

type LightningGravityHoldModalProps = {
  notice: LightningGravityHoldNotice;
  onClose: () => void;
};

function buildMessage(notice: LightningGravityHoldNotice): string {
  const shortage = notice.requiredHolds - notice.heldHolds;
  const lines: string[] = [
    "稲妻重力エネルギー（常駐）が場にある間、Mユニットはバトルエリアに出す前に自軍コマンドをホールドする必要があります。",
    "",
    "【カードの効果】",
    "すべてのMユニットは、コマンドを1つホールドしないとバトルエリアに出られません。",
    "※両軍の常駐ゾーンにある稲妻重力エネルギーの枚数ぶん、ホールドが必要です。",
    "",
    `「${notice.unitName}」を出す場合：`,
  ];

  if (notice.unitHoldCount > 0) {
    lines.push(`・このユニットの※：${notice.unitHoldCount}枚`);
  }
  lines.push(`・稲妻重力エネルギー：${notice.lightningGravityCount}枚`);

  lines.push(
    "",
    `現在ホールド中：${notice.heldHolds}枚 / 必要：${notice.requiredHolds}枚（あと${shortage}枚）`,
    "",
    "コマンドゾーンのカードをタップしてホールドし、もう一度バトルエリアへ出してください。",
  );

  return lines.join("\n");
}

export function LightningGravityHoldModal({
  notice,
  onClose,
}: LightningGravityHoldModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal modal--alert modal--lightning-gravity"
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="lightning-gravity-modal-title"
        aria-describedby="lightning-gravity-modal-message"
      >
        <div className="modal__content">
          <h3 id="lightning-gravity-modal-title" className="lightning-gravity-modal__title">
            稲妻重力エネルギー
          </h3>
          <p id="lightning-gravity-modal-message" className="lightning-gravity-modal__message">
            {buildMessage(notice)}
          </p>
          <button
            type="button"
            className="btn btn--primary alert-modal__ok"
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
