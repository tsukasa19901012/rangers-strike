import {
  getRidingComboEffect,
  getRidingComboNamedEffect,
  isJointComboEffectImplemented,
  type NumberComboEffectId,
} from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { buildLogEntry } from "../log/formatLog";
import { tryResolveDslTriggeredEffects } from "../dsl/triggerResolver";
import { resolveP0Alias } from "../effects/p0EffectBridge";
import { applyLegacyNumberComboEffect } from "./numberComboEffects";
import { grantBpBoostOnPlayer, grantSp1OnPlayer, patchPlayer } from "./playerPatches";
import type { ComboOutcome } from "./comboTypes";

function ridingComboLog(
  playerId: PlayerId,
  cardId: string,
  definitions: GameState["definitions"],
  detail: string,
): string {
  return buildLogEntry(playerId, "riding_combo", cardId, definitions, detail);
}

function resolveRidingEffectId(cardId: string): string | undefined {
  const fromMap = getRidingComboEffect(cardId);
  if (fromMap) return fromMap;
  const named = getRidingComboNamedEffect(cardId);
  if (named && isJointComboEffectImplemented(named.effectId, "riding_combo")) {
    return named.effectId;
  }
  return undefined;
}

function applyP0RidingEffect(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  effectId: string,
): ComboOutcome | null {
  const alias = resolveP0Alias(effectId);
  if (!alias) return null;

  if (alias.p0Id === "grant_sp") {
    const level = alias.params?.spLevel ?? 1;
    let nextState = state;
    for (let i = 0; i < level; i += 1) {
      nextState = patchPlayer(nextState, playerId, (player) =>
        grantSp1OnPlayer(player, card.instanceId),
      );
    }
    return {
      state: nextState,
      logs: [ridingComboLog(playerId, card.cardId, state.definitions, `sp${level}`)],
    };
  }

  if (alias.p0Id === "bp_boost" && alias.params?.bpDelta) {
    const amount = alias.params.bpDelta;
    return {
      state: patchPlayer(state, playerId, (player) =>
        grantBpBoostOnPlayer(player, card.instanceId, amount),
      ),
      logs: [
        ridingComboLog(
          playerId,
          card.cardId,
          state.definitions,
          `bp+${amount}`,
        ),
      ],
    };
  }

  return null;
}

/** ライドオフ時 RC — effectId テーブル / P0 / NC レガシー / DSL。 */
export function resolveRidingComboOnRideOff(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
): ComboOutcome {
  const effectId = resolveRidingEffectId(card.cardId);
  if (effectId) {
    const p0 = applyP0RidingEffect(state, playerId, card, effectId);
    if (p0) return p0;

    const legacy = applyLegacyNumberComboEffect(
      state,
      playerId,
      card,
      effectId as NonNullable<NumberComboEffectId>,
    );
    if (legacy.logs.length > 0) {
      return {
        state: legacy.state,
        logs: legacy.logs.map((log) =>
          log.replace("number_combo", "riding_combo"),
        ),
      };
    }
  }

  const dsl = tryResolveDslTriggeredEffects({
    state,
    cardId: card.cardId,
    instanceId: card.instanceId,
    playerId,
    phasePlayerId: playerId,
    triggerType: "riding_combo",
    logAction: "riding_combo",
  });
  if (dsl.handled) {
    return { state: dsl.state, logs: dsl.logs };
  }

  return { state, logs: [] };
}
