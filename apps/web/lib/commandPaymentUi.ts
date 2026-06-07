import {
  getCommandPaymentView,
  type CommandPaymentView,
  type GameState,
  type PendingCommandPayment,
  type PlayerId,
} from "@rangers-strike/engine";
import {
  getCardEffect,
  getEffectLabel,
  getEnterBattleNamedEffect,
  type CardDefinition,
} from "@rangers-strike/cards";

export const CARD_PREVIEW_GESTURE_HINT = "タップで選択 · 長押しで詳細";

/** effect_hold 時は pendingEffectChoice.effectId を渡す。 */
export type CommandPaymentUiContext = {
  effectId?: string;
};

function categoryUseHoldDetail(
  view: CommandPaymentView,
  selectedCount: number,
): string {
  return `コマンドを${view.selectCount}枚ホールド（${selectedCount}/${view.selectCount}）`;
}

function operationCardEffectText(sourceCardId: string): string | undefined {
  return getCardEffect(sourceCardId)?.text;
}

export function commandPaymentTitle(
  pending: PendingCommandPayment,
  view: CommandPaymentView,
  context?: CommandPaymentUiContext,
): string {
  if (view.kind === "category_use") {
    if (pending.continuation.type === "rush") {
      return `「${view.sourceCardName}」のラッシュ`;
    }
    if (pending.continuation.type === "play_counter") {
      return `カウンター「${view.sourceCardName}」の使用`;
    }
    if (pending.continuation.type === "play_operation") {
      return `「${view.sourceCardName}」の使用`;
    }
  }

  if (view.kind === "effect_hold") {
    if (context?.effectId) {
      return `【${getEffectLabel(context.effectId)}】`;
    }
    return `「${view.sourceCardName}」`;
  }

  if (view.kind === "mothership_hold") {
    return "【母艦】";
  }

  if (view.kind === "battle_entry") {
    const named = getEnterBattleNamedEffect(view.sourceCardId);
    if (named) {
      return `【${getEffectLabel(named.effectId)}】`;
    }
    return `「${view.sourceCardName}」`;
  }

  return `「${view.sourceCardName}」`;
}

export function commandPaymentDetail(
  pending: PendingCommandPayment,
  view: CommandPaymentView,
  selectedCount: number,
): string {
  if (view.kind === "category_use") {
    const hold = categoryUseHoldDetail(view, selectedCount);
    if (pending.continuation.type === "rush") {
      return hold;
    }
    const effectText = operationCardEffectText(view.sourceCardId);
    if (effectText) {
      return `${effectText}。${hold}`;
    }
    return hold;
  }

  let detail = categoryUseHoldDetail(view, selectedCount);
  if (view.kind === "battle_entry") {
    detail += "。選んだコマンドをホールドしてからバトルエリアに出ます";
  }
  if (view.eligibleSelectMin > 0 && view.eligibleSelectMin < view.selectCount) {
    detail += " ※進入用のホールドが必要です（母艦のホールドは使えません）";
  }
  if (view.kind === "mothership_hold") {
    detail += " ※母艦用のホールドです（バトル進入の※には使えません）";
  }
  return detail;
}

export function commandPaymentHint(
  pending: PendingCommandPayment,
  view: CommandPaymentView,
  selectedCount: number,
  context?: CommandPaymentUiContext,
): string {
  return `${commandPaymentTitle(pending, view, context)}：${commandPaymentDetail(
    pending,
    view,
    selectedCount,
  )}`;
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
