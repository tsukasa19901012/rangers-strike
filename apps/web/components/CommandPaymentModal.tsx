"use client";

import { useMemo, useState } from "react";
import { getCardById } from "@rangers-strike/cards";
import {
  getCommandPaymentView,
  type GameState,
  type PlayerId,
} from "@rangers-strike/engine";
import { GameModalBackdrop } from "./GameModalBackdrop";

type CommandPaymentModalProps = {
  state: GameState;
  playerId: PlayerId;
  onConfirm: (commandInstanceIds: string[]) => void;
  onCancel: () => void;
  onPrismModeChange?: (usePrism: boolean) => void;
};

export function CommandPaymentModal({
  state,
  playerId,
  onConfirm,
  onCancel,
  onPrismModeChange,
}: CommandPaymentModalProps) {
  const pending = state.pendingCommandPayment;
  const [selected, setSelected] = useState<string[]>([]);
  const usePrism = pending?.prismSubstitute ?? false;

  const view = useMemo(() => {
    if (!pending) return null;
    return getCommandPaymentView(state, pending);
  }, [pending, state]);

  if (!pending || !view) return null;

  const commands = pending.validInstanceIds
    .map((id) => {
      const player = state.players[playerId];
      const inst =
        player.command.find((c) => c.instanceId === id) ??
        (view.allowRushZoneCommands
          ? player.rush.find((c) => c.instanceId === id)
          : undefined);
      if (!inst) return null;
      const card = getCardById(inst.cardId);
      const zone =
        player.rush.some((c) => c.instanceId === id) ? "（ラッシュ）" : "";
      return card ? { instanceId: id, name: card.name + zone } : null;
    })
    .filter((e): e is { instanceId: string; name: string } => !!e);

  const required = view.selectCount;
  const canConfirm = selected.length === required;

  const title =
    view.kind === "battle_entry"
      ? "バトルエリアに出す"
      : view.kind === "mothership_hold"
        ? "母艦の支払い"
        : view.kind === "effect_hold"
          ? "コマンドをホールド"
          : "カードを使う";

  const purpose =
    view.kind === "battle_entry"
      ? `「${view.sourceCardName}」をバトルエリアに出す`
      : view.kind === "mothership_hold"
        ? `「${view.sourceCardName}」の母艦コスト`
        : view.kind === "effect_hold"
          ? `「${view.sourceCardName}」の効果`
          : `「${view.sourceCardName}」を使う`;

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= required) return prev;
      return [...prev, id];
    });
  }

  return (
    <GameModalBackdrop onBackdropClick={onCancel}>
      <div
        className="modal modal--command-payment"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-payment-title"
      >
        <div className="modal__content">
          <h3 id="command-payment-title">{title}</h3>
          <p className="command-payment-modal__lead">{purpose}</p>
          <p className="command-payment-modal__hint">
            コマンドを{required}枚選んでホールドしてください。
            {view.kind === "battle_entry" && view.consumeOnConfirm
              ? " 進入と同時にホールドは消費されます。"
              : ""}
            {view.eligibleSelectMin > 0 && view.eligibleSelectMin < required
              ? " ※進入用のホールドが必要です（母艦のホールドは使えません）。"
              : ""}
            {view.kind === "mothership_hold"
              ? " 母艦用のホールドです（バトル進入の※には使えません）。"
              : ""}
          </p>

          {view.prismAvailable && view.kind === "category_use" && (
            <label className="command-payment-modal__prism">
              <input
                type="checkbox"
                checked={usePrism}
                onChange={(e) => {
                  setSelected([]);
                  onPrismModeChange?.(e.target.checked);
                }}
              />
              【プリズムパワー】ホールド2枚でカテゴリ支払い（{view.categories.join("・")}不要）
            </label>
          )}

          <ul className="command-payment-modal__list">
            {commands.map((cmd) => {
              const isSelected = selected.includes(cmd.instanceId);
              const disabled =
                !isSelected && selected.length >= required;
              return (
                <li key={cmd.instanceId}>
                  <button
                    type="button"
                    className={`btn command-payment-modal__cmd${isSelected ? " command-payment-modal__cmd--selected" : ""}`}
                    disabled={disabled}
                    onClick={() => toggle(cmd.instanceId)}
                  >
                    {cmd.name}
                    {isSelected ? " ✓" : ""}
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="command-payment-modal__count">
            選択 {selected.length} / {required}
          </p>

          <div className="modal__actions">
            <button type="button" className="btn" onClick={onCancel}>
              キャンセル
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={!canConfirm}
              onClick={() => onConfirm(selected)}
            >
              確定
            </button>
          </div>
        </div>
      </div>
    </GameModalBackdrop>
  );
}
