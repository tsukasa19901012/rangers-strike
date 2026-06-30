import type { GameState } from "../../types/game";
import { findInZone } from "../../core/helpers";
import { applyOnRushUnitEffects } from "../../rules/onRushUnitEffects";
import type { EventListener, UnitRushedEvent } from "../types";

/**
 * RS-026 Q6/Q10: ラッシュ起因効果を疾風カウンターより先に解決する。
 * `UnitRushed` イベントの唯一の Listener（順序は登録順で制御）。
 */
export const unitRushedListener: EventListener = (event, state) => {
  const rushEvent = event as UnitRushedEvent;
  const rusherPlayerId = rushEvent.rusherPlayerId;
  const rushedInstanceId = rushEvent.instanceId;

  const rusher = state.players[rusherPlayerId];
  const found = findInZone(rusher, "rush", rushedInstanceId);
  if (!found) return { state };

  const result = applyOnRushUnitEffects(
    state,
    rusherPlayerId,
    rushedInstanceId,
    rushEvent.phasePlayerId,
    "rush",
  );

  return {
    state: result.state,
    logs: result.logs.length > 0 ? result.logs : undefined,
  };
};
