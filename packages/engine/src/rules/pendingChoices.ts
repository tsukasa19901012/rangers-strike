import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../types/game";
import { cardName, effectiveBp, getDefinition, unitBp } from "../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../core/helpers";
import { buildLogEntry } from "../log/formatLog";
import { findCardOwner } from "./fieldLookup";
import { tryLeaveField } from "./operationCounters";
import { promoteDeferredBattleEntry } from "./battleEntry";
import { canMoveUnitToBattle, releaseHeldCommands, requiredBattleEntryHolds } from "./restrictions";
import {
  grantSp1ToBattleUnit,
} from "./namedUnitEffects";

export type ChoiceOutcome =
  | { state: GameState; log?: string; logs?: string[] }
  | { error: string };

function collectFieldUnitIds(
  state: GameState,
  playerId: PlayerId,
  maxBp: number,
  zones: Array<"rush" | "battle"> = ["rush", "battle"],
): string[] {
  const player = state.players[playerId];
  const ids: string[] = [];
  for (const zone of zones) {
    for (const card of player[zone]) {
      if (effectiveBp(state, playerId, card) <= maxBp) {
        ids.push(card.instanceId);
      }
    }
  }
  return ids;
}

function collectAnyFieldUnitIds(state: GameState, maxBp: number): string[] {
  const ids: string[] = [];
  for (const pid of ["player1", "player2"] as const) {
    ids.push(...collectFieldUnitIds(state, pid, maxBp));
  }
  return ids;
}

function collectCommandIds(
  state: GameState,
  playerId: PlayerId,
  filter: "held" | "released" | "any",
): string[] {
  return state.players[playerId].command
    .filter((c) => {
      if (filter === "held") return !!c.commandHeld;
      if (filter === "released") return !c.commandHeld;
      return true;
    })
    .map((c) => c.instanceId);
}

function collectPowerIds(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].power.filter((c) => !c.faceDown).map((c) => c.instanceId);
}

function collectHandIdsByName(
  state: GameState,
  playerId: PlayerId,
  name: string,
): string[] {
  return state.players[playerId].hand
    .filter((c) => cardName(state.definitions, c.cardId) === name)
    .map((c) => c.instanceId);
}

function collectHandIdsByCardId(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): string[] {
  return state.players[playerId].hand
    .filter((c) => c.cardId === cardId)
    .map((c) => c.instanceId);
}

function collectEnemyRushSmallIds(state: GameState, playerId: PlayerId): string[] {
  const enemyId = opponent(playerId);
  return state.players[enemyId].rush
    .filter((c) => getDefinition(state.definitions, c.cardId)?.size === "S")
    .map((c) => c.instanceId);
}

export function openEffectChoice(
  state: GameState,
  choice: PendingEffectChoice,
): GameState {
  return {
    ...state,
    pendingEffectChoice: {
      ...choice,
      selectedInstanceIds: choice.selectedInstanceIds ?? [],
    },
    activePlayer: choice.playerId,
  };
}

export function startRuinSurveyChoice(
  state: GameState,
  playerId: PlayerId,
  sourceCardId: string,
): GameState | null {
  const top = state.players[playerId].deck[0];
  if (!top) return null;
  return openEffectChoice(state, {
    playerId,
    effectId: "ruin_survey",
    sourceCardId,
    kind: "deck_top_or_bottom",
    phasePlayerId: playerId,
    validInstanceIds: [top.instanceId],
    viewedInstanceIds: [top.instanceId],
  });
}

export function startSelectUnitChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
    validInstanceIds: string[];
    unitDestination: PendingEffectChoice["unitDestination"];
    optional?: boolean;
  },
): GameState | null {
  if (params.validInstanceIds.length === 0) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "select_unit",
    selectCount: 1,
  });
}

export function startTyrannoSonicChoice(
  state: GameState,
  rusherId: PlayerId,
  sourceCardId: string,
  phasePlayerId: PlayerId,
): GameState | null {
  const ownTargets = collectFieldUnitIds(state, rusherId, 5000);
  if (ownTargets.length === 0) return null;
  return openEffectChoice(state, {
    playerId: rusherId,
    effectId: "tyranno_sonic",
    sourceCardId,
    kind: "select_unit_step",
    step: "own",
    phasePlayerId,
    validInstanceIds: ownTargets,
    maxBp: 5000,
    unitDestination: "discard",
    optional: true,
  });
}

export function startMultiCommandChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    phasePlayerId: PlayerId;
    selectCount: number;
    commandFilter: "held" | "released";
    commandAction: PendingEffectChoice["commandAction"];
    optional?: boolean;
  },
): GameState | null {
  const valid = collectCommandIds(state, params.playerId, params.commandFilter);
  if (valid.length === 0 && !params.optional) return null;
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "select_commands",
    validInstanceIds: valid,
    selectCount: Math.min(params.selectCount, valid.length),
  });
}

export function startSelectCommandChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    phasePlayerId: PlayerId;
    commandFilter: "held" | "released" | "any";
    commandAction: PendingEffectChoice["commandAction"];
    optional?: boolean;
    validInstanceIds?: string[];
    sourceInstanceId?: string;
  },
): GameState | null {
  const valid =
    params.validInstanceIds ??
    collectCommandIds(state, params.playerId, params.commandFilter);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    playerId: params.playerId,
    effectId: params.effectId,
    sourceCardId: params.sourceCardId,
    sourceInstanceId: params.sourceInstanceId,
    kind: "select_command",
    phasePlayerId: params.phasePlayerId,
    validInstanceIds: valid,
    selectCount: 1,
    commandAction: params.commandAction,
    commandFilter: params.commandFilter,
    optional: params.optional,
  });
}

export function startSelectPowerChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId: string;
    phasePlayerId: PlayerId;
    selectCount: number;
    optional?: boolean;
  },
): GameState | null {
  const valid = collectPowerIds(state, params.playerId);
  if (valid.length < params.selectCount) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "select_power",
    validInstanceIds: valid,
    selectCount: params.selectCount,
    optional: params.optional ?? true,
  });
}

export function startSelectHandChoice(
  state: GameState,
  params: {
    playerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId: string;
    phasePlayerId: PlayerId;
    cardId?: string;
    cardName?: string;
    optional?: boolean;
  },
): GameState | null {
  const valid = params.cardId
    ? collectHandIdsByCardId(state, params.playerId, params.cardId)
    : params.cardName
      ? collectHandIdsByName(state, params.playerId, params.cardName)
      : [];
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    playerId: params.playerId,
    effectId: params.effectId,
    sourceCardId: params.sourceCardId,
    sourceInstanceId: params.sourceInstanceId,
    kind: "select_hand",
    phasePlayerId: params.phasePlayerId,
    validInstanceIds: valid,
    selectCount: 1,
    optional: params.optional ?? true,
  });
}

export function startRadialHammerChoice(
  state: GameState,
  playerId: PlayerId,
  sourceCardId: string,
  sourceInstanceId: string,
): GameState | null {
  const player = state.players[playerId];
  if (player.deck.length === 0) return null;
  const count = Math.min(3, player.deck.length);
  const viewed = player.deck.slice(0, count).map((c) => c.instanceId);
  return openEffectChoice(state, {
    playerId,
    effectId: "radial_hammer",
    sourceCardId,
    sourceInstanceId,
    kind: "scry_keep_one",
    phasePlayerId: playerId,
    validInstanceIds: viewed,
    viewedInstanceIds: viewed,
    selectCount: 1,
  });
}

export function startPitInDiveOrderChoice(
  state: GameState,
  playerId: PlayerId,
  sourceCardId: string,
  sourceInstanceId: string,
): GameState | null {
  const valid = collectEnemyRushSmallIds(state, playerId);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    playerId,
    effectId: "pit_in_dive",
    sourceCardId,
    sourceInstanceId,
    kind: "pit_in_dive_order",
    phasePlayerId: playerId,
    validInstanceIds: valid,
    selectCount: valid.length,
  });
}

function clearChoice(state: GameState, phasePlayerId: PlayerId): GameState {
  return {
    ...state,
    pendingEffectChoice: undefined,
    activePlayer: phasePlayerId,
  };
}

function applyUnitLeave(
  state: GameState,
  instanceId: string,
  destination: "power" | "discard" | "deck_top",
  phasePlayerId: PlayerId,
): ChoiceOutcome {
  const located = findCardOwner(state, instanceId);
  if (!located || (located.zone !== "rush" && located.zone !== "battle")) {
    return { error: "invalid_target" };
  }

  if (destination === "deck_top") {
    const owner = state.players[located.playerId];
    const found = findInZone(owner, located.zone, instanceId);
    if (!found) return { error: "invalid_target" };
    const [, zoneCards] = removeAt(owner[located.zone], found.index);
    const nextOwner = {
      ...owner,
      [located.zone]: zoneCards,
      deck: [found.card, ...owner.deck],
    };
    return {
      state: { ...state, ...updatePlayer(state, located.playerId, nextOwner) },
    };
  }

  const owner = state.players[located.playerId];
  const found = findInZone(owner, located.zone, instanceId);
  if (!found) return { error: "invalid_target" };

  const toZone = destination === "power" ? "power" : "discard";
  const leaveResult = tryLeaveField(state, {
    ownerPlayerId: located.playerId,
    instanceId,
    fromZone: located.zone,
    toZone,
    leavingCardId: found.card.cardId,
    phasePlayerId,
  });

  if (leaveResult.deferred) {
    return { state: leaveResult.state };
  }
  return { state: leaveResult.state };
}

function findFieldUnitCardId(state: GameState, instanceId: string): string {
  const located = findCardOwner(state, instanceId);
  if (!located) return instanceId;
  const found = findInZone(state.players[located.playerId], located.zone, instanceId);
  return found?.card.cardId ?? instanceId;
}

function findCommandCard(
  state: GameState,
  instanceId: string,
): { playerId: PlayerId; index: number; card: CardInstance } | null {
  for (const pid of ["player1", "player2"] as const) {
    const found = findInZone(state.players[pid], "command", instanceId);
    if (found) {
      return { playerId: pid, index: found.index, card: found.card };
    }
  }
  return null;
}

function finishChoice(
  state: GameState,
  pending: PendingEffectChoice,
  detail: string,
): ChoiceOutcome {
  const log = buildLogEntry(
    pending.playerId,
    "resolve_effect_choice",
    pending.sourceCardId,
    state.definitions,
    `${pending.effectId}:${detail}`,
  );
  return {
    state: promoteDeferredBattleEntry(clearChoice(state, pending.phasePlayerId)),
    log,
  };
}

export function skipEffectChoice(state: GameState, playerId: PlayerId): ChoiceOutcome {
  const pending = state.pendingEffectChoice;
  if (!pending) return { error: "no_pending_choice" };
  if (pending.playerId !== playerId) return { error: "wrong_player" };
  if (!pending.optional) return { error: "cannot_skip" };
  return finishChoice(state, pending, "skipped");
}

export function applyEffectChoicePlacement(
  state: GameState,
  playerId: PlayerId,
  placement: "top" | "bottom",
): ChoiceOutcome {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.kind !== "deck_top_or_bottom") {
    return { error: "no_pending_choice" };
  }
  if (pending.playerId !== playerId) return { error: "wrong_player" };

  const player = state.players[playerId];
  const top = player.deck[0];
  if (!top || top.instanceId !== pending.viewedInstanceIds?.[0]) {
    return { error: "invalid_scry" };
  }

  let nextPlayer = player;
  if (placement === "bottom") {
    const [card, rest] = removeAt(player.deck, 0);
    nextPlayer = { ...player, deck: [...rest, card] };
  }

  return finishChoice(
    { ...state, ...updatePlayer(state, playerId, nextPlayer) },
    pending,
    placement,
  );
}

export function applyEffectChoiceSelect(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): ChoiceOutcome {
  const pending = state.pendingEffectChoice;
  if (!pending) return { error: "no_pending_choice" };
  if (pending.playerId !== playerId) return { error: "wrong_player" };
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };

  switch (pending.kind) {
    case "select_unit": {
      const dest = pending.unitDestination ?? "discard";
      if (dest === "hand" || dest === "hand_from_discard" || dest === "hand_from_power") {
        const located = findCardOwner(state, instanceId);
        if (!located) return { error: "invalid_target" };
        const owner = state.players[located.playerId];
        const fromZone =
          dest === "hand_from_discard"
            ? "discard"
            : dest === "hand_from_power"
              ? "power"
              : located.zone;
        if (fromZone !== "discard" && fromZone !== "power" && fromZone !== "rush" && fromZone !== "battle") {
          return { error: "invalid_target" };
        }
        const found = findInZone(owner, fromZone, instanceId);
        if (!found) return { error: "invalid_target" };
        const [, zoneCards] = removeAt(owner[fromZone], found.index);
        let nextOwner = {
          ...owner,
          [fromZone]: zoneCards,
          hand: [...owner.hand, found.card],
        };
        if (pending.effectId === "ghost_absorption" && pending.sourceInstanceId) {
          const returnedBp = unitBp(getDefinition(state.definitions, found.card.cardId));
          const battle = nextOwner.battle.map((c) =>
            c.instanceId === pending.sourceInstanceId
              ? {
                  ...c,
                  spModifier: (c.spModifier ?? 0) + 1,
                  bpModifier: returnedBp,
                }
              : c,
          );
          nextOwner = { ...nextOwner, battle };
        }
        return finishChoice(
          { ...state, ...updatePlayer(state, located.playerId, nextOwner) },
          pending,
          cardName(state.definitions, found.card.cardId),
        );
      }
      if (dest === "enemy_battle") {
        const located = findCardOwner(state, instanceId);
        if (!located || located.zone !== "rush") return { error: "invalid_target" };
        const owner = state.players[located.playerId];
        const found = findInZone(owner, "rush", instanceId);
        if (!found) return { error: "invalid_target" };
        if (!canMoveUnitToBattle(state, located.playerId, found.card, "rush")) {
          return { error: "cannot_enter_battle" };
        }
        const [, rush] = removeAt(owner.rush, found.index);
        let nextOwner = {
          ...owner,
          rush,
          battle: [...owner.battle, found.card],
        };
        nextOwner = releaseHeldCommands(
          nextOwner,
          requiredBattleEntryHolds(state, found.card),
        );
        return finishChoice(
          { ...state, ...updatePlayer(state, located.playerId, nextOwner) },
          pending,
          cardName(state.definitions, found.card.cardId),
        );
      }
      if (dest === "swap_battle" && pending.sourceInstanceId) {
        const player = state.players[pending.playerId];
        const swapTarget = findInZone(player, "battle", instanceId);
        const entering = findInZone(player, "rush", pending.sourceInstanceId);
        if (!swapTarget || !entering) return { error: "invalid_target" };
        if (!canMoveUnitToBattle(state, pending.playerId, entering.card, "rush")) {
          return { error: "cannot_enter_battle" };
        }
        let battle = player.battle.filter((c) => c.instanceId !== instanceId);
        battle = [...battle, { ...entering.card, battleActed: true }];
        const rush = player.rush.filter((c) => c.instanceId !== pending.sourceInstanceId);
        let nextPlayer = {
          ...player,
          battle,
          rush: [...rush, swapTarget.card],
        };
        nextPlayer = releaseHeldCommands(
          nextPlayer,
          requiredBattleEntryHolds(state, entering.card),
        );
        return finishChoice(
          { ...state, ...updatePlayer(state, pending.playerId, nextPlayer) },
          pending,
          cardName(state.definitions, swapTarget.card.cardId),
        );
      }
      const leave = applyUnitLeave(state, instanceId, dest === "power" ? "power" : dest === "deck_top" ? "deck_top" : "discard", pending.phasePlayerId);
      if ("error" in leave) return leave;
      return finishChoice(
        leave.state,
        pending,
        cardName(state.definitions, findFieldUnitCardId(leave.state, instanceId)),
      );
    }

    case "select_unit_step": {
      if (pending.effectId === "tyranno_sonic") {
        const leave = applyUnitLeave(state, instanceId, "discard", pending.phasePlayerId);
        if ("error" in leave) return leave;
        let nextState = leave.state;

        if (pending.step === "own") {
          const enemyId = opponent(pending.playerId);
          const enemyTargets = collectFieldUnitIds(nextState, enemyId, pending.maxBp ?? 5000);
          if (enemyTargets.length === 0) {
            return finishChoice(nextState, pending, "own_only");
          }
          return {
            state: openEffectChoice(clearChoice(nextState, pending.playerId), {
              ...pending,
              step: "enemy",
              validInstanceIds: enemyTargets,
            }),
          };
        }

        return finishChoice(
          nextState,
          pending,
          cardName(state.definitions, findFieldUnitCardId(nextState, instanceId)),
        );
      }
      return { error: "invalid_step" };
    }

    case "select_command": {
      if (pending.effectId === "dark_dual_blade") {
        const enemyId = opponent(pending.playerId);
        const enemy = state.players[enemyId];
        const powerFound = findInZone(enemy, "power", instanceId);
        if (powerFound) {
          const [, power] = removeAt(enemy.power, powerFound.index);
          let nextState = {
            ...state,
            ...updatePlayer(state, enemyId, {
              ...enemy,
              power,
              discard: [...enemy.discard, powerFound.card],
            }),
          };
          const commandTargets = collectCommandIds(nextState, enemyId, "any");
          if (commandTargets.length === 0) {
            return finishChoice(nextState, pending, cardName(state.definitions, powerFound.card.cardId));
          }
          return {
            state: openEffectChoice(clearChoice(nextState, pending.playerId), {
              ...pending,
              effectId: "dark_dual_blade_command",
              playerId: pending.playerId,
              validInstanceIds: commandTargets,
              commandAction: "discard",
            }),
          };
        }
      }
      if (pending.effectId === "dark_dual_blade_command") {
        const enemyId = opponent(pending.playerId);
        const enemy = state.players[enemyId];
        const found = findInZone(enemy, "command", instanceId);
        if (!found) return { error: "invalid_target" };
        const [, command] = removeAt(enemy.command, found.index);
        const nextEnemy = {
          ...enemy,
          command,
          discard: [...enemy.discard, found.card],
        };
        return finishChoice(
          { ...state, ...updatePlayer(state, enemyId, nextEnemy) },
          pending,
          cardName(state.definitions, found.card.cardId),
        );
      }

      const located = findCommandCard(state, instanceId);
      if (!located) {
        for (const playerId of ["player1", "player2"] as const) {
          const owner = state.players[playerId];
          const found = findInZone(owner, "power", instanceId);
          if (!found) continue;
          const [, power] = removeAt(owner.power, found.index);
          const nextOwner = {
            ...owner,
            power,
            discard: [...owner.discard, found.card],
          };
          return finishChoice(
            { ...state, ...updatePlayer(state, playerId, nextOwner) },
            pending,
            cardName(state.definitions, found.card.cardId),
          );
        }
        return { error: "invalid_target" };
      }
      const owner = located.playerId;
      const player = state.players[owner];
      const found = findInZone(player, "command", instanceId);
      if (!found) return { error: "invalid_target" };

      let nextPlayer = player;
      if (pending.commandAction === "discard") {
        const [, command] = removeAt(player.command, found.index);
        nextPlayer = {
          ...player,
          command,
          discard: [...player.discard, found.card],
        };
      } else if (pending.commandAction === "hold") {
        const command = [...player.command];
        command[found.index] = { ...found.card, commandHeld: true };
        nextPlayer = { ...player, command };
      } else if (pending.commandAction === "return_hand") {
        const [, command] = removeAt(player.command, found.index);
        nextPlayer = {
          ...player,
          command,
          hand: [...player.hand, found.card],
        };
      } else if (pending.commandAction === "rush" || pending.commandAction === "rush_silent") {
        const [, command] = removeAt(player.command, found.index);
        nextPlayer = {
          ...player,
          command,
          rush: [...player.rush, found.card],
        };
      }

      let nextState = { ...state, ...updatePlayer(state, owner, nextPlayer) };
      if (pending.effectId === "shift_up" && pending.sourceInstanceId) {
        const actor = nextState.players[pending.playerId];
        nextState = {
          ...nextState,
          ...updatePlayer(nextState, pending.playerId, {
            ...actor,
            battle: actor.battle.map((c) =>
              c.instanceId === pending.sourceInstanceId
                ? { ...c, spModifier: (c.spModifier ?? 0) + 1 }
                : c,
            ),
          }),
        };
      }

      return finishChoice(
        nextState,
        pending,
        cardName(state.definitions, found.card.cardId),
      );
    }

    case "select_commands": {
      const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
      const selectCount = pending.selectCount ?? 1;
      if (selected.length < selectCount) {
        const remaining = pending.validInstanceIds.filter((id) => !selected.includes(id));
        return {
          state: {
            ...state,
            pendingEffectChoice: {
              ...pending,
              selectedInstanceIds: selected,
              validInstanceIds: remaining,
            },
          },
        };
      }

      let nextState = state;
      for (const cmdId of selected) {
        const player = nextState.players[pending.playerId];
        const found = findInZone(player, "command", cmdId);
        if (!found) continue;
        const command = [...player.command];
        command[found.index] = { ...found.card, commandHeld: true };
        nextState = {
          ...nextState,
          ...updatePlayer(nextState, pending.playerId, { ...player, command }),
        };
      }
      return finishChoice(nextState, pending, selected.join(","));
    }

    case "select_power": {
      const prev = pending.selectedInstanceIds ?? [];
      if (prev.includes(instanceId)) return { error: "already_selected" };
      const selected = [...prev, instanceId];
      const selectCount = pending.selectCount ?? 1;
      if (selected.length < selectCount) {
        const remaining = pending.validInstanceIds.filter((id) => !selected.includes(id));
        return {
          state: {
            ...state,
            pendingEffectChoice: {
              ...pending,
              selectedInstanceIds: selected,
              validInstanceIds: remaining,
            },
          },
        };
      }

      const player = state.players[pending.playerId];
      const discardIds = new Set(selected);
      const toDiscard = player.power.filter((c) => discardIds.has(c.instanceId));
      let nextPlayer = {
        ...player,
        power: player.power.filter((c) => !discardIds.has(c.instanceId)),
        discard: [...player.discard, ...toDiscard],
      };

      if (pending.effectId === "earth_force") {
        nextPlayer = { ...nextPlayer, hasPaidEarthForceUpkeep: true };
      }

      if (pending.sourceInstanceId) {
        const needsFullPayment =
          pending.effectId === "judgment_sword" || pending.effectId === "justice_flasher";
        const paidEnough = !needsFullPayment || toDiscard.length >= selectCount;
        const spGain = paidEnough
          ? pending.effectId === "justice_flasher"
            ? 3
            : pending.effectId === "judgment_sword"
              ? 1
              : 0
          : 0;
        if (spGain > 0) {
          nextPlayer = {
            ...nextPlayer,
            battle: nextPlayer.battle.map((c) =>
              c.instanceId === pending.sourceInstanceId
                ? { ...c, spModifier: (c.spModifier ?? 0) + spGain }
                : c,
            ),
          };
        }
      }

      return finishChoice(
        { ...state, ...updatePlayer(state, pending.playerId, nextPlayer) },
        pending,
        String(selected.length),
      );
    }

    case "select_hand": {
      const player = state.players[pending.playerId];
      const found = findInZone(player, "hand", instanceId);
      if (!found) return { error: "invalid_target" };
      const [, hand] = removeAt(player.hand, found.index);
      let nextPlayer = {
        ...player,
        hand,
        discard: [...player.discard, found.card],
      };
      if (pending.sourceInstanceId) {
        nextPlayer = {
          ...nextPlayer,
          battle: nextPlayer.battle.map((c) =>
            c.instanceId === pending.sourceInstanceId
              ? { ...c, spModifier: (c.spModifier ?? 0) + 1 }
              : c,
          ),
        };
      }
      return finishChoice(
        { ...state, ...updatePlayer(state, pending.playerId, nextPlayer) },
        pending,
        cardName(state.definitions, found.card.cardId),
      );
    }

    case "scry_keep_one": {
      const player = state.players[pending.playerId];
      const viewed = (pending.viewedInstanceIds ?? [])
        .map((id) => player.deck.find((c) => c.instanceId === id))
        .filter((c): c is CardInstance => !!c);
      const kept = viewed.find((c) => c.instanceId === instanceId);
      if (!kept) return { error: "invalid_target" };
      const rest = viewed.filter((c) => c.instanceId !== instanceId);
      const deckTail = player.deck.slice(viewed.length);
      const nextPlayer = {
        ...player,
        deck: [kept, ...deckTail],
        discard: [...player.discard, ...rest],
      };
      let nextState = { ...state, ...updatePlayer(state, pending.playerId, nextPlayer) };
      if (pending.sourceInstanceId) {
        nextState = grantSp1ToBattleUnit(nextState, pending.playerId, pending.sourceInstanceId);
      }
      return finishChoice(nextState, pending, cardName(state.definitions, kept.cardId));
    }

    case "pit_in_dive_order": {
      const actorId = pending.playerId;
      const enemyId = opponent(actorId);
      const enemy = state.players[enemyId];
      const found = findInZone(enemy, "rush", instanceId);
      if (!found) return { error: "invalid_target" };

      if (!canMoveUnitToBattle(state, enemyId, found.card, "rush")) {
        return { error: "cannot_enter_battle" };
      }

      const [, rush] = removeAt(enemy.rush, found.index);
      let nextEnemy = {
        ...enemy,
        rush,
        battle: [...enemy.battle, found.card],
      };
      nextEnemy = releaseHeldCommands(
        nextEnemy,
        requiredBattleEntryHolds(state, found.card),
      );
      let nextState = { ...state, ...updatePlayer(state, enemyId, nextEnemy) };

      const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
      const remaining = pending.validInstanceIds.filter((id) => !selected.includes(id));
      if (remaining.length > 0) {
        return {
          state: {
            ...nextState,
            pendingEffectChoice: {
              ...pending,
              selectedInstanceIds: selected,
              validInstanceIds: remaining,
            },
            activePlayer: pending.playerId,
          },
        };
      }

      return finishChoice(nextState, pending, String(selected.length));
    }

    default:
      return { error: "invalid_choice_kind" };
  }
}

export function getValidTargetsForChoice(state: GameState): string[] {
  return state.pendingEffectChoice?.validInstanceIds ?? [];
}

export {
  collectFieldUnitIds,
  collectAnyFieldUnitIds,
  collectCommandIds,
  collectPowerIds,
  collectEnemyRushSmallIds,
};
