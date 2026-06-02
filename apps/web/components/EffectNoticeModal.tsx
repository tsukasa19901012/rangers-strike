"use client";

import { useEffect } from "react";

type EffectNoticeModalProps = {
  message: string;
  onClose: () => void;
  autoDismissMs?: number;
};

export function EffectNoticeModal({
  message,
  onClose,
  autoDismissMs = 4500,
}: EffectNoticeModalProps) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [autoDismissMs, onClose, message]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal modal--alert modal--effect-notice"
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="effect-notice-title"
        aria-describedby="effect-notice-message"
      >
        <div className="modal__content">
          <h3 id="effect-notice-title" className="effect-notice-modal__title">
            効果発動
          </h3>
          <p id="effect-notice-message" className="effect-notice-modal__message">
            {message}
          </p>
          <button type="button" className="btn btn--primary alert-modal__ok" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
