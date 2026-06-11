import type { Category } from "@rangers-strike/cards";
import {
  getBattleEntryHoldCount,
  MOTHERSHIP_CONFIG,
  mothershipHoldsRequiredForRush,
  zordSlotsFilledByMaterial,
} from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import { getCardEffect } from "@rangers-strike/cards";
import {
  isValidOperationTarget,
  needsOperationTarget,
} from "../effects/resolveOperation";
import type { InitiateCommandPaymentAction, ZordMaterialDestination } from "../types/actions";
import { isCostWindowSatisfied, satisfyCostWindow } from "../core/costWindow";
import type {
  CommandPaymentContinuation,
  PendingCommandPayment,
  PendingEffectChoice,
  PendingZordSetup,
} from "../types/game";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { isShironLightRushTarget } from "./shironLight";
import {
  canPlayOperationExceptCommandHold,
  canRushUnit,
  canRushUnitExceptCommandHold,
  cardCategories,
  getDefinition,
  hasHeldCommandForCategories,
  hasOperationEffect,
  hasReleasedCommandForCategories,
  isRushable,
  isUnit,
  parsePowerCost,
} from "../core/catalog";
import { countAvailablePower, effectivePowerCost } from "../core/power";
import { findInZone } from "../core/helpers";
import {
  canMoveUnitToBattle,
  canMoveUnitToBattleExceptHoldRequirements,
  countBattleEntryEligibleHolds,
  countHeldCommands,
  countReleasedCommands,
  hasCommandForCardUse,
  requiredBattleEntryHolds,
} from "./restrictions";

/** 通常ラッシュ1回ごとに、リリース中コマンドからホールド支払いができるか。 */
export function canPayRushCategoryHold(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  categories: Category[],
): boolean {
  if (categories.length === 0) return true;
  if (hasReleasedCommandForCategories(player, definitions, categories)) return true;
  return (
    hasOperationEffect(player, "prism_power", definitions) &&
    countReleasedCommands(player) >= 2
  );
}
import {
  applyMothershipHolds,
  canUseMothershipForZordRush,
  collectMothershipEligibleCommands,
  validateMothershipHolds,
} from "./mothership";
import {
  hasAllRequiredFusionMaterials,
  needsZordMaterial,
  requiresAllFusionPartners,
} from "./zord";
import { canBeginZordSetup, hasLegalZordRush } from "./zordSetup";
import {
  canInitiateCounterCategoryPayment,
  isCounterReactionActive,
} from "./operationCounters";

function formatCategories(categories: Category[]): string {
  return categories.join("・");
}

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
  allowRushZoneCommands?: boolean;
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
  const requiredTotal = requiredBattleEntryHolds(state, playerId, unit);
  const held = countHeldCommands(player);
  const battleEligible = countBattleEntryEligibleHolds(player);

  const holdShortfall = Math.max(0, requiredTotal - held);
  const noteEligibleShortfall = Math.max(0, unitHold - battleEligible);
  const needsNoteConfirm = unitHold > 0 && !isCostWindowSatisfied(player, "battle_entry_hold");

  if (!needsNoteConfirm && holdShortfall <= 0) {
    return null;
  }

  const eligibleNeeded = needsNoteConfirm
    ? noteEligibleShortfall > 0
      ? noteEligibleShortfall
      : unitHold
    : 0;
  const totalNeeded = Math.max(holdShortfall, eligibleNeeded);
  if (totalNeeded <= 0) return null;

  const unheld = countReleasedCommands(player);
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

export function getCategoryPaymentOptions(
  state: GameState,
  playerId: PlayerId,
  categories: Category[],
  options?: { perRushPayment?: boolean },
): { selectCount: number; prismAvailable: boolean; prismSubstitute: boolean } | null {
  if (
    !options?.perRushPayment &&
    hasCommandForCardUse(state.players[playerId], state.definitions, categories)
  ) {
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
  options?: { perRushPayment?: boolean },
): PendingCommandPayment | null {
  const paymentOptions = getCategoryPaymentOptions(
    state,
    playerId,
    categories,
    options,
  );
  if (!paymentOptions) return null;

  const usePrism = prismSubstitute && paymentOptions.prismAvailable;
  const selectCount = usePrism ? 2 : paymentOptions.selectCount;
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
    consumeOnConfirm: pending.kind === "mothership_hold",
    allowRushZoneCommands: pending.kind === "mothership_hold",
  };
}

export function validatePaymentSelection(
  state: GameState,
  pending: PendingCommandPayment,
  commandInstanceIds: string[],
): string | null {
  const unique = new Set(commandInstanceIds);
  if (unique.size !== commandInstanceIds.length) return "duplicate_selection";
  if (commandInstanceIds.length !== pending.totalNeeded) return "wrong_count";

  for (const id of commandInstanceIds) {
    if (!pending.validInstanceIds.includes(id)) return "invalid_command";
  }

  if (pending.kind === "mothership_hold") {
    const player = state.players[pending.playerId];
    const kind = canUseMothershipForZordRush(
      state.definitions,
      player,
      pending.sourceCardId,
    );
    if (!kind) return "invalid_command";
    const cont = pending.continuation;
    const slotsFilled =
      cont.type === "rush" && cont.zordMaterialInstanceId
        ? zordSlotsFilledByMaterial(
            pending.sourceCardId,
            true,
            cont.zordMaterialDestination,
          )
        : 0;
    const holdsRequired = mothershipHoldsRequiredForRush(
      pending.sourceCardId,
      slotsFilled,
    );
    if (
      !validateMothershipHolds(
        player,
        state.definitions,
        pending.sourceCardId,
        kind,
        commandInstanceIds,
        holdsRequired,
      )
    ) {
      return "invalid_command";
    }
    return null;
  }

  if (pending.kind === "battle_entry" && pending.eligibleNeeded > 0) {
    if (commandInstanceIds.length < pending.eligibleNeeded) {
      return "insufficient_eligible";
    }
  }

  return null;
}

export function applyCommandPaymentResolve(
  state: GameState,
  playerId: PlayerId,
  pending: PendingCommandPayment,
  commandInstanceIds: string[],
): { state: GameState; nextPending?: PendingCommandPayment } | { error: string } {
  if (pending.kind === "mothership_hold") {
    const afterMothership = applyMothershipPaymentHolds(
      state,
      playerId,
      pending,
      commandInstanceIds,
    );
    if (!afterMothership) return { error: "invalid_command" };
    const followUp = continueAfterMothershipPayment(
      afterMothership,
      pending,
      commandInstanceIds,
    );
    if (followUp) {
      return { state: afterMothership, nextPending: followUp };
    }
    if (pending.continuation.type !== "rush") return { error: "invalid_payment" };
    return {
      state: {
        ...afterMothership,
        pendingCommandPayment: undefined,
        pendingZordSetup: undefined,
      },
    };
  }

  if (pending.kind === "effect_hold") {
    let nextState = applyPaymentHolds(state, playerId, commandInstanceIds);
    return { state: { ...nextState, pendingCommandPayment: undefined } };
  }

  let nextState = applyPaymentHolds(state, playerId, commandInstanceIds);
  const player = nextState.players[playerId];
  let playerPatch: typeof player = player;
  if (pending.kind === "battle_entry") {
    playerPatch = satisfyCostWindow(playerPatch, "battle_entry_hold");
  }
  if (pending.kind === "category_use" && pending.continuation.type === "rush") {
    playerPatch = satisfyCostWindow(playerPatch, "rush_category");
  }
  if (pending.kind === "category_use" && pending.continuation.type === "play_counter") {
    playerPatch = satisfyCostWindow(playerPatch, "counter_category");
  }
  if (playerPatch !== player) {
    nextState = {
      ...nextState,
      players: { ...nextState.players, [playerId]: playerPatch },
    };
  }
  return { state: { ...nextState, pendingCommandPayment: undefined } };
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

export function needsEffectHoldPayment(pending: PendingEffectChoice): boolean {
  return (
    pending.commandAction === "hold" &&
    (pending.kind === "select_command" || pending.kind === "select_commands")
  );
}

export function buildEffectHoldPayment(state: GameState): PendingCommandPayment | null {
  const pending = state.pendingEffectChoice;
  if (!pending || !needsEffectHoldPayment(pending)) return null;

  const selectCount = pending.selectCount ?? 1;
  const validInstanceIds = pending.validInstanceIds;
  if (validInstanceIds.length < selectCount) return null;

  return {
    playerId: pending.playerId,
    kind: "effect_hold",
    sourceInstanceId: pending.sourceInstanceId ?? validInstanceIds[0]!,
    sourceCardId: pending.sourceCardId,
    eligibleNeeded: 0,
    totalNeeded: selectCount,
    validInstanceIds,
    continuation: { type: "effect_choice" },
  };
}

export function buildMothershipHoldPayment(
  state: GameState,
  playerId: PlayerId,
  setup: Pick<PendingZordSetup, "zordInstanceId" | "zordCardId">,
  materialInstanceId?: string,
  materialDestination?: ZordMaterialDestination,
): PendingCommandPayment | null {
  const player = state.players[playerId];
  const kind = canUseMothershipForZordRush(state.definitions, player, setup.zordCardId);
  if (!kind) return null;

  const slotsFilled = materialInstanceId
    ? zordSlotsFilledByMaterial(setup.zordCardId, true, materialDestination)
    : 0;
  const holdsRequired = mothershipHoldsRequiredForRush(setup.zordCardId, slotsFilled);
  if (holdsRequired <= 0) return null;

  const category = MOTHERSHIP_CONFIG[kind].commandCategory;
  const validInstanceIds = collectMothershipEligibleCommands(
    player,
    state.definitions,
    category,
  ).map((e) => e.card.instanceId);
  if (validInstanceIds.length < holdsRequired) return null;

  const continuation: CommandPaymentContinuation = {
    type: "rush",
    zordMaterialInstanceId: materialInstanceId,
    zordMaterialDestination: materialDestination,
  };

  return {
    playerId,
    kind: "mothership_hold",
    sourceInstanceId: setup.zordInstanceId,
    sourceCardId: setup.zordCardId,
    eligibleNeeded: 0,
    totalNeeded: holdsRequired,
    validInstanceIds,
    continuation,
  };
}

function applyMothershipPaymentHolds(
  state: GameState,
  playerId: PlayerId,
  pending: PendingCommandPayment,
  commandInstanceIds: string[],
): GameState | null {
  const player = state.players[playerId];
  const kind = canUseMothershipForZordRush(
    state.definitions,
    player,
    pending.sourceCardId,
  );
  if (!kind) return null;
  const slotsFilled =
    pending.continuation.type === "rush" && pending.continuation.zordMaterialInstanceId
      ? zordSlotsFilledByMaterial(
          pending.sourceCardId,
          true,
          pending.continuation.zordMaterialDestination,
        )
      : 0;
  const holdsRequired = mothershipHoldsRequiredForRush(pending.sourceCardId, slotsFilled);
  if (
    !validateMothershipHolds(
      player,
      state.definitions,
      pending.sourceCardId,
      kind,
      commandInstanceIds,
      holdsRequired,
    )
  ) {
    return null;
  }
  const afterHolds = applyMothershipHolds(
    player,
    state.definitions,
    commandInstanceIds,
    kind,
  );
  if (!afterHolds) return null;
  return { ...state, players: { ...state.players, [playerId]: afterHolds } };
}

export function continueAfterMothershipPayment(
  state: GameState,
  pending: PendingCommandPayment,
  commandInstanceIds: string[],
): PendingCommandPayment | null {
  if (pending.continuation.type !== "rush") return null;
  const playerId = pending.playerId;
  const def = getDefinition(state.definitions, pending.sourceCardId);
  if (!def || !isRushable(def)) return null;

  const cont = pending.continuation;
  const player = state.players[playerId];
  if (
    canRushUnit(
      player,
      state.definitions,
      def,
      pending.sourceInstanceId,
      cont.zordMaterialInstanceId,
      commandInstanceIds,
      cont.zordMaterialDestination,
      undefined,
      { ...state, playerId },
    )
  ) {
    return null;
  }

  const categories = cardCategories(def);
  return buildCategoryPayment(
    state,
    playerId,
    pending.sourceInstanceId,
    pending.sourceCardId,
    categories,
    {
      type: "rush",
      zordMaterialInstanceId: cont.zordMaterialInstanceId,
      zordMaterialDestination: cont.zordMaterialDestination,
      zordMothershipHoldInstanceIds: commandInstanceIds,
    },
    false,
  );
}

export function buildPaymentFromInitiateAction(
  state: GameState,
  action: InitiateCommandPaymentAction,
): PendingCommandPayment | null {
  const playerId = action.playerId;

  if (action.kind === "effect_hold") {
    return buildEffectHoldPayment(state);
  }

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
  if (isRushable(def)) {
    if (
      !canRushUnitExceptCommandHold(
        player,
        state.definitions,
        def,
        handFound.card.instanceId,
        action.zordMaterialInstanceId,
        action.zordMothershipHoldInstanceIds,
        action.zordMaterialDestination,
        undefined,
        { ...state, playerId },
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
      { perRushPayment: true },
    );
  }

  if (def.type === "operation") {
    if (!canPlayOperationExceptCommandHold(state, playerId, def)) {
      return null;
    }

    const isCounter =
      getCardEffect(handFound.card.cardId)?.kind === "counter" &&
      isCounterReactionActive(state);
    if (isCounter) {
      if (!canInitiateCounterCategoryPayment(state, playerId, handFound.card.instanceId)) {
        return null;
      }
      const continuation: CommandPaymentContinuation = {
        type: "play_counter",
        substituteInstanceId: action.substituteInstanceId,
      };
      return buildCategoryPayment(
        state,
        playerId,
        handFound.card.instanceId,
        handFound.card.cardId,
        categories,
        continuation,
        action.prismSubstitute ?? false,
        { perRushPayment: true },
      );
    }

    if (needsOperationTarget(handFound.card.cardId)) {
      if (!action.targetInstanceId) return null;
      if (
        !isValidOperationTarget(
          state,
          playerId,
          handFound.card.cardId,
          action.targetInstanceId,
        )
      ) {
        return null;
      }
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
  if (state.pendingCommandPayment || state.pendingZordSetup) return false;
  if (state.winner) return false;
  if (action.kind === "effect_hold") {
    return state.pendingEffectChoice !== undefined && buildEffectHoldPayment(state) !== null;
  }
  if (buildPaymentFromInitiateAction(state, action) === null) return false;

  if (action.kind === "category_use" && state.phase === "rush") {
    const player = state.players[action.playerId];
    const handFound = findInZone(player, "hand", action.sourceInstanceId);
    if (handFound) {
      const def = getDefinition(state.definitions, handFound.card.cardId);
      if (
        def &&
        isUnit(def) &&
        needsZordMaterial(state.definitions, handFound.card.cardId) &&
        !requiresAllFusionPartners(handFound.card.cardId) &&
        canBeginZordSetup(state, action.playerId, action.sourceInstanceId)
      ) {
        return false;
      }
    }
  }

  if (action.kind === "category_use" && state.phase !== "rush") {
    const handFound = findInZone(state.players[action.playerId], "hand", action.sourceInstanceId);
    const isCounterPayment =
      !!handFound &&
      getCardEffect(handFound.card.cardId)?.kind === "counter" &&
      isCounterReactionActive(state);
    if (!isCounterPayment) return false;
  }
  if (action.kind === "battle_entry" && state.phase !== "battle") return false;

  return true;
}

export function isResolveCommandPaymentLegal(
  state: GameState,
  action: { playerId: PlayerId; commandInstanceIds: string[] },
): boolean {
  const pending = state.pendingCommandPayment;
  if (!pending || pending.playerId !== action.playerId) return false;
  if (validatePaymentSelection(state, pending, action.commandInstanceIds) !== null) {
    return false;
  }

  const resolved = applyCommandPaymentResolve(
    state,
    pending.playerId,
    pending,
    action.commandInstanceIds,
  );
  if ("error" in resolved) return false;
  if (resolved.nextPending) return true;

  const cont = pending.continuation;
  if (cont.type !== "rush") return true;

  const player = resolved.state.players[pending.playerId];
  const def = getDefinition(resolved.state.definitions, pending.sourceCardId);
  if (!def || !isRushable(def)) return false;

  const holdIds =
    pending.kind === "mothership_hold"
      ? action.commandInstanceIds
      : cont.zordMothershipHoldInstanceIds;

  return canRushUnitExceptCommandHold(
    player,
    resolved.state.definitions,
    def,
    pending.sourceInstanceId,
    cont.zordMaterialInstanceId,
    holdIds,
    cont.zordMaterialDestination,
    undefined,
    { ...resolved.state, playerId: pending.playerId },
  );
}

/** 手札ユニットをラッシュできない理由（人間が読める形式）。 */
export function explainCannotRush(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): string | null {
  if (state.phase !== "rush") {
    return "ラッシュフェイズではありません。";
  }

  const player = state.players[playerId];
  const found = player.hand.find((c) => c.instanceId === instanceId);
  if (!found) return null;

  const def = getDefinition(state.definitions, found.cardId);
  if (!def || !isRushable(def)) {
    return "このカードはラッシュできません。";
  }

  const categories = cardCategories(def);
  if (
    categories.length === 0 &&
    canRushUnitExceptCommandHold(
      player,
      state.definitions,
      def,
      instanceId,
      undefined,
      undefined,
      undefined,
      undefined,
      { ...state, playerId },
    )
  ) {
    return null;
  }
  if (
    isShironLightRushTarget(player, instanceId) &&
    canRushUnitExceptCommandHold(
      player,
      state.definitions,
      def,
      instanceId,
      undefined,
      undefined,
      undefined,
      undefined,
      { ...state, playerId },
    )
  ) {
    return null;
  }
  if (
    isCostWindowSatisfied(player, "rush_category") &&
    canRushUnitExceptCommandHold(
      player,
      state.definitions,
      def,
      instanceId,
      undefined,
      undefined,
      undefined,
      undefined,
      { ...state, playerId },
    )
  ) {
    return null;
  }

  const unitName = def.name;
  const cost = parsePowerCost(def.powerCost);
  const available = countAvailablePower(state, playerId);
  const effectiveCost = effectivePowerCost(state, playerId, cost);
  if (available < effectiveCost) {
    return `「${unitName}」をラッシュするにはパワー${effectiveCost}枚が必要です（現在${available}枚）。`;
  }

  const catLabel = formatCategories(categories);
  if (categories.length > 0 && !canPayRushCategoryHold(player, state.definitions, categories)) {
    return `「${unitName}」をラッシュするには${catLabel}のリリース状態のコマンドが必要ですが、ありません。`;
  }

  if (needsZordMaterial(state.definitions, def.id)) {
    if (requiresAllFusionPartners(def.id)) {
      if (
        !hasAllRequiredFusionMaterials(player, def.id, instanceId)
      ) {
        return `「${unitName}」をラッシュするには、必要な合体ユニットが揃っていません。`;
      }
    } else if (
      !canBeginZordSetup(state, playerId, instanceId) &&
      !hasLegalZordRush(state, playerId, instanceId)
    ) {
      return `「${unitName}」のゾード条件（素材または母艦の支払い）を満たしていません。`;
    }
  }

  if (
    categories.length > 0 &&
    !isCostWindowSatisfied(player, "rush_category") &&
    getCategoryPaymentOptions(state, playerId, categories, { perRushPayment: true })
  ) {
    return null;
  }

  if (categories.length > 0 && !hasCommandForCardUse(player, state.definitions, categories)) {
    const payment = getCategoryPaymentOptions(state, playerId, categories, {
      perRushPayment: true,
    });
    if (payment?.prismAvailable) {
      return `「${unitName}」をラッシュするには、リリース中の${catLabel}コマンドを1枚ホールドするか、【プリズムパワー】でリリース2枚をホールドしてください。`;
    }
    return `「${unitName}」をラッシュするには、リリース中の${catLabel}コマンドを1枚ホールドしてください。`;
  }

  return `「${unitName}」は今ラッシュできません。`;
}
