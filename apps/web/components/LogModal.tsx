"use client";

import { formatGameLog } from "@rangers-strike/engine";
import type { CardDefinition } from "@rangers-strike/cards";

type LogModalProps = {
  entries: string[];
  definitions: Record<string, CardDefinition>;
  onClose: () => void;
};

export function LogModal({ entries, definitions, onClose }: LogModalProps) {
  const visible = [...entries].reverse();

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal modal--log"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="ゲームログ"
      >
        <button type="button" className="modal__close" onClick={onClose}>
          ✕
        </button>
        <div className="modal__content modal__content--log">
          <h3 className="log-modal__title">ゲームログ</h3>
          <div className="log-modal__list">
            {visible.length === 0 ? (
              <p className="log-modal__empty">ログはまだありません</p>
            ) : (
              visible.map((entry, index) => (
                <div key={`${entry}-${index}`} className="log-modal__entry">
                  {formatGameLog(entry, definitions)}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
