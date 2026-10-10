/**
 * RS-417 冥府神サイクロプス【消滅の緋色】
 * 「これが自軍ラッシュエリアにある間、敵軍Sユニットがバトルエリアからラッシュエリアに戻るたび、
 * 自軍常駐置き場からカードを1枚選び捨札にしてもよい。そうしたとき、そのユニットを撃破する。」
 *
 * 紐男爵【紐拳】等で敵軍 S ユニットがラッシュエリアに戻ったときに選択（任意）を開く。
 * 出典: atwiki（RS-417）、grnrngr/faq-card-6 RS-417（紐拳で戻したユニットを撃破しても、後半の「出す」は行える）。
 */
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../types/game";
import { isSmallUnit } from "../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../core/helpers";

export const CYCLOPS_SCARLET_EFFECT_ID = "cyclops_scarlet";

/**
 * 敵軍 S ユニット（returnedOwnerId の returned）がバトルエリアからラッシュエリアに戻ったとき、
 * 相手のラッシュエリアにサイクロプスがいて常駐置き場にカードがあれば選択を開く。
 */
export function tryCyclopsScarletOnReturnToRush(
  state: GameState,
  returnedOwnerId: PlayerId,
  returned: CardInstance,
  phasePlayerId: PlayerId,
): GameState {
  if (state.pendingEffectChoice) return state;
  if (!isSmallUnit(state.definitions, returned.cardId)) return state;
  if (!findInZone(state.players[returnedOwnerId], "rush", returned.instanceId)) return state;
  const controllerId = opponent(returnedOwnerId);
  const controller = state.players[controllerId];
  const cyclops = controller.rush.find((c) => c.cardId === "RS-417");
  if (!cyclops || controller.operation.length === 0) return state;
  const choice: PendingEffectChoice = {
    playerId: controllerId,
    effectId: CYCLOPS_SCARLET_EFFECT_ID,
    sourceCardId: "RS-417",
    sourceInstanceId: returned.instanceId,
    kind: "select_unit",
    phasePlayerId,
    validInstanceIds: controller.operation.map((c) => c.instanceId),
    selectCount: 1,
    selectedInstanceIds: [],
    optional: true,
  };
  return { ...state, pendingEffectChoice: choice, activePlayer: controllerId };
}

/** 選んだ常駐カードを捨札にする（撃破は呼び出し側で離場処理を通す）。戻り値の returnedInstanceId を撃破する。 */
export function discardCyclopsResident(
  state: GameState,
  pending: PendingEffectChoice,
  instanceId: string,
): GameState | null {
  const controller = state.players[pending.playerId];
  const found = findInZone(controller, "operation", instanceId);
  if (!found) return null;
  const [, operation] = removeAt(controller.operation, found.index);
  return {
    ...state,
    ...updatePlayer(state, pending.playerId, {
      ...controller,
      operation,
      discard: [...controller.discard, found.card],
    }),
  };
}
