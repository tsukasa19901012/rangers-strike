"use client";

import { useEffect } from "react";
import type { Phase } from "@rangers-strike/engine";
import { PHASE_LABELS } from "@/lib/labels";

type PhaseNoticeModalProps = {
  phase: Phase;
  onDismiss: () => void;
};

const AUTO_DISMISS_MS = 1000;

export function PhaseNoticeModal({ phase, onDismiss }: PhaseNoticeModalProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="modal-backdrop turn-notice-backdrop" role="presentation">
      <div className="turn-notice" role="status" aria-live="polite">
        <p className="turn-notice__title">{PHASE_LABELS[phase]}フェイズ</p>
      </div>
    </div>
  );
}
