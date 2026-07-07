import type { GameState, PlayerId } from "../types/game";
import { findInZone } from "../core/helpers";
import { buildLogEntry } from "../log/formatLog";
import { requestDrawFromDeck } from "./drawFromDeck";
import { resolveNamedOnRushEffects } from "./namedUnitEffects";
import { tryResolveDslTriggeredEffects } from "../dsl/triggerResolver";
import {
  applySuperRadarOnRush,
  resolveLegend3UnnamedRushEffects,
} from "./legend3/rushEffects";
import { ON_RUSH_EFFECTS } from "./rushEffects";
import {
  resolveNoteOtherOnRushEffects,
  applyMotoSharianPowerTrigger,
} from "./noteOtherRushEffects";
import { tryFormationDeployOnRush } from "./formationDeploy";
import {
  applyBandoraHeldCommandDiscard,
  tryZubazubanOnAllyRush,
} from "./batch06FieldEffects";
import { tryOnAllyRushNamedReturnSelfToHand } from "./batch07FieldEffects";
import { tryRsCatchallOnEnemyRush } from "./rs/rsCatchallRuntime";
import { applyRadarOnRush } from "./residentOps";

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
 * ユニットがフィールドに出たときの on_rush 効果。
 * 通常ラッシュとモーフ置換（wiki p1413: 置き換えでエリアに出ることはラッシュに含まれる）で共用。
 */
export function applyOnRushUnitEffects(
  state: GameState,
  ownerPlayerId: PlayerId,
  instanceId: string,
  phasePlayerId: PlayerId,
  zone: "rush" | "battle" = "rush",
): { state: GameState; logs: string[] } {
  const owner = state.players[ownerPlayerId];
  const found = findInZone(owner, zone, instanceId);
  if (!found) return { state, logs: [] };

  let nextState = state;
  const logs: string[] = [];

  const onRush = ON_RUSH_EFFECTS[found.card.cardId];
  if (onRush === "draw_1") {
    const result = applyDrawOnRush(
      nextState,
      ownerPlayerId,
      found.card.cardId,
      phasePlayerId,
    );
    nextState = result.state;
    logs.push(...result.logs);
  }

  const unnamedLegend3 = resolveLegend3UnnamedRushEffects(
    nextState,
    ownerPlayerId,
    instanceId,
  );
  nextState = unnamedLegend3.state;
  logs.push(...unnamedLegend3.logs);

  {
    const radar = applyRadarOnRush(nextState, ownerPlayerId, found.card.cardId);
    nextState = radar;
  }

  const dslRush = tryResolveDslTriggeredEffects({
    state: nextState,
    cardId: found.card.cardId,
    instanceId,
    playerId: ownerPlayerId,
    phasePlayerId,
    triggerType: "on_rush",
    logAction: "named_effect",
  });
  nextState = dslRush.state;
  logs.push(...dslRush.logs);

  if (!dslRush.handled) {
    const namedRush = resolveNamedOnRushEffects(
      nextState,
      ownerPlayerId,
      instanceId,
      phasePlayerId,
    );
    nextState = namedRush.state;
    logs.push(...namedRush.logs);
  }

  if (!nextState.pendingEffectChoice) {
    const allyReturn = tryOnAllyRushNamedReturnSelfToHand(
      nextState,
      ownerPlayerId,
      found.card.cardId,
      instanceId,
      phasePlayerId,
    );
    nextState = allyReturn.state;
    logs.push(...allyReturn.logs);
  }

  if (!nextState.pendingEffectChoice) {
    const formation = tryFormationDeployOnRush(
      nextState,
      ownerPlayerId,
      instanceId,
      phasePlayerId,
    );
    nextState = formation.state;
    logs.push(...formation.logs);
  }

  const radar = applySuperRadarOnRush(nextState, ownerPlayerId, instanceId);
  nextState = radar.state;
  logs.push(...radar.logs);

  const noteOther = resolveNoteOtherOnRushEffects(
    nextState,
    ownerPlayerId,
    instanceId,
    phasePlayerId,
    found.card.cardId,
  );
  nextState = noteOther.state;
  logs.push(...noteOther.logs);

  const motoSharian = applyMotoSharianPowerTrigger(
    nextState,
    ownerPlayerId,
    found.card.cardId,
  );
  nextState = motoSharian.state;
  logs.push(...motoSharian.logs);

  if (!nextState.pendingEffectChoice) {
    nextState = applyBandoraHeldCommandDiscard(
      nextState,
      ownerPlayerId,
      found.card.cardId,
    );
  }
  if (!nextState.pendingEffectChoice) {
    nextState = tryZubazubanOnAllyRush(
      nextState,
      ownerPlayerId,
      instanceId,
      phasePlayerId,
    );
  }

  const rsEnemyRush = tryRsCatchallOnEnemyRush(
    nextState,
    ownerPlayerId,
    instanceId,
    phasePlayerId,
  );
  nextState = rsEnemyRush.state;
  if (rsEnemyRush.logs.length > 0) logs.push(...rsEnemyRush.logs);

  return { state: nextState, logs };
}
