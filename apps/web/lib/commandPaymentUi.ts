import {
  getCommandPaymentView,
  type CommandPaymentView,
  type GameState,
  type PendingCommandPayment,
  type PlayerId,
} from "@rangers-strike/engine";
import type { CardDefinition } from "@rangers-strike/cards";

export const CARD_PREVIEW_GESTURE_HINT = "タップで選択 · 長押しで詳細";

export function commandPaymentHint(
  pending: PendingCommandPayment,
  view: CommandPaymentView,
  selectedCount: number,
): string {
  const purpose =
    view.kind === "battle_entry"
      ? `「${view.sourceCardName}」をバトルエリアに出す`
      : view.kind === "mothership_hold"
        ? `「${view.sourceCardName}」の母艦コスト`
        : view.kind === "effect_hold"
          ? `「${view.sourceCardName}」の効果`
          : pending.continuation.type === "rush"
            ? `「${view.sourceCardName}」をラッシュする`
            : `「${view.sourceCardName}」を使う`;

  let detail = `コマンドを${view.selectCount}枚ホールド（${selectedCount}/${view.selectCount}）`;
  if (view.kind === "battle_entry") {
    detail += "。選んだコマンドをホールドしてからバトルエリアに出ます";
  }
  if (view.eligibleSelectMin > 0 && view.eligibleSelectMin < view.selectCount) {
    detail += " ※進入用のホールドが必要です（母艦のホールドは使えません）";
  }
  if (view.kind === "mothership_hold") {
    detail += " ※母艦用のホールドです（バトル進入の※には使えません）";
  }

  return `${purpose}：${detail}`;
}

export function commandPaymentZoneHint(view: CommandPaymentView): string {
  if (view.allowRushZoneCommands) {
    return "コマンドゾーンまたはラッシュの常駐をタップして選んでください。";
  }
  return "コマンドゾーンのカードをタップして選んでください。";
}

export function buildCommandPaymentView(state: GameState, pending: PendingCommandPayment) {
  return getCommandPaymentView(state, pending);
}

export function commandPaymentTargetIds(pending: PendingCommandPayment): Set<string> {
  return new Set(pending.validInstanceIds);
}

export function toggleCommandPaymentSelection(
  selected: readonly string[],
  instanceId: string,
  required: number,
): string[] {
  if (selected.includes(instanceId)) {
    return selected.filter((id) => id !== instanceId);
  }
  if (selected.length >= required) return [...selected];
  return [...selected, instanceId];
}

export function canConfirmCommandPayment(
  selected: readonly string[],
  required: number,
): boolean {
  return selected.length === required;
}

export type CommandPaymentSelectedCard = {
  instanceId: string;
  definition: CardDefinition;
};

export function resolveCommandPaymentSelectedCards(
  state: GameState,
  playerId: PlayerId,
  selectedInstanceIds: readonly string[],
): CommandPaymentSelectedCard[] {
  const player = state.players[playerId];
  const pool = [...player.command, ...player.rush];

  return selectedInstanceIds.flatMap((instanceId) => {
    const instance = pool.find((card) => card.instanceId === instanceId);
    if (!instance) return [];
    const definition = state.definitions[instance.cardId];
    if (!definition) return [];
    return [{ instanceId, definition }];
  });
}
