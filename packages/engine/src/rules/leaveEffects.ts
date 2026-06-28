import { hasDestroySelfDamageNote } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";
import { cardName } from "../core/catalog";
import { applyDamageToPlayer } from "./damagePayment";
import { resolveLegend2OnDestroy } from "./legend2/destroyEffects";
import { tryResolveDslTriggeredEffects } from "../dsl/triggerResolver";
import { startSelectUnitChoice } from "./pendingChoices";
import { applyReanimate } from "./reanimate";
import { buildLogEntry } from "../log/formatLog";

export type UnitLeftZoneContext = {
  ownerPlayerId: PlayerId;
  instanceId: string;
  cardId: string;
  fromZone: "rush" | "battle";
  toZone: string;
  phasePlayerId: PlayerId;
};

/** UnitLeftZone リスナー本体: 捨札離場時の撃破誘発と自ダメージ。 */
export function resolveUnitLeftZoneEffectsImpl(
  state: GameState,
  ctx: UnitLeftZoneContext,
): { state: GameState; logs: string[] } {
  const wentToDiscard = ctx.toZone === "discard";
  if (!wentToDiscard) {
    return { state, logs: [] };
  }

  let nextState = state;
  const logs: string[] = [];

  const destroyDsl = tryResolveDslTriggeredEffects({
    state: nextState,
    cardId: ctx.cardId,
    instanceId: ctx.instanceId,
    playerId: ctx.ownerPlayerId,
    phasePlayerId: ctx.phasePlayerId,
    triggerType: "on_destroy",
    logAction: "destroy_effect",
  });
  nextState = destroyDsl.state;
  logs.push(...destroyDsl.logs);

  const destroyFx = resolveLegend2OnDestroy(nextState, ctx.ownerPlayerId, ctx.cardId);
  nextState = destroyFx.state;
  logs.push(...destroyFx.logs);

  if (ctx.cardId === "RS-427") {
    const player = nextState.players[ctx.ownerPlayerId];
    const gekiInDiscard = player.discard.filter(
      (c) => cardName(nextState.definitions, c.cardId) === "ゲキイエロー",
    );
    if (gekiInDiscard.length === 1) {
      nextState = applyReanimate(nextState, {
        playerId: ctx.ownerPlayerId,
        instanceId: gekiInDiscard[0]!.instanceId,
        from: "discard",
        to: "rush",
      });
      logs.push(buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, nextState.definitions, "super_geki_yellow_reanimate"));
    } else if (gekiInDiscard.length > 1) {
      const withChoice = startSelectUnitChoice(nextState, {
        playerId: ctx.ownerPlayerId,
        effectId: "super_geki_yellow_reanimate",
        sourceCardId: ctx.cardId,
        phasePlayerId: ctx.phasePlayerId,
        validInstanceIds: gekiInDiscard.map((c) => c.instanceId),
        unitDestination: "rush_from_discard",
        optional: false,
      });
      if (withChoice) {
        nextState = withChoice;
        logs.push(buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, nextState.definitions, "super_geki_yellow_reanimate_choice"));
      }
    }
  }

  if (hasDestroySelfDamageNote(ctx.cardId)) {
    const withSelfDamage = applyDamageToPlayer(nextState, ctx.ownerPlayerId, 1, {
      kind: "none",
      activePlayer: nextState.activePlayer,
    });
    return { state: withSelfDamage, logs };
  }

  return { state: nextState, logs };
}
