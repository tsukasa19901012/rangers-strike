"use client";

import { useEffect } from "react";
import type { PlayerId } from "@rangers-strike/engine";
import { PLAYER_LABELS } from "@/lib/labels";

type TurnNoticeModalProps = {
  playerId: PlayerId;
  onDismiss: () => void;
};

export function TurnNoticeModal({ playerId, onDismiss }: TurnNoticeModalProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 1200);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  const label = PLAYER_LABELS[playerId];

  return (
    <div className="modal-backdrop turn-notice-backdrop" onClick={onDismiss} role="presentation">
      <div
        className="turn-notice"
        onClick={(event) => event.stopPropagation()}
        role="status"
        aria-live="polite"
      >
        <p className="turn-notice__title">{label}のターン</p>
        {playerId === "player1" ? (
          <p className="turn-notice__hint">タップして続行</p>
        ) : (
          <p className="turn-notice__hint">CPUが操作します</p>
        )}
      </div>
    </div>
  );
}
