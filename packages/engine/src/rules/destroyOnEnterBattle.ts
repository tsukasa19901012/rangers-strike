import type { GameState, PlayerId } from "../types/game";
import { getDefinition } from "../core/catalog";
import { findInZone } from "../core/helpers";
import { cardHasGrantKeyword } from "../dsl/promotedKeywordBridge";
import { hasTurnRuleModifier } from "../core/scopedModifiers";
import { buildLogEntry } from "../log/formatLog";
import { tryLeaveField } from "./operationCounters";

/** RK-242 タッグ等: イマジンの撃破テキスト無効化（将来の常駐効果用）。 */
export const IMAGIN_DESTROY_ON_ENTER_SUPPRESSED = "imagin_destroy_on_enter_suppressed";

export function cardHasDestroyOnEnterBattle(cardId: string): boolean {
  return cardHasGrantKeyword(cardId, "destroy_on_enter_battle");
}

function isDestroyOnEnterBattleSuppressed(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): boolean {
  const def = getDefinition(state.definitions, cardId);
  if (!def?.features?.includes("イマジン")) return false;
  return hasTurnRuleModifier(
    state.players[playerId],
    IMAGIN_DESTROY_ON_ENTER_SUPPRESSED,
  );
}

/** バトル進入の tail 後: 「※バトルエリアに出たとき撃破される」を解決する。 */
export function applyDestroyOnEnterBattle(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  phasePlayerId: PlayerId,
): { state: GameState; logs: string[] } {
  const player = state.players[playerId];
  const found = findInZone(player, "battle", instanceId);
  if (!found) return { state, logs: [] };

  if (!cardHasDestroyOnEnterBattle(found.card.cardId)) {
    return { state, logs: [] };
  }

  if (isDestroyOnEnterBattleSuppressed(state, playerId, found.card.cardId)) {
    return { state, logs: [] };
  }

  const leaveResult = tryLeaveField(state, {
    ownerPlayerId: playerId,
    instanceId,
    fromZone: "battle",
    toZone: "discard",
    leavingCardId: found.card.cardId,
    phasePlayerId,
  });

  if (leaveResult.deferred) {
    return { state: leaveResult.state, logs: [] };
  }

  return {
    state: leaveResult.state,
    logs: [
      buildLogEntry(
        playerId,
        "enter_battle",
        found.card.cardId,
        state.definitions,
        "destroy_on_enter_battle",
      ),
    ],
  };
}
