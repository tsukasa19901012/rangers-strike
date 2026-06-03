import type { Category } from "@rangers-strike/cards";
import { getBattleEntryHoldCount } from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import type { InitiateCommandPaymentAction } from "../types/actions";
import type { CommandPaymentContinuation, PendingCommandPayment } from "../types/game";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import {
  canPlayOperationExceptCommandHold,
  canRushUnitExceptCommandHold,
  cardCategories,
  getDefinition,
  hasOperationEffect,
  isUnit,
} from "../core/catalog";
import { findInZone } from "../core/helpers";
import {
  canMoveUnitToBattle,
  canMoveUnitToBattleExceptHoldRequirements,
  countBattleEntryEligibleHolds,
  countHeldCommands,
  hasCommandForCardUse,
  requiredBattleEntryHolds,
} from "./restrictions";

export type CommandPaymentView = {
  kind: PendingCommandPayment["kind"];
  sourceCardId: string;
  sourceCardName: string;
  selectCount: number;
  eligibleSelectMin: number;
  categories: Category[];
  prismSubstitute: boolean;
  prismAvailable: boolean;
  validInstanceIds: string[];
  consumeOnConfirm?: boolean;
};

function cardDisplayName(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): string {
  return getDefinition(definitions, cardId)?.name ?? cardId;
}

function holdCommand(player: PlayerState, instanceId: string): PlayerState {
  const command = player.command.map((c) =>
    c.instanceId === instanceId
      ? { ...c, commandHeld: true, mothershipHold: false }
      : c,
  );
  return { ...player, command };
}

export function getBattleEntryPaymentNeeds(
  state: GameState,
  playerId: PlayerId,
  unit: CardInstance,
): { eligibleNeeded: number; totalNeeded: number } | null {
  if (!canMoveUnitToBattleExceptHoldRequirements(state, playerId, unit, "rush")) {
    return null;
  }
  if (canMoveUnitToBattle(state, playerId, unit, "rush")) return null;

  const player = state.players[playerId];
  const unitHold = getBattleEntryHoldCount(unit.cardId);
  const requiredTotal = requiredBattleEntryHolds(state, unit);
  const eligibleNeeded = Math.max(0, unitHold - countBattleEntryEligibleHolds(player));
  const totalNeeded = Math.max(
    Math.max(0, requiredTotal - countHeldCommands(player)),
    eligibleNeeded,
  );
  if (totalNeeded <= 0) return null;

  const unheld = player.command.filter((c) => !c.commandHeld).length;
  if (unheld < totalNeeded) return null;

  return { eligibleNeeded, totalNeeded };
}

function unheldCommandsMatchingCategory(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  categories: Category[],
): CardInstance[] {
  return player.command.filter((cmd) => {
    if (cmd.commandHeld) return false;
    const cmdCats = cardCategories(getDefinition(definitions, cmd.cardId));
    return categories.some((cat) => cmdCats.includes(cat));
  });
}

export type CategoryPaymentMode = "category" | "prism";

export function getCategoryPaymentOptions(
  state: GameState,
  playerId: PlayerId,
  categories: Category[],
): { selectCount: number; prismAvailable: boolean; prismSubstitute: boolean } | null {
  if (hasCommandForCardUse(state.players[playerId], state.definitions, categories)) {
    return null;
  }

  const player = state.players[playerId];
  const prismAvailable =
    hasOperationEffect(player, "prism_power", state.definitions) &&
    player.command.filter((c) => !c.commandHeld).length >= 2;

  const matching = unheldCommandsMatchingCategory(player, state.definitions, categories);
  if (matching.length >= 1) {
    return { selectCount: 1, prismAvailable, prismSubstitute: false };
  }

  if (prismAvailable) {
    return { selectCount: 2, prismAvailable: true, prismSubstitute: true };
  }

  return null;
}

export function buildBattleEntryPayment(
  state: GameState,
  playerId: PlayerId,
  unit: CardInstance,
  rideOff?: boolean,
): PendingCommandPayment | null {
  const needs = getBattleEntryPaymentNeeds(state, playerId, unit);
  if (!needs) return null;

  const player = state.players[playerId];
  const validInstanceIds = player.command
    .filter((c) => !c.commandHeld)
    .map((c) => c.instanceId);

  return {
    playerId,
    kind: "battle_entry",
    sourceInstanceId: unit.instanceId,
    sourceCardId: unit.cardId,
    eligibleNeeded: needs.eligibleNeeded,
    totalNeeded: needs.totalNeeded,
    validInstanceIds,
    continuation: { type: "move_to_battle", rideOff },
  };
}

export function buildCategoryPayment(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  sourceCardId: string,
  categories: Category[],
  continuation: CommandPaymentContinuation,
  prismSubstitute: boolean,
): PendingCommandPayment | null {
  const options = getCategoryPaymentOptions(state, playerId, categories);
  if (!options) return null;

  const usePrism = prismSubstitute && options.prismAvailable;
  const selectCount = usePrism ? 2 : options.selectCount;
  const player = state.players[playerId];
  const validInstanceIds = usePrism
    ? player.command.filter((c) => !c.commandHeld).map((c) => c.instanceId)
    : unheldCommandsMatchingCategory(player, state.definitions, categories).map(
        (c) => c.instanceId,
      );

  if (validInstanceIds.length < selectCount) return null;

  return {
    playerId,
    kind: "category_use",
    sourceInstanceId,
    sourceCardId,
    categories,
    prismSubstitute: usePrism,
    eligibleNeeded: 0,
    totalNeeded: selectCount,
    validInstanceIds,
    continuation,
  };
}

export function getCommandPaymentView(
  state: GameState,
  pending: PendingCommandPayment,
): CommandPaymentView {
  const definitions = state.definitions;
  const unitHold =
    pending.kind === "battle_entry"
      ? getBattleEntryHoldCount(pending.sourceCardId)
      : 0;

  return {
    kind: pending.kind,
    sourceCardId: pending.sourceCardId,
    sourceCardName: cardDisplayName(definitions, pending.sourceCardId),
    selectCount: pending.totalNeeded,
    eligibleSelectMin: pending.eligibleNeeded,
    categories: pending.categories ?? [],
    prismSubstitute: pending.prismSubstitute ?? false,
    prismAvailable:
      pending.kind === "category_use" &&
      getCategoryPaymentOptions(state, pending.playerId, pending.categories ?? [])
        ?.prismAvailable === true,
    validInstanceIds: pending.validInstanceIds,
    consumeOnConfirm: pending.kind === "battle_entry",
  };
}

export function validatePaymentSelection(
  pending: PendingCommandPayment,
  commandInstanceIds: string[],
): string | null {
  const unique = new Set(commandInstanceIds);
  if (unique.size !== commandInstanceIds.length) return "duplicate_selection";
  if (commandInstanceIds.length !== pending.totalNeeded) return "wrong_count";

  for (const id of commandInstanceIds) {
    if (!pending.validInstanceIds.includes(id)) return "invalid_command";
  }

  if (pending.kind === "battle_entry" && pending.eligibleNeeded > 0) {
    if (commandInstanceIds.length < pending.eligibleNeeded) {
      return "insufficient_eligible";
    }
  }

  return null;
}

export function applyPaymentHolds(
  state: GameState,
  playerId: PlayerId,
  commandInstanceIds: string[],
): GameState {
  let player = state.players[playerId];
  for (const instanceId of commandInstanceIds) {
    player = holdCommand(player, instanceId);
  }
  return { ...state, players: { ...state.players, [playerId]: player } };
}

export function canAffordCategoryPaymentAfterHolds(
  state: GameState,
  playerId: PlayerId,
  categories: Category[],
  prismSubstitute: boolean,
): boolean {
  if (prismSubstitute) {
    return countHeldCommands(state.players[playerId]) >= 2;
  }
  return hasCommandForCardUse(state.players[playerId], state.definitions, categories);
}

export function buildPaymentFromInitiateAction(
  state: GameState,
  action: InitiateCommandPaymentAction,
): PendingCommandPayment | null {
  const playerId = action.playerId;
  const player = state.players[playerId];

  if (action.kind === "battle_entry") {
    if (state.phase !== "battle") return null;
    const found = findInZone(player, "rush", action.sourceInstanceId);
    if (!found) return null;
    return buildBattleEntryPayment(
      state,
      playerId,
      found.card,
      action.rideOff,
    );
  }

  if (action.kind !== "category_use") return null;

  const handFound = findInZone(player, "hand", action.sourceInstanceId);
  if (!handFound) return null;

  const def = getDefinition(state.definitions, handFound.card.cardId);
  if (!def) return null;

  const categories = cardCategories(def);
  if (isUnit(def)) {
    if (
      !canRushUnitExceptCommandHold(
        player,
        state.definitions,
        def,
        handFound.card.instanceId,
        action.zordMaterialInstanceId,
        action.zordMothershipHoldInstanceIds,
        action.zordMaterialDestination,
      )
    ) {
      return null;
    }
    const continuation: CommandPaymentContinuation = {
      type: "rush",
      zordMaterialInstanceId: action.zordMaterialInstanceId,
      zordMaterialDestination: action.zordMaterialDestination,
      zordMothershipHoldInstanceIds: action.zordMothershipHoldInstanceIds,
    };
    return buildCategoryPayment(
      state,
      playerId,
      handFound.card.instanceId,
      handFound.card.cardId,
      categories,
      continuation,
      action.prismSubstitute ?? false,
    );
  }

  if (def.type === "operation") {
    if (!canPlayOperationExceptCommandHold(player, state.definitions, def)) {
      return null;
    }
    const continuation: CommandPaymentContinuation = {
      type: "play_operation",
      targetInstanceId: action.targetInstanceId,
      extraInstanceId: action.extraInstanceId,
    };
    return buildCategoryPayment(
      state,
      playerId,
      handFound.card.instanceId,
      handFound.card.cardId,
      categories,
      continuation,
      action.prismSubstitute ?? false,
    );
  }

  return null;
}

export function isInitiateCommandPaymentLegal(
  state: GameState,
  action: InitiateCommandPaymentAction,
): boolean {
  if (state.pendingCommandPayment) return false;
  if (state.winner) return false;
  if (buildPaymentFromInitiateAction(state, action) === null) return false;

  if (action.kind === "category_use" && state.phase !== "rush") return false;
  if (action.kind === "battle_entry" && state.phase !== "battle") return false;

  return true;
}

export function isResolveCommandPaymentLegal(
  state: GameState,
  action: { playerId: PlayerId; commandInstanceIds: string[] },
): boolean {
  const pending = state.pendingCommandPayment;
  if (!pending || pending.playerId !== action.playerId) return false;
  if (validatePaymentSelection(pending, action.commandInstanceIds) !== null) {
    return false;
  }
  return true;
}
