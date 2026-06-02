import type { GameAction } from "../types/actions";
import type { GameState, PendingBattle, PendingStrike, PlayerId, PlayerState } from "../types/game";
import { getCardEffect, listZordFusionPartnerIds } from "@rangers-strike/cards";
import { COMMAND_ZONE_MAX } from "../types/game";
import { checkWinner, advancePhase } from "./createGame";
import {
  canHoldCommandPhases,
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
  applyPlayerDamage,
  findInZone,
  opponent,
  payPowerCost,
  removeAt,
  updatePlayer,
} from "./helpers";
import { isLegalAction } from "./legalActions";
import {
  battlePositionAfterMove,
  canStrikeUnit,
  resolveEnterBattleEffects,
  strikeDamageFor,
} from "../rules/combo";
import { finalizeRushAction } from "../rules/rushEffects";
import { canAttackRushWithYellowThunder } from "../rules/namedUnitEffects";
import {
  applyStartPhaseReset,
  canPayEarthForceUpkeep,
  discardEarthForceForUnpaidUpkeep,
  mustDrawBeforeStartEnd,
  mustResolveEarthForceUpkeepBeforeStartEnd,
  openEarthForceUpkeepChoiceIfNeeded,
} from "../rules/startPhase";
import { applyAllZordFusionMaterials, applyZordMaterial, findZordMaterial, requiresAllFusionPartners } from "../rules/zord";
import { canMoveUnitToBattle, mustEnterBattleBeforePhaseEnd } from "../rules/restrictions";
import {
  applyFiveTechIntercept,
  applyPlasmaEnergyCounter,
  canPlayPlasmaEnergyCounter,
  finalizeStrike,
  hasStrikeReactions,
} from "../rules/strikeReactions";
import { applyAdventureEndTurn, getTurnModifiers, markBattleBlocked, markRushedThisTurn, withTurnModifiers } from "../rules/turnModifiers";
import { applyKarakuriFireHawkEndTurn, checkReturnToHandAt6Damage } from "../rules/legend2/destroyEffects";
import { noAttackOrStrikeTurnRushed } from "@rangers-strike/cards";
import { countHeldCommands } from "../rules/restrictions";
import {
  applyDinoChronicleCounter,
  applyDinoGutsCounter,
  applyHiddenNinjaCounter,
  applyNewGymnasticsCounter,
  applyShippuNinjaCounter,
  applySuperShieldSubstitute,
  getCounterEffectId,
  hasBattleCounterReactions,
  resolveBattlePending,
  finalizeLeaveReaction,
  finalizeRushPending,
} from "../rules/operationCounters";
import { applyResolveRuinSurvey } from "../rules/ruinSurvey";
import {
  applyEffectChoicePlacement,
  applyEffectChoiceSelect,
  skipEffectChoice,
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
  return {
    ok: true,
    state: {
      ...state,
      log: [...state.log, message],
      winner: checkWinner(state),
    },
  };
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
  next = applyKarakuriFireHawkEndTurn(next, prevPlayer);
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

function completeStrike(state: GameState, pending: PendingStrike, extraLogs: string[] = []): ActionResult {
  let nextState = finalizeStrike(state, pending);
  nextState = withWinner(nextState);
  nextState = finishBattleEntryIf(nextState, pending.strikerInstanceId);

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
      ...nextState,
      log: [...nextState.log, strikeLog, ...extraLogs],
    },
  };
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
      const drawn = applySuperBrainDraw(state, playerId, {
        ...player,
        hasDrawnThisStart: true,
      });
      if (drawn.detail === "empty_deck") {
        const nextState: GameState = {
          ...state,
          winner: opponent(playerId),
          log: [...state.log, buildSimpleLogEntry(playerId, "deck_out")],
        };
        return { ok: true, state: nextState };
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
      return ok(withUpkeep, buildSimpleLogEntry(playerId, "draw"));
    }

    case "bonus_draw": {
      if (state.phase !== "start") return fail("wrong_phase");
      if (!player.hasDrawnThisStart) return fail("must_draw_first");
      if (player.hand.length >= player.damage || player.deck.length === 0) {
        return fail("bonus_draw_unavailable");
      }
      const drawn = applySuperBrainDraw(state, playerId, player);
      if (drawn.detail === "empty_deck") {
        return fail("bonus_draw_unavailable");
      }
      return ok(drawn.state, buildSimpleLogEntry(playerId, "bonus_draw"));
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

    case "hold_command": {
      if (!canHoldCommandPhases(state.phase)) return fail("wrong_phase");
      const found = findInZone(player, "command", action.instanceId);
      if (!found) return fail("card_not_in_command");
      if (found.card.commandHeld) return fail("already_held");

      const command = [...player.command];
      command[found.index] = { ...found.card, commandHeld: true };
      return ok(
        { ...state, ...updatePlayer(state, playerId, { ...player, command }) },
        buildLogEntry(playerId, "hold_command", found.card.cardId, state.definitions),
      );
    }

    case "release_command": {
      if (!canHoldCommandPhases(state.phase)) return fail("wrong_phase");
      const found = findInZone(player, "command", action.instanceId);
      if (!found) return fail("card_not_in_command");
      if (!found.card.commandHeld) return fail("not_held");

      const command = [...player.command];
      command[found.index] = { ...found.card, commandHeld: false };
      return ok(
        { ...state, ...updatePlayer(state, playerId, { ...player, command }) },
        buildLogEntry(playerId, "release_command", found.card.cardId, state.definitions),
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
          if (!action.zordMaterialInstanceId) return fail("zord_material_required");
          const material = findZordMaterial(
            nextPlayer,
            state.definitions,
            found.card.cardId,
            found.card.instanceId,
            action.zordMaterialInstanceId,
          );
          if (!material) return fail("invalid_zord_material");
          const afterZord = applyZordMaterial(
            nextPlayer,
            state.definitions,
            found.card.cardId,
            found.card.instanceId,
            action.zordMaterialInstanceId,
          );
          if (!afterZord) return fail("invalid_zord_material");
          nextPlayer = afterZord;
        }
      }

      if (!payPowerCost(nextPlayer, cost)) return fail("insufficient_power");

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

      return ok(nextState, mainLog);
    }

    case "move_to_battle": {
      if (state.phase !== "battle") return fail("wrong_phase");

      let found = findInZone(player, "rush", action.instanceId);
      if (!found) return fail("card_not_in_rush");

      if (!canMoveUnitToBattle(state, playerId, found.card, "rush")) {
        return fail("cannot_enter_battle");
      }

      let nextPlayer = { ...player };
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
      const finalState: GameState = afterEnterBattle(
        {
          ...combo.state,
          log: [...combo.state.log, ...combo.logs, mainLog],
          winner: checkWinner(combo.state),
        },
        entry,
      );
      return { ok: true, state: finalState };
    }

    case "pass_battle_entry": {
      const pending = state.pendingBattleEntry;
      if (!pending || playerId !== pending.playerId) return fail("no_pending_battle_entry");
      const nextPlayer = markBattleActed(player, pending.instanceId);
      const nextState = finishBattleEntryIf(
        { ...state, ...updatePlayer(state, playerId, nextPlayer) },
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
            return completeStrike(nextState, resumedStrike);
          }
          return ok(nextState, result.log);
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
            return completeStrike(nextState, resumedStrike);
          }
          return ok(nextState, result.log);
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
              ...resolved.state,
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
              ...resolved.state,
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
        return ok(nextState, result.log);
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

    case "resolve_effect_choice": {
      const result = applyEffectChoiceSelect(state, playerId, action.instanceId);
      if ("error" in result) return fail(result.error);
      return ok(result.state, result.log ?? buildSimpleLogEntry(playerId, "resolve_effect_choice"));
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
        return ok(
          nextState,
          buildLogEntry(
            playerId,
            "earth_force_upkeep",
            "RS-022",
            state.definitions,
            "declined",
          ),
        );
      }
      const result = skipEffectChoice(state, playerId);
      if ("error" in result) return fail(result.error);
      return ok(result.state, result.log ?? buildSimpleLogEntry(playerId, "skip_effect_choice"));
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

    case "battle": {
      if (state.phase !== "battle") return fail("wrong_phase");
      if (state.pendingBattle) return fail("pending_battle");
      if (
        state.pendingBattleEntry &&
        action.attackerInstanceId !== state.pendingBattleEntry.instanceId
      ) {
        return fail("pending_battle_entry");
      }

      const enemyId = opponent(playerId);
      const enemy = state.players[enemyId];

      const attackerFound = findInZone(player, "battle", action.attackerInstanceId);
      if (!attackerFound) return fail("attacker_not_in_battle");
      if (attackerFound.card.battleActed) return fail("already_acted");

      const defenderInBattle = findInZone(enemy, "battle", action.defenderInstanceId);
      const defenderInRush = findInZone(enemy, "rush", action.defenderInstanceId);
      if (!defenderInBattle && !defenderInRush) return fail("defender_not_found");
      if (
        defenderInRush &&
        !canAttackRushWithYellowThunder(state, playerId, action.attackerInstanceId)
      ) {
        return fail("invalid_target");
      }

      const pending: PendingBattle = {
        attackerPlayerId: playerId,
        attackerInstanceId: action.attackerInstanceId,
        defenderPlayerId: enemyId,
        defenderInstanceId: action.defenderInstanceId,
        phasePlayerId: playerId,
        attackerBpBonus: superPowerAttackBonus(state, playerId, attackerFound.card),
      };

      if (
        hasBattleCounterReactions(
          state,
          enemyId,
          action.defenderInstanceId,
          playerId,
          action.attackerInstanceId,
        )
      ) {
        return ok(
          {
            ...state,
            pendingBattle: pending,
            activePlayer: enemyId,
          },
          buildSimpleLogEntry(playerId, "battle_pending"),
        );
      }

      const resolved = resolveBattlePending(state, pending);
      return ok(resolved.state, resolved.log);
    }

    case "battle_dance_retreat": {
      if (state.phase !== "battle") return fail("wrong_phase");
      if (!hasOperationEffect(player, "battle_dance", state.definitions)) {
        return fail("illegal_action");
      }
      if (countHeldCommands(player) < 2) return fail("need_two_held_commands");

      const found = findInZone(player, "battle", action.battleInstanceId);
      if (!found || !isSmallUnit(state.definitions, found.card.cardId)) {
        return fail("invalid_target");
      }

      const [, battle] = removeAt(player.battle, found.index);
      let nextPlayer = markBattleBlocked(
        { ...player, battle, rush: [...player.rush, found.card] },
        found.card.instanceId,
      );

      return ok(
        { ...state, ...updatePlayer(state, playerId, nextPlayer) },
        buildLogEntry(playerId, "battle_dance", "RS-003", state.definitions),
      );
    }

    case "shiron_light": {
      if (state.phase !== "rush") return fail("wrong_phase");
      if (!hasOperationEffect(player, "shiron_light", state.definitions)) {
        return fail("illegal_action");
      }
      if (getTurnModifiers(player).shironLightUsed) return fail("already_used");

      const handFound = findInZone(player, "hand", action.handInstanceId);
      if (!handFound) return fail("card_not_in_hand");

      const definition = getDefinition(state.definitions, handFound.card.cardId);
      if (!isUnit(definition)) {
        const nextPlayer = withTurnModifiers(player, { shironLightUsed: true });
        return ok(
          { ...state, ...updatePlayer(state, playerId, nextPlayer) },
          buildLogEntry(playerId, "shiron_light", "RS-013", state.definitions, "not_unit"),
        );
      }

      const cost = parsePowerCost(definition!.powerCost);
      if (!payPowerCost(player, cost)) return fail("insufficient_power");

      const [, hand] = removeAt(player.hand, handFound.index);
      let nextPlayer = {
        ...player,
        hand,
        rush: [...player.rush, handFound.card],
      };
      nextPlayer = withTurnModifiers(nextPlayer, { shironLightUsed: true });

      return ok(
        { ...state, ...updatePlayer(state, playerId, nextPlayer) },
        buildLogEntry(playerId, "shiron_light", "RS-013", state.definitions, definition!.name),
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
        if (mustDrawBeforeStartEnd(state, playerId)) {
          return fail("must_draw_first");
        }
        if (mustResolveEarthForceUpkeepBeforeStartEnd(state, playerId)) {
          if (canPayEarthForceUpkeep(state, playerId)) {
            return fail("earth_force_upkeep_required");
          }
        }
        let nextState = state;
        if (mustResolveEarthForceUpkeepBeforeStartEnd(state, playerId)) {
          const discarded = discardEarthForceForUnpaidUpkeep(nextState, playerId);
          nextState = discarded.state;
        }
        nextState = applyStartPhaseReset(nextState, playerId);
        const resetPlayer = {
          ...nextState.players[playerId],
          hasChargedThisTurn: false,
          hasDrawnThisStart: false,
          hasPaidEarthForceUpkeep: false,
        };
        nextState = {
          ...nextState,
          ...updatePlayer(nextState, playerId, resetPlayer),
          phase: "charge",
        };
        const logEntries = [
          ...(mustResolveEarthForceUpkeepBeforeStartEnd(state, playerId) &&
          !canPayEarthForceUpkeep(state, playerId)
            ? [
                buildLogEntry(
                  playerId,
                  "earth_force_upkeep",
                  "RS-022",
                  state.definitions,
                  "failed",
                ),
              ]
            : []),
          buildSimpleLogEntry(playerId, "end_phase", state.phase),
        ];
        return {
          ok: true,
          state: {
            ...nextState,
            log: [...nextState.log, ...logEntries],
            winner: checkWinner(nextState),
          },
        };
      }

      if (state.phase === "end") {
        let nextState = finalizeTurnEnd(state);
        return ok(nextState, buildSimpleLogEntry(playerId, "end_turn"));
      }

      const nextState: GameState = { ...advancePhase(state) };

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
