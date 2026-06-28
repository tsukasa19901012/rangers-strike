import type { GameState, PlayerId } from "../../types/game";
import { findInZone } from "../../core/helpers";
import { buildLogEntry } from "../../log/formatLog";
import { requestDrawFromDeck } from "../../rules/drawFromDeck";
import { resolveNamedOnRushEffects } from "../../rules/namedUnitEffects";
import { tryResolveDslTriggeredEffects } from "../../dsl/triggerResolver";
import {
  applySuperRadarOnRush,
  resolveLegend3UnnamedRushEffects,
} from "../../rules/legend3/rushEffects";
import { ON_RUSH_EFFECTS } from "../../rules/rushEffects";
import { resolveNoteOtherOnRushEffects, applyMotoSharianPowerTrigger } from "../../rules/noteOtherRushEffects";
import type { EventListener, UnitRushedEvent } from "../types";

function applyDrawOnRush(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
  phasePlayerId: PlayerId,
): { state: GameState; logs: string[] } {
  const result = requestDrawFromDeck(state, playerId, phasePlayerId, {
    count: 1,
    sourceCardId: cardId,
  });
  if (!result.pending && !result.drawn) {
    return { state: result.state, logs: [] };
  }
  return {
    state: result.state,
    logs: [
      buildLogEntry(playerId, "rush_effect", cardId, state.definitions, "draw_1"),
    ],
  };
}

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

  let nextState = state;
  const logs: string[] = [];
  const phasePlayerId = rushEvent.phasePlayerId;

  const onRush = ON_RUSH_EFFECTS[found.card.cardId];
  if (onRush === "draw_1") {
    const result = applyDrawOnRush(
      nextState,
      rusherPlayerId,
      found.card.cardId,
      phasePlayerId,
    );
    nextState = result.state;
    logs.push(...result.logs);
  }

  const unnamedLegend3 = resolveLegend3UnnamedRushEffects(
    nextState,
    rusherPlayerId,
    rushedInstanceId,
  );
  nextState = unnamedLegend3.state;
  logs.push(...unnamedLegend3.logs);

  const dslRush = tryResolveDslTriggeredEffects({
    state: nextState,
    cardId: found.card.cardId,
    instanceId: rushedInstanceId,
    playerId: rusherPlayerId,
    phasePlayerId,
    triggerType: "on_rush",
    logAction: "named_effect",
  });
  nextState = dslRush.state;
  logs.push(...dslRush.logs);

  if (!dslRush.handled) {
    const namedRush = resolveNamedOnRushEffects(
      nextState,
      rusherPlayerId,
      rushedInstanceId,
      phasePlayerId,
    );
    nextState = namedRush.state;
    logs.push(...namedRush.logs);
  }

  const radar = applySuperRadarOnRush(nextState, rusherPlayerId, rushedInstanceId);
  nextState = radar.state;
  logs.push(...radar.logs);

  const noteOther = resolveNoteOtherOnRushEffects(
    nextState,
    rusherPlayerId,
    rushedInstanceId,
    phasePlayerId,
    found.card.cardId,
  );
  nextState = noteOther.state;
  logs.push(...noteOther.logs);

  const motoSharian = applyMotoSharianPowerTrigger(
    nextState,
    rusherPlayerId,
    found.card.cardId,
  );
  nextState = motoSharian.state;
  logs.push(...motoSharian.logs);

  return {
    state: nextState,
    logs: logs.length > 0 ? logs : undefined,
  };
};
