import type { GameAction } from "../types/actions";
import type { GameState, PendingBattle, PendingStrike, PlayerId, PlayerState } from "../types/game";
import {
  getBattleEntryHoldCount,
  getCardEffect,
  listZordFusionPartnerIds,
  needsBattleEntryHandDiscard,
} from "@rangers-strike/cards";
import { COMMAND_ZONE_MAX } from "../types/game";
import { checkWinner, advancePhase } from "./createGame";
import {
  canPlayOperation,
  cardName,
  effectiveBp,
  getDefinition,
  hasOperationEffect,
  isSmallUnit,
  isUnit,
  needsZordMaterial,
  parsePowerCost,
  superPowerAttackBonus,
} from "./catalog";
import {
  isPermanentCard,
  needsOperationTarget,
  placePermanentOperation,
  resolveOperationEffect,
} from "../effects/resolveOperation";
import {
  hidoraEggLog,
  infiniteChainLog,
  resolveHidoraEgg,
  resolveInfiniteChain,
} from "../rules/legend2/operations";
import {
  buildLogEntry,
  buildSimpleLogEntry,
} from "../log/formatLog";
import { clearTurnModifiers } from "./modifiers";
import {
  findInZone,
  opponent,
  payPowerCost,
  removeAt,
  updatePlayer,
} from "./helpers";
import { isLegalAction } from "./legalActions";
import { resolveDamagePaymentSelect } from "../rules/damagePayment";
import {
  battlePositionAfterMove,
  canStrikeUnit,
  resolveEnterBattleEffects,
  strikeDamageFor,
} from "../rules/combo";
import { finalizeRushAction } from "../rules/rushEffects";
import { canAttackRushWithYellowThunder } from "../rules/namedUnitEffects";
import {
  applyDarkDealRushHolds,
  battleEntryHandDiscardSatisfied,
  battleEntryRushDiscardSatisfied,
  canAttackDefender,
  darkDealRushPowerBudget,
  needsBattleEntryRushDiscard,
  tryLegend3BattleToRush,
  tryStartBattleEntryHandDiscard,
  tryStartBattleEntryRushDiscard,
} from "../rules/legend3/restrictions";
import { prepareMirageBeamForBattle } from "../rules/legend3/mirageBeam";
import {
  shouldAutoFinalizeEndPhase,
  tryOpenEndTurnEffectsMenu,
} from "../rules/legend3/endTurnEffects";
import { clearBakiBakiExtraAttack } from "../rules/legend3/destroyEffects";
import {
  canBonusDraw,
  canPayEarthForceUpkeep,
  discardEarthForceForUnpaidUpkeep,
  mustResolveEarthForceUpkeepBeforeStartEnd,
  openEarthForceUpkeepChoiceIfNeeded,
  releaseAllCommands,
  returnAllBattleUnitsToRush,
  continueBattleToRushEffectQueue,
  shouldAutoAdvanceFromStartPhase,
  transitionStartToChargePhase,
} from "../rules/startPhase";
import {
  applyMothershipHolds,
  canUseMothershipForZordRush,
  validateZordAdditionalPayment,
} from "../rules/mothership";
import { applyAllZordFusionMaterials, applyZordMaterial, findZordMaterial, requiresAllFusionPartners } from "../rules/zord";
import {
  canMoveUnitToBattle,
  cannotAttackOrStrikeThisTurn,
  mustEnterBattleBeforePhaseEnd,
  countHeldCommands,
  requiredBattleEntryHolds,
} from "../rules/restrictions";
import {
  applyCommandPaymentResolve,
  buildPaymentFromInitiateAction,
  validatePaymentSelection,
} from "../rules/commandPayment";
import {
  advanceZordSetup,
  canBeginZordSetup,
  createZordSetup,
} from "../rules/zordSetup";
import {
  applyFiveTechIntercept,
  applyPlasmaEnergyCounter,
  canPlayPlasmaEnergyCounter,
  finalizeStrike,
  hasStrikeReactions,
} from "../rules/strikeReactions";
import { applyAdventureEndTurn, getTurnModifiers, markBattleBlocked, markRushedThisTurn, withTurnModifiers } from "../rules/turnModifiers";
import { applyOnTurnEndBattleEffects } from "../rules/legend2/destroyEffects";
import { withSyncedEffectStack } from "../rules/effectStack";
import { applyRegisterHold, finalizeRegisterDiscard } from "../rules/resist";
import { hasAutoBattleEntryOnRushNote } from "@rangers-strike/cards";
import {
  applyDinoChronicleCounter,
  applyDinoGutsCounter,
  applyHiddenNinjaCounter,
  applyNewGymnasticsCounter,
  applyShippuNinjaCounter,
  applySuperShieldSubstitute,
  canExecuteHandCounter,
  getCounterEffectId,
  hasBattleCounterReactions,
  resolveBattlePending,
  finalizeLeaveReaction,
  finalizeRushPending,
  tryLeaveField,
} from "../rules/operationCounters";
import { applyResolveRuinSurvey } from "../rules/ruinSurvey";
import { applySeabedDrawPlacement } from "../rules/pendingChoices";
import {
  applyConfirmDenjiReveal,
  applyDenjiBottomOrderSelect,
} from "../rules/denjiMachine";
import {
  applyConfirmShironReveal,
  applyShironPickSelect,
  clearShironLightRushTarget,
  startShironLightChoice,
} from "../rules/shironLight";
import {
  applyEffectChoicePlacement,
  applyEffectChoiceSelect,
  completeEffectHoldChoice,
  skipEffectChoice,
  applyConfirmEffectChoice,
} from "../rules/pendingChoices";
import {
  afterEnterBattle,
  createBattleEntryPrompt,
  finishBattleEntryIf,
} from "../rules/battleEntry";
import { applySuperBrainDraw } from "../effects/drawEffects";

export type ActionResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };

function ok(state: GameState, message: string): ActionResult {
  const next = withSyncedEffectStack({
    ...state,
    log: [...state.log, message],
    winner: checkWinner(state),
  });
  return { ok: true, state: next };
}

function clearCounterHoldReady(state: GameState, playerId: PlayerId): GameState {
  const player = state.players[playerId];
  if (!player.counterCategoryHoldReady) return state;
  return {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      counterCategoryHoldReady: false,
    }),
  };
}

function withStartPhaseAutoAdvance(
  result: ActionResult,
  playerId: PlayerId,
): ActionResult {
  if (!result.ok || result.state.phase !== "start") return result;
  if (!shouldAutoAdvanceFromStartPhase(result.state, playerId)) return result;
  const advanced = transitionStartToChargePhase(result.state, playerId);
  if (!advanced) return result;
  return { ok: true, state: advanced };
}

function withEndPhaseAutoFinalize(
  result: ActionResult,
  playerId: PlayerId,
): ActionResult {
  if (!result.ok || !shouldAutoFinalizeEndPhase(result.state)) return result;
  return ok(finalizeTurnEnd(result.state), buildSimpleLogEntry(playerId, "end_turn"));
}

function fail(error: string): ActionResult {
  return { ok: false, error };
}

function markBattleActed(player: PlayerState, instanceId: string): PlayerState {
  const battle = player.battle.map((card) =>
    card.instanceId === instanceId ? { ...card, battleActed: true } : card,
  );
  return { ...player, battle };
}

function withWinner(state: GameState): GameState {
  return { ...state, winner: checkWinner(state) };
}

function advanceFromCharge(state: GameState, chargeLog: string): GameState {
  const logged = { ...state, log: [...state.log, chargeLog] };
  return withWinner(advancePhase(logged));
}

function finalizeTurnEnd(state: GameState): GameState {
  const prevPlayer = state.activePlayer;
  let next = applyAdventureEndTurn(state, prevPlayer);
  next = applyOnTurnEndBattleEffects(next, prevPlayer);
  next = advancePhase(next);

  if (next.activePlayer !== prevPlayer) {
    next = {
      ...next,
      players: {
        ...next.players,
        [prevPlayer]: clearTurnModifiers(next.players[prevPlayer]),
      },
    };
  }

  return withWinner(next);
}

function finishStrikeResolution(
  state: GameState,
  pending: PendingStrike,
  nextState: GameState,
  extraLogs: string[] = [],
): ActionResult {
  let resolved = withWinner({
    ...nextState,
    pendingStrike: undefined,
    activePlayer: pending.battlePhasePlayer,
  });
  resolved = finishBattleEntryIf(resolved, pending.strikerInstanceId);

  const striker = state.players[pending.strikerPlayerId];
  const strikerFound = findInZone(striker, "battle", pending.strikerInstanceId);
  const strikeLog = buildLogEntry(
    pending.strikerPlayerId,
    "strike",
    strikerFound?.card.cardId ?? "unknown",
    state.definitions,
    pending.damageCancelled ? "0" : String(pending.damage),
  );

  return {
    ok: true,
    state: {
      ...resolved,
      log: [...resolved.log, strikeLog, ...extraLogs],
    },
  };
}

function completeStrike(state: GameState, pending: PendingStrike, extraLogs: string[] = []): ActionResult {
  const nextState = finalizeStrike(state, pending);
  if (nextState.pendingDamagePayment) {
    return ok(nextState, buildSimpleLogEntry(pending.strikerPlayerId, "strike_pending_damage"));
  }
  return finishStrikeResolution(state, pending, nextState, extraLogs);
}

export function applyAction(state: GameState, action: GameAction): ActionResult {
  if (state.winner) return fail("game_already_over");
  if (
    action.type === "end_phase" &&
    state.phase === "battle" &&
    mustEnterBattleBeforePhaseEnd(state, action.playerId)
  ) {
    return fail("must_enter_battle");
  }
  if (action.type === "end_phase" && state.pendingBattleEntry) {
    return fail("pending_battle_entry");
  }
  if (action.type === "move_to_battle" && state.pendingBattleEntry) {
    return fail("pending_battle_entry");
  }
  if (
    state.pendingCommandPayment &&
    action.type !== "resolve_command_payment" &&
    action.type !== "cancel_command_payment"
  ) {
    return fail("pending_command_payment");
  }
  if (
    state.pendingZordSetup &&
    action.type !== "resolve_zord_setup" &&
    action.type !== "cancel_zord_setup"
  ) {
    return fail("pending_zord_setup");
  }
  if (
    state.pendingDamagePayment &&
    action.type !== "resolve_damage_payment"
  ) {
    return fail("pending_damage_payment");
  }
  if (!isLegalAction(state, action)) return fail("illegal_action");

  const playerId = action.playerId;
  const player = state.players[playerId];

  switch (action.type) {
    case "draw": {
      if (state.phase !== "start") return fail("wrong_phase");
      if (player.hasDrawnThisStart) return fail("already_drawn");
      if (player.deck.length === 0) {
        const nextState: GameState = {
          ...state,
          winner: opponent(playerId),
          log: [...state.log, buildSimpleLogEntry(playerId, "deck_out")],
        };
        return { ok: true, state: nextState };
      }
      const drawn = applySuperBrainDraw(state, playerId, player, playerId);
      if (drawn.detail === "empty_deck") {
        const nextState: GameState = {
          ...state,
          winner: opponent(playerId),
          log: [...state.log, buildSimpleLogEntry(playerId, "deck_out")],
        };
        return { ok: true, state: nextState };
      }
      if (drawn.pending) {
        const nextPlayer = { ...drawn.state.players[playerId], hasDrawnThisStart: true };
        const nextState: GameState = {
          ...drawn.state,
          ...updatePlayer(drawn.state, playerId, nextPlayer),
        };
        return ok(nextState, buildSimpleLogEntry(playerId, "draw"));
      }
      const nextPlayer = {
        ...drawn.state.players[playerId],
        hasDrawnThisStart: true,
      };
      const nextState: GameState = {
        ...drawn.state,
        ...updatePlayer(drawn.state, playerId, nextPlayer),
      };
      const withUpkeep = openEarthForceUpkeepChoiceIfNeeded(nextState, playerId);
      return withStartPhaseAutoAdvance(
        ok(withUpkeep, buildSimpleLogEntry(playerId, "draw")),
        playerId,
      );
    }

    case "bonus_draw": {
      if (state.phase !== "start") return fail("wrong_phase");
      if (!player.hasDrawnThisStart) return fail("must_draw_first");
      if (player.hand.length >= player.damage || player.deck.length === 0) {
        return fail("bonus_draw_unavailable");
      }
      const drawn = applySuperBrainDraw(state, playerId, player, playerId);
      if (drawn.detail === "empty_deck") {
        return fail("bonus_draw_unavailable");
      }
      if (drawn.pending) {
        return ok(drawn.state, buildSimpleLogEntry(playerId, "bonus_draw"));
      }
      return withStartPhaseAutoAdvance(
        ok(drawn.state, buildSimpleLogEntry(playerId, "bonus_draw")),
        playerId,
      );
    }

    case "skip_bonus_draw": {
      if (state.phase !== "start") return fail("wrong_phase");
      if (!canBonusDraw(state, playerId)) return fail("bonus_draw_unavailable");
      const advanced = transitionStartToChargePhase(state, playerId);
      if (!advanced) return fail("start_phase_incomplete");
      return ok(advanced, buildSimpleLogEntry(playerId, "skip_bonus_draw"));
    }

    case "release_start_commands": {
      if (state.phase !== "start") return fail("wrong_phase");
      if (player.hasReleasedCommandsThisStart) return fail("already_released");
      if (!player.command.some((c) => c.commandHeld)) {
        return fail("no_held_commands");
      }
      const nextState = releaseAllCommands(state, playerId);
      const nextPlayer = {
        ...nextState.players[playerId],
        hasReleasedCommandsThisStart: true,
      };
      return withStartPhaseAutoAdvance(
        ok(
          { ...nextState, ...updatePlayer(nextState, playerId, nextPlayer) },
          buildSimpleLogEntry(playerId, "release_start_commands"),
        ),
        playerId,
      );
    }

    case "return_all_battle_to_rush": {
      if (state.phase !== "start") return fail("wrong_phase");
      if (player.hasReturnedBattleThisStart) return fail("already_returned");
      const moved = returnAllBattleUnitsToRush(state, playerId);
      if (!moved) return fail("card_not_in_battle");
      return withStartPhaseAutoAdvance(
        ok(moved, buildSimpleLogEntry(playerId, "return_all_battle_to_rush")),
        playerId,
      );
    }

    case "charge_power": {
      if (state.phase !== "charge") return fail("wrong_phase");
      if (player.hasChargedThisTurn) return fail("already_charged");
      const found = findInZone(player, "hand", action.instanceId);
      if (!found) return fail("card_not_in_hand");

      const [, hand] = removeAt(player.hand, found.index);
      const powerCard: typeof found.card = { ...found.card, faceDown: false };
      const nextPlayer: typeof player = {
        ...player,
        hand,
        power: [...player.power, powerCard],
        hasChargedThisTurn: true,
      };
      const chargedState = { ...state, ...updatePlayer(state, playerId, nextPlayer) };
      return {
        ok: true,
        state: advanceFromCharge(
          chargedState,
          buildLogEntry(playerId, "charge_power", found.card.cardId, state.definitions),
        ),
      };
    }

    case "charge_command": {
      if (state.phase !== "charge") return fail("wrong_phase");
      if (player.hasChargedThisTurn) return fail("already_charged");
      if (player.command.length >= COMMAND_ZONE_MAX) return fail("command_zone_full");
      const found = findInZone(player, "hand", action.instanceId);
      if (!found) return fail("card_not_in_hand");

      const [, hand] = removeAt(player.hand, found.index);
      const commandCard: typeof found.card = {
        ...found.card,
        commandHeld: false,
      };
      const nextPlayer: typeof player = {
        ...player,
        hand,
        command: [...player.command, commandCard],
        hasChargedThisTurn: true,
      };
      const chargedState = { ...state, ...updatePlayer(state, playerId, nextPlayer) };
      return {
        ok: true,
        state: advanceFromCharge(
          chargedState,
          buildLogEntry(playerId, "charge_command", found.card.cardId, state.definitions),
        ),
      };
    }

    case "initiate_command_payment": {
      const pending = buildPaymentFromInitiateAction(state, action);
      if (!pending) return fail("cannot_pay");
      return ok(
        { ...state, pendingCommandPayment: pending },
        buildSimpleLogEntry(playerId, "command_payment_pending"),
      );
    }

    case "begin_zord_setup": {
      if (state.phase !== "rush") return fail("wrong_phase");
      if (!canBeginZordSetup(state, playerId, action.zordInstanceId)) {
        return fail("cannot_begin_zord_setup");
      }
      const setup = createZordSetup(state, playerId, action.zordInstanceId);
      if (!setup) return fail("cannot_begin_zord_setup");
      return ok(
        { ...state, pendingZordSetup: setup },
        buildSimpleLogEntry(playerId, "zord_setup_pending"),
      );
    }

    case "resolve_zord_setup": {
      const setup = state.pendingZordSetup;
      if (!setup || setup.playerId !== playerId) return fail("no_pending_zord_setup");
      const advanced = advanceZordSetup(state, setup, {
        materialInstanceId: action.materialInstanceId,
        destination: action.destination,
        paymentPath: action.paymentPath,
      });
      if (advanced.kind === "error") return fail(advanced.error);
      if (advanced.kind === "continue") {
        return ok(
          { ...state, pendingZordSetup: advanced.setup },
          buildSimpleLogEntry(playerId, "zord_setup_step"),
        );
      }
      if (advanced.kind === "rush") {
        return applyAction(
          { ...state, pendingZordSetup: undefined },
          advanced.action,
        );
      }
      return ok(
        {
          ...state,
          pendingZordSetup: undefined,
          pendingCommandPayment: advanced.payment,
        },
        buildSimpleLogEntry(playerId, "command_payment_pending"),
      );
    }

    case "cancel_zord_setup": {
      if (!state.pendingZordSetup) return fail("no_pending_zord_setup");
      if (state.pendingZordSetup.playerId !== playerId) {
        return fail("no_pending_zord_setup");
      }
      return ok(
        { ...state, pendingZordSetup: undefined },
        buildSimpleLogEntry(playerId, "zord_setup_cancel"),
      );
    }

    case "resolve_damage_payment": {
      const result = resolveDamagePaymentSelect(state, playerId, action.instanceId);
      if ("error" in result) return fail(result.error);
      if (result.state.pendingDamagePayment) {
        return ok(
          result.state,
          buildSimpleLogEntry(playerId, "damage_payment", action.instanceId),
        );
      }
      if (result.resume.kind === "strike") {
        return finishStrikeResolution(
          state,
          { ...result.resume.pending, damageApplied: true },
          result.state,
        );
      }
      return ok(
        result.state,
        buildSimpleLogEntry(playerId, "damage_payment", "done"),
      );
    }

    case "resolve_command_payment": {
      const pending = state.pendingCommandPayment;
      if (!pending || pending.playerId !== playerId) return fail("no_pending_payment");
      const err = validatePaymentSelection(state, pending, action.commandInstanceIds);
      if (err) return fail(err);

      const resolved = applyCommandPaymentResolve(
        state,
        playerId,
        pending,
        action.commandInstanceIds,
      );
      if ("error" in resolved) return fail(resolved.error);

      let nextState = resolved.state;
      if (resolved.nextPending) {
        return ok(
          { ...nextState, pendingCommandPayment: resolved.nextPending },
          buildSimpleLogEntry(playerId, "command_payment_pending"),
        );
      }

      const cont = pending.continuation;

      if (cont.type === "effect_choice") {
        const completed = completeEffectHoldChoice(
          nextState,
          playerId,
          action.commandInstanceIds,
        );
        if ("error" in completed) return fail(completed.error);
        return ok(completed.state, completed.log ?? buildSimpleLogEntry(playerId, "resolve_effect_choice"));
      }

      if (cont.type === "move_to_battle") {
        return applyAction(nextState, {
          type: "move_to_battle",
          playerId,
          instanceId: pending.sourceInstanceId,
          rideOff: cont.rideOff,
        });
      }
      if (cont.type === "rush") {
        const holdIds =
          pending.kind === "mothership_hold"
            ? action.commandInstanceIds
            : cont.zordMothershipHoldInstanceIds;
        return applyAction(nextState, {
          type: "rush",
          playerId,
          instanceId: pending.sourceInstanceId,
          zordMaterialInstanceId: cont.zordMaterialInstanceId,
          zordMaterialDestination: cont.zordMaterialDestination,
          zordMothershipHoldInstanceIds: holdIds,
        });
      }
      if (cont.type === "play_counter") {
        return applyAction(nextState, {
          type: "play_counter",
          playerId,
          instanceId: pending.sourceInstanceId,
          substituteInstanceId: cont.substituteInstanceId,
        });
      }
      return applyAction(nextState, {
        type: "play_operation",
        playerId,
        instanceId: pending.sourceInstanceId,
        targetInstanceId: cont.targetInstanceId,
        extraInstanceId: cont.extraInstanceId,
      });
    }

    case "cancel_command_payment": {
      if (!state.pendingCommandPayment) return fail("no_pending_payment");
      if (state.pendingCommandPayment.playerId !== playerId) {
        return fail("no_pending_payment");
      }
      const payer = state.players[playerId];
      return ok(
        {
          ...state,
          pendingCommandPayment: undefined,
          players: {
            ...state.players,
            [playerId]: {
              ...payer,
              battleEntryHoldReady: false,
              rushCategoryHoldReady: false,
              counterCategoryHoldReady: false,
            },
          },
        },
        buildSimpleLogEntry(playerId, "command_payment_cancel"),
      );
    }

    case "play_operation": {
      if (state.phase !== "rush") return fail("wrong_phase");
      const found = findInZone(player, "hand", action.instanceId);
      if (!found) return fail("card_not_in_hand");

      const definition = getDefinition(state.definitions, found.card.cardId);
      if (!definition || definition.type !== "operation") return fail("not_operation");

      if (needsOperationTarget(found.card.cardId) && !action.targetInstanceId) {
        return fail("target_required");
      }

      if (
        getCardEffect(found.card.cardId)?.effectId === "cyber_s_rider" &&
        !action.targetInstanceId
      ) {
        return fail("target_required");
      }

      if (!canPlayOperation(player, state.definitions, definition)) {
        return fail("command_not_held");
      }

      const cost = parsePowerCost(definition.powerCost);
      if (!payPowerCost(player, cost)) return fail("insufficient_power");

      const [, hand] = removeAt(player.hand, found.index);
      let nextPlayer = { ...player, hand };
      let nextState: GameState = {
        ...state,
        ...updatePlayer(state, playerId, nextPlayer),
      };

      const effectMeta = getCardEffect(found.card.cardId);
      if (effectMeta?.effectId === "place_in_power") {
        const current = nextState.players[playerId];
        nextState = {
          ...nextState,
          ...updatePlayer(nextState, playerId, {
            ...current,
            power: [...current.power, { ...found.card, faceDown: false }],
          }),
        };
        return ok(
          nextState,
          buildLogEntry(
            playerId,
            "play_operation",
            found.card.cardId,
            state.definitions,
            "place_in_power",
          ),
        );
      }

      const isPermanent = isPermanentCard(state.definitions, found.card.cardId);
      if (isPermanent) {
        nextState = placePermanentOperation(nextState, playerId, found.card);
      }

      const outcome = resolveOperationEffect({
        state: nextState,
        playerId,
        operationCardId: found.card.cardId,
        targetInstanceId: action.targetInstanceId,
        extraInstanceIds: [
          ...(action.targetInstanceId ? [action.targetInstanceId] : []),
          ...(action.extraInstanceId ? [action.extraInstanceId] : []),
        ],
      });

      nextState = outcome.state;

      if (outcome.discardOperation !== false && !isPermanent) {
        const current = nextState.players[playerId];
        nextState = {
          ...nextState,
          ...updatePlayer(nextState, playerId, {
            ...current,
            discard: [...current.discard, found.card],
          }),
        };
      } else if (outcome.discardOperation === true && isPermanent) {
        const current = nextState.players[playerId];
        const operation = current.operation.filter(
          (c) => c.instanceId !== found.card.instanceId,
        );
        nextState = {
          ...nextState,
          ...updatePlayer(nextState, playerId, {
            ...current,
            operation,
            discard: [...current.discard, found.card],
          }),
        };
      }

      return ok(
        nextState,
        buildLogEntry(
          playerId,
          "play_operation",
          found.card.cardId,
          state.definitions,
          outcome.detail,
        ),
      );
    }

    case "rush": {
      if (state.phase !== "rush") return fail("wrong_phase");
      const found = findInZone(player, "hand", action.instanceId);
      if (!found) return fail("card_not_in_hand");

      const definition = getDefinition(state.definitions, found.card.cardId);
      if (!isUnit(definition)) return fail("not_a_unit");

      const cost = parsePowerCost(definition!.powerCost);
      let nextPlayer = player;

      if (needsZordMaterial(state.definitions, found.card.cardId)) {
        if (requiresAllFusionPartners(found.card.cardId)) {
          const afterZord = applyAllZordFusionMaterials(
            nextPlayer,
            found.card.cardId,
            found.card.instanceId,
          );
          if (!afterZord) return fail("zord_material_required");
          nextPlayer = afterZord;
        } else {
          const mothershipHolds = action.zordMothershipHoldInstanceIds ?? [];
          const hasMaterial = !!action.zordMaterialInstanceId;
          if (!hasMaterial && mothershipHolds.length === 0) {
            return fail("zord_material_required");
          }
          if (
            !validateZordAdditionalPayment(
              nextPlayer,
              state.definitions,
              found.card.cardId,
              found.card.instanceId,
              action.zordMaterialInstanceId,
              action.zordMaterialDestination,
              mothershipHolds,
            )
          ) {
            return fail("invalid_zord_material");
          }

          if (hasMaterial) {
            const afterZord = applyZordMaterial(
              nextPlayer,
              state.definitions,
              found.card.cardId,
              found.card.instanceId,
              action.zordMaterialInstanceId!,
              action.zordMaterialDestination,
            );
            if (!afterZord) return fail("invalid_zord_material");
            nextPlayer = afterZord;
          }

          if (mothershipHolds.length > 0) {
            const kind = canUseMothershipForZordRush(
              state.definitions,
              nextPlayer,
              found.card.cardId,
            );
            if (!kind) return fail("invalid_zord_material");
            const afterHolds = applyMothershipHolds(
              nextPlayer,
              state.definitions,
              mothershipHolds,
              kind,
            );
            if (!afterHolds) return fail("invalid_zord_material");
            nextPlayer = afterHolds;
          }
        }
      }

      if (!payPowerCost(nextPlayer, cost)) {
        const shortage = cost - nextPlayer.power.length;
        const withHolds = applyDarkDealRushHolds(nextPlayer, shortage);
        if (!withHolds || darkDealRushPowerBudget(state, playerId, nextPlayer, definition!) < cost) {
          return fail("insufficient_power");
        }
        nextPlayer = withHolds;
      }

      const handFound = findInZone(nextPlayer, "hand", action.instanceId);
      if (!handFound) return fail("card_not_in_hand");

      const [, hand] = removeAt(nextPlayer.hand, handFound.index);
      let rushCard = handFound.card;
      if (
        needsZordMaterial(state.definitions, found.card.cardId) &&
        !requiresAllFusionPartners(found.card.cardId) &&
        action.zordMaterialInstanceId
      ) {
        const material = findZordMaterial(
          player,
          state.definitions,
          found.card.cardId,
          found.card.instanceId,
          action.zordMaterialInstanceId,
        );
        if (material) {
          rushCard = { ...rushCard, zordMaterialCardId: material.card.cardId };
        }
      } else if (
        needsZordMaterial(state.definitions, found.card.cardId) &&
        requiresAllFusionPartners(found.card.cardId)
      ) {
        const partners = listZordFusionPartnerIds(found.card.cardId);
        if (partners[0]) {
          rushCard = { ...rushCard, zordMaterialCardId: partners[0] };
        }
      }
      nextPlayer = {
        ...nextPlayer,
        hand,
        rush: [...nextPlayer.rush, rushCard],
      };
      nextPlayer = markRushedThisTurn(nextPlayer, handFound.card.instanceId);
      nextPlayer = clearShironLightRushTarget(nextPlayer);
      nextPlayer = { ...nextPlayer, rushCategoryHoldReady: false };
      let nextState: GameState = {
        ...state,
        ...updatePlayer(state, playerId, nextPlayer),
      };

      const rushFinal = finalizeRushAction(
        nextState,
        playerId,
        handFound.card.instanceId,
        playerId,
      );
      nextState = {
        ...rushFinal.state,
        log: [...rushFinal.state.log, ...rushFinal.logs],
      };

      const mainLog = buildLogEntry(
        playerId,
        "rush",
        found.card.cardId,
        state.definitions,
        rushFinal.counterPending ? "counter_pending" : undefined,
      );

      if (
        !rushFinal.counterPending &&
        hasAutoBattleEntryOnRushNote(found.card.cardId)
      ) {
        const autoBattle = applyAction(nextState, {
          type: "move_to_battle",
          playerId,
          instanceId: handFound.card.instanceId,
        });
        if (autoBattle.ok) {
          return {
            ok: true,
            state: autoBattle.state,
            log: [mainLog, autoBattle.log].filter(Boolean).join("\n"),
          };
        }
      }

      return ok(nextState, mainLog);
    }

    case "move_to_battle": {
      let found = findInZone(player, "rush", action.instanceId);
      if (!found) return fail("card_not_in_rush");

      if (state.phase !== "battle") {
        if (state.phase !== "rush" || !hasAutoBattleEntryOnRushNote(found.card.cardId)) {
          return fail("wrong_phase");
        }
      }

      if (
        needsBattleEntryRushDiscard(found.card.cardId) &&
        !battleEntryRushDiscardSatisfied(player, found.card.cardId)
      ) {
        const discardChoice = tryStartBattleEntryRushDiscard(state, playerId, found.card);
        if (!discardChoice) return fail("cannot_enter_battle");
        return ok(
          discardChoice,
          buildSimpleLogEntry(playerId, "battle_entry_discard_pending"),
        );
      }

      if (
        needsBattleEntryHandDiscard(found.card.cardId) &&
        !battleEntryHandDiscardSatisfied(player, found.card.cardId)
      ) {
        const discardChoice = tryStartBattleEntryHandDiscard(state, playerId, found.card);
        if (!discardChoice) return fail("cannot_enter_battle");
        return ok(
          discardChoice,
          buildSimpleLogEntry(playerId, "battle_entry_hand_discard_pending"),
        );
      }

      if (!canMoveUnitToBattle(state, playerId, found.card, "rush")) {
        return fail("cannot_enter_battle");
      }

      const entryHoldsRequired = requiredBattleEntryHolds(state, playerId, found.card);
      if (
        entryHoldsRequired > 0 &&
        countHeldCommands(player) < entryHoldsRequired
      ) {
        return fail("cannot_enter_battle");
      }
      let nextPlayer: PlayerState = {
        ...player,
        battleEntryHoldReady: false,
        battleEntryRushDiscardReady: false,
        battleEntryHandDiscardReady: false,
      };
      const [, rush] = removeAt(nextPlayer.rush, found.index);
      nextPlayer = { ...nextPlayer, rush };

      const position = battlePositionAfterMove(nextPlayer.battle.length);
      const battleBeforeEnter = [...nextPlayer.battle];
      let battleCard = found.card;

      if (action.rideOff && found.card.mountedOnInstanceId) {
        battleCard = { ...battleCard, mountedOnInstanceId: undefined };
      }

      nextPlayer = {
        ...nextPlayer,
        battle: [...nextPlayer.battle, battleCard],
      };
      let nextState: GameState = {
        ...state,
        ...updatePlayer(state, playerId, nextPlayer),
      };

      const combo = resolveEnterBattleEffects(
        nextState,
        playerId,
        battleCard,
        position,
        {
          battleBeforeEnter,
          rideOff: action.rideOff,
        },
      );

      const mainLog = buildLogEntry(
        playerId,
        "move_to_battle",
        battleCard.cardId,
        state.definitions,
      );
      const entry = createBattleEntryPrompt(
        playerId,
        battleCard.instanceId,
        combo.state.pendingEffectChoice && combo.enterResumeFrom
          ? {
              battlePosition: position,
              rideOff: action.rideOff,
              battleBeforeEnterInstanceIds: battleBeforeEnter.map((c) => c.instanceId),
              from: combo.enterResumeFrom,
            }
          : undefined,
      );
      const withClearedDiscard = {
        ...combo.state,
        ...updatePlayer(combo.state, playerId, {
          ...combo.state.players[playerId],
          battleEntryDiscardedCardId: undefined,
        }),
      };
      const finalState: GameState = afterEnterBattle(
        {
          ...withClearedDiscard,
          log: [...withClearedDiscard.log, ...combo.logs, mainLog],
          winner: checkWinner(withClearedDiscard),
        },
        entry,
      );
      return { ok: true, state: finalState };
    }

    case "pass_battle_entry": {
      const pending = state.pendingBattleEntry;
      if (!pending || playerId !== pending.playerId) return fail("no_pending_battle_entry");
      let cleared = clearBakiBakiExtraAttack(state, playerId, pending.instanceId);
      const nextPlayer = markBattleActed(cleared.players[playerId], pending.instanceId);
      const nextState = finishBattleEntryIf(
        { ...cleared, ...updatePlayer(cleared, playerId, nextPlayer) },
        pending.instanceId,
      );
      return ok(nextState, buildSimpleLogEntry(playerId, "pass_battle_entry"));
    }

    case "strike": {
      if (state.phase !== "battle") return fail("wrong_phase");
      if (state.pendingStrike) return fail("pending_strike");
      if (
        state.pendingBattleEntry &&
        action.instanceId !== state.pendingBattleEntry.instanceId
      ) {
        return fail("pending_battle_entry");
      }

      const found = findInZone(player, "battle", action.instanceId);
      if (!found) return fail("card_not_in_battle");
      if (found.card.battleActed) return fail("already_acted");
      if (!canStrikeUnit(state.definitions, found.card, state, playerId)) return fail("insufficient_sp");

      const damage = strikeDamageFor(state.definitions, found.card, state, playerId);
      let nextPlayer = markBattleActed(player, action.instanceId);
      let nextState: GameState = {
        ...state,
        ...updatePlayer(state, playerId, nextPlayer),
      };

      const pending: PendingStrike = {
        strikerPlayerId: playerId,
        strikerInstanceId: action.instanceId,
        damage,
        battlePhasePlayer: playerId,
      };

      const defenderId = opponent(playerId);
      if (hasStrikeReactions(nextState, defenderId)) {
        nextState = {
          ...nextState,
          pendingStrike: pending,
          activePlayer: defenderId,
        };
        if (state.pendingBattleEntry?.instanceId === action.instanceId) {
          nextState = { ...nextState, pendingBattleEntry: undefined };
        }
        return ok(
          nextState,
          buildSimpleLogEntry(playerId, "strike_pending", String(damage)),
        );
      }

      return completeStrike(nextState, pending);
    }

    case "five_tech_intercept": {
      const pending = state.pendingStrike;
      if (!pending) return fail("no_pending_strike");
      const defenderId = opponent(pending.strikerPlayerId);
      if (playerId !== defenderId) return fail("wrong_player");

      const result = applyFiveTechIntercept(
        state,
        defenderId,
        pending,
        action.interceptInstanceId,
      );
      if (result.state.pendingLeave) {
        return ok(
          { ...result.state, log: [...result.state.log, result.log] },
          result.log,
        );
      }
      return completeStrike(result.state, result.pending, [result.log]);
    }

    case "play_counter": {
      if (!canExecuteHandCounter(state, playerId, action.instanceId)) {
        return fail("command_not_held");
      }

      if (state.pendingLeave) {
        const pending = state.pendingLeave;
        if (playerId !== pending.ownerPlayerId) return fail("wrong_player");
        const effectId = getCounterEffectId(state, playerId, action.instanceId);
        if (effectId === "dino_chronicle") {
          const result = applyDinoChronicleCounter(state, playerId, action.instanceId);
          const nextState = finalizeLeaveReaction(result.state, pending, result.prevented);
          const strikePending = state.pendingStrike;
          if (!result.prevented && pending.resumePendingStrike && strikePending) {
            const resumedStrike: PendingStrike = {
              strikerPlayerId: strikePending.strikerPlayerId,
              strikerInstanceId: strikePending.strikerInstanceId,
              damage: strikePending.damage,
              battlePhasePlayer: strikePending.battlePhasePlayer,
              damageCancelled: pending.resumePendingStrike.damageCancelled,
            };
            return completeStrike(
            clearCounterHoldReady(nextState, playerId),
            resumedStrike,
          );
          }
          return ok(clearCounterHoldReady(nextState, playerId), result.log);
        }
        if (effectId === "dino_guts") {
          const result = applyDinoGutsCounter(
            state,
            playerId,
            action.instanceId,
            pending.leavingCardId,
          );
          const nextState = finalizeLeaveReaction(result.state, pending, result.prevented);
          const strikePending = state.pendingStrike;
          if (!result.prevented && pending.resumePendingStrike && strikePending) {
            const resumedStrike: PendingStrike = {
              strikerPlayerId: strikePending.strikerPlayerId,
              strikerInstanceId: strikePending.strikerInstanceId,
              damage: strikePending.damage,
              battlePhasePlayer: strikePending.battlePhasePlayer,
              damageCancelled: pending.resumePendingStrike.damageCancelled,
            };
            return completeStrike(
              clearCounterHoldReady(nextState, playerId),
              resumedStrike,
            );
          }
          return ok(clearCounterHoldReady(nextState, playerId), result.log);
        }
        return fail("invalid_counter");
      }

      if (state.pendingBattle) {
        const pending = state.pendingBattle;
        if (playerId !== pending.defenderPlayerId) return fail("wrong_player");
        const effectId = getCounterEffectId(state, playerId, action.instanceId);
        if (effectId === "new_gymnastics") {
          const result = applyNewGymnasticsCounter(
            state,
            playerId,
            action.instanceId,
            pending,
          );
          const nextPending: PendingBattle = { ...pending, battleCancelled: true };
          const resolved = resolveBattlePending(result.state, nextPending);
          return {
            ok: true,
            state: {
              ...clearCounterHoldReady(resolved.state, playerId),
              log: [...resolved.state.log, result.log, resolved.log],
              winner: checkWinner(resolved.state),
            },
          };
        }
        if (effectId === "hidden_ninja") {
          if (!action.substituteInstanceId) return fail("target_required");
          const result = applyHiddenNinjaCounter(
            state,
            playerId,
            action.instanceId,
            action.substituteInstanceId,
            pending,
          );
          const resolved = resolveBattlePending(result.state, result.pending);
          return {
            ok: true,
            state: {
              ...clearCounterHoldReady(resolved.state, playerId),
              log: [...resolved.state.log, result.log, resolved.log],
              winner: checkWinner(resolved.state),
            },
          };
        }
        return fail("invalid_counter");
      }

      if (state.pendingRush) {
        const pending = state.pendingRush;
        const defenderId = opponent(pending.rusherPlayerId);
        if (playerId !== defenderId) return fail("wrong_player");
        if (getCounterEffectId(state, playerId, action.instanceId) !== "shippu_ninja") {
          return fail("invalid_counter");
        }
        const result = applyShippuNinjaCounter(state, playerId, action.instanceId, pending);
        const nextState = finalizeRushPending(result.state, pending);
        return ok(clearCounterHoldReady(nextState, playerId), result.log);
      }

      if (state.pendingStrike) {
        return fail("invalid_counter");
      }

      return fail("no_pending_reaction");
    }

    case "use_plasma_energy": {
      const pending = state.pendingStrike;
      if (!pending) return fail("no_pending_strike");
      const defenderId = opponent(pending.strikerPlayerId);
      if (playerId !== defenderId) return fail("wrong_player");
      if (!canPlayPlasmaEnergyCounter(state, defenderId)) {
        return fail("invalid_counter");
      }

      const counter = applyPlasmaEnergyCounter(
        state,
        defenderId,
        pending.strikerPlayerId,
        pending.strikerInstanceId,
      );
      if (counter.state.pendingLeave) {
        return ok(
          { ...counter.state, log: [...counter.state.log, counter.log] },
          counter.log,
        );
      }
      return completeStrike(counter.state, pending, [counter.log]);
    }

    case "resolve_ruin_survey": {
      const result = applyResolveRuinSurvey(state, playerId, action.placement);
      if ("error" in result) return fail(result.error);
      return ok(result.state, result.log);
    }

    case "resolve_seabed_draw": {
      const result = applySeabedDrawPlacement(state, playerId, action.placement);
      if ("error" in result) return fail(result.error);
      let nextState = result.state;
      if (
        nextState.phase === "start" &&
        nextState.players[playerId].hasDrawnThisStart &&
        !nextState.pendingEffectChoice
      ) {
        nextState = openEarthForceUpkeepChoiceIfNeeded(nextState, playerId);
      }
      return withStartPhaseAutoAdvance(
        ok(nextState, result.log ?? buildSimpleLogEntry(playerId, "resolve_seabed_draw")),
        playerId,
      );
    }

    case "confirm_denji_reveal": {
      const result = applyConfirmDenjiReveal(state, playerId);
      if ("error" in result) return fail(result.error);
      const nextState = result.state;
      if (nextState.pendingEffectChoice) {
        return ok(nextState, result.log ?? buildSimpleLogEntry(playerId, "confirm_denji_reveal"));
      }
      return ok(nextState, result.log ?? buildSimpleLogEntry(playerId, "confirm_denji_reveal"));
    }

    case "confirm_shiron_reveal": {
      const result = applyConfirmShironReveal(state, playerId);
      if ("error" in result) return fail(result.error);
      return ok(
        result.state,
        result.log ?? buildSimpleLogEntry(playerId, "confirm_shiron_reveal"),
      );
    }

    case "confirm_effect_choice": {
      const result = applyConfirmEffectChoice(state, playerId);
      if ("error" in result) return fail(result.error);
      return withStartPhaseAutoAdvance(
        ok(result.state, result.log ?? buildSimpleLogEntry(playerId, "confirm_effect_choice")),
        playerId,
      );
    }

    case "resolve_effect_choice": {
      const pending = state.pendingEffectChoice;
      if (pending?.kind === "denji_machine") {
        const result = applyDenjiBottomOrderSelect(state, playerId, action.instanceId);
        if ("error" in result) return fail(result.error);
        return ok(result.state, result.log ?? buildSimpleLogEntry(playerId, "resolve_effect_choice"));
      }
      if (pending?.kind === "shiron_light") {
        const result = applyShironPickSelect(state, playerId, action.instanceId);
        if ("error" in result) return fail(result.error);
        return ok(result.state, result.log ?? buildSimpleLogEntry(playerId, "resolve_effect_choice"));
      }
      const result = applyEffectChoiceSelect(state, playerId, action.instanceId);
      if ("error" in result) return fail(result.error);
      let nextState = result.state;
      if (!nextState.pendingEffectChoice && pending?.effectId === "falcon_claw") {
        nextState = continueBattleToRushEffectQueue(nextState);
      }
      if (
        nextState.phase === "end" &&
        !nextState.pendingEffectChoice &&
        pending?.effectId === "jet_skateboard"
      ) {
        nextState = tryOpenEndTurnEffectsMenu(nextState, playerId) ?? nextState;
      }
      return withEndPhaseAutoFinalize(
        withStartPhaseAutoAdvance(
          ok(nextState, result.log ?? buildSimpleLogEntry(playerId, "resolve_effect_choice")),
          playerId,
        ),
        playerId,
      );
    }

    case "skip_effect_choice": {
      const pending = state.pendingEffectChoice;
      if (pending?.effectId === "earth_force" && pending.playerId === playerId) {
        const { state: afterDiscard, discarded } = discardEarthForceForUnpaidUpkeep(
          state,
          playerId,
        );
        if (!discarded) return fail("invalid_target");
        const nextState: GameState = {
          ...afterDiscard,
          pendingEffectChoice: undefined,
          activePlayer: pending.phasePlayerId,
        };
        return withStartPhaseAutoAdvance(
          ok(
            nextState,
            buildLogEntry(
              playerId,
              "earth_force_upkeep",
              "RS-022",
              state.definitions,
              "declined",
            ),
          ),
          playerId,
        );
      }
      const result = skipEffectChoice(state, playerId);
      if ("error" in result) return fail(result.error);
      let afterSkip = result.state;
      if (!afterSkip.pendingEffectChoice && pending?.effectId === "falcon_claw") {
        afterSkip = continueBattleToRushEffectQueue(afterSkip);
      }
      if (
        afterSkip.phase === "start" &&
        afterSkip.players[playerId].hasDrawnThisStart &&
        !afterSkip.pendingEffectChoice &&
        pending?.effectId === "seabed_survey"
      ) {
        afterSkip = openEarthForceUpkeepChoiceIfNeeded(afterSkip, playerId);
      }
      if (
        afterSkip.phase === "end" &&
        !afterSkip.pendingEffectChoice &&
        pending?.effectId === "jet_skateboard"
      ) {
        afterSkip = tryOpenEndTurnEffectsMenu(afterSkip, playerId) ?? afterSkip;
      }
      return withEndPhaseAutoFinalize(
        withStartPhaseAutoAdvance(
          ok(afterSkip, result.log ?? buildSimpleLogEntry(playerId, "skip_effect_choice")),
          playerId,
        ),
        playerId,
      );
    }

    case "pass_strike_reaction": {
      const pending = state.pendingStrike;
      if (!pending) return fail("no_pending_strike");
      const defenderId = opponent(pending.strikerPlayerId);
      if (playerId !== defenderId) return fail("wrong_player");
      return completeStrike(state, pending);
    }

    case "pass_battle_reaction": {
      const pending = state.pendingBattle;
      if (!pending) return fail("no_pending_battle");
      if (playerId !== pending.defenderPlayerId) return fail("wrong_player");
      const resolved = resolveBattlePending(state, pending);
      return ok(resolved.state, resolved.log);
    }

    case "pass_rush_reaction": {
      const pending = state.pendingRush;
      if (!pending) return fail("no_pending_rush");
      if (playerId !== opponent(pending.rusherPlayerId)) return fail("wrong_player");
      const nextState = finalizeRushPending(state, pending);
      return ok(nextState, buildSimpleLogEntry(playerId, "pass_rush_reaction"));
    }

    case "use_super_shield": {
      const pending = state.pendingLeave;
      if (!pending?.superShieldInstanceId) return fail("no_super_shield");
      if (playerId !== pending.ownerPlayerId) return fail("wrong_player");

      const shieldResult = applySuperShieldSubstitute(
        state,
        playerId,
        pending.superShieldInstanceId,
      );
      let nextState = finalizeLeaveReaction(shieldResult.state, pending, true);
      if (pending.resumePendingStrike && state.pendingStrike) {
        return completeStrike(nextState, {
          ...state.pendingStrike,
          damageCancelled: pending.resumePendingStrike.damageCancelled,
        }, [shieldResult.log]);
      }
      return ok(nextState, shieldResult.log);
    }

    case "pass_leave_reaction": {
      const pending = state.pendingLeave;
      if (!pending) return fail("no_pending_leave");
      if (playerId !== pending.ownerPlayerId) return fail("wrong_player");
      let nextState = finalizeLeaveReaction(state, pending, false);
      if (pending.resumePendingStrike && state.pendingStrike) {
        return completeStrike(nextState, {
          ...state.pendingStrike,
          damageCancelled: pending.resumePendingStrike.damageCancelled,
        });
      }
      return ok(nextState, buildSimpleLogEntry(playerId, "pass_leave_reaction"));
    }

    case "use_register": {
      const pending = state.pendingRegister;
      if (!pending) return fail("no_pending_register");
      if (playerId !== pending.ownerPlayerId) return fail("wrong_player");
      const nextState = applyRegisterHold(state, pending);
      if (pending.followUpAttackerLeave) {
        const followUp = tryLeaveField(nextState, {
          ...pending.followUpAttackerLeave,
          phasePlayerId: pending.followUpAttackerLeave.phasePlayerId,
        });
        if (followUp.deferred) {
          return ok(followUp.state, buildSimpleLogEntry(playerId, "use_register"));
        }
        return ok(followUp.state, buildSimpleLogEntry(playerId, "use_register"));
      }
      if (pending.resumePendingStrike && state.pendingStrike) {
        return completeStrike(nextState, {
          ...state.pendingStrike,
          damageCancelled: pending.resumePendingStrike.damageCancelled,
        });
      }
      return ok(nextState, buildSimpleLogEntry(playerId, "use_register"));
    }

    case "pass_register": {
      const pending = state.pendingRegister;
      if (!pending) return fail("no_pending_register");
      if (playerId !== pending.ownerPlayerId) return fail("wrong_player");
      let nextState = finalizeRegisterDiscard(state, pending);
      if (pending.followUpAttackerLeave) {
        const followUp = tryLeaveField(nextState, {
          ...pending.followUpAttackerLeave,
          phasePlayerId: pending.followUpAttackerLeave.phasePlayerId,
        });
        nextState = followUp.state;
      }
      if (pending.resumePendingStrike && state.pendingStrike) {
        return completeStrike(nextState, {
          ...state.pendingStrike,
          damageCancelled: pending.resumePendingStrike.damageCancelled,
        });
      }
      return ok(nextState, buildSimpleLogEntry(playerId, "pass_register"));
    }

    case "battle": {
      if (state.phase !== "battle") return fail("wrong_phase");
      state = clearBakiBakiExtraAttack(state, playerId, action.attackerInstanceId);
      if (state.pendingBattle) return fail("pending_battle");
      if (
        state.pendingBattleEntry &&
        action.attackerInstanceId !== state.pendingBattleEntry.instanceId
      ) {
        return fail("pending_battle_entry");
      }

      const enemyId = opponent(playerId);
      const actor = state.players[playerId];

      const attackerFound = findInZone(actor, "battle", action.attackerInstanceId);
      if (!attackerFound) return fail("attacker_not_in_battle");
      if (attackerFound.card.battleActed) return fail("already_acted");
      if (cannotAttackOrStrikeThisTurn(actor, attackerFound.card)) {
        return fail("cannot_attack_turn_rushed");
      }

      const enemy = state.players[enemyId];
      const defenderFound =
        findInZone(enemy, "battle", action.defenderInstanceId) ??
        findInZone(enemy, "rush", action.defenderInstanceId);
      if (!defenderFound) return fail("defender_not_found");
      if (
        !canAttackDefender(
          state,
          playerId,
          action.attackerInstanceId,
          enemyId,
          action.defenderInstanceId,
          canAttackRushWithYellowThunder,
        )
      ) {
        return fail("invalid_target");
      }

      const miragePrep = prepareMirageBeamForBattle(
        state,
        playerId,
        attackerFound.card.cardId,
      );
      const battleState = miragePrep.state;

      const pending: PendingBattle = {
        attackerPlayerId: playerId,
        attackerInstanceId: action.attackerInstanceId,
        defenderPlayerId: enemyId,
        defenderInstanceId: action.defenderInstanceId,
        phasePlayerId: playerId,
        attackerBpBonus: superPowerAttackBonus(battleState, playerId, attackerFound.card),
        mirageBeamBpOverride: miragePrep.bpOverride,
        mirageBeamDiscard: miragePrep.revealedCard,
      };

      if (
        hasBattleCounterReactions(
          battleState,
          enemyId,
          action.defenderInstanceId,
          playerId,
          action.attackerInstanceId,
        )
      ) {
        let pendingState: GameState = {
          ...battleState,
          pendingBattle: pending,
          activePlayer: enemyId,
        };
        if (state.pendingBattleEntry?.instanceId === action.attackerInstanceId) {
          pendingState = { ...pendingState, pendingBattleEntry: undefined };
        }
        return ok(pendingState, buildSimpleLogEntry(playerId, "battle_pending"));
      }

      const resolved = resolveBattlePending(battleState, pending);
      return ok(resolved.state, resolved.log);
    }

    case "battle_dance_retreat": {
      if (state.phase !== "battle") return fail("wrong_phase");
      if (!hasOperationEffect(player, "battle_dance", state.definitions)) {
        return fail("illegal_action");
      }

      const commandIds = action.commandInstanceIds;
      if (!commandIds || commandIds.length !== 2) {
        return fail("invalid_command_payment");
      }
      const uniqueCommandIds = new Set(commandIds);
      if (uniqueCommandIds.size !== 2) return fail("invalid_command_payment");

      let nextPlayer = player;
      for (const commandInstanceId of commandIds) {
        const cmdFound = findInZone(nextPlayer, "command", commandInstanceId);
        if (!cmdFound || cmdFound.card.commandHeld) {
          return fail("invalid_command_payment");
        }
        const command = nextPlayer.command.map((c) =>
          c.instanceId === commandInstanceId
            ? { ...c, commandHeld: true, mothershipHold: false }
            : c,
        );
        nextPlayer = { ...nextPlayer, command };
      }

      const found = findInZone(nextPlayer, "battle", action.battleInstanceId);
      if (!found || !isSmallUnit(state.definitions, found.card.cardId)) {
        return fail("invalid_target");
      }

      const [, battle] = removeAt(nextPlayer.battle, found.index);
      nextPlayer = markBattleBlocked(
        { ...nextPlayer, battle, rush: [...nextPlayer.rush, found.card] },
        found.card.instanceId,
      );

      let nextState: GameState = {
        ...state,
        ...updatePlayer(state, playerId, nextPlayer),
      };
      nextState = tryLegend3BattleToRush(nextState, playerId, found.card, playerId);
      return ok(
        nextState,
        buildLogEntry(playerId, "battle_dance", "RS-003", state.definitions),
      );
    }

    case "shiron_light": {
      if (state.phase !== "rush") return fail("wrong_phase");
      const nextState = startShironLightChoice(
        state,
        playerId,
        action.operationInstanceId,
      );
      if (!nextState) return fail("illegal_action");
      return ok(
        nextState,
        buildLogEntry(playerId, "shiron_light", "RS-013", state.definitions, "start"),
      );
    }

    case "hidora_egg": {
      if (state.phase !== "rush") return fail("wrong_phase");
      if (!hasOperationEffect(player, "hidora_egg", state.definitions, { state, playerId })) {
        return fail("illegal_action");
      }
      if (getTurnModifiers(player).hidoraEggUsed) return fail("already_used");

      const result = resolveHidoraEgg(state, playerId);
      let nextPlayer = withTurnModifiers(player, { hidoraEggUsed: true });
      return ok(
        { ...result.state, ...updatePlayer(result.state, playerId, nextPlayer) },
        hidoraEggLog(playerId, result.detail, state.definitions),
      );
    }

    case "end_phase": {
      if (state.phase === "start") {
        return fail("illegal_action");
      }

      if (state.phase === "end") {
        let nextState = finalizeTurnEnd(state);
        return ok(nextState, buildSimpleLogEntry(playerId, "end_turn"));
      }

      const nextState: GameState = { ...advancePhase(state) };
      if (nextState.phase === "end") {
        const withMenu = tryOpenEndTurnEffectsMenu(nextState, playerId);
        if (withMenu) {
          return ok(
            withMenu,
            buildSimpleLogEntry(playerId, "end_phase", state.phase),
          );
        }
        return withEndPhaseAutoFinalize(
          ok(nextState, buildSimpleLogEntry(playerId, "end_phase", state.phase)),
          playerId,
        );
      }

      return ok(
        nextState,
        buildSimpleLogEntry(playerId, "end_phase", state.phase),
      );
    }

    default:
      return fail("unknown_action");
  }
}

export function applyActions(
  state: GameState,
  actions: GameAction[],
): ActionResult {
  let current = state;
  for (const action of actions) {
    const result = applyAction(current, action);
    if (!result.ok) return result;
    current = result.state;
  }
  return { ok: true, state: current };
}
