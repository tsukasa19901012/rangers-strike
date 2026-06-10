import type { GameState, PlayerId } from "../types/game";
import {
  cardName,
  getDefinition,
  isUnit,
  parsePowerCost,
} from "../core/catalog";
import { findInZone, opponent, updatePlayer } from "../core/helpers";
import { findOwnUnit } from "../core/modifiers";
import { tryLeaveField } from "../rules/operationCounters";
import {
  grantSp1ToBattleUnit,
  markBattleNcEffect,
} from "../rules/namedUnitEffects";
import { setAuraPowerInstanceId } from "../rules/turnModifierBridge";
import {
  startPitInDiveOrderChoice,
  startRadialHammerChoice,
  startSelectCommandChoice,
} from "../rules/pendingChoices";
import { isValidOwnSmallUnitTarget } from "./targetSelectors";
import {
  applyRuntimeGrantKeyword,
  isRuntimeGrantKeyword,
  runtimeEffectIdFromKeyword,
} from "./runtimeEffectDispatch";
import { effectDelegateSlot } from "./effectDelegateSlot";

export const PASSIVE_GRANT_KEYWORDS = new Set([
  "over_technology_m_bp_plus_on_attacked",
  "block_m_battle_entry_bp5000_plus",
  "category_substitute_via_hold",
  "auto_battle_entry_from_rush",
  "auto_battle_entry_each_turn",
  "auto_battle_entry_if_enemy_battle",
  "no_ride_while_held",
  "not_selectable",
  "cannot_attack_enemy_battle",
  "counter_redirect_attack",
  "m_battle_entry_requires_hold",
  "fusion_material_alias",
  "battle_entry_hold_1",
  "require_command_hold_entry",
  "substitute_on_wb_destroy",
  "win_but_destroyed_vs_sp1",
  "no_battle_entry_turn_rushed",
]);

export const SUPPORTED_GRANT_KEYWORDS = new Set([
  "bp_plus_per_own_damage",
  "reveal_top_destroy_if_same_size",
  "SP1",
  "SP2",
  "SP3",
  "use_printed_bp_in_battle",
  "prevent_counter",
  "attack_rush_zone",
  "pay_power_discard_5_for_sp3",
  "pay_power_discard_2_for_sp1",
  "discard_named_from_hand_for_sp1",
  "substitute_on_wb_destroy",
  "destroy_self_damage_1",
  "bp_plus_per_released_command_on_attack",
  "s_bp_plus_per_released_command_on_opponent_turn",
  "release_command_on_s_battle_entry",
  "prevent_leave_with_power_cost",
  "force_enemy_s_rush_to_battle",
  "radial_hammer_scry",
  "force_opponent_hold_command",
  "hold_all_enemy_commands",
  "destroy_striker_on_strike_self_discard",
  "strike_intercept_with_s_unit",
  ...PASSIVE_GRANT_KEYWORDS,
]);

export type GrantKeywordContext = {
  playerId: PlayerId;
  phasePlayerId: PlayerId;
  sourceCardId: string;
  effectId: string;
  triggerSourceInstanceId?: string;
  operationInstanceId?: string;
  extraInstanceIds?: string[];
  leavingCardId?: string;
};

export type GrantKeywordResult = {
  state: GameState;
  detail?: string;
};

function resolveJudgmentKeyword(
  state: GameState,
  ctx: GrantKeywordContext,
): GrantKeywordResult {
  const targetInstanceId = ctx.triggerSourceInstanceId;
  if (!targetInstanceId) return { state };

  const enemyId = opponent(ctx.playerId);
  const enemy = state.players[enemyId];
  let targetFound = findInZone(enemy, "battle", targetInstanceId);
  let fromZone: "rush" | "battle" = "battle";
  if (!targetFound) {
    targetFound = findInZone(enemy, "rush", targetInstanceId);
    fromZone = "rush";
  }
  if (!targetFound || !isUnit(getDefinition(state.definitions, targetFound.card.cardId))) {
    return { state };
  }

  const targetDef = getDefinition(state.definitions, targetFound.card.cardId);
  const targetSize = targetDef?.size;
  if (!targetSize) return { state };

  const player = state.players[ctx.playerId];
  if (player.deck.length === 0) return { state };

  const revealed = player.deck[0]!;
  const restDeck = player.deck.slice(1);
  const revealedDef = getDefinition(state.definitions, revealed.cardId);
  const matches = revealedDef?.type === "unit" && revealedDef.size === targetSize;

  const targetName = cardName(state.definitions, targetFound.card.cardId);
  const revealedName = cardName(state.definitions, revealed.cardId);

  let nextState: GameState = {
    ...state,
    ...updatePlayer(state, ctx.playerId, {
      ...player,
      deck: [...restDeck, revealed],
    }),
  };

  if (matches) {
    const leaveResult = tryLeaveField(nextState, {
      ownerPlayerId: enemyId,
      instanceId: targetInstanceId,
      fromZone,
      toZone: "discard",
      leavingCardId: targetFound.card.cardId,
      phasePlayerId: ctx.phasePlayerId,
    });
    if (leaveResult.deferred) {
      return { state: leaveResult.state, detail: `judgment_pending:${targetName}:${revealedName}` };
    }
    nextState = leaveResult.state;
    return { state: nextState, detail: `judgment:hit:${targetName}:${revealedName}` };
  }

  return { state: nextState, detail: `judgment:miss:${targetName}:${revealedName}` };
}

function grantSpLevel(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  level: 1 | 2 | 3,
): GameState {
  let next = state;
  for (let i = 0; i < level; i += 1) {
    next = grantSp1ToBattleUnit(next, playerId, instanceId);
  }
  return next;
}

export function applyGrantKeyword(
  state: GameState,
  ctx: GrantKeywordContext,
  keyword: string,
): GrantKeywordResult {
  switch (keyword) {
    case "bp_plus_per_own_damage": {
      const instanceId = ctx.triggerSourceInstanceId;
      if (!instanceId || !isValidOwnSmallUnitTarget(state, ctx.playerId, instanceId)) {
        return { state };
      }
      const player = state.players[ctx.playerId];
      const nextPlayer = setAuraPowerInstanceId(player, instanceId, ctx.sourceCardId);
      const name = cardName(
        state.definitions,
        findOwnUnit(player, instanceId)?.card.cardId ?? ctx.sourceCardId,
      );
      return { state: { ...state, ...updatePlayer(state, ctx.playerId, nextPlayer) }, detail: `aura_power:${name}` };
    }
    case "reveal_top_destroy_if_same_size":
      return resolveJudgmentKeyword(state, ctx);
    case "SP1": {
      const instanceId = ctx.triggerSourceInstanceId;
      if (!instanceId) return { state };
      return {
        state: grantSpLevel(state, ctx.playerId, instanceId, 1),
        detail: "sp1",
      };
    }
    case "SP2": {
      const instanceId = ctx.triggerSourceInstanceId;
      if (!instanceId) return { state };
      return {
        state: grantSpLevel(state, ctx.playerId, instanceId, 2),
        detail: "sp2",
      };
    }
    case "SP3": {
      const instanceId = ctx.triggerSourceInstanceId;
      if (!instanceId) return { state };
      return {
        state: grantSpLevel(state, ctx.playerId, instanceId, 3),
        detail: "sp3",
      };
    }
    case "use_printed_bp_in_battle": {
      const instanceId = ctx.triggerSourceInstanceId;
      if (!instanceId) return { state };
      return {
        state: markBattleNcEffect(state, ctx.playerId, instanceId, ctx.effectId),
        detail: ctx.effectId,
      };
    }
    case "prevent_counter": {
      const instanceId = ctx.triggerSourceInstanceId;
      if (!instanceId) return { state };
      return {
        state: markBattleNcEffect(state, ctx.playerId, instanceId, ctx.effectId),
        detail: ctx.effectId,
      };
    }
    case "attack_rush_zone": {
      const instanceId = ctx.triggerSourceInstanceId;
      if (!instanceId) return { state };
      return {
        state: markBattleNcEffect(state, ctx.playerId, instanceId, ctx.effectId),
        detail: ctx.effectId,
      };
    }
    case "force_enemy_s_rush_to_battle": {
      const instanceId = ctx.triggerSourceInstanceId;
      if (!instanceId) return { state };
      const withChoice = startPitInDiveOrderChoice(
        state,
        ctx.playerId,
        ctx.sourceCardId,
        instanceId,
      );
      if (!withChoice) return { state };
      return { state: withChoice, detail: "pit_in_dive" };
    }
    case "radial_hammer_scry": {
      const instanceId = ctx.triggerSourceInstanceId;
      if (!instanceId) return { state };
      const withChoice = startRadialHammerChoice(
        state,
        ctx.playerId,
        ctx.sourceCardId,
        instanceId,
      );
      if (!withChoice) return { state };
      return { state: withChoice, detail: "radial_hammer" };
    }
    case "force_opponent_hold_command": {
      const enemyId = opponent(ctx.playerId);
      const withChoice = startSelectCommandChoice(state, {
        playerId: enemyId,
        effectId: ctx.effectId,
        sourceCardId: ctx.sourceCardId,
        phasePlayerId: ctx.phasePlayerId,
        commandFilter: "released",
        commandAction: "hold",
        optional: true,
      });
      if (!withChoice) return { state };
      return { state: withChoice, detail: ctx.effectId };
    }
    case "hold_all_enemy_commands": {
      const enemyId = opponent(ctx.playerId);
      const enemy = state.players[enemyId];
      const command = enemy.command.map((c) => ({ ...c, commandHeld: true }));
      return {
        state: { ...state, ...updatePlayer(state, enemyId, { ...enemy, command }) },
        detail: "sky_magic_slash",
      };
    }
    case "prevent_leave_with_power_cost": {
      if (!ctx.leavingCardId) return { state };
      const leavingDef = getDefinition(state.definitions, ctx.leavingCardId);
      const drawCost = parsePowerCost(leavingDef?.powerCost ?? 0);
      const owner = state.players[ctx.playerId];
      const drawn = owner.deck.slice(0, drawCost);
      const restDeck = owner.deck.slice(drawCost);
      const nextOwner = {
        ...owner,
        deck: restDeck,
        discard: [...owner.discard, ...drawn],
      };
      return {
        state: { ...state, ...updatePlayer(state, ctx.playerId, nextOwner) },
        detail: `dino_guts:${drawCost}`,
      };
    }
    default:
      if (isRuntimeGrantKeyword(keyword)) {
        return applyRuntimeGrantKeyword(
          state,
          ctx,
          runtimeEffectIdFromKeyword(keyword),
        );
      }
      if (keyword.startsWith("effect_")) {
        const resolved = effectDelegateSlot.resolver?.(state, ctx, keyword);
        if (resolved) return resolved;
        return { state, detail: keyword };
      }
      if (PASSIVE_GRANT_KEYWORDS.has(keyword)) {
        return { state, detail: keyword };
      }
      return { state };
  }
}
