import { getCardEffect, getZordCondition, isFusionUnit } from "@rangers-strike/cards";
import type { GameState, PlayerId, PlayerState } from "../types/game";
import {
  cardName,
  effectiveBp,
  getDefinition,
  isLargeUnit,
  isOperation,
  isPermanentOperation,
  isSmallUnit,
  isUnit,
  parsePowerCost,
  unitBp,
} from "../core/catalog";
import {
  applyPlayerDamage,
  findInZone,
  opponent,
  payPowerCost,
  removeAt,
  updatePlayer,
} from "../core/helpers";
import { findCardInPlayer, findOwnUnit } from "../core/modifiers";
import { findCardOwner } from "../rules/fieldLookup";
import { withTurnModifiers } from "../rules/turnModifiers";
import { resolveInfiniteChain } from "../rules/legend2/operations";
import {
  autoHoldForBattleEntry,
  canMoveUnitToBattle,
  consumeBattleEntryHolds,
} from "../rules/restrictions";
import { tryLeaveField } from "../rules/operationCounters";
import { COMMAND_ZONE_MAX } from "../types/game";
import { applySuperBrainDraw } from "./drawEffects";

export type EffectContext = {
  state: GameState;
  playerId: PlayerId;
  operationCardId: string;
  targetInstanceId?: string;
  /** Extra hand cards for cyber_s_rider (up to 2). */
  extraInstanceIds?: string[];
};

export type EffectOutcome = {
  state: GameState;
  detail: string;
  discardOperation?: boolean;
};

function fail(state: GameState, reason: string): EffectOutcome {
  return { state, detail: reason, discardOperation: true };
}

function applyBpBoost(ctx: EffectContext, amount: number): EffectOutcome {
  if (!ctx.targetInstanceId) {
    return fail(ctx.state, "target_required");
  }

  const player = ctx.state.players[ctx.playerId];
  const found = findOwnUnit(player, ctx.targetInstanceId);
  if (!found) return fail(ctx.state, "invalid_target");

  const updated: typeof found.card = {
    ...found.card,
    bpModifier: (found.card.bpModifier ?? 0) + amount,
  };

  const zoneCards = [...player[found.zone]];
  zoneCards[found.index] = updated;

  const nextPlayer = { ...player, [found.zone]: zoneCards };
  const nextState = {
    ...ctx.state,
    ...updatePlayer(ctx.state, ctx.playerId, nextPlayer),
  };

  const targetName = cardName(ctx.state.definitions, found.card.cardId);
  return {
    state: nextState,
    detail: `bp+${amount}:${targetName}`,
    discardOperation: true,
  };
}

function resolveDenjiMachine(ctx: EffectContext): EffectOutcome {
  const player = ctx.state.players[ctx.playerId];
  if (player.deck.length < 3) return fail(ctx.state, "insufficient_deck");

  const revealed = player.deck.slice(0, 3);
  const restDeck = player.deck.slice(3);
  const toHand: typeof revealed = [];
  const toBottom: typeof revealed = [];

  for (const card of revealed) {
    if (isSmallUnit(ctx.state.definitions, card.cardId)) {
      toHand.push(card);
    } else {
      toBottom.push(card);
    }
  }

  const nextPlayer = {
    ...player,
    deck: [...restDeck, ...toBottom],
    hand: [...player.hand, ...toHand],
  };

  return {
    state: { ...ctx.state, ...updatePlayer(ctx.state, ctx.playerId, nextPlayer) },
    detail: `denji:${toHand.length}`,
    discardOperation: true,
  };
}

function resolveLandBalkan(ctx: EffectContext): EffectOutcome {
  const player = ctx.state.players[ctx.playerId];
  const candidates = player.command.filter(
    (card) =>
      !card.commandHeld &&
      isUnit(getDefinition(ctx.state.definitions, card.cardId)) &&
      isSmallUnit(ctx.state.definitions, card.cardId),
  );

  if (candidates.length === 0) return fail(ctx.state, "no_command_units");

  let nextPlayer = { ...player };
  let rushed = 0;

  for (const card of candidates.slice(0, 2)) {
    const definition = getDefinition(ctx.state.definitions, card.cardId);
    if (!definition || !isUnit(definition)) continue;

    const cost = parsePowerCost(definition.powerCost);
    if (!payPowerCost(nextPlayer, cost)) continue;

    const found = findInZone(nextPlayer, "command", card.instanceId);
    if (!found) continue;

    const [, command] = removeAt(nextPlayer.command, found.index);
    nextPlayer = {
      ...nextPlayer,
      command,
      rush: [...nextPlayer.rush, found.card],
    };
    rushed += 1;
  }

  if (rushed === 0) return fail(ctx.state, "cannot_rush");

  return {
    state: { ...ctx.state, ...updatePlayer(ctx.state, ctx.playerId, nextPlayer) },
    detail: `land_balkan:${rushed}`,
    discardOperation: true,
  };
}

function resolveCyberSRider(ctx: EffectContext): EffectOutcome {
  const player = ctx.state.players[ctx.playerId];
  const ids = ctx.extraInstanceIds ?? (ctx.targetInstanceId ? [ctx.targetInstanceId] : []);
  if (ids.length === 0) return fail(ctx.state, "target_required");

  const uniqueIds = [...new Set(ids)].slice(0, 2);
  let nextPlayer = { ...player };
  let placed = 0;

  for (const instanceId of uniqueIds) {
    if (nextPlayer.command.length >= COMMAND_ZONE_MAX) break;
    const found = findInZone(nextPlayer, "hand", instanceId);
    if (!found) continue;

    const [, hand] = removeAt(nextPlayer.hand, found.index);
    nextPlayer = {
      ...nextPlayer,
      hand,
      command: [
        ...nextPlayer.command,
        { ...found.card, commandHeld: true },
      ],
    };
    placed += 1;
  }

  if (placed === 0) return fail(ctx.state, "invalid_target");

  return {
    state: { ...ctx.state, ...updatePlayer(ctx.state, ctx.playerId, nextPlayer) },
    detail: `cyber:${placed}`,
    discardOperation: true,
  };
}

function resolveCompressionFreeze(ctx: EffectContext): EffectOutcome {
  if (!ctx.targetInstanceId) return fail(ctx.state, "target_required");

  const located = findCardOwner(ctx.state, ctx.targetInstanceId);
  if (!located || (located.zone !== "rush" && located.zone !== "battle")) {
    return fail(ctx.state, "invalid_target");
  }

  const owner = ctx.state.players[located.playerId];
  const found = findInZone(owner, located.zone, ctx.targetInstanceId);
  if (!found) return fail(ctx.state, "invalid_target");

  const bp = effectiveBp(ctx.state, located.playerId, found.card);
  if (bp > 8000) return fail(ctx.state, "bp_too_high");

  const targetName = cardName(ctx.state.definitions, found.card.cardId);
  const leaveResult = tryLeaveField(ctx.state, {
    ownerPlayerId: located.playerId,
    instanceId: ctx.targetInstanceId,
    fromZone: located.zone,
    toZone: "power",
    leavingCardId: found.card.cardId,
    phasePlayerId: ctx.playerId,
  });

  if (leaveResult.deferred) {
    return {
      state: leaveResult.state,
      detail: `freeze_pending:${targetName}`,
      discardOperation: true,
    };
  }

  return {
    state: leaveResult.state,
    detail: `freeze:${targetName}`,
    discardOperation: true,
  };
}

function resolveDynamitePower(ctx: EffectContext): EffectOutcome {
  if (!ctx.targetInstanceId) return fail(ctx.state, "target_required");

  const enemyId = opponent(ctx.playerId);
  const enemy = ctx.state.players[enemyId];
  let found = findInZone(enemy, "battle", ctx.targetInstanceId);
  let fromZone: "rush" | "battle" = "battle";
  if (!found) {
    found = findInZone(enemy, "rush", ctx.targetInstanceId);
    fromZone = "rush";
  }
  if (!found) return fail(ctx.state, "invalid_target");

  const bp = effectiveBp(ctx.state, enemyId, found.card);
  if (bp > 8000) return fail(ctx.state, "bp_too_high");

  const targetName = cardName(ctx.state.definitions, found.card.cardId);
  const leaveResult = tryLeaveField(ctx.state, {
    ownerPlayerId: enemyId,
    instanceId: ctx.targetInstanceId,
    fromZone,
    toZone: "command",
    leavingCardId: found.card.cardId,
    phasePlayerId: ctx.playerId,
  });

  if (leaveResult.deferred) {
    return {
      state: leaveResult.state,
      detail: `dynamite_pending:${targetName}`,
      discardOperation: true,
    };
  }

  const enemyAfter = leaveResult.state.players[enemyId];
  const placedInCommand = enemyAfter.command.some(
    (c) => c.instanceId === ctx.targetInstanceId && c.commandHeld,
  );
  return {
    state: leaveResult.state,
    detail: placedInCommand ? `dynamite:${targetName}` : `dynamite_discard:${targetName}`,
    discardOperation: true,
  };
}

function returnFusionMaterialsAfterBazooka(
  state: GameState,
  enemyId: PlayerId,
  destroyed: { cardId: string; zordMaterialCardId?: string },
): GameState {
  if (getZordCondition(destroyed.cardId) !== "discard_fusion_unit") {
    return state;
  }

  let enemy = state.players[enemyId];
  let discard = [...enemy.discard];
  let battle = [...enemy.battle];
  const quota = 1;
  let returned = 0;

  while (returned < quota) {
    let index = -1;
    if (destroyed.zordMaterialCardId) {
      index = discard.findIndex((c) => c.cardId === destroyed.zordMaterialCardId);
    }
    if (index < 0) {
      index = discard.findIndex((c) => isFusionUnit(c.cardId));
    }
    if (index < 0) break;

    const [card, rest] = removeAt(discard, index);
    discard = rest;

    const prepared = autoHoldForBattleEntry(enemy, card);
    if (!prepared) {
      discard = [...discard, card];
      break;
    }
    enemy = prepared;
    const withPrepared = {
      ...state,
      ...updatePlayer(state, enemyId, enemy),
    };

    if (canMoveUnitToBattle(withPrepared, enemyId, card, "rush")) {
      battle = [...battle, { ...card, battleActed: false }];
      let nextEnemy: PlayerState = {
        ...enemy,
        discard,
        battle,
        battleEntryHoldReady: false,
      };
      nextEnemy = consumeBattleEntryHolds(withPrepared, enemyId, card);
      enemy = nextEnemy;
      returned += 1;
    } else {
      discard = [...discard, card];
      break;
    }
  }

  return {
    ...state,
    ...updatePlayer(state, enemyId, { ...enemy, discard, battle }),
  };
}

function resolvePowerBazooka(ctx: EffectContext): EffectOutcome {
  if (!ctx.targetInstanceId) return fail(ctx.state, "target_required");

  const enemyId = opponent(ctx.playerId);
  const enemy = ctx.state.players[enemyId];
  const found = findInZone(enemy, "battle", ctx.targetInstanceId);
  if (!found) return fail(ctx.state, "invalid_target");
  if (!isLargeUnit(ctx.state.definitions, found.card.cardId)) {
    return fail(ctx.state, "invalid_target");
  }

  const [, battle] = removeAt(enemy.battle, found.index);
  let nextState: GameState = {
    ...ctx.state,
    ...updatePlayer(ctx.state, enemyId, {
      ...enemy,
      battle,
      discard: [...enemy.discard, found.card],
    }),
  };

  nextState = returnFusionMaterialsAfterBazooka(nextState, enemyId, found.card);

  const targetName = cardName(ctx.state.definitions, found.card.cardId);
  const returned = nextState.players[enemyId].battle.length - battle.length;
  return {
    state: nextState,
    detail: returned > 0 ? `bazooka:${targetName}:return${returned}` : `bazooka:${targetName}`,
    discardOperation: true,
  };
}

function resolveJudgment(ctx: EffectContext): EffectOutcome {
  if (!ctx.targetInstanceId) return fail(ctx.state, "target_required");

  const enemyId = opponent(ctx.playerId);
  const enemy = ctx.state.players[enemyId];
  let targetFound = findInZone(enemy, "battle", ctx.targetInstanceId);
  let fromZone: "rush" | "battle" = "battle";
  if (!targetFound) {
    targetFound = findInZone(enemy, "rush", ctx.targetInstanceId);
    fromZone = "rush";
  }
  if (
    !targetFound ||
    !isUnit(getDefinition(ctx.state.definitions, targetFound.card.cardId))
  ) {
    return fail(ctx.state, "invalid_target");
  }

  const targetDef = getDefinition(ctx.state.definitions, targetFound.card.cardId);
  const targetSize = targetDef?.size;
  if (!targetSize) return fail(ctx.state, "invalid_target");

  const player = ctx.state.players[ctx.playerId];
  if (player.deck.length === 0) return fail(ctx.state, "empty_deck");

  const revealed = player.deck[0]!;
  const restDeck = player.deck.slice(1);
  const revealedDef = getDefinition(ctx.state.definitions, revealed.cardId);
  const matches =
    revealedDef?.type === "unit" && revealedDef.size === targetSize;

  const targetName = cardName(ctx.state.definitions, targetFound.card.cardId);
  const revealedName = cardName(ctx.state.definitions, revealed.cardId);

  let nextState: GameState = {
    ...ctx.state,
    ...updatePlayer(ctx.state, ctx.playerId, {
      ...player,
      deck: [...restDeck, revealed],
    }),
  };

  if (matches) {
    const leaveResult = tryLeaveField(nextState, {
      ownerPlayerId: enemyId,
      instanceId: ctx.targetInstanceId,
      fromZone,
      toZone: "discard",
      leavingCardId: targetFound.card.cardId,
      phasePlayerId: ctx.playerId,
    });
    if (leaveResult.deferred) {
      return {
        state: leaveResult.state,
        detail: `judgment_pending:${targetName}:${revealedName}`,
        discardOperation: true,
      };
    }
    nextState = leaveResult.state;
    return {
      state: nextState,
      detail: `judgment:hit:${targetName}:${revealedName}`,
      discardOperation: true,
    };
  }

  return {
    state: nextState,
    detail: `judgment:miss:${targetName}:${revealedName}`,
    discardOperation: true,
  };
}

function resolveDraw(ctx: EffectContext): EffectOutcome {
  const player = ctx.state.players[ctx.playerId];
  if (player.deck.length === 0) return fail(ctx.state, "empty_deck");

  const drawn = applySuperBrainDraw(ctx.state, ctx.playerId, player);
  return {
    state: drawn.state,
    detail: drawn.detail,
    discardOperation: true,
  };
}

export function resolveOperationEffect(ctx: EffectContext): EffectOutcome {
  const effect = getCardEffect(ctx.operationCardId);
  if (!effect) {
    return { state: ctx.state, detail: "no_effect", discardOperation: true };
  }

  const player = ctx.state.players[ctx.playerId];
  const enemyId = opponent(ctx.playerId);
  const enemy = ctx.state.players[enemyId];

  switch (effect.effectId) {
    case "draw_1":
      return resolveDraw(ctx);

    case "deal_damage_1": {
      const nextEnemy = applyPlayerDamage(enemy, 1);
      return {
        state: { ...ctx.state, ...updatePlayer(ctx.state, enemyId, nextEnemy) },
        detail: "damage:1",
        discardOperation: true,
      };
    }

    case "deal_damage_2": {
      const nextEnemy = applyPlayerDamage(enemy, 2);
      return {
        state: { ...ctx.state, ...updatePlayer(ctx.state, enemyId, nextEnemy) },
        detail: "damage:2",
        discardOperation: true,
      };
    }

    case "judgment":
      return resolveJudgment(ctx);

    case "aura_power": {
      if (!ctx.targetInstanceId) return fail(ctx.state, "target_required");
      const found = findOwnUnit(player, ctx.targetInstanceId);
      if (!found || !isSmallUnit(ctx.state.definitions, found.card.cardId)) {
        return fail(ctx.state, "invalid_target");
      }
      const nextPlayer = withTurnModifiers(player, {
        auraPowerInstanceId: ctx.targetInstanceId,
      });
      const targetName = cardName(ctx.state.definitions, found.card.cardId);
      return {
        state: { ...ctx.state, ...updatePlayer(ctx.state, ctx.playerId, nextPlayer) },
        detail: `aura_power:${targetName}`,
        discardOperation: true,
      };
    }

    case "bp_boost_4000":
      return applyBpBoost(ctx, 4000);

    case "discard_to_hand": {
      if (!ctx.targetInstanceId) return fail(ctx.state, "target_required");
      const found = findInZone(player, "discard", ctx.targetInstanceId);
      if (!found) return fail(ctx.state, "invalid_target");

      const [, discard] = removeAt(player.discard, found.index);
      const nextPlayer = {
        ...player,
        discard,
        hand: [...player.hand, found.card],
      };
      const targetName = cardName(ctx.state.definitions, found.card.cardId);
      return {
        state: { ...ctx.state, ...updatePlayer(ctx.state, ctx.playerId, nextPlayer) },
        detail: `recover:${targetName}`,
        discardOperation: true,
      };
    }

    case "discard_s_unit_to_hand": {
      if (!ctx.targetInstanceId) return fail(ctx.state, "target_required");
      const found = findInZone(player, "discard", ctx.targetInstanceId);
      if (!found) return fail(ctx.state, "invalid_target");
      if (!isSmallUnit(ctx.state.definitions, found.card.cardId)) {
        return fail(ctx.state, "invalid_target");
      }

      const [, discard] = removeAt(player.discard, found.index);
      const nextPlayer = {
        ...player,
        discard,
        hand: [...player.hand, found.card],
      };
      const targetName = cardName(ctx.state.definitions, found.card.cardId);
      return {
        state: { ...ctx.state, ...updatePlayer(ctx.state, ctx.playerId, nextPlayer) },
        detail: `recover_s:${targetName}`,
        discardOperation: true,
      };
    }

    case "science_academy": {
      if (!ctx.targetInstanceId) return fail(ctx.state, "target_required");
      const found = findInZone(player, "discard", ctx.targetInstanceId);
      if (!found) return fail(ctx.state, "invalid_target");
      const def = getDefinition(ctx.state.definitions, found.card.cardId);
      if (!def?.features?.includes("メカ")) return fail(ctx.state, "invalid_target");

      const [, discard] = removeAt(player.discard, found.index);
      const nextPlayer = {
        ...player,
        discard,
        hand: [...player.hand, found.card],
      };
      const targetName = cardName(ctx.state.definitions, found.card.cardId);
      return {
        state: { ...ctx.state, ...updatePlayer(ctx.state, ctx.playerId, nextPlayer) },
        detail: `recover_mecha:${targetName}`,
        discardOperation: true,
      };
    }

    case "goren_storm": {
      const nextPlayer = withTurnModifiers(player, { sComboFinisher: "goren_storm" });
      return {
        state: { ...ctx.state, ...updatePlayer(ctx.state, ctx.playerId, nextPlayer) },
        detail: "goren_storm",
        discardOperation: true,
      };
    }

    case "jacker_hurricane": {
      const nextPlayer = withTurnModifiers(player, { sComboFinisher: "jacker_hurricane" });
      return {
        state: { ...ctx.state, ...updatePlayer(ctx.state, ctx.playerId, nextPlayer) },
        detail: "jacker_hurricane",
        discardOperation: true,
      };
    }

    case "bird_nick_wave": {
      const mods = player.turnModifiers;
      const nextPlayer = withTurnModifiers(player, {
        comboNumberDelta: (mods?.comboNumberDelta ?? 0) + 1,
      });
      return {
        state: { ...ctx.state, ...updatePlayer(ctx.state, ctx.playerId, nextPlayer) },
        detail: "bird_nick_wave",
        discardOperation: true,
      };
    }

    case "denji_machine":
      return resolveDenjiMachine(ctx);

    case "land_balkan":
      return resolveLandBalkan(ctx);

    case "cyber_s_rider":
      return resolveCyberSRider(ctx);

    case "compression_freeze":
      return resolveCompressionFreeze(ctx);

    case "dynamite_power":
      return resolveDynamitePower(ctx);

    case "power_bazooka":
      return resolvePowerBazooka(ctx);

    case "hidora_egg":
      return { state: ctx.state, detail: "placed", discardOperation: false };

    case "infinite_chain": {
      const result = resolveInfiniteChain(ctx.state, ctx.playerId);
      return {
        state: result.state,
        detail: result.detail,
        discardOperation: true,
      };
    }

    default:
      if (effect.kind === "permanent") {
        return { state: ctx.state, detail: "placed", discardOperation: false };
      }
      return {
        state: ctx.state,
        detail: "resolved",
        discardOperation: true,
      };
  }
}

export function placePermanentOperation(
  state: GameState,
  playerId: PlayerId,
  card: { instanceId: string; cardId: string },
): GameState {
  const player = state.players[playerId];
  let operation = [...player.operation];
  let discard = [...player.discard];

  if (operation.length > 0) {
    discard = [...discard, ...operation];
    operation = [];
  }

  operation.push(card);

  return {
    ...state,
    ...updatePlayer(state, playerId, { ...player, operation, discard }),
  };
}

export function needsOperationTarget(cardId: string): boolean {
  const effect = getCardEffect(cardId);
  return effect?.target !== undefined && effect.kind === "instant";
}

export function needsExtraOperationTargets(cardId: string): number {
  if (getCardEffect(cardId)?.effectId === "cyber_s_rider") return 1;
  return 0;
}

function cardHasMechaFeature(
  definitions: GameState["definitions"],
  cardId: string,
): boolean {
  return getDefinition(definitions, cardId)?.features?.includes("メカ") ?? false;
}

export function isValidOperationTarget(
  state: GameState,
  playerId: PlayerId,
  operationCardId: string,
  targetInstanceId: string,
): boolean {
  const effect = getCardEffect(operationCardId);
  if (!effect?.target) return false;

  const player = state.players[playerId];
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];
  const located = findCardOwner(state, targetInstanceId);

  switch (effect.target) {
    case "own_unit": {
      const found = findOwnUnit(player, targetInstanceId);
      return found !== null;
    }
    case "own_s_unit": {
      const found = findOwnUnit(player, targetInstanceId);
      return (
        found !== null &&
        isSmallUnit(state.definitions, found.card.cardId)
      );
    }
    case "discard_any":
      return findInZone(player, "discard", targetInstanceId) !== null;
    case "discard_s_unit": {
      const found = findInZone(player, "discard", targetInstanceId);
      return (
        found !== null &&
        isSmallUnit(state.definitions, found.card.cardId)
      );
    }
    case "discard_mecha": {
      const found = findInZone(player, "discard", targetInstanceId);
      return (
        found !== null &&
        cardHasMechaFeature(state.definitions, found.card.cardId)
      );
    }
    case "enemy_battle_unit": {
      const found = findInZone(enemy, "battle", targetInstanceId);
      return (
        found !== null &&
        isLargeUnit(state.definitions, found.card.cardId)
      );
    }
    case "enemy_field_unit": {
      for (const zone of ["battle", "rush"] as const) {
        const found = findInZone(enemy, zone, targetInstanceId);
        if (!found) continue;
        return isUnit(getDefinition(state.definitions, found.card.cardId));
      }
      return false;
    }
    case "enemy_field_unit_bp8000": {
      for (const zone of ["battle", "rush"] as const) {
        const found = findInZone(enemy, zone, targetInstanceId);
        if (!found) continue;
        return effectiveBp(state, enemyId, found.card) <= 8000;
      }
      return false;
    }
    case "any_field_unit": {
      if (!located || (located.zone !== "rush" && located.zone !== "battle")) {
        return false;
      }
      const owner = state.players[located.playerId];
      const found = findInZone(owner, located.zone, targetInstanceId);
      if (!found) return false;
      return effectiveBp(state, located.playerId, found.card) <= 8000;
    }
    default:
      return false;
  }
}

export function collectOperationTargets(
  state: GameState,
  playerId: PlayerId,
  operationCardId: string,
): string[] {
  const effect = getCardEffect(operationCardId);
  if (!effect?.target) return [];

  const player = state.players[playerId];
  const enemy = state.players[opponent(playerId)];
  const targets: string[] = [];

  switch (effect.target) {
    case "own_unit":
      for (const card of [...player.rush, ...player.battle]) {
        if (isValidOperationTarget(state, playerId, operationCardId, card.instanceId)) {
          targets.push(card.instanceId);
        }
      }
      break;
    case "own_s_unit":
      for (const card of [...player.rush, ...player.battle]) {
        if (isValidOperationTarget(state, playerId, operationCardId, card.instanceId)) {
          targets.push(card.instanceId);
        }
      }
      break;
    case "discard_any":
    case "discard_s_unit":
    case "discard_mecha":
      for (const card of player.discard) {
        if (isValidOperationTarget(state, playerId, operationCardId, card.instanceId)) {
          targets.push(card.instanceId);
        }
      }
      break;
    case "enemy_battle_unit":
      for (const card of enemy.battle) {
        if (isValidOperationTarget(state, playerId, operationCardId, card.instanceId)) {
          targets.push(card.instanceId);
        }
      }
      break;
    case "enemy_field_unit":
    case "enemy_field_unit_bp8000":
      for (const card of [...enemy.battle, ...enemy.rush]) {
        if (isValidOperationTarget(state, playerId, operationCardId, card.instanceId)) {
          targets.push(card.instanceId);
        }
      }
      break;
    case "any_field_unit":
      for (const pid of ["player1", "player2"] as const) {
        const p = state.players[pid];
        for (const card of [...p.rush, ...p.battle]) {
          if (isValidOperationTarget(state, playerId, operationCardId, card.instanceId)) {
            targets.push(card.instanceId);
          }
        }
      }
      break;
  }

  return targets;
}

export function canPlayOperationCard(
  definitions: GameState["definitions"],
  cardId: string,
): boolean {
  const def = getDefinition(definitions, cardId);
  if (!isOperation(def)) return false;
  const effect = getCardEffect(def!.id);
  if (effect?.kind === "counter") return false;
  return !def?.tags?.includes("カウンター");
}

export function isPermanentCard(
  definitions: GameState["definitions"],
  cardId: string,
): boolean {
  const def = getDefinition(definitions, cardId);
  return isPermanentOperation(def);
}
