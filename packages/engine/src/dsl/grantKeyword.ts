import type { GameState, PendingBattle, PlayerId } from "../types/game";
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
  startEnterHoldEnemyPowerLeDamageChoice,
  startHangaEvolutionChoice,
  startEnterRushFromDiscardFeatureChoice,
  startSphinxPowerQuizChoice,
  startSuperDrillRushChoice,
  startSiteTransportChoice,
  startOnRushDeckResidentChoice,
  startGaoriJawDestroyChoice,
  startTimeJetProtectChoice,
  startTimeJetCategoryProtectChoice,
  startPhoenixMereDestroyChoice,
} from "../rules/pendingChoices";
import { applyFalconSummonerOperation } from "../rules/falconSummoner";
import {
  applyPinkRaiderVehicleReturn,
  releaseHeldSUnitCommands,
} from "../rules/batch03RushEffects";
import {
  applyGaroaGrudgeEnterBattle,
  applyHungerGodOnRush,
  applySilverBlazerEnterBattle,
} from "../rules/batch04FieldEffects";
import { getDslEffectById } from "./effectLookup";
import { applyEmpireDominionEnterBattle } from "../rules/empireDominion";
import { applyRexLaserOnRush } from "../rules/rexLaser";
import {
  applyBeastRodOperation,
  applyClimberBallEnterBattle,
  applyFireGeneralEnterBattle,
  applyAkaRedSoulEnterBattle,
} from "../rules/batch05FieldEffects";
import { beginCastoffOnRush } from "../rules/castoff";
import {
  beginAssaultVectorDestroy,
  beginDinoSlasherDiscard,
  beginOpponentHoldByCategoryCount,
} from "../rules/zoneCategoryEffects";
import { beginKamenRideMorphChoice } from "../keywords/activeMorph";
import { isValidOwnSmallUnitTarget } from "./targetSelectors";
import {
  applyRuntimeGrantKeyword,
  isRuntimeGrantKeyword,
  runtimeEffectIdFromKeyword,
} from "./runtimeEffectDispatch";
import { effectDelegateSlot } from "./effectDelegateSlot";
import { isEngineNativeGrantKeyword } from "./promotedKeywordBridge";
import { isCatchallGrantKeyword } from "./hashGrantKeywordStub";
import { setGenericSComboFinisher, setBattleDestroyToPower, addComboNumberDelta } from "../rules/turnModifierBridge";
import { superPowerAttackBonus } from "../core/catalog";

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
  "cannot_attack",
  "counter_redirect_attack",
  "m_battle_entry_requires_hold",
  "fusion_material_alias",
  "battle_entry_hold_1",
  "require_command_hold_entry",
  "last_battle_protect_other_s",
  "substitute_on_wb_destroy",
  "win_but_destroyed_vs_sp1",
  "destroy_on_win_vs_sp1",
  "no_battle_entry_turn_rushed",
  "morph",
  "resident",
  "wing",
  "chase",
  "register",
  "commander",
  "mothership",
  "while_in_field_formation_deploy",
  "v_commander_hold_entry",
  "battle_entry_discard_sensho_7",
  "while_in_field_da_rush_discard_sensho_power",
  "while_in_field_ally_enter_mere_chameleon",
  "start_end_command_toggle_hold_discard",
  "on_cease_shuffle_all_discard_to_deck",
  "deck_unlimited",
  "note_bp_per_own_command_feature_red",
  "ride_bp_boost_500",
  "ride_bp_boost_1000",
  "cross1",
  "blast",
  "breaker",
  "scrum",
  "not_selectable_except_attack",
  "no_strike_after_rideoff",
  "all_enemy_s_auto_battle_entry",
  "combo_l_category_sp1",
  "combo_l_category_attack_rush",
  "opponent_destroy_lower_bp_on_battle_win",
  "while_command_leave_hold_from_discard",
  "while_opponent_operation_discard_power",
  "while_da_s_cannot_battle_entry",
  "bp_debuff_per_non_ot_command",
  "category_wb_while_in_battle",
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
  "castoff_on_rush",
  "opponent_hold_commands_by_category",
  "dino_slasher_category_balance",
  "assault_vector_destroy",
  "blood_vessel_on_strike",
  "attack_ride_replace",
  "battle_destroy_to_power",
  "combo_number_delta_minus_1",
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
  optional?: boolean;
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

function parseFeatureFromEffectText(text: string): string {
  return text.match(/特徴「([^」]+)」/)?.[1] ?? "メカ";
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
    case "combo_number_delta_minus_1": {
      const player = state.players[ctx.playerId];
      return {
        state: {
          ...state,
          ...updatePlayer(state, ctx.playerId, addComboNumberDelta(player, -1)),
        },
        detail: "combo_number_delta_minus_1",
      };
    }
    case "nc_sp1_if_no_enemy_units": {
      const instanceId = ctx.triggerSourceInstanceId ?? ctx.operationInstanceId;
      if (!instanceId) return { state, detail: keyword };
      const enemy = state.players[opponent(ctx.playerId)];
      const enemyUnitCount =
        enemy.battle.length + enemy.rush.length + enemy.command.length;
      if (enemyUnitCount > 0) return { state, detail: keyword };
      return {
        state: grantSp1ToBattleUnit(state, ctx.playerId, instanceId),
        detail: keyword,
      };
    }
    case "battle_destroy_to_power": {
      const instanceId = ctx.triggerSourceInstanceId;
      if (!instanceId) return { state };
      const player = state.players[ctx.playerId];
      return {
        state: {
          ...state,
          ...updatePlayer(
            state,
            ctx.playerId,
            setBattleDestroyToPower(player, instanceId, ctx.sourceCardId),
          ),
        },
        detail: "battle_destroy_to_power",
      };
    }
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
    case "enter_hold_enemy_power_le_opponent_damage": {
      const withChoice = startEnterHoldEnemyPowerLeDamageChoice(state, {
        playerId: ctx.playerId,
        effectId: ctx.effectId,
        sourceCardId: ctx.sourceCardId,
        sourceInstanceId: ctx.triggerSourceInstanceId,
        phasePlayerId: ctx.phasePlayerId,
      });
      if (!withChoice) return { state };
      return { state: withChoice, detail: ctx.effectId };
    }
    case "enter_scry_top_wb_m_rush": {
      const withChoice = startHangaEvolutionChoice(state, {
        playerId: ctx.playerId,
        sourceCardId: ctx.sourceCardId,
        sourceInstanceId: ctx.triggerSourceInstanceId,
        phasePlayerId: ctx.phasePlayerId,
      });
      if (!withChoice) return { state };
      return { state: withChoice, detail: "hanga" };
    }
    case "enter_rush_discard_feature_m_silent": {
      const effect = getDslEffectById(ctx.sourceCardId, ctx.effectId);
      const feature =
        effect?.text?.match(/特徴「([^」]+)」/)?.[1] ?? "車両";
      const withChoice = startEnterRushFromDiscardFeatureChoice(state, {
        playerId: ctx.playerId,
        effectId: ctx.effectId,
        sourceCardId: ctx.sourceCardId,
        sourceInstanceId: ctx.triggerSourceInstanceId,
        phasePlayerId: ctx.phasePlayerId,
        feature,
      });
      if (!withChoice) return { state };
      return { state: withChoice, detail: ctx.effectId };
    }
    case "sphinx_power_quiz": {
      const withChoice = startSphinxPowerQuizChoice(state, {
        playerId: ctx.playerId,
        effectId: ctx.effectId,
        sourceCardId: ctx.sourceCardId,
        sourceInstanceId: ctx.triggerSourceInstanceId,
        phasePlayerId: ctx.phasePlayerId,
      });
      if (!withChoice) return { state };
      return { state: withChoice, detail: ctx.effectId };
    }
    case "enter_battle_discard_rush_feature_sp1": {
      const effect = getDslEffectById(ctx.sourceCardId, ctx.effectId);
      const feature =
        effect?.text?.match(/特徴「([^」]+)」/)?.[1] ?? "恐竜";
      const withChoice = startSuperDrillRushChoice(state, {
        playerId: ctx.playerId,
        effectId: ctx.effectId,
        sourceCardId: ctx.sourceCardId,
        sourceInstanceId: ctx.triggerSourceInstanceId,
        phasePlayerId: ctx.phasePlayerId,
        feature,
      });
      if (!withChoice) return { state };
      return { state: withChoice, detail: ctx.effectId };
    }
    case "on_rush_command_discard_deck_feature_m_hold": {
      const effect = getDslEffectById(ctx.sourceCardId, ctx.effectId);
      const feature = parseFeatureFromEffectText(effect?.text ?? "");
      const withChoice = startSiteTransportChoice(state, {
        playerId: ctx.playerId,
        effectId: ctx.effectId,
        sourceCardId: ctx.sourceCardId,
        sourceInstanceId: ctx.triggerSourceInstanceId,
        phasePlayerId: ctx.phasePlayerId,
        feature,
      });
      if (!withChoice) return { state };
      return { state: withChoice, detail: ctx.effectId };
    }
    case "on_rush_deck_resident_operation": {
      const withChoice = startOnRushDeckResidentChoice(state, {
        playerId: ctx.playerId,
        effectId: ctx.effectId,
        sourceCardId: ctx.sourceCardId,
        sourceInstanceId: ctx.triggerSourceInstanceId,
        phasePlayerId: ctx.phasePlayerId,
      });
      if (!withChoice) return { state };
      return { state: withChoice, detail: ctx.effectId };
    }
    case "on_rush_send_printed_bp3000_to_power": {
      return {
        state: applyRexLaserOnRush(state, ctx.phasePlayerId),
        detail: ctx.effectId,
      };
    }
    case "on_rush_destroy_enemy_multicat_bp9000": {
      const withChoice = startGaoriJawDestroyChoice(state, {
        playerId: ctx.playerId,
        effectId: ctx.effectId,
        sourceCardId: ctx.sourceCardId,
        sourceInstanceId: ctx.triggerSourceInstanceId,
        phasePlayerId: ctx.phasePlayerId,
      });
      if (!withChoice) return { state };
      return { state: withChoice, detail: ctx.effectId };
    }
    case "on_rush_send_enemy_battle_feature_m_to_power": {
      const withChoice = startTimeJetProtectChoice(state, {
        playerId: ctx.playerId,
        effectId: ctx.effectId,
        sourceCardId: ctx.sourceCardId,
        sourceInstanceId: ctx.triggerSourceInstanceId,
        phasePlayerId: ctx.phasePlayerId,
      });
      if (!withChoice) return { state };
      return { state: withChoice, detail: ctx.effectId };
    }
    case "on_rush_return_unridden_s_vehicles_deck_bottom": {
      return {
        state: applyPinkRaiderVehicleReturn(state, ctx.phasePlayerId),
        detail: ctx.effectId,
      };
    }
    case "on_rush_release_held_s_units": {
      return {
        state: releaseHeldSUnitCommands(state, ctx.playerId),
        detail: ctx.effectId,
      };
    }
    case "operation_enemy_damage_reveal_beast_rush": {
      return {
        state: applyFalconSummonerOperation(state, ctx.playerId),
        detail: ctx.effectId,
      };
    }
    case "enter_battle_hand_match_destroy_sp": {
      const instanceId = ctx.triggerSourceInstanceId;
      if (!instanceId) return { state };
      return {
        state: applyEmpireDominionEnterBattle(
          state,
          ctx.playerId,
          instanceId,
          ctx.phasePlayerId,
        ),
        detail: ctx.effectId,
      };
    }
    case "enter_battle_enemy_red_feature_to_rush": {
      const instanceId = ctx.triggerSourceInstanceId;
      if (!instanceId) return { state };
      return {
        state: applyGaroaGrudgeEnterBattle(
          state,
          ctx.playerId,
          instanceId,
          ctx.phasePlayerId,
        ),
        detail: ctx.effectId,
      };
    }
    case "enter_battle_command_return_hand_bp2000_sp1": {
      const instanceId = ctx.triggerSourceInstanceId;
      if (!instanceId) return { state };
      return {
        state: applySilverBlazerEnterBattle(
          state,
          ctx.playerId,
          instanceId,
          ctx.phasePlayerId,
        ),
        detail: ctx.effectId,
      };
    }
    case "on_rush_deck_split_hunger_god": {
      return {
        state: applyHungerGodOnRush(state, ctx.playerId),
        detail: ctx.effectId,
      };
    }
    case "operation_enemy_s_command_hold_or_destroy": {
      const operationInstanceId = ctx.operationInstanceId;
      if (!operationInstanceId) return { state };
      return {
        state: applyBeastRodOperation(
          state,
          ctx.playerId,
          operationInstanceId,
          ctx.phasePlayerId,
        ),
        detail: ctx.effectId,
      };
    }
    case "on_rush_send_enemy_battle_category_m_to_power": {
      const effect = getDslEffectById(ctx.sourceCardId, ctx.effectId);
      const category = effect?.text?.match(/から([A-Z]{2,})のMユニット/)?.[1] ?? "MA";
      const withChoice = startTimeJetCategoryProtectChoice(state, {
        playerId: ctx.playerId,
        effectId: ctx.effectId,
        sourceCardId: ctx.sourceCardId,
        sourceInstanceId: ctx.triggerSourceInstanceId,
        phasePlayerId: ctx.phasePlayerId,
        category,
      });
      if (!withChoice) return { state };
      return { state: withChoice, detail: ctx.effectId };
    }
    case "enter_battle_hold_red_nc_command_soul": {
      const instanceId = ctx.triggerSourceInstanceId;
      if (!instanceId) return { state };
      return {
        state: applyAkaRedSoulEnterBattle(
          state,
          ctx.playerId,
          instanceId,
          ctx.phasePlayerId,
        ),
        detail: ctx.effectId,
      };
    }
    case "enter_battle_discard_rush_name_bp4000": {
      const instanceId = ctx.triggerSourceInstanceId;
      if (!instanceId) return { state };
      return {
        state: applyClimberBallEnterBattle(
          state,
          ctx.playerId,
          instanceId,
          ctx.phasePlayerId,
        ),
        detail: ctx.effectId,
      };
    }
    case "on_destroy_reanimate_named_from_discard": {
      const effect = getDslEffectById(ctx.sourceCardId, ctx.effectId);
      const partnerName =
        effect?.text?.match(/[「｢]([^」｣]+)[」｣]/)?.[1] ?? "獣人メレ";
      const withChoice = startPhoenixMereDestroyChoice(state, {
        playerId: ctx.playerId,
        effectId: ctx.effectId,
        sourceCardId: ctx.sourceCardId,
        phasePlayerId: ctx.phasePlayerId,
        partnerName,
      });
      if (!withChoice) return { state };
      return { state: withChoice, detail: ctx.effectId };
    }
    case "enter_battle_enemy_command_match_own_count_power_discard": {
      const instanceId = ctx.triggerSourceInstanceId;
      if (!instanceId) return { state };
      return {
        state: applyFireGeneralEnterBattle(
          state,
          ctx.playerId,
          instanceId,
          ctx.phasePlayerId,
        ),
        detail: ctx.effectId,
      };
    }
    case "while_in_field_formation_deploy":
    case "while_in_field_da_rush_discard_sensho_power":
    case "v_commander_hold_entry":
    case "battle_entry_discard_sensho_7":
    case "mothership": {
      return { state, detail: keyword };
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
    case "castoff_on_rush": {
      const instanceId = ctx.triggerSourceInstanceId;
      if (!instanceId) return { state };
      const withChoice = beginCastoffOnRush(state, {
        playerId: ctx.playerId,
        sourceCardId: ctx.sourceCardId,
        sourceInstanceId: instanceId,
        phasePlayerId: ctx.phasePlayerId,
      });
      if (!withChoice) return { state };
      return { state: withChoice, detail: "castoff_on_rush" };
    }
    case "opponent_hold_commands_by_category": {
      const withChoice = beginOpponentHoldByCategoryCount(state, {
        effectOwnerId: ctx.playerId,
        effectId: ctx.effectId,
        sourceCardId: ctx.sourceCardId,
        sourceInstanceId: ctx.triggerSourceInstanceId,
        phasePlayerId: ctx.phasePlayerId,
      });
      if (!withChoice) return { state };
      return { state: withChoice, detail: ctx.effectId };
    }
    case "dino_slasher_category_balance": {
      const withChoice = beginDinoSlasherDiscard(state, {
        effectOwnerId: ctx.playerId,
        effectId: ctx.effectId,
        sourceCardId: ctx.sourceCardId,
        sourceInstanceId: ctx.triggerSourceInstanceId,
        phasePlayerId: ctx.phasePlayerId,
      });
      if (!withChoice) return { state };
      return { state: withChoice, detail: "dino_slasher" };
    }
    case "assault_vector_destroy": {
      const withChoice = beginAssaultVectorDestroy(state, {
        effectOwnerId: ctx.playerId,
        effectId: ctx.effectId,
        sourceCardId: ctx.sourceCardId,
        phasePlayerId: ctx.phasePlayerId,
      });
      if (!withChoice) return { state };
      return { state: withChoice, detail: "assault_vector" };
    }
    case "blood_vessel_on_strike": {
      return { state, detail: "blood_vessel_on_strike" };
    }
    case "attack_ride_replace": {
      const instanceId = ctx.triggerSourceInstanceId;
      if (!instanceId) return { state };
      const withChoice = beginKamenRideMorphChoice(
        state,
        ctx.playerId,
        instanceId,
        ctx.sourceCardId,
        ctx.effectId,
        ctx.phasePlayerId,
        ctx.optional ?? true,
      );
      if (!withChoice) return { state, detail: "attack_ride_no_candidates" };
      return { state: withChoice, detail: "kamen_ride_morph" };
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
    default: {
      const sCombo = keyword.match(/^s_combo_finisher_(\d+)_sp(\d+)_bp(\d+)$/);
      if (sCombo) {
        const player = state.players[ctx.playerId];
        const nextPlayer = setGenericSComboFinisher(
          player,
          {
            position: Number(sCombo[1]),
            sp: Number(sCombo[2]),
            bp: Number(sCombo[3]),
          },
          ctx.sourceCardId,
        );
        return {
          state: { ...state, ...updatePlayer(state, ctx.playerId, nextPlayer) },
          detail: keyword,
        };
      }

      const optionalBattle = keyword.match(
        /^optional_enemy_battle_min_bp_(\d+)(_no_attack)?$/,
      );
      if (optionalBattle) {
        const defenderInstanceId = ctx.triggerSourceInstanceId;
        if (!defenderInstanceId) return { state };
        const player = state.players[ctx.playerId];
        const attacker = player.battle.find((c) => c.cardId === ctx.sourceCardId);
        if (!attacker) return { state };
        const enemyId = opponent(ctx.playerId);
        let nextState = state;
        if (optionalBattle[2]) {
          nextState = markBattleNcEffect(
            nextState,
            ctx.playerId,
            attacker.instanceId,
            "optional_battle_no_attack",
          );
        }
        const pending: PendingBattle = {
          attackerPlayerId: ctx.playerId,
          attackerInstanceId: attacker.instanceId,
          defenderPlayerId: enemyId,
          defenderInstanceId,
          phasePlayerId: ctx.phasePlayerId,
          attackerBpBonus: superPowerAttackBonus(nextState, ctx.playerId, attacker),
        };
        return {
          state: { ...nextState, pendingBattle: pending },
          detail: "optional_enemy_battle",
        };
      }

      if (keyword.startsWith("bp_plus_on_battle_own_turn_")) {
        return { state, detail: keyword };
      }

      if (keyword.startsWith("battle_destroy_to_power_self")) {
        const instanceId = ctx.operationInstanceId ?? ctx.triggerSourceInstanceId;
        if (!instanceId) return { state };
        const player = state.players[ctx.playerId];
        return {
          state: {
            ...state,
            ...updatePlayer(
              state,
              ctx.playerId,
              setBattleDestroyToPower(player, instanceId, ctx.sourceCardId),
            ),
          },
          detail: keyword,
        };
      }

      if (
        keyword.startsWith("power_zone_min_") ||
        (keyword.startsWith("all_") && keyword.endsWith("_auto_battle_entry")) ||
        keyword.startsWith("end_turn_return_if_no_") ||
        keyword.startsWith("rush_trim_power_") ||
        keyword.startsWith("rush_skip_command_hold_") ||
        keyword.startsWith("end_turn_return_hand_if_no_") ||
        keyword.startsWith("require_power_discard_") ||
        keyword.startsWith("attack_bp_plus_vs_") ||
        keyword === "ignore_rule_hold_command_entry" ||
        keyword === "combo_wb_m_bp3000_sp1_destroy_end" ||
        keyword === "deck_search_minus_power_rush" ||
        keyword === "opponent_rush_s_to_hand" ||
        keyword === "opponent_rush_s_to_battle" ||
        keyword === "combo_number_delta_minus_1" ||
        keyword === "nc_sp1_if_no_enemy_units" ||
        keyword.startsWith("deck_search_") ||
        keyword.startsWith("hold_all_enemy_bp") ||
        keyword === "opponent_hand_counter_to_power" ||
        keyword === "deck_search_operation_to_power" ||
        keyword === "alternating_draw_3_mill" ||
        keyword === "deploy_enemy_command_silent" ||
        keyword === "release_m_command_to_rush" ||
        keyword === "draw_deck_to_command_or_hand" ||
        (keyword.startsWith("return_") && keyword.endsWith("_battle_to_deck_bottom"))
      ) {
        return { state, detail: keyword };
      }

      if (isCatchallGrantKeyword(keyword)) {
        const resolved = effectDelegateSlot.resolver?.(state, ctx, keyword);
        if (resolved && resolved.detail !== keyword) return resolved;
        return { state, detail: keyword };
      }

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
      if (PASSIVE_GRANT_KEYWORDS.has(keyword) || isEngineNativeGrantKeyword(keyword)) {
        return { state, detail: keyword };
      }
      return { state };
    }
  }
}
