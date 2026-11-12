/**
 * RS-325 天空勇者マジシャイン【マジチケット】の、コマンドゾーンのカードを手札から使うものとして扱う仮の状態（stageMagiTicket）と、
 * マジチケットで発動できるコマンドゾーンのカウンター。反応の窓を開く判定（rules/operationCounters.ts）からも使うので、
 * 循環 import を避けて rules/legend1/set5NamedEffects.ts から分けた（効果の本体はそちら）。
 */
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { getDefinition, isCounterOperation } from "../core/catalog";
import { satisfyCostWindow } from "../core/costWindow";
import { findInZone, updatePlayer } from "../core/helpers";

export const MAGI_TICKET_STAND_IN_SUFFIX = "#magi_ticket";

/**
 * マジチケットで発動できるコマンドゾーンのカウンター（リリース状態のカウンターのオペレーション）。タイミングと必要パワーは、
 * 手札にあるものとして呼び出し側（core/legalActions.ts）が判定する（faq-card-5 RS-325 Q3: 巨大化爆弾の※カウンター）。
 * 使うカウンター自身をホールドする対価は省けない（RK-036 ライアがあっても同じ。faq-rider-1 RK-036 Q1）ので、ホールド状態のものは使えない。
 */
export function magiTicketCounterCandidates(state: GameState, playerId: PlayerId): CardInstance[] {
  const player = state.players[playerId];
  if (!player.rush.some((c) => c.cardId === "RS-325")) return [];
  return player.command.filter((c) => !c.commandHeld && isCounterOperation(getDefinition(state.definitions, c.cardId)));
}

/**
 * play_operation を通すための仮の状態: コマンドゾーンのカードを手札へ移し、同じカードのホールド状態の写しをコマンドゾーンに置く。
 */
export function stageMagiTicket(
  state: GameState,
  playerId: PlayerId,
  commandInstanceId: string,
  window: "operation_category" | "counter_category" = "operation_category",
): GameState | null {
  const player = state.players[playerId];
  const found = findInZone(player, "command", commandInstanceId);
  if (!found) return null;
  const { commandHeld: _h, paymentHeld: _p, mothershipHold: _m, ...card } = found.card;
  const standIn: CardInstance = {
    ...card,
    instanceId: `${card.instanceId}${MAGI_TICKET_STAND_IN_SUFFIX}`,
    commandHeld: true,
    paymentHeld: true,
  };
  const command = [...player.command];
  command[found.index] = standIn;
  const staged = satisfyCostWindow({ ...player, command, hand: [...player.hand, card] }, window);
  return { ...state, ...updatePlayer(state, playerId, staged) };
}

