"use client";

import { useEffect } from "react";
import type { PlayerId } from "@rangers-strike/engine";
import { PLAYER_LABELS } from "@/lib/labels";

type TurnNoticeModalProps = {
  playerId: PlayerId;
  onDismiss: () => void;
};

const AUTO_DISMISS_MS = 1000;

export function TurnNoticeModal({ playerId, onDismiss }: TurnNoticeModalProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  const label = PLAYER_LABELS[playerId];

  return (
    <div className="modal-backdrop turn-notice-backdrop" role="presentation">
      <div className="turn-notice" role="status" aria-live="polite">
        <p className="turn-notice__title">{label}のターン</p>
        {playerId === "player2" ? (
          <p className="turn-notice__hint">CPUが操作します</p>
        ) : null}
      </div>
    </div>
  );
}
