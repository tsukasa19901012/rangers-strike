import type { GameState, PlayerId } from "../types/game";
import type { ZoneName } from "../types/game";
import { withSyncedEffectStack } from "../rules/effectStack";
import { buildUnitLeftZoneEvent } from "./builders";
import { getEngineEventDispatcher } from "./globalDispatcher";

export function emitUnitLeftZoneAndResolve(
  state: GameState,
  input: {
    ownerPlayerId: PlayerId;
    instanceId: string;
    cardId: string;
    fromZone: "rush" | "battle";
    toZone: ZoneName;
    phasePlayerId: PlayerId;
    /** ルール: R-DESTROY-02 — 撃破による移動か（省略時は捨札への移動を撃破とみなす）。 */
    destroyed?: boolean;
    /** バトルによる撃破のとき、バトルの相手（RS-453【激怒斬り】）。 */
    battleOpponentInstanceId?: string;
  },
): { state: GameState; logs: string[] } {
  const event = buildUnitLeftZoneEvent({
    state,
    phasePlayerId: input.phasePlayerId,
    ownerPlayerId: input.ownerPlayerId,
    instanceId: input.instanceId,
    cardId: input.cardId,
    fromZone: input.fromZone,
    toZone: input.toZone,
    destroyed: input.destroyed,
    battleOpponentInstanceId: input.battleOpponentInstanceId,
  });
  const outcome = getEngineEventDispatcher().dispatch(event, state);
  return {
    state: withSyncedEffectStack(outcome.state),
    logs: outcome.logs ?? [],
  };
}
