import { hasDestroySelfDamageNote } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";
import { cardName, getDefinition } from "../core/catalog";
import { updatePlayer, removeAt } from "../core/helpers";
import { applyDamageToPlayer } from "./damagePayment";
import { resolveLegend2OnDestroy } from "./legend2/destroyEffects";
import { tryResolveDslTriggeredEffects } from "../dsl/triggerResolver";
import { startSelectUnitChoice, startSelectCommandChoice } from "./pendingChoices";
import { applyReanimate } from "./reanimate";
import { buildLogEntry } from "../log/formatLog";
import { resolveZordFusionPartnerIds } from "../dsl/zordBridge";
import { applyHungerGodCeaseShuffle } from "./batch04FieldEffects";
import { reanimateNamedFromDiscardOnDestroy } from "./legend1/coreGapEffects";

const DESTROY_RECRUIT_FROM_DISCARD: Record<string, { partnerName: string; effectId: string }> = {
  "RS-231": { partnerName: "アバレブルー", effectId: "avare_blue_reanimate" },
  "RS-333": { partnerName: "マジレッド", effectId: "magi_red_reanimate" },
  "RS-334": { partnerName: "マジイエロー", effectId: "magi_yellow_reanimate" },
  "RS-335": { partnerName: "マジブルー", effectId: "magi_blue_reanimate" },
  "RS-336": { partnerName: "マジピンク", effectId: "magi_pink_reanimate" },
  "RS-337": { partnerName: "マジグリーン", effectId: "magi_green_reanimate" },
};

/** Finds a named unit in the player's command OR discard zone and rushes it. */
function reanimateNamedToRush(
  state: GameState,
  ctx: UnitLeftZoneContext,
  targetName: string,
  effectId: string,
): { state: GameState; log: string | null } {
  const player = state.players[ctx.ownerPlayerId];
  const inCommand = player.command.filter(
    (c) => cardName(state.definitions, c.cardId) === targetName,
  );
  const inDiscard = player.discard.filter(
    (c) => cardName(state.definitions, c.cardId) === targetName,
  );
  const total = inCommand.length + inDiscard.length;
  if (total === 0) return { state, log: null };

  if (inDiscard.length >= 1 && inCommand.length === 0) {
    if (inDiscard.length === 1) {
      const ns = applyReanimate(state, {
        playerId: ctx.ownerPlayerId,
        instanceId: inDiscard[0]!.instanceId,
        from: "discard",
        to: "rush",
      });
      return { state: ns, log: buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, ns.definitions, effectId) };
    }
    const withChoice = startSelectUnitChoice(state, {
      playerId: ctx.ownerPlayerId,
      effectId,
      sourceCardId: ctx.cardId,
      phasePlayerId: ctx.phasePlayerId,
      validInstanceIds: inDiscard.map((c) => c.instanceId),
      unitDestination: "rush_from_discard",
      optional: false,
    });
    if (withChoice) {
      return { state: withChoice, log: buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, withChoice.definitions, `${effectId}_choice`) };
    }
    return { state, log: null };
  }

  if (inCommand.length >= 1 && inDiscard.length === 0) {
    if (inCommand.length === 1) {
      const target = inCommand[0]!;
      const idx = player.command.findIndex((c) => c.instanceId === target.instanceId);
      const [, newCommand] = removeAt(player.command, idx);
      const ns = {
        ...state,
        ...updatePlayer(state, ctx.ownerPlayerId, {
          ...player,
          command: newCommand,
          rush: [...player.rush, target],
        }),
      };
      return { state: ns, log: buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, ns.definitions, effectId) };
    }
    const withChoice = startSelectCommandChoice(state, {
      playerId: ctx.ownerPlayerId,
      effectId,
      sourceCardId: ctx.cardId,
      phasePlayerId: ctx.phasePlayerId,
      commandFilter: "any",
      commandAction: "rush",
      validInstanceIds: inCommand.map((c) => c.instanceId),
      optional: false,
    });
    if (withChoice) {
      return { state: withChoice, log: buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, withChoice.definitions, `${effectId}_choice`) };
    }
    return { state, log: null };
  }

  // Mixed: auto-take first from discard (command copy stays)
  const target = inDiscard[0]!;
  const ns = applyReanimate(state, {
    playerId: ctx.ownerPlayerId,
    instanceId: target.instanceId,
    from: "discard",
    to: "rush",
  });
  return { state: ns, log: buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, ns.definitions, effectId) };
}

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
  let nextState = state;
  const logs: string[] = [];

  if (
    (ctx.fromZone === "rush" || ctx.fromZone === "battle") &&
    (ctx.toZone === "discard" || ctx.toZone === "power") &&
    ctx.cardId === "RS-580"
  ) {
    nextState = applyHungerGodCeaseShuffle(nextState);
  }

  const wentToDiscard = ctx.toZone === "discard";
  if (!wentToDiscard) {
    return { state: nextState, logs };
  }

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

  const destroyRecruit = DESTROY_RECRUIT_FROM_DISCARD[ctx.cardId];
  if (destroyRecruit) {
    const result = reanimateNamedFromDiscardOnDestroy(
      nextState,
      ctx,
      destroyRecruit.partnerName,
      destroyRecruit.effectId,
    );
    nextState = result.state;
    if (result.log) logs.push(result.log);
  }

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

  // RS-428: destroyed → bring ゲキブルー from discard to rush
  if (ctx.cardId === "RS-428") {
    const player = nextState.players[ctx.ownerPlayerId];
    const targets = player.discard.filter(
      (c) => cardName(nextState.definitions, c.cardId) === "ゲキブルー",
    );
    if (targets.length === 1) {
      nextState = applyReanimate(nextState, {
        playerId: ctx.ownerPlayerId,
        instanceId: targets[0]!.instanceId,
        from: "discard",
        to: "rush",
      });
      logs.push(buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, nextState.definitions, "geki_blue_reanimate"));
    } else if (targets.length > 1) {
      const withChoice = startSelectUnitChoice(nextState, {
        playerId: ctx.ownerPlayerId,
        effectId: "geki_blue_reanimate",
        sourceCardId: ctx.cardId,
        phasePlayerId: ctx.phasePlayerId,
        validInstanceIds: targets.map((c) => c.instanceId),
        unitDestination: "rush_from_discard",
        optional: false,
      });
      if (withChoice) {
        nextState = withChoice;
        logs.push(buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, nextState.definitions, "geki_blue_reanimate_choice"));
      }
    }
  }

  // XG2-099: destroyed → bring カメロック from command or discard to rush
  if (ctx.cardId === "XG2-099") {
    const result = reanimateNamedToRush(nextState, ctx, "カメロック", "camerock_reanimate");
    nextState = result.state;
    if (result.log) logs.push(result.log);
  }

  // XG3-099: destroyed → bring ロボタック from command or discard to rush
  if (ctx.cardId === "XG3-099") {
    const result = reanimateNamedToRush(nextState, ctx, "ロボタック", "robotack_reanimate");
    nextState = result.state;
    if (result.log) logs.push(result.log);
  }

  // XG5-089: destroyed → bring カバドス from command or discard to rush
  if (ctx.cardId === "XG5-089") {
    const result = reanimateNamedToRush(nextState, ctx, "カバドス", "kabados_reanimate");
    nextState = result.state;
    if (result.log) logs.push(result.log);
  }

  // XG7-063: destroyed → bring シャークラー from command or discard to rush
  if (ctx.cardId === "XG7-063") {
    const result = reanimateNamedToRush(nextState, ctx, "シャークラー", "sharklar_reanimate");
    nextState = result.state;
    if (result.log) logs.push(result.log);
  }

  // RS-332: destroyed → bring each combo part (RS-334, RS-335, RS-336) from discard to rush
  if (ctx.cardId === "RS-332") {
    const partnerIds = resolveZordFusionPartnerIds("RS-332");
    for (const partnerId of partnerIds) {
      const player = nextState.players[ctx.ownerPlayerId];
      const inDiscard = player.discard.filter((c) => c.cardId === partnerId);
      if (inDiscard.length === 0) continue;
      nextState = applyReanimate(nextState, {
        playerId: ctx.ownerPlayerId,
        instanceId: inDiscard[0]!.instanceId,
        from: "discard",
        to: "rush",
      });
      logs.push(buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, nextState.definitions, "maji_lion_parts_reanimate"));
    }
  }

  // RS-426: destroyed → bring スーパーゲキレッド from hand OR ゲキレッド from discard to rush
  if (ctx.cardId === "RS-426") {
    const player = nextState.players[ctx.ownerPlayerId];
    const superInHand = player.hand.filter(
      (c) => cardName(nextState.definitions, c.cardId) === "スーパーゲキレッド",
    );
    const baseInDiscard = player.discard.filter(
      (c) => cardName(nextState.definitions, c.cardId) === "ゲキレッド",
    );
    if (superInHand.length === 0 && baseInDiscard.length > 0) {
      // Only discard option: reanimate ゲキレッド
      nextState = applyReanimate(nextState, {
        playerId: ctx.ownerPlayerId,
        instanceId: baseInDiscard[0]!.instanceId,
        from: "discard",
        to: "rush",
      });
      logs.push(buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, nextState.definitions, "super_geki_red_reanimate"));
    } else if (superInHand.length > 0 && baseInDiscard.length === 0) {
      // Only hand option: move スーパーゲキレッド from hand to rush
      const target = superInHand[0]!;
      const idx = player.hand.findIndex((c) => c.instanceId === target.instanceId);
      const [, newHand] = removeAt(player.hand, idx);
      nextState = {
        ...nextState,
        ...updatePlayer(nextState, ctx.ownerPlayerId, {
          ...nextState.players[ctx.ownerPlayerId],
          hand: newHand,
          rush: [...nextState.players[ctx.ownerPlayerId].rush, target],
        }),
      };
      logs.push(buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, nextState.definitions, "super_geki_red_reanimate"));
    } else if (superInHand.length > 0 && baseInDiscard.length > 0) {
      // Both available: prefer discard option (auto-pick, strategic note: hand is more valuable)
      nextState = applyReanimate(nextState, {
        playerId: ctx.ownerPlayerId,
        instanceId: baseInDiscard[0]!.instanceId,
        from: "discard",
        to: "rush",
      });
      logs.push(buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, nextState.definitions, "super_geki_red_reanimate"));
    }
  }

  // RS-471: destroyed during enemy turn → optionally bring メカ M-units from command to rush
  if (ctx.cardId === "RS-471" && ctx.phasePlayerId !== ctx.ownerPlayerId) {
    const player = nextState.players[ctx.ownerPlayerId];
    const mechaInCommand = player.command
      .filter((c) => {
        const def = getDefinition(nextState.definitions, c.cardId);
        return def?.type === "unit" && def.size === "M" && def.features?.includes("メカ");
      })
      .map((c) => c.instanceId);
    if (mechaInCommand.length > 0) {
      const withChoice = startSelectCommandChoice(nextState, {
        playerId: ctx.ownerPlayerId,
        effectId: "grand_liner_mecha_rush",
        sourceCardId: ctx.cardId,
        phasePlayerId: ctx.phasePlayerId,
        commandFilter: "any",
        commandAction: "rush",
        validInstanceIds: mechaInCommand,
        optional: true,
      });
      if (withChoice) {
        nextState = withChoice;
        logs.push(buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, nextState.definitions, "grand_liner_mecha_rush"));
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
