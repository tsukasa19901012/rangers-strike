import type { GameAction, RushAction } from "../types/actions";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState, PlayerId, PlayerState } from "../types/game";
import { COMMAND_ZONE_MAX } from "../types/game";
import { getRidingComboEffect } from "@rangers-strike/cards";
import {
  canPlayOperationCard,
  collectOperationTargets,
  needsOperationTarget,
} from "../effects/resolveOperation";
import {
  canPlayOperation,
  canRushUnitExceptCommandHold,
  cardCategories,
  getDefinition,
  hasOperationEffect,
  isSmallUnit,
  isUnit,
  needsZordMaterial,
  parsePowerCost,
} from "./catalog";
import { findInZone, opponent, payPowerCost } from "./helpers";
import { canStrikeUnit } from "../rules/combo";
import { canAttackRushWithYellowThunder } from "../rules/namedUnitEffects";
import { canMoveUnitToBattle, countHeldCommands, mustEnterBattleBeforePhaseEnd } from "../rules/restrictions";
import { canInitiateShironLight, isShironLightRushTarget } from "../rules/shironLight";
import {
  canAttackDefender,
  darkDealRushPowerBudget,
} from "../rules/legend3/restrictions";
import {
  getCategoryPaymentOptions,
  isInitiateCommandPaymentLegal,
  isResolveCommandPaymentLegal,
  buildEffectHoldPayment,
  needsEffectHoldPayment,
} from "../rules/commandPayment";
import { hasCommandForCardUse } from "../rules/restrictions";
import {
  canBeginZordSetup,
  listZordSetupResolveActions,
} from "../rules/zordSetup";
import { canToggleBpBudgetTarget } from "../rules/pendingChoices";
import { canBonusDraw, canReleaseStartCommands, canReturnBattleAtStart } from "../rules/startPhase";
import { listZordRushPaymentVariants } from "../rules/mothership";
import { collectZordMaterials, requiresAllFusionPartners } from "../rules/zord";
import {
  canPlayDinoGutsLeaveCounter,
  canPlayHandCounter,
  collectHiddenNinjaSubstitutes,
  getCounterEffectId,
  hasPlayableDinoChronicleCounter,
} from "../rules/operationCounters";
import {
  canPlayPlasmaEnergyCounter,
  collectFiveTechInterceptors,
} from "../rules/strikeReactions";
import { getValidDamagePowerTargets } from "../rules/damagePayment";
import { getCardEffect } from "@rangers-strike/cards";
import { getTurnModifiers } from "../rules/turnModifiers";

function assertActive(state: GameState, playerId: PlayerId): boolean {
  return state.activePlayer === playerId && state.winner === null;
}

function appendStrikeReactionActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  const pending = state.pendingStrike;
  if (!pending) return;

  const defenderId = opponent(pending.strikerPlayerId);
  if (playerId !== defenderId) return;

  for (const interceptInstanceId of collectFiveTechInterceptors(state, defenderId)) {
    actions.push({
      type: "five_tech_intercept",
      playerId: defenderId,
      interceptInstanceId,
    });
  }

  if (canPlayPlasmaEnergyCounter(state, defenderId)) {
    actions.push({ type: "use_plasma_energy", playerId: defenderId });
  }

  actions.push({ type: "pass_strike_reaction", playerId: defenderId });
}

function appendBattleReactionActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  const pending = state.pendingBattle;
  if (!pending || playerId !== pending.defenderPlayerId) return;

  const defender = state.players[pending.defenderPlayerId];
  const defenderCard = findInZone(defender, "battle", pending.defenderInstanceId)?.card;

  for (const card of defender.hand) {
    if (!canPlayHandCounter(state, playerId, card.instanceId)) continue;
    const effectId = getCounterEffectId(state, playerId, card.instanceId);
    if (effectId === "new_gymnastics") {
      if (!defenderCard || !isSmallUnit(state.definitions, defenderCard.cardId)) continue;
      actions.push({ type: "play_counter", playerId, instanceId: card.instanceId });
    }
    if (effectId === "hidden_ninja") {
      for (const sub of collectHiddenNinjaSubstitutes(state, [
        pending.defenderInstanceId,
        pending.attackerInstanceId,
      ])) {
        actions.push({
          type: "play_counter",
          playerId,
          instanceId: card.instanceId,
          substituteInstanceId: sub.instanceId,
        });
      }
    }
  }

  actions.push({ type: "pass_battle_reaction", playerId });
}

function appendRushReactionActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  const pending = state.pendingRush;
  if (!pending) return;
  const defenderId = opponent(pending.rusherPlayerId);
  if (playerId !== defenderId) return;

  const defender = state.players[defenderId];
  for (const card of defender.hand) {
    if (getCounterEffectId(state, defenderId, card.instanceId) !== "shippu_ninja") continue;
    if (!canPlayHandCounter(state, defenderId, card.instanceId)) continue;
    actions.push({ type: "play_counter", playerId: defenderId, instanceId: card.instanceId });
  }

  actions.push({ type: "pass_rush_reaction", playerId: defenderId });
}

function appendLeaveReactionActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  const pending = state.pendingLeave;
  if (!pending || playerId !== pending.ownerPlayerId) return;

  const owner = state.players[pending.ownerPlayerId];
  for (const card of owner.hand) {
    const effectId = getCounterEffectId(state, pending.ownerPlayerId, card.instanceId);
    if (effectId === "dino_chronicle") {
      if (
        !hasPlayableDinoChronicleCounter(state, pending.ownerPlayerId, pending.leavingCardId, {
          requireEnemyTurn: false,
        })
      ) {
        continue;
      }
    } else if (effectId === "dino_guts") {
      if (
        !canPlayDinoGutsLeaveCounter(
          state,
          pending.ownerPlayerId,
          pending.leavingCardId,
          card.instanceId,
          { requireEnemyTurn: false },
        )
      ) {
        continue;
      }
    } else {
      continue;
    }
    if (!canPlayHandCounter(state, pending.ownerPlayerId, card.instanceId)) continue;
    actions.push({
      type: "play_counter",
      playerId: pending.ownerPlayerId,
      instanceId: card.instanceId,
    });
  }

  if (pending.superShieldInstanceId) {
    actions.push({
      type: "use_super_shield",
      playerId: pending.ownerPlayerId,
    });
  }

  actions.push({ type: "pass_leave_reaction", playerId: pending.ownerPlayerId });
}

function appendZordSetupActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  const player = state.players[playerId];
  for (const card of player.hand) {
    const definition = getDefinition(state.definitions, card.cardId);
    if (!isUnit(definition) || !needsZordMaterial(state.definitions, card.cardId)) {
      continue;
    }
    if (requiresAllFusionPartners(card.cardId)) continue;
    if (findDirectZordRushAction(state, playerId, card.instanceId)) continue;
    if (!canBeginZordSetup(state, playerId, card.instanceId)) continue;
    actions.push({
      type: "begin_zord_setup",
      playerId,
      zordInstanceId: card.instanceId,
    });
  }
}

function appendOperationActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  const player = state.players[playerId];

  for (const card of player.hand) {
    if (!canPlayOperationCard(state.definitions, card.cardId)) continue;
    const definition = getDefinition(state.definitions, card.cardId);
    if (!definition || !canPlayOperation(player, state.definitions, definition)) continue;

    const effect = getCardEffect(card.cardId);

    if (effect?.effectId === "cyber_s_rider") {
      const others = player.hand.filter((c) => c.instanceId !== card.instanceId);
      if (others.length === 0) continue;
      for (let i = 0; i < others.length; i += 1) {
        actions.push({
          type: "play_operation",
          playerId,
          instanceId: card.instanceId,
          targetInstanceId: others[i]!.instanceId,
        });
        for (let j = i + 1; j < others.length; j += 1) {
          if (player.command.length + 2 > COMMAND_ZONE_MAX) continue;
          actions.push({
            type: "play_operation",
            playerId,
            instanceId: card.instanceId,
            targetInstanceId: others[i]!.instanceId,
            extraInstanceId: others[j]!.instanceId,
          });
        }
      }
      continue;
    }

    if (needsOperationTarget(card.cardId)) {
      for (const targetInstanceId of collectOperationTargets(state, playerId, card.cardId)) {
        actions.push({
          type: "play_operation",
          playerId,
          instanceId: card.instanceId,
          targetInstanceId,
        });
      }
    } else if (effect?.effectId === "denji_machine" && player.deck.length < 3) {
      continue;
    } else {
      actions.push({
        type: "play_operation",
        playerId,
        instanceId: card.instanceId,
      });
    }
  }
}

function appendHidoraEggActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  if (state.phase !== "rush") return;
  const player = state.players[playerId];
  if (!hasOperationEffect(player, "hidora_egg", state.definitions, { state, playerId })) return;
  if (getTurnModifiers(player).hidoraEggUsed) return;
  if (player.deck.length === 0) return;
  actions.push({ type: "hidora_egg", playerId });
}

function appendShironLightActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  if (state.phase !== "rush") return;
  const player = state.players[playerId];
  for (const card of player.operation) {
    if (!canInitiateShironLight(state, playerId, card.instanceId)) continue;
    actions.push({
      type: "shiron_light",
      playerId,
      operationInstanceId: card.instanceId,
    });
  }
}

function appendBattleDanceActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  if (state.phase !== "battle") return;
  const player = state.players[playerId];
  if (!hasOperationEffect(player, "battle_dance", state.definitions)) return;
  if (countHeldCommands(player) < 2) return;

  for (const card of player.battle) {
    if (!isSmallUnit(state.definitions, card.cardId)) continue;
    actions.push({
      type: "battle_dance_retreat",
      playerId,
      battleInstanceId: card.instanceId,
    });
  }
}

const OPERATION_PHASES = new Set<GameState["phase"]>(["rush"]);

/** カテゴリ支払い済み、またはカテゴリ不要なユニットのみ直接 rush 可能。 */
function canDeclareRush(
  state: GameState,
  playerId: PlayerId,
  player: PlayerState,
  definitions: GameState["definitions"],
  definition: CardDefinition,
  instanceId: string,
  zord?: {
    zordMaterialInstanceId?: string;
    zordMothershipHoldInstanceIds?: string[];
    zordMaterialDestination?: import("../types/actions").ZordMaterialDestination;
  },
): boolean {
  const powerBudget = darkDealRushPowerBudget(state, playerId, player, definition);
  if (
    !canRushUnitExceptCommandHold(
      player,
      definitions,
      definition,
      instanceId,
      zord?.zordMaterialInstanceId,
      zord?.zordMothershipHoldInstanceIds,
      zord?.zordMaterialDestination,
      powerBudget,
    )
  ) {
    return false;
  }
  const categories = cardCategories(definition);
  if (categories.length === 0) return true;
  if (isShironLightRushTarget(player, instanceId)) return true;
  if (!player.rushCategoryHoldReady) return false;
  return hasCommandForCardUse(player, definitions, categories);
}

/** Zord in hand that already paid category hold and can rush immediately. */
export function findDirectZordRushAction(
  state: GameState,
  playerId: PlayerId,
  zordInstanceId: string,
): RushAction | null {
  const player = state.players[playerId];
  const card = player.hand.find((c) => c.instanceId === zordInstanceId);
  if (!card) return null;

  const definition = getDefinition(state.definitions, card.cardId);
  if (!definition || !isUnit(definition) || !needsZordMaterial(state.definitions, card.cardId)) {
    return null;
  }

  if (requiresAllFusionPartners(card.cardId)) {
    if (!canDeclareRush(state, playerId, player, state.definitions, definition, card.instanceId)) {
      return null;
    }
    return { type: "rush", playerId, instanceId: card.instanceId };
  }

  const materials = collectZordMaterials(
    player,
    state.definitions,
    card.cardId,
    card.instanceId,
  );
  const variants = listZordRushPaymentVariants(
    player,
    state.definitions,
    card.cardId,
    card.instanceId,
    materials,
    player.command.length < COMMAND_ZONE_MAX,
  );
  for (const variant of variants) {
    if (
      !canDeclareRush(state, playerId, player, state.definitions, definition, card.instanceId, {
        zordMaterialInstanceId: variant.zordMaterialInstanceId,
        zordMothershipHoldInstanceIds: variant.zordMothershipHoldInstanceIds,
        zordMaterialDestination: variant.zordMaterialDestination,
      })
    ) {
      continue;
    }
    return {
      type: "rush",
      playerId,
      instanceId: card.instanceId,
      zordMaterialInstanceId: variant.zordMaterialInstanceId,
      zordMaterialDestination: variant.zordMaterialDestination,
      zordMothershipHoldInstanceIds: variant.zordMothershipHoldInstanceIds,
    };
  }
  return null;
}

function appendRushCategoryPaymentActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  const player = state.players[playerId];

  const pushPayment = (
    instanceId: string,
    zord?: {
      zordMaterialInstanceId?: string;
      zordMothershipHoldInstanceIds?: string[];
      zordMaterialDestination?: import("../types/actions").ZordMaterialDestination;
    },
    prismSubstitute?: boolean,
  ) => {
    const action: GameAction = {
      type: "initiate_command_payment",
      playerId,
      kind: "category_use",
      sourceInstanceId: instanceId,
      prismSubstitute,
      zordMaterialInstanceId: zord?.zordMaterialInstanceId,
      zordMothershipHoldInstanceIds: zord?.zordMothershipHoldInstanceIds,
      zordMaterialDestination: zord?.zordMaterialDestination,
    };
    if (isInitiateCommandPaymentLegal(state, action)) {
      actions.push(action);
    }
  };

  for (const card of player.hand) {
    const definition = getDefinition(state.definitions, card.cardId);
    if (!definition || !isUnit(definition)) continue;

    const categories = cardCategories(definition);
    if (categories.length === 0) continue;

    if (needsZordMaterial(state.definitions, card.cardId)) {
      if (requiresAllFusionPartners(card.cardId)) {
        if (canDeclareRush(state, playerId, player, state.definitions, definition, card.instanceId)) {
          continue;
        }
        if (
          !canRushUnitExceptCommandHold(
            player,
            state.definitions,
            definition,
            card.instanceId,
          )
        ) {
          continue;
        }
        const options = getCategoryPaymentOptions(state, playerId, categories, {
          perRushPayment: true,
        });
        if (!options) continue;
        pushPayment(card.instanceId, undefined, options.prismSubstitute);
        if (options.prismAvailable && !options.prismSubstitute) {
          pushPayment(card.instanceId, undefined, true);
        }
      } else {
        if (
          !requiresAllFusionPartners(card.cardId) &&
          canBeginZordSetup(state, playerId, card.instanceId)
        ) {
          continue;
        }
        const materials = collectZordMaterials(
          player,
          state.definitions,
          card.cardId,
          card.instanceId,
        );
        const variants = listZordRushPaymentVariants(
          player,
          state.definitions,
          card.cardId,
          card.instanceId,
          materials,
          player.command.length < COMMAND_ZONE_MAX,
        );
        for (const variant of variants) {
          const zord = {
            zordMaterialInstanceId: variant.zordMaterialInstanceId,
            zordMothershipHoldInstanceIds: variant.zordMothershipHoldInstanceIds,
            zordMaterialDestination: variant.zordMaterialDestination,
          };
          if (canDeclareRush(state, playerId, player, state.definitions, definition, card.instanceId, zord)) {
            continue;
          }
          if (
            !canRushUnitExceptCommandHold(
              player,
              state.definitions,
              definition,
              card.instanceId,
              zord.zordMaterialInstanceId,
              zord.zordMothershipHoldInstanceIds,
              zord.zordMaterialDestination,
            )
          ) {
            continue;
          }
          const options = getCategoryPaymentOptions(state, playerId, categories, {
            perRushPayment: true,
          });
          if (!options) continue;
          pushPayment(card.instanceId, zord, options.prismSubstitute);
          if (options.prismAvailable && !options.prismSubstitute) {
            pushPayment(card.instanceId, zord, true);
          }
        }
      }
    } else {
      if (canDeclareRush(state, playerId, player, state.definitions, definition, card.instanceId)) {
        continue;
      }
      if (
        !canRushUnitExceptCommandHold(
          player,
          state.definitions,
          definition,
          card.instanceId,
        )
      ) {
        continue;
      }
      const options = getCategoryPaymentOptions(state, playerId, categories, {
        perRushPayment: true,
      });
      if (!options) continue;
      pushPayment(card.instanceId, undefined, options.prismSubstitute);
      if (options.prismAvailable && !options.prismSubstitute) {
        pushPayment(card.instanceId, undefined, true);
      }
    }
  }
}

function appendEffectChoiceActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return;

  if (pending.optional || pending.effectId === "earth_force") {
    actions.push({ type: "skip_effect_choice", playerId });
  }

  if (needsEffectHoldPayment(pending) && buildEffectHoldPayment(state)) {
    actions.push({
      type: "initiate_command_payment",
      playerId,
      kind: "effect_hold",
      sourceInstanceId: pending.sourceInstanceId ?? pending.validInstanceIds[0]!,
    });
    return;
  }

  if (pending.kind === "deck_top_or_bottom") {
    actions.push({ type: "resolve_ruin_survey", playerId, placement: "top" });
    actions.push({ type: "resolve_ruin_survey", playerId, placement: "bottom" });
    return;
  }

  if (pending.kind === "seabed_draw") {
    actions.push({ type: "resolve_seabed_draw", playerId, placement: "top" });
    actions.push({ type: "resolve_seabed_draw", playerId, placement: "bottom" });
    return;
  }

  if (pending.kind === "optional_deck_draw") {
    actions.push({ type: "resolve_effect_choice", playerId, instanceId: "draw" });
    return;
  }

  if (pending.kind === "shiron_light") {
    if (pending.shironLightMeta?.step === "pick") {
      for (const instanceId of pending.validInstanceIds) {
        actions.push({ type: "resolve_effect_choice", playerId, instanceId });
      }
      return;
    }
    if (pending.shironLightMeta?.step === "reveal") {
      actions.push({ type: "confirm_shiron_reveal", playerId });
      return;
    }
    return;
  }

  if (pending.kind === "denji_machine") {
    if (pending.denjiMachineMeta?.step === "reveal") {
      actions.push({ type: "confirm_denji_reveal", playerId });
      return;
    }
    if (pending.denjiMachineMeta?.step === "order_bottom") {
      for (const instanceId of pending.validInstanceIds) {
        actions.push({ type: "resolve_effect_choice", playerId, instanceId });
      }
      return;
    }
    return;
  }

  if (pending.kind === "select_units_bp_budget") {
    for (const instanceId of pending.validInstanceIds) {
      if (canToggleBpBudgetTarget(state, pending, instanceId)) {
        actions.push({ type: "resolve_effect_choice", playerId, instanceId });
      }
    }
    actions.push({ type: "confirm_effect_choice", playerId });
    return;
  }

  for (const instanceId of pending.validInstanceIds) {
    actions.push({ type: "resolve_effect_choice", playerId, instanceId });
  }
}

function appendBattleEntryActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  const pending = state.pendingBattleEntry;
  if (!pending || pending.playerId !== playerId) return;

  const player = state.players[playerId];
  const enemy = state.players[opponent(playerId)];
  const unit = player.battle.find((c) => c.instanceId === pending.instanceId);
  if (!unit || unit.battleActed) {
    actions.push({ type: "pass_battle_entry", playerId });
    return;
  }

  for (const defender of enemy.battle) {
    if (
      !canAttackDefender(
        state,
        playerId,
        pending.instanceId,
        opponent(playerId),
        defender.instanceId,
        canAttackRushWithYellowThunder,
      )
    ) {
      continue;
    }
    actions.push({
      type: "battle",
      playerId,
      attackerInstanceId: pending.instanceId,
      defenderInstanceId: defender.instanceId,
    });
  }
  for (const defender of enemy.rush) {
    if (
      !canAttackDefender(
        state,
        playerId,
        pending.instanceId,
        opponent(playerId),
        defender.instanceId,
        canAttackRushWithYellowThunder,
      )
    ) {
      continue;
    }
    actions.push({
      type: "battle",
      playerId,
      attackerInstanceId: pending.instanceId,
      defenderInstanceId: defender.instanceId,
    });
  }
  if (canStrikeUnit(state.definitions, unit, state, playerId)) {
    actions.push({ type: "strike", playerId, instanceId: pending.instanceId });
  }
  actions.push({ type: "pass_battle_entry", playerId });
}

function appendDamagePaymentActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  const pending = state.pendingDamagePayment;
  if (!pending || pending.playerId !== playerId) return;
  for (const instanceId of getValidDamagePowerTargets(state, pending)) {
    actions.push({ type: "resolve_damage_payment", playerId, instanceId });
  }
}

export function getLegalActions(state: GameState): GameAction[] {
  if (state.winner) return [];

  const playerId =
    state.pendingDamagePayment?.playerId ??
    state.pendingEffectChoice?.playerId ??
    state.activePlayer;
  const player = state.players[playerId];
  const actions: GameAction[] = [];

  if (state.pendingLeave) {
    appendLeaveReactionActions(state, state.pendingLeave.ownerPlayerId, actions);
    return actions;
  }

  if (state.pendingCommandPayment) {
    if (state.pendingCommandPayment.playerId === playerId) {
      actions.push({ type: "cancel_command_payment", playerId });
    }
    return actions;
  }

  if (state.pendingZordSetup) {
    if (state.pendingZordSetup.playerId === playerId) {
      actions.push(
        ...listZordSetupResolveActions(state, state.pendingZordSetup),
      );
      actions.push({ type: "cancel_zord_setup", playerId });
    }
    return actions;
  }

  if (state.pendingEffectChoice) {
    appendEffectChoiceActions(state, playerId, actions);
    return actions;
  }

  if (state.pendingDamagePayment) {
    appendDamagePaymentActions(state, playerId, actions);
    return actions;
  }

  if (state.pendingScry) {
    if (playerId === state.pendingScry.playerId) {
      actions.push({
        type: "resolve_ruin_survey",
        playerId,
        placement: "top",
      });
      actions.push({
        type: "resolve_ruin_survey",
        playerId,
        placement: "bottom",
      });
    }
    return actions;
  }

  if (state.pendingRush) {
    appendRushReactionActions(
      state,
      opponent(state.pendingRush.rusherPlayerId),
      actions,
    );
    return actions;
  }

  if (state.pendingBattle) {
    appendBattleReactionActions(state, state.pendingBattle.defenderPlayerId, actions);
    return actions;
  }

  if (state.pendingStrike) {
    appendStrikeReactionActions(
      state,
      opponent(state.pendingStrike.strikerPlayerId),
      actions,
    );
    return actions;
  }

  if (state.pendingBattleEntry) {
    appendBattleEntryActions(state, playerId, actions);
    return actions;
  }

  switch (state.phase) {
    case "start":
      if (canReleaseStartCommands(state, playerId)) {
        actions.push({ type: "release_start_commands", playerId });
      }
      if (canReturnBattleAtStart(state, playerId)) {
        for (const card of player.battle) {
          actions.push({
            type: "return_battle_unit_to_rush",
            playerId,
            battleInstanceId: card.instanceId,
          });
        }
      }
      if (!player.hasDrawnThisStart) {
        actions.push({ type: "draw", playerId });
      }
      if (canBonusDraw(state, playerId)) {
        actions.push({ type: "bonus_draw", playerId });
      }
      break;

    case "charge":
      if (!player.hasChargedThisTurn) {
        for (const card of player.hand) {
          actions.push({
            type: "charge_power",
            playerId,
            instanceId: card.instanceId,
          });
          if (player.command.length < COMMAND_ZONE_MAX) {
            actions.push({
              type: "charge_command",
              playerId,
              instanceId: card.instanceId,
            });
          }
        }
      }
      actions.push({ type: "end_phase", playerId });
      break;

    case "rush":
      for (const card of player.hand) {
        const definition = getDefinition(state.definitions, card.cardId);
        if (!isUnit(definition)) continue;

        if (needsZordMaterial(state.definitions, card.cardId)) {
          if (requiresAllFusionPartners(card.cardId)) {
            if (canDeclareRush(state, playerId, player, state.definitions, definition!, card.instanceId)) {
              actions.push({
                type: "rush",
                playerId,
                instanceId: card.instanceId,
              });
            }
          } else {
            const materials = collectZordMaterials(
              player,
              state.definitions,
              card.cardId,
              card.instanceId,
            );
            const variants = listZordRushPaymentVariants(
              player,
              state.definitions,
              card.cardId,
              card.instanceId,
              materials,
              player.command.length < COMMAND_ZONE_MAX,
            );
            for (const variant of variants) {
              if (
                !canDeclareRush(state, playerId, player, state.definitions, definition!, card.instanceId, {
                  zordMaterialInstanceId: variant.zordMaterialInstanceId,
                  zordMothershipHoldInstanceIds: variant.zordMothershipHoldInstanceIds,
                  zordMaterialDestination: variant.zordMaterialDestination,
                })
              ) {
                continue;
              }
              actions.push({
                type: "rush",
                playerId,
                instanceId: card.instanceId,
                zordMaterialInstanceId: variant.zordMaterialInstanceId,
                zordMaterialDestination: variant.zordMaterialDestination,
                zordMothershipHoldInstanceIds: variant.zordMothershipHoldInstanceIds,
              });
            }
          }
        } else if (canDeclareRush(state, playerId, player, state.definitions, definition!, card.instanceId)) {
          actions.push({
            type: "rush",
            playerId,
            instanceId: card.instanceId,
          });
        }
      }
      appendRushCategoryPaymentActions(state, playerId, actions);
      appendZordSetupActions(state, playerId, actions);
      appendOperationActions(state, playerId, actions);
      appendHidoraEggActions(state, playerId, actions);
      appendShironLightActions(state, playerId, actions);
      actions.push({ type: "end_phase", playerId });
      break;

    case "battle": {
      const enemy = state.players[opponent(playerId)];

      for (const card of player.rush) {
        if (!canMoveUnitToBattle(state, playerId, card, "rush")) continue;
        actions.push({
          type: "move_to_battle",
          playerId,
          instanceId: card.instanceId,
        });
        if (card.mountedOnInstanceId && getRidingComboEffect(card.cardId)) {
          actions.push({
            type: "move_to_battle",
            playerId,
            instanceId: card.instanceId,
            rideOff: true,
          });
        }
      }

      for (const attacker of player.battle) {
        if (attacker.battleActed) continue;
        for (const defender of enemy.battle) {
          if (
            !canAttackDefender(
              state,
              playerId,
              attacker.instanceId,
              opponent(playerId),
              defender.instanceId,
              canAttackRushWithYellowThunder,
            )
          ) {
            continue;
          }
          actions.push({
            type: "battle",
            playerId,
            attackerInstanceId: attacker.instanceId,
            defenderInstanceId: defender.instanceId,
          });
        }
        for (const defender of enemy.rush) {
          if (
            !canAttackDefender(
              state,
              playerId,
              attacker.instanceId,
              opponent(playerId),
              defender.instanceId,
              canAttackRushWithYellowThunder,
            )
          ) {
            continue;
          }
          actions.push({
            type: "battle",
            playerId,
            attackerInstanceId: attacker.instanceId,
            defenderInstanceId: defender.instanceId,
          });
        }
      }

      for (const card of player.battle) {
        if (card.battleActed) continue;
        if (!canStrikeUnit(state.definitions, card, state, playerId)) continue;
        actions.push({
          type: "strike",
          playerId,
          instanceId: card.instanceId,
        });
      }

      appendBattleDanceActions(state, playerId, actions);
      if (!mustEnterBattleBeforePhaseEnd(state, playerId)) {
        actions.push({ type: "end_phase", playerId });
      }
      break;
    }

    case "end":
      actions.push({ type: "end_phase", playerId });
      break;
  }

  return actions;
}

export function isLegalAction(state: GameState, action: GameAction): boolean {
  if (state.winner) return false;

  if (action.type === "initiate_command_payment") {
    if (!assertActive(state, action.playerId)) return false;
    return isInitiateCommandPaymentLegal(state, action);
  }

  if (action.type === "resolve_command_payment") {
    return isResolveCommandPaymentLegal(state, action);
  }

  if (action.type === "cancel_command_payment") {
    return state.pendingCommandPayment?.playerId === action.playerId;
  }

  if (state.pendingCommandPayment) {
    return false;
  }

  if (action.type === "begin_zord_setup") {
    if (!assertActive(state, action.playerId)) return false;
    return canBeginZordSetup(state, action.playerId, action.zordInstanceId);
  }

  if (action.type === "resolve_zord_setup") {
    const setup = state.pendingZordSetup;
    if (!setup || setup.playerId !== action.playerId) return false;
    return listZordSetupResolveActions(state, setup).some(
      (candidate) =>
        candidate.destination === action.destination &&
        candidate.materialInstanceId === action.materialInstanceId &&
        candidate.paymentPath === action.paymentPath,
    );
  }

  if (action.type === "cancel_zord_setup") {
    return state.pendingZordSetup?.playerId === action.playerId;
  }

  if (state.pendingZordSetup) {
    return false;
  }

  if (action.type === "end_phase" && state.phase === "start") {
    return false;
  }

  if (action.type === "resolve_damage_payment") {
    const pending = state.pendingDamagePayment;
    return (
      !!pending &&
      pending.playerId === action.playerId &&
      getValidDamagePowerTargets(state, pending).includes(action.instanceId)
    );
  }

  if (state.pendingDamagePayment) {
    return false;
  }

  if (state.pendingLeave) {
    if (action.playerId !== state.pendingLeave.ownerPlayerId) return false;
  } else if (state.pendingEffectChoice) {
    if (action.playerId !== state.pendingEffectChoice.playerId) return false;
  } else if (state.pendingBattleEntry) {
    if (action.playerId !== state.pendingBattleEntry.playerId) return false;
  } else if (state.pendingScry) {
    if (action.playerId !== state.pendingScry.playerId) return false;
  } else if (state.pendingRush) {
    if (action.playerId !== opponent(state.pendingRush.rusherPlayerId)) return false;
  } else if (state.pendingBattle) {
    if (action.playerId !== state.pendingBattle.defenderPlayerId) return false;
  } else if (state.pendingStrike) {
    const defenderId = opponent(state.pendingStrike.strikerPlayerId);
    if (action.playerId !== defenderId) return false;
  } else if (!assertActive(state, action.playerId)) {
    return false;
  }

  if (action.type === "rush" && state.phase === "rush") {
    if (!assertActive(state, action.playerId)) return false;
    const player = state.players[action.playerId];
    const handCard = player.hand.find((c) => c.instanceId === action.instanceId);
    if (handCard) {
      const definition = getDefinition(state.definitions, handCard.cardId);
      if (
        definition &&
        isUnit(definition) &&
        canDeclareRush(state, action.playerId, player, state.definitions, definition, action.instanceId, {
          zordMaterialInstanceId: action.zordMaterialInstanceId,
          zordMothershipHoldInstanceIds: action.zordMothershipHoldInstanceIds,
          zordMaterialDestination: action.zordMaterialDestination,
        })
      ) {
        return true;
      }
    }
  }

  return getLegalActions(state).some((candidate) => actionsEqual(candidate, action));
}

function actionsEqual(a: GameAction, b: GameAction): boolean {
  if (a.type !== b.type || a.playerId !== b.playerId) return false;

  if (a.type === "battle" && b.type === "battle") {
    return (
      a.attackerInstanceId === b.attackerInstanceId &&
      a.defenderInstanceId === b.defenderInstanceId
    );
  }

  if (a.type === "rush" && b.type === "rush") {
    const holdsA = [...(a.zordMothershipHoldInstanceIds ?? [])].sort().join(",");
    const holdsB = [...(b.zordMothershipHoldInstanceIds ?? [])].sort().join(",");
    return (
      a.instanceId === b.instanceId &&
      (a.zordMaterialInstanceId ?? "") === (b.zordMaterialInstanceId ?? "") &&
      (a.zordMaterialDestination ?? "") === (b.zordMaterialDestination ?? "") &&
      holdsA === holdsB
    );
  }

  if (a.type === "play_operation" && b.type === "play_operation") {
    return (
      a.instanceId === b.instanceId &&
      (a.targetInstanceId ?? "") === (b.targetInstanceId ?? "") &&
      (a.extraInstanceId ?? "") === (b.extraInstanceId ?? "")
    );
  }

  if (a.type === "play_counter" && b.type === "play_counter") {
    return (
      a.instanceId === b.instanceId &&
      (a.substituteInstanceId ?? "") === (b.substituteInstanceId ?? "")
    );
  }

  if (a.type === "five_tech_intercept" && b.type === "five_tech_intercept") {
    return a.interceptInstanceId === b.interceptInstanceId;
  }

  if (a.type === "battle_dance_retreat" && b.type === "battle_dance_retreat") {
    return a.battleInstanceId === b.battleInstanceId;
  }

  if (a.type === "return_battle_unit_to_rush" && b.type === "return_battle_unit_to_rush") {
    return a.battleInstanceId === b.battleInstanceId;
  }

  if (a.type === "shiron_light" && b.type === "shiron_light") {
    return (
      a.playerId === b.playerId &&
      a.operationInstanceId === b.operationInstanceId
    );
  }
  if (a.type === "confirm_shiron_reveal" && b.type === "confirm_shiron_reveal") {
    return a.playerId === b.playerId;
  }

  if (a.type === "resolve_ruin_survey" && b.type === "resolve_ruin_survey") {
    return a.placement === b.placement;
  }

  if (a.type === "resolve_seabed_draw" && b.type === "resolve_seabed_draw") {
    return a.placement === b.placement;
  }

  if (a.type === "confirm_denji_reveal" && b.type === "confirm_denji_reveal") {
    return true;
  }

  if (a.type === "confirm_effect_choice" && b.type === "confirm_effect_choice") {
    return a.playerId === b.playerId;
  }

  if (a.type === "resolve_effect_choice" && b.type === "resolve_effect_choice") {
    return a.instanceId === b.instanceId;
  }

  if (a.type === "resolve_command_payment" && b.type === "resolve_command_payment") {
    const idsA = [...a.commandInstanceIds].sort().join(",");
    const idsB = [...b.commandInstanceIds].sort().join(",");
    return idsA === idsB;
  }

  if (a.type === "initiate_command_payment" && b.type === "initiate_command_payment") {
    const holdsA = [...(a.zordMothershipHoldInstanceIds ?? [])].sort().join(",");
    const holdsB = [...(b.zordMothershipHoldInstanceIds ?? [])].sort().join(",");
    return (
      a.kind === b.kind &&
      a.sourceInstanceId === b.sourceInstanceId &&
      (a.prismSubstitute ?? false) === (b.prismSubstitute ?? false) &&
      (a.rideOff ?? false) === (b.rideOff ?? false) &&
      (a.zordMaterialInstanceId ?? "") === (b.zordMaterialInstanceId ?? "") &&
      (a.zordMaterialDestination ?? "") === (b.zordMaterialDestination ?? "") &&
      holdsA === holdsB &&
      (a.targetInstanceId ?? "") === (b.targetInstanceId ?? "") &&
      (a.extraInstanceId ?? "") === (b.extraInstanceId ?? "")
    );
  }

  if (a.type === "skip_effect_choice" && b.type === "skip_effect_choice") {
    return true;
  }

  if (a.type === "pass_battle_entry" && b.type === "pass_battle_entry") {
    return true;
  }

  if (a.type === "move_to_battle" && b.type === "move_to_battle") {
    return (
      a.instanceId === b.instanceId &&
      (a.rideOff ?? false) === (b.rideOff ?? false)
    );
  }

  const aHasInstance = "instanceId" in a;
  const bHasInstance = "instanceId" in b;
  if (aHasInstance !== bHasInstance) return false;
  if (aHasInstance && bHasInstance) {
    return a.instanceId === b.instanceId;
  }
  return true;
}

export function canPlayOperationsInPhase(phase: GameState["phase"]): boolean {
  return OPERATION_PHASES.has(phase);
}

export function getStrikeableInstanceIds(state: GameState, playerId: PlayerId): string[] {
  if (state.phase !== "battle" || state.pendingStrike) return [];
  if (state.activePlayer !== playerId) return [];

  return getLegalActions(state)
    .filter((a): a is Extract<typeof a, { type: "strike" }> => a.type === "strike")
    .map((a) => a.instanceId);
}
