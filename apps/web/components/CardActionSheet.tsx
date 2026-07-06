"use client";

import type { CardDefinition } from "@rangers-strike/cards";
import { CardImage } from "./CardImage";
import { GameModalBackdrop } from "./GameModalBackdrop";

export type CardSheetAction = {
  id: string;
  label: string;
  detail?: string;
  variant?: "primary" | "danger";
  onSelect: () => void;
};

type CardActionSheetProps = {
  definition?: CardDefinition;
  actions: CardSheetAction[];
  onPreview?: () => void;
  onClose: () => void;
};

/** カードをタップしたときのアクションシート（ドラッグ操作の代替）。 */
export function CardActionSheet({
  definition,
  actions,
  onPreview,
  onClose,
}: CardActionSheetProps) {
  return (
    <GameModalBackdrop onBackdropClick={onClose}>
      <div
        className="card-action-sheet"
        role="dialog"
        aria-label={definition ? `${definition.name} のアクション` : "カードアクション"}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="card-action-sheet__card">
          <CardImage card={definition} hideMeta />
          <div className="card-action-sheet__info">
            <span className="card-action-sheet__name">{definition?.name}</span>
            <span className="card-action-sheet__meta">
              {definition?.bp !== undefined ? `BP ${definition.bp}` : null}
              {definition?.type === "operation"
                ? `オペレーション · 必要パワー ${definition.powerCost}`
                : null}
            </span>
          </div>
        </div>
        <div className="card-action-sheet__actions">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className={[
                "btn",
                "card-action-sheet__action",
                action.variant === "primary" ? "btn--primary" : "",
                action.variant === "danger" ? "btn--danger" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                onClose();
                action.onSelect();
              }}
            >
              <span>{action.label}</span>
              {action.detail && (
                <span className="card-action-sheet__detail">{action.detail}</span>
              )}
            </button>
          ))}
          {onPreview && (
            <button
              type="button"
              className="btn btn--ghost card-action-sheet__action"
              onClick={() => {
                onClose();
                onPreview();
              }}
            >
              カードの詳細を見る
            </button>
          )}
          <button
            type="button"
            className="btn btn--ghost card-action-sheet__action card-action-sheet__cancel"
            onClick={onClose}
          >
            閉じる
          </button>
        </div>
      </div>
    </GameModalBackdrop>
  );
}
