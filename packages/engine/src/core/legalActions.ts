import type { GameAction, RushAction } from "../types/actions";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState, PlayerId, PlayerState } from "../types/game";
import { isCostWindowSatisfied } from "./costWindow";
import { COMMAND_ZONE_MAX } from "../types/game";
import { getRidingComboEffect, hasAutoBattleEntryOnRushNote } from "@rangers-strike/cards";
import { canWingAttackFromRush, canHoldForWing } from "../keywords/battleKeywords";
import {
  canPlayOperationCard,
  collectOperationTargets,
  needsOperationTarget,
} from "../effects/resolveOperation";
import {
  dslOperationOpensChoose,
  getDslOperationEffect,
  isDslInterpretableEffect,
} from "../dsl/dslCatalog";
import { collectTargetInstanceIds } from "../dsl/targetSelectors";
import {
  canPlayOperation,
  canPlayOperationExceptCommandHold,
  canRushUnitExceptCommandHold,
  cardCategories,
  getDefinition,
  hasOperationEffect,
  isSmallUnit,
  isRushable,
  isUnit,
  needsZordMaterial,
  parsePowerCost,
} from "./catalog";
import {
  listZordDownRushPaymentVariants,
  needsZordDownPayment,
} from "../rules/zordDown";
import { findInZone, opponent, payPowerCost } from "./helpers";
import { canStrikeUnit } from "../rules/combo";
import { canAttackRushWithYellowThunder } from "../rules/namedUnitEffects";
import {
  canMoveUnitToBattle,
  cannotAttackOrStrikeThisTurn,
  countReleasedCommands,
  mustEnterBattleBeforePhaseEnd,
} from "../rules/restrictions";
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
  validatePaymentSelection,
} from "../rules/commandPayment";
import { hasCommandForCardUse } from "../rules/restrictions";
import {
  canBeginZordSetup,
  listZordSetupResolveActions,
} from "../rules/zordSetup";
import { canToggleBpBudgetTarget, isValidEffectChoiceTarget } from "../rules/pendingChoices";
import { canBonusDraw, canReleaseStartCommands, canReturnBattleAtStart } from "../rules/startPhase";
import {
  listZordRushPaymentVariants,
  listZordUpRushPaymentVariants,
} from "../rules/mothership";
import { collectZordMaterials, requiresAllFusionPartners } from "../rules/zord";
import { isZordUpCost, resolveRushAdditionalCondition } from "@rangers-strike/cards";
import {
  canExecuteHandCounter,
  canInitiateCounterCategoryPayment,
  canPlayDinoGutsLeaveCounter,
  canPlayHandCounter,
  collectHiddenNinjaSubstitutes,
  getCounterEffectId,
  hasPlayableDinoChronicleCounter,
  isCounterReactionActive,
  isHandCounterCard,
} from "../rules/operationCounters";
import {
  canPlayPlasmaEnergyCounter,
  collectFiveTechInterceptors,
} from "../rules/strikeReactions";
import { getValidDamagePowerTargets, damagePaymentChoosingPlayer } from "../rules/damagePayment";
import { getStackActorPlayerId, hasOpenReactionWindow } from "../rules/effectStack";
import { getCardEffect } from "@rangers-strike/cards";
import { isHidoraEggUsed } from "../rules/turnModifiers";
import { listValidChaseVehicleIds } from "../keywords/chase";
import { canDeclareRush } from "../rules/rushDeclaration";

function assertActive(state: GameState, playerId: PlayerId): boolean {
  return state.activePlayer === playerId && state.winner === null;
}

/** カウンター窓が開いているとき、応答するプレイヤー（効果スタック最上位）。 */
export function getReactionChooserPlayerId(state: GameState): PlayerId | undefined {
  if (!hasOpenReactionWindow(state)) return undefined;
  return getStackActorPlayerId(state);
}

function isCounterPaymentAction(
  state: GameState,
  action: Extract<GameAction, { type: "initiate_command_payment" }>,
): boolean {
  return (
    action.kind === "category_use" &&
    isCounterReactionActive(state) &&
    isHandCounterCard(state, action.playerId, action.sourceInstanceId)
  );
}

function appendCounterCategoryPaymentActions(
  state: GameState,
  playerId: PlayerId,
  counterInstanceId: string,
  actions: GameAction[],
  options?: { substituteInstanceId?: string },
): void {
  if (!canInitiateCounterCategoryPayment(state, playerId, counterInstanceId)) return;

  const found = findInZone(state.players[playerId], "hand", counterInstanceId);
  if (!found) return;
  const categories = cardCategories(getDefinition(state.definitions, found.card.cardId)!);

  const pushPayment = (prismSubstitute?: boolean) => {
    const action: GameAction = {
      type: "initiate_command_payment",
      playerId,
      kind: "category_use",
      sourceInstanceId: counterInstanceId,
      prismSubstitute,
      substituteInstanceId: options?.substituteInstanceId,
    };
    if (isInitiateCommandPaymentLegal(state, action)) {
      actions.push(action);
    }
  };

  const paymentOptions = getCategoryPaymentOptions(state, playerId, categories, {
    perRushPayment: true,
    callLeadKind: "lead",
  });
  if (!paymentOptions) return;

  pushPayment(paymentOptions.prismSubstitute);
  if (paymentOptions.prismAvailable && !paymentOptions.prismSubstitute) {
    pushPayment(true);
  }
}

function isReactionWindowAction(action: GameAction): boolean {
  switch (action.type) {
    case "initiate_command_payment":
      return true;
    case "play_counter":
    case "pass_strike_reaction":
    case "pass_battle_reaction":
    case "pass_rush_reaction":
    case "pass_morph_reaction":
    case "select_morph_unit":
    case "pass_leave_reaction":
    case "use_register":
    case "pass_register":
    case "resolve_chase":
    case "pass_chase":
    case "five_tech_intercept":
    case "use_plasma_energy":
    case "use_super_shield":
      return true;
    default:
      return false;
  }
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
    const effectId = getCounterEffectId(state, playerId, card.instanceId);
    if (effectId === "new_gymnastics") {
      if (!defenderCard || !isSmallUnit(state.definitions, defenderCard.cardId)) continue;
      appendCounterCategoryPaymentActions(state, playerId, card.instanceId, actions);
      if (canExecuteHandCounter(state, playerId, card.instanceId)) {
        actions.push({ type: "play_counter", playerId, instanceId: card.instanceId });
      }
    }
    if (effectId === "hidden_ninja") {
      for (const sub of collectHiddenNinjaSubstitutes(state, [
        pending.defenderInstanceId,
        pending.attackerInstanceId,
      ])) {
        appendCounterCategoryPaymentActions(state, playerId, card.instanceId, actions, {
          substituteInstanceId: sub.instanceId,
        });
        if (canExecuteHandCounter(state, playerId, card.instanceId)) {
          actions.push({
            type: "play_counter",
            playerId,
            instanceId: card.instanceId,
            substituteInstanceId: sub.instanceId,
          });
        }
      }
    }
  }

  actions.push({ type: "pass_battle_reaction", playerId });
}

function appendMorphReactionActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  const pending = state.pendingMorph;
  if (!pending || playerId !== pending.defenderPlayerId) return;

  if (state.pendingEffectChoice?.effectId === "morph_replacement") {
    appendEffectChoiceActions(state, playerId, actions);
    return;
  }

  for (const morphUnitInstanceId of pending.morphUnitInstanceIds) {
    actions.push({
      type: "select_morph_unit",
      playerId,
      morphUnitInstanceId,
    });
  }
  actions.push({ type: "pass_morph_reaction", playerId });
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
    appendCounterCategoryPaymentActions(state, defenderId, card.instanceId, actions);
    if (canExecuteHandCounter(state, defenderId, card.instanceId)) {
      actions.push({ type: "play_counter", playerId: defenderId, instanceId: card.instanceId });
    }
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
    appendCounterCategoryPaymentActions(
      state,
      pending.ownerPlayerId,
      card.instanceId,
      actions,
    );
    if (canExecuteHandCounter(state, pending.ownerPlayerId, card.instanceId)) {
      actions.push({
        type: "play_counter",
        playerId: pending.ownerPlayerId,
        instanceId: card.instanceId,
      });
    }
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
    if (!definition) continue;
    const isZordDown = needsZordDownPayment(
      card.cardId,
      definition.powerCost,
      definition,
    );
    if (
      !isUnit(definition) ||
      (!needsZordMaterial(state.definitions, card.cardId) && !isZordDown)
    ) {
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
    if (!definition || !canPlayOperation(state, playerId, definition)) continue;

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

    const dslEffect = getDslOperationEffect(card.cardId, "rush");
    const dslChoose =
      dslEffect !== undefined &&
      isDslInterpretableEffect(dslEffect) &&
      dslOperationOpensChoose(dslEffect);

    if (dslChoose && dslEffect.effects[0]?.type === "choose") {
      const choose = dslEffect.effects[0];
      const targets = collectTargetInstanceIds(
        state,
        playerId,
        choose.valid,
        card.instanceId,
      );
      if (choose.kind === "optional_deck_draw") {
        if (player.deck.length === 0 && targets.length === 0) continue;
      } else if (targets.length === 0) {
        continue;
      }
      actions.push({
        type: "play_operation",
        playerId,
        instanceId: card.instanceId,
      });
      for (const targetInstanceId of targets) {
        actions.push({
          type: "play_operation",
          playerId,
          instanceId: card.instanceId,
          targetInstanceId,
        });
      }
      continue;
    }

    if (needsOperationTarget(card.cardId) && !dslChoose) {
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
  if (isHidoraEggUsed(player)) return;
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

  const released = player.command.filter((c) => !c.commandHeld);
  if (released.length < 2) return;

  const sUnits = player.battle.filter((card) =>
    isSmallUnit(state.definitions, card.cardId),
  );
  if (sUnits.length === 0) return;

  for (let i = 0; i < released.length; i += 1) {
    for (let j = i + 1; j < released.length; j += 1) {
      const commandInstanceIds = [
        released[i]!.instanceId,
        released[j]!.instanceId,
      ] as [string, string];
      for (const unit of sUnits) {
        actions.push({
          type: "battle_dance_retreat",
          playerId,
          battleInstanceId: unit.instanceId,
          commandInstanceIds,
        });
      }
    }
  }
}

const OPERATION_PHASES = new Set<GameState["phase"]>(["rush"]);

/** カテゴリホールド済みで即ラッシュ可能な手札のゾード。 */
export function findDirectZordRushAction(
  state: GameState,
  playerId: PlayerId,
  zordInstanceId: string,
): RushAction | null {
  const player = state.players[playerId];
  const card = player.hand.find((c) => c.instanceId === zordInstanceId);
  if (!card) return null;

  const definition = getDefinition(state.definitions, card.cardId);
  if (!definition || !isUnit(definition)) return null;

  if (
    needsZordDownPayment(card.cardId, definition.powerCost, definition)
  ) {
    const variants = listZordDownRushPaymentVariants(
      player,
      state.definitions,
      card.cardId,
      card.instanceId,
    );
    for (const variant of variants) {
      if (
        !canDeclareRush(state, playerId, player, state.definitions, definition, card.instanceId, variant)
      ) {
        continue;
      }
      return {
        type: "rush",
        playerId,
        instanceId: card.instanceId,
        zordMaterialInstanceId: variant.zordMaterialInstanceId,
        zordMaterialInstanceIds: variant.zordMaterialInstanceIds,
        zordMaterialDestination: variant.zordMaterialDestination,
      };
    }
    return null;
  }

  if (
    !isZordUpCost(definition.powerCost) ||
    (!resolveRushAdditionalCondition(card.cardId, definition) &&
      !requiresAllFusionPartners(card.cardId))
  ) {
    return null;
  }

  const variants = listZordUpRushPaymentVariants(
    state,
    playerId,
    card.cardId,
    card.instanceId,
  );
  for (const variant of variants) {
    if (
      !canDeclareRush(state, playerId, player, state.definitions, definition, card.instanceId, variant)
    ) {
      continue;
    }
    return {
      type: "rush",
      playerId,
      instanceId: card.instanceId,
      zordMaterialInstanceId: variant.zordMaterialInstanceId,
      zordMaterialInstanceIds: variant.zordMaterialInstanceIds,
      zordMaterialDestination: variant.zordMaterialDestination,
      zordMothershipHoldInstanceIds: variant.zordMothershipHoldInstanceIds,
      zordExtraCommandHoldInstanceIds: variant.zordExtraCommandHoldInstanceIds,
    };
  }
  return null;
}

function appendOperationCategoryPaymentActions(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): void {
  const player = state.players[playerId];

  const pushPayment = (
    instanceId: string,
    targetInstanceId?: string,
    extraInstanceId?: string,
    prismSubstitute?: boolean,
  ) => {
    const action: GameAction = {
      type: "initiate_command_payment",
      playerId,
      kind: "category_use",
      sourceInstanceId: instanceId,
      prismSubstitute,
      targetInstanceId,
      extraInstanceId,
    };
    if (isInitiateCommandPaymentLegal(state, action)) {
      actions.push(action);
    }
  };

  for (const card of player.hand) {
    if (!canPlayOperationCard(state.definitions, card.cardId)) continue;
    const definition = getDefinition(state.definitions, card.cardId);
    if (!definition || definition.type !== "operation") continue;
    if (canPlayOperation(state, playerId, definition)) continue;
    if (!canPlayOperationExceptCommandHold(state, playerId, definition)) continue;

    const categories = cardCategories(definition);
    if (categories.length === 0) continue;

    const options = getCategoryPaymentOptions(state, playerId, categories, {
      perRushPayment: true,
      callLeadKind: "lead",
    });
    if (!options) continue;

    pushPayment(card.instanceId, undefined, undefined, options.prismSubstitute);
    if (options.prismAvailable && !options.prismSubstitute) {
      pushPayment(card.instanceId, undefined, undefined, true);
    }
  }
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
      zordMaterialInstanceIds?: string[];
      zordMothershipHoldInstanceIds?: string[];
      zordExtraCommandHoldInstanceIds?: string[];
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
      zordMaterialInstanceIds: zord?.zordMaterialInstanceIds,
      zordMothershipHoldInstanceIds: zord?.zordMothershipHoldInstanceIds,
      zordExtraCommandHoldInstanceIds: zord?.zordExtraCommandHoldInstanceIds,
      zordMaterialDestination: zord?.zordMaterialDestination,
    };
    if (isInitiateCommandPaymentLegal(state, action)) {
      actions.push(action);
    }
  };

  for (const card of player.hand) {
    const definition = getDefinition(state.definitions, card.cardId);
    if (!definition || !isRushable(definition)) continue;

    const categories = cardCategories(definition);
    if (categories.length === 0) continue;

    if (
      isUnit(definition) &&
      isZordUpCost(definition.powerCost) &&
      (resolveRushAdditionalCondition(card.cardId, definition) ||
        requiresAllFusionPartners(card.cardId))
    ) {
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
            undefined,
            undefined,
            undefined,
            undefined,
            { ...state, playerId },
          )
        ) {
          continue;
        }
        const options = getCategoryPaymentOptions(state, playerId, categories, {
          perRushPayment: true,
          callLeadKind: "call",
        });
        if (!options) continue;
        pushPayment(card.instanceId, undefined, options.prismSubstitute);
        if (options.prismAvailable && !options.prismSubstitute) {
          pushPayment(card.instanceId, undefined, true);
        }
      } else {
        if (canBeginZordSetup(state, playerId, card.instanceId)) {
          continue;
        }
        const variants = listZordUpRushPaymentVariants(
          state,
          playerId,
          card.cardId,
          card.instanceId,
        );
        for (const variant of variants) {
          if (canDeclareRush(state, playerId, player, state.definitions, definition, card.instanceId, variant)) {
            continue;
          }
          if (
            !canRushUnitExceptCommandHold(
              player,
              state.definitions,
              definition,
              card.instanceId,
              variant.zordMaterialInstanceId,
              variant.zordMothershipHoldInstanceIds,
              variant.zordMaterialDestination,
              undefined,
              { ...state, playerId },
              variant.zordMaterialInstanceIds,
              variant.zordExtraCommandHoldInstanceIds,
            )
          ) {
            continue;
          }
          const options = getCategoryPaymentOptions(state, playerId, categories, {
            perRushPayment: true,
            callLeadKind: "call",
          });
          if (!options) continue;
          pushPayment(card.instanceId, variant, options.prismSubstitute);
          if (options.prismAvailable && !options.prismSubstitute) {
            pushPayment(card.instanceId, variant, true);
          }
        }
      }
    } else if (
      needsZordDownPayment(card.cardId, definition.powerCost, definition)
    ) {
      const zordVariants = [
        {},
        ...listZordDownRushPaymentVariants(
          player,
          state.definitions,
          card.cardId,
          card.instanceId,
        ),
      ];
      for (const zord of zordVariants) {
        if (
          canDeclareRush(state, playerId, player, state.definitions, definition, card.instanceId, zord)
        ) {
          continue;
        }
        if (
          !canRushUnitExceptCommandHold(
            player,
            state.definitions,
            definition,
            card.instanceId,
            zord.zordMaterialInstanceId,
            undefined,
            zord.zordMaterialDestination,
            undefined,
            { ...state, playerId },
          )
        ) {
          continue;
        }
        const options = getCategoryPaymentOptions(state, playerId, categories, {
          perRushPayment: true,
          callLeadKind: "call",
        });
        if (!options) continue;
        pushPayment(card.instanceId, zord, options.prismSubstitute);
        if (options.prismAvailable && !options.prismSubstitute) {
          pushPayment(card.instanceId, zord, true);
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
          undefined,
          undefined,
          undefined,
          undefined,
          { ...state, playerId },
        )
      ) {
        continue;
      }
      const options = getCategoryPaymentOptions(state, playerId, categories, {
        perRushPayment: true,
        callLeadKind: "call",
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
    if (!isValidEffectChoiceTarget(state, pending, instanceId)) continue;
    actions.push({ type: "resolve_effect_choice", playerId, instanceId });
  }

  const hasChoiceAction = actions.some(
    (action) =>
      action.type === "resolve_effect_choice" ||
      action.type === "confirm_effect_choice" ||
      action.type === "confirm_shiron_reveal" ||
      action.type === "confirm_denji_reveal" ||
      action.type === "resolve_ruin_survey" ||
      action.type === "resolve_seabed_draw" ||
      action.type === "initiate_command_payment",
  );
  if (!hasChoiceAction && !actions.some((action) => action.type === "skip_effect_choice")) {
    actions.push({ type: "skip_effect_choice", playerId });
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

  if (cannotAttackOrStrikeThisTurn(player, unit)) {
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
  if (!pending || damagePaymentChoosingPlayer(pending) !== playerId) return;
  for (const instanceId of getValidDamagePowerTargets(state, pending)) {
    actions.push({ type: "resolve_damage_payment", playerId, instanceId });
  }
}

export function getLegalActions(state: GameState): GameAction[] {
  if (state.winner) return [];

  const playerId =
    (state.pendingDamagePayment
      ? damagePaymentChoosingPlayer(state.pendingDamagePayment)
      : undefined) ??
    getReactionChooserPlayerId(state) ??
    state.pendingEffectChoice?.playerId ??
    state.pendingMorph?.defenderPlayerId ??
    state.pendingBattleEntry?.playerId ??
    state.pendingScry?.playerId ??
    state.activePlayer;
  const player = state.players[playerId];
  const actions: GameAction[] = [];

  if (state.pendingRegister) {
    const owner = state.pendingRegister.ownerPlayerId;
    actions.push({ type: "use_register", playerId: owner });
    actions.push({ type: "pass_register", playerId: owner });
    return actions;
  }

  if (state.pendingChase) {
    const pending = state.pendingChase;
    for (const vehicleId of listValidChaseVehicleIds(state, pending)) {
      actions.push({
        type: "resolve_chase",
        playerId: pending.chaserPlayerId,
        newVehicleInstanceId: vehicleId,
      });
    }
    actions.push({ type: "pass_chase", playerId: pending.chaserPlayerId });
    return actions;
  }

  if (state.pendingEffectChoice?.kind === "simultaneous_order") {
    const chooserId = state.pendingEffectChoice.playerId;
    appendEffectChoiceActions(state, chooserId, actions);
    if (actions.length === 0 && state.pendingEffectChoice.optional) {
      actions.push({ type: "skip_effect_choice", playerId: chooserId });
    }
    return actions;
  }

  if (state.pendingLeave) {
    appendLeaveReactionActions(state, state.pendingLeave.ownerPlayerId, actions);
    return actions;
  }

  if (state.pendingCommandPayment) {
    const pending = state.pendingCommandPayment;
    if (pending.playerId === playerId) {
      const ids = pending.validInstanceIds.slice(0, pending.totalNeeded);
      if (
        ids.length >= pending.totalNeeded &&
        validatePaymentSelection(state, pending, ids) === null &&
        isResolveCommandPaymentLegal(state, {
          playerId,
          commandInstanceIds: ids,
        })
      ) {
        actions.push({
          type: "resolve_command_payment",
          playerId,
          commandInstanceIds: ids,
        });
      }
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

  if (state.pendingDamagePayment) {
    appendDamagePaymentActions(state, playerId, actions);
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

  if (state.pendingBattle) {
    appendBattleReactionActions(state, state.pendingBattle.defenderPlayerId, actions);
    return actions;
  }

  if (state.pendingMorph) {
    const defenderId = state.pendingMorph.defenderPlayerId;
    appendMorphReactionActions(state, defenderId, actions);
    if (actions.length === 0) {
      actions.push({ type: "pass_morph_reaction", playerId: defenderId });
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

  if (state.pendingEffectChoice) {
    const chooserId = state.pendingEffectChoice.playerId;
    appendEffectChoiceActions(state, chooserId, actions);
    if (actions.length === 0 && state.pendingEffectChoice.optional) {
      actions.push({ type: "skip_effect_choice", playerId: chooserId });
    }
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
        actions.push({ type: "return_all_battle_to_rush", playerId });
      }
      if (!player.hasDrawnThisStart) {
        actions.push({ type: "draw", playerId });
      }
      if (canBonusDraw(state, playerId)) {
        actions.push({ type: "bonus_draw", playerId });
        actions.push({ type: "skip_bonus_draw", playerId });
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
        if (!isRushable(definition)) continue;

        if (
          isUnit(definition) &&
          needsZordDownPayment(card.cardId, definition!.powerCost, definition!)
        ) {
          for (const variant of listZordDownRushPaymentVariants(
            player,
            state.definitions,
            card.cardId,
            card.instanceId,
          )) {
            if (
              !canDeclareRush(state, playerId, player, state.definitions, definition!, card.instanceId, variant)
            ) {
              continue;
            }
            actions.push({
              type: "rush",
              playerId,
              instanceId: card.instanceId,
              zordMaterialInstanceId: variant.zordMaterialInstanceId,
              zordMaterialInstanceIds: variant.zordMaterialInstanceIds,
              zordMaterialDestination: variant.zordMaterialDestination,
            });
          }
          if (canDeclareRush(state, playerId, player, state.definitions, definition!, card.instanceId)) {
            actions.push({
              type: "rush",
              playerId,
              instanceId: card.instanceId,
            });
          }
        } else if (
          isUnit(definition) &&
          isZordUpCost(definition!.powerCost) &&
          (resolveRushAdditionalCondition(card.cardId, definition!) ||
            requiresAllFusionPartners(card.cardId))
        ) {
          for (const variant of listZordUpRushPaymentVariants(
            state,
            playerId,
            card.cardId,
            card.instanceId,
          )) {
            if (
              !canDeclareRush(state, playerId, player, state.definitions, definition!, card.instanceId, variant)
            ) {
              continue;
            }
            actions.push({
              type: "rush",
              playerId,
              instanceId: card.instanceId,
              zordMaterialInstanceId: variant.zordMaterialInstanceId,
              zordMaterialInstanceIds: variant.zordMaterialInstanceIds,
              zordMaterialDestination: variant.zordMaterialDestination,
              zordMothershipHoldInstanceIds: variant.zordMothershipHoldInstanceIds,
              zordExtraCommandHoldInstanceIds: variant.zordExtraCommandHoldInstanceIds,
            });
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
      appendOperationCategoryPaymentActions(state, playerId, actions);
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

      for (const card of player.rush) {
        if (canHoldForWing(state, playerId, card)) {
          actions.push({
            type: "hold_for_wing",
            playerId,
            instanceId: card.instanceId,
          });
        }
      }

      for (const attacker of player.rush) {
        if (!canWingAttackFromRush(state, playerId, attacker)) continue;
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

      for (const attacker of player.battle) {
        if (attacker.battleActed) continue;
        if (cannotAttackOrStrikeThisTurn(player, attacker)) continue;
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
        if (cannotAttackOrStrikeThisTurn(player, card)) continue;
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
    const reactionActor = getReactionChooserPlayerId(state);
    if (reactionActor && isCounterPaymentAction(state, action)) {
      if (action.playerId !== reactionActor) return false;
      return isInitiateCommandPaymentLegal(state, action);
    }
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

  if (state.pendingRegister) {
    if (action.type === "use_register" || action.type === "pass_register") {
      return action.playerId === state.pendingRegister.ownerPlayerId;
    }
    return false;
  }

  if (action.type === "resolve_damage_payment") {
    const pending = state.pendingDamagePayment;
    return (
      !!pending &&
      damagePaymentChoosingPlayer(pending) === action.playerId &&
      getValidDamagePowerTargets(state, pending).includes(action.instanceId)
    );
  }

  if (state.pendingDamagePayment) {
    return false;
  }

  if (state.pendingChase) {
    if (action.type === "pass_chase") {
      return action.playerId === state.pendingChase.chaserPlayerId;
    }
    if (action.type === "resolve_chase") {
      return (
        action.playerId === state.pendingChase.chaserPlayerId &&
        listValidChaseVehicleIds(state, state.pendingChase).includes(action.newVehicleInstanceId)
      );
    }
    return false;
  }

  const reactionActor = getReactionChooserPlayerId(state);
  if (reactionActor && isReactionWindowAction(action)) {
    if (action.playerId !== reactionActor) return false;
  } else if (state.pendingLeave) {
    if (action.playerId !== state.pendingLeave.ownerPlayerId) return false;
  } else if (state.pendingEffectChoice) {
    if (action.playerId !== state.pendingEffectChoice.playerId) return false;
  } else if (state.pendingBattleEntry) {
    if (action.playerId !== state.pendingBattleEntry.playerId) return false;
  } else if (state.pendingScry) {
    if (action.playerId !== state.pendingScry.playerId) return false;
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
        isRushable(definition) &&
        canDeclareRush(state, action.playerId, player, state.definitions, definition, action.instanceId, {
          zordMaterialInstanceId: action.zordMaterialInstanceId,
          zordMaterialInstanceIds: action.zordMaterialInstanceIds,
          zordMothershipHoldInstanceIds: action.zordMothershipHoldInstanceIds,
          zordExtraCommandHoldInstanceIds: action.zordExtraCommandHoldInstanceIds,
          zordMaterialDestination: action.zordMaterialDestination,
        })
      ) {
        return true;
      }
    }
  }

  if (action.type === "move_to_battle" && state.phase === "rush") {
    if (!assertActive(state, action.playerId)) return false;
    const rushCard = state.players[action.playerId].rush.find(
      (c) => c.instanceId === action.instanceId,
    );
    if (
      rushCard &&
      hasAutoBattleEntryOnRushNote(rushCard.cardId) &&
      canMoveUnitToBattle(state, action.playerId, rushCard, "rush")
    ) {
      return true;
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
    const extraA = [...(a.zordExtraCommandHoldInstanceIds ?? [])].sort().join(",");
    const extraB = [...(b.zordExtraCommandHoldInstanceIds ?? [])].sort().join(",");
    const matsA = [...(a.zordMaterialInstanceIds ?? [])].sort().join(",");
    const matsB = [...(b.zordMaterialInstanceIds ?? [])].sort().join(",");
    return (
      a.instanceId === b.instanceId &&
      (a.zordMaterialInstanceId ?? "") === (b.zordMaterialInstanceId ?? "") &&
      matsA === matsB &&
      (a.zordMaterialDestination ?? "") === (b.zordMaterialDestination ?? "") &&
      holdsA === holdsB &&
      extraA === extraB
    );
  }

  if (a.type === "resolve_chase" && b.type === "resolve_chase") {
    return a.newVehicleInstanceId === b.newVehicleInstanceId;
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
    const aCmd = [...a.commandInstanceIds].sort().join("\0");
    const bCmd = [...b.commandInstanceIds].sort().join("\0");
    return a.battleInstanceId === b.battleInstanceId && aCmd === bCmd;
  }

  if (a.type === "return_all_battle_to_rush" && b.type === "return_all_battle_to_rush") {
    return a.playerId === b.playerId;
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

  if (a.type === "select_morph_unit" && b.type === "select_morph_unit") {
    return a.morphUnitInstanceId === b.morphUnitInstanceId;
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
      (a.extraInstanceId ?? "") === (b.extraInstanceId ?? "") &&
      (a.substituteInstanceId ?? "") === (b.substituteInstanceId ?? "")
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
